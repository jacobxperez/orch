/**
 * @license Apache License 2.0
 * @file orch/system/runtime/loadOrchWasm.js
 * @title Orch WASM Loader
 * @description Resolves and loads the published browser or WASI Orch runtime artifacts without relying on the broader public proxy surface.
 * @version 0.2.1
 */

import {verifySealedArtifact} from './verifySealedArtifact.js';
import {buildRuntimeError} from './runtimeError.js';

const VALID_WASM_TARGETS = new Set(['browser', 'wasi']);

const ORCH_WASM_PATHS = Object.freeze({
    browser: new URL('../../public/wasm/orch.browser.wasm', import.meta.url).href,
    wasi: new URL('../../public/wasm/orch.wasi.wasm', import.meta.url).href,
});

function cmp(left, right) {
    const a = String(left);
    const b = String(right);
    return a < b ? -1 : a > b ? 1 : 0;
}

function isNodeRuntime(runtime = globalThis) {
    return !!runtime?.process?.versions?.node;
}

function normalizeWasmTarget(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    return VALID_WASM_TARGETS.has(normalized) ? normalized : null;
}

function resolveOrchWasmTarget(target, runtime = globalThis) {
    const explicit = normalizeWasmTarget(target);
    if (explicit) return explicit;

    const globalTarget = normalizeWasmTarget(runtime?.ORCH_WASM_TARGET);
    if (globalTarget) return globalTarget;

    const envTarget = normalizeWasmTarget(runtime?.process?.env?.ORCH_WASM_TARGET);
    if (envTarget) return envTarget;

    return isNodeRuntime(runtime) ? 'wasi' : 'browser';
}

function throwWithRuntimeError(runtimeError) {
    const err = new Error(runtimeError.message);
    err.name = 'OrchRuntimeError';
    err.runtimeError = runtimeError;
    err.code = runtimeError.code;
    throw err;
}

function normalizeWasmBytes(bytesLike) {
    if (bytesLike instanceof Uint8Array) return bytesLike;
    if (bytesLike instanceof ArrayBuffer) return new Uint8Array(bytesLike);
    if (ArrayBuffer.isView(bytesLike)) {
        return new Uint8Array(
            bytesLike.buffer,
            bytesLike.byteOffset,
            bytesLike.byteLength
        );
    }
    throw new TypeError('Expected WASM bytes as Uint8Array or ArrayBuffer');
}

function metaUrlFromWasmUrl(url) {
    return `${url}.meta.json`;
}

const ORCH_WASM_PATH = ORCH_WASM_PATHS[resolveOrchWasmTarget()];

async function listAvailableNodeTargets({paths, access, fileURLToPath}) {
    const available = [];

    for (const target of Object.keys(paths).sort(cmp)) {
        const url = paths[target];
        try {
            await access(fileURLToPath(url));
            available.push(target);
        } catch {}
    }

    return available;
}

async function resolveOrchWasmArtifact(options = {}) {
    const runtime = options.runtime ?? globalThis;
    const target = resolveOrchWasmTarget(options.target, runtime);
    const paths = options.paths ?? ORCH_WASM_PATHS;
    const url = paths?.[target];

    if (typeof url !== 'string' || url.length === 0) {
        throw new Error(`No published Orch WASM artifact configured for target "${target}".`);
    }

    if (isNodeRuntime(runtime)) {
        const {access} = options.access
            ? {access: options.access}
            : await import('node:fs/promises');
        const {fileURLToPath} = options.fileURLToPath
            ? {fileURLToPath: options.fileURLToPath}
            : await import('node:url');

        try {
            await access(fileURLToPath(url));
        } catch {
            const availableTargets = await listAvailableNodeTargets({
                paths,
                access,
                fileURLToPath,
            });
            const suffix =
                availableTargets.length > 0
                    ? ` Available published targets: ${availableTargets.join(', ')}.`
                    : ' No published targets are currently available.';
            throw new Error(
                `Missing published Orch WASM artifact for target "${target}" at ${url}.${suffix}`
            );
        }
    }

    return {target, url};
}

async function readNodeJson({url, readFile, fileURLToPath, target}) {
    try {
        const data = await readFile(fileURLToPath(url), 'utf8');
        const parsed = JSON.parse(data);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new TypeError('meta sidecar must decode to a plain object');
        }
        return parsed;
    } catch (err) {
        throwWithRuntimeError(
            buildRuntimeError({
                code: 'ERR_IO',
                message: `Failed to read Orch WASM meta sidecar for target "${target}" at ${url}: ${err.message}`,
                reason: 'invalid',
                kind: 'io',
                details: {target, url, operation: 'read-meta-sidecar'},
            })
        );
    }
}

async function readWebJson({url, fetchImpl, target}) {
    const response = await fetchImpl(url);
    if (!response.ok) {
        throwWithRuntimeError(
            buildRuntimeError({
                code: 'ERR_IO',
                message: `Failed to fetch Orch WASM meta sidecar for target "${target}" from ${url}: ${response.status} ${response.statusText}`,
                reason: 'invalid',
                kind: 'io',
                details: {target, url, status: response.status, operation: 'fetch-meta-sidecar'},
            })
        );
    }

    try {
        const parsed = await response.json();
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new TypeError('meta sidecar must decode to a plain object');
        }
        return parsed;
    } catch (err) {
        throwWithRuntimeError(
            buildRuntimeError({
                code: 'ERR_SCHEMA',
                message: `Failed to parse Orch WASM meta sidecar for target "${target}" from ${url}: ${err.message}`,
                reason: 'invalid',
                kind: 'configuration',
                details: {target, url, operation: 'parse-meta-sidecar'},
            })
        );
    }
}

async function verifyOrchWasmArtifact({wasmBytes, target, url, options, runtime, isNode}) {
    const verifyInput =
        options.verify && typeof options.verify === 'object' ? options.verify : {};
    const metaUrl = metaUrlFromWasmUrl(url);

    let meta;
    if (verifyInput.meta && typeof verifyInput.meta === 'object' && !Array.isArray(verifyInput.meta)) {
        meta = verifyInput.meta;
    } else if (isNode) {
        const {readFile} = options.readFile
            ? {readFile: options.readFile}
            : await import('node:fs/promises');
        const {fileURLToPath} = options.fileURLToPath
            ? {fileURLToPath: options.fileURLToPath}
            : await import('node:url');
        meta = await readNodeJson({url: metaUrl, readFile, fileURLToPath, target});
    } else {
        const fetchImpl = options.fetchImpl ?? runtime.fetch;
        if (typeof fetchImpl !== 'function') {
            throwWithRuntimeError(
                buildRuntimeError({
                    code: 'ERR_IO',
                    message: `Failed to verify Orch WASM for target "${target}": fetch is unavailable in this runtime`,
                    reason: 'invalid',
                    kind: 'io',
                    details: {target, operation: 'verify-load-meta'},
                })
            );
        }
        meta = await readWebJson({url: metaUrl, fetchImpl, target});
    }

    const result = await verifySealedArtifact({
        wasmBytes,
        meta,
        target,
        ...verifyInput,
    });

    if (!result?.ok) {
        const runtimeError =
            result?.error && typeof result.error === 'object'
                ? result.error
                : buildRuntimeError({
                      code: 'ERR_INTERNAL',
                      message: `Sealed artifact verification failed for target "${target}".`,
                      reason: 'internal',
                      kind: 'bug',
                      details: {target, url, operation: 'verify-sealed-artifact'},
                  });

        throwWithRuntimeError(runtimeError);
    }

    return result;
}

async function loadOrchWasm(imports = {}, options = {}) {
    const runtime = options.runtime ?? globalThis;
    const {target, url} = await resolveOrchWasmArtifact({
        ...options,
        runtime,
    });
    const isNode = isNodeRuntime(runtime);

    let wasmBuffer;

    if (isNode) {
        try {
            const {readFile} = options.readFile
                ? {readFile: options.readFile}
                : await import('node:fs/promises');
            const {fileURLToPath} = options.fileURLToPath
                ? {fileURLToPath: options.fileURLToPath}
                : await import('node:url');
            const wasmPath = fileURLToPath(url);
            wasmBuffer = await readFile(wasmPath);
        } catch (err) {
            throw new Error(
                `Failed to load Orch WASM for target "${target}" in Node.js: ${err.message}`
            );
        }
    } else {
        const fetchImpl = options.fetchImpl ?? runtime.fetch;
        if (typeof fetchImpl !== 'function') {
            throw new Error(
                `Failed to load Orch WASM for target "${target}": fetch is unavailable in this runtime`
            );
        }
        const response = await fetchImpl(url);
        if (!response.ok) {
            throw new Error(
                `Failed to load Orch WASM for target "${target}" from ${url}: ${response.status} ${response.statusText}`
            );
        }
        wasmBuffer = await response.arrayBuffer();
    }

    const wasmBytes = normalizeWasmBytes(wasmBuffer);

    if (options.verify) {
        await verifyOrchWasmArtifact({
            wasmBytes,
            target,
            url,
            options,
            runtime,
            isNode,
        });
    }

    try {
        const {instance} = await WebAssembly.instantiate(wasmBytes, imports);
        return instance;
    } catch (err) {
        throw new Error(
            `Failed to instantiate Orch WASM for target "${target}": ${err.message}`
        );
    }
}

export {
    ORCH_WASM_PATH,
    ORCH_WASM_PATHS,
    loadOrchWasm,
    resolveOrchWasmArtifact,
    resolveOrchWasmTarget,
};
