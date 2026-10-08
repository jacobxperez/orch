/**
 * @license Apache License 2.0
 * @file orch/system/runtime/loadOrchWasm.js
 * @title Orch WASM Loader
 * @description Resolves and verifies published browser or WASI Orch runtime artifacts while keeping production instantiation behind private Runtime Core and canonical Host Adapter composition.
 * @version 1.1.0
 */

import {verifySealedArtifact} from './verifySealedArtifact.js';
import {buildRuntimeError} from './runtimeError.js';

const VALID_WASM_TARGETS = new Set(['browser', 'wasi']);
const NON_PRODUCTION_POSTURES = new Set(['bootstrap', 'development', 'test']);

const ORCH_WASM_PATHS = Object.freeze({
    browser: new URL('../../public/wasm/orch.browser.wasm', import.meta.url)
        .href,
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

function resolveRuntimePosture(value, runtime = globalThis) {
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (NON_PRODUCTION_POSTURES.has(normalized)) return normalized;
        if (normalized === 'production') return normalized;
    }

    const environment = runtime?.process?.env?.NODE_ENV;
    if (NON_PRODUCTION_POSTURES.has(environment)) return environment;

    return 'production';
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

    const envTarget = normalizeWasmTarget(
        runtime?.process?.env?.ORCH_WASM_TARGET
    );
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

function siblingUrl(url, filename) {
    return new URL(filename, url).href;
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
        throw new Error(
            `No published Orch WASM artifact configured for target "${target}".`
        );
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

async function readNodeJson({url, readFile, fileURLToPath, target, label}) {
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
                message: `Failed to read Orch WASM ${label} for target "${target}" at ${url}: ${err.message}`,
                reason: 'invalid',
                kind: 'io',
                details: {target, url, operation: `read-${label}`},
            })
        );
    }
}

async function readWebJson({url, fetchImpl, target, label}) {
    const response = await fetchImpl(url);
    if (!response.ok) {
        throwWithRuntimeError(
            buildRuntimeError({
                code: 'ERR_IO',
                message: `Failed to fetch Orch WASM ${label} for target "${target}" from ${url}: ${response.status} ${response.statusText}`,
                reason: 'invalid',
                kind: 'io',
                details: {
                    target,
                    url,
                    status: response.status,
                    operation: `fetch-${label}`,
                },
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
                message: `Failed to parse Orch WASM ${label} for target "${target}" from ${url}: ${err.message}`,
                reason: 'invalid',
                kind: 'configuration',
                details: {target, url, operation: `parse-${label}`},
            })
        );
    }
}

async function readJsonResource({
    url,
    options,
    runtime,
    isNode,
    target,
    label,
}) {
    if (isNode) {
        const {readFile} = options.readFile
            ? {readFile: options.readFile}
            : await import('node:fs/promises');
        const {fileURLToPath} = options.fileURLToPath
            ? {fileURLToPath: options.fileURLToPath}
            : await import('node:url');
        return readNodeJson({url, readFile, fileURLToPath, target, label});
    }

    const fetchImpl = options.fetchImpl ?? runtime.fetch;
    if (typeof fetchImpl !== 'function') {
        throwWithRuntimeError(
            buildRuntimeError({
                code: 'ERR_IO',
                message: `Failed to load Orch WASM ${label} for target "${target}": fetch is unavailable in this runtime`,
                reason: 'invalid',
                kind: 'io',
                details: {target, operation: `load-${label}`},
            })
        );
    }
    return readWebJson({url, fetchImpl, target, label});
}

async function sha256Hex(bytes, {runtime, isNode}) {
    if (runtime?.crypto?.subtle?.digest) {
        const digest = await runtime.crypto.subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(digest), (value) =>
            value.toString(16).padStart(2, '0')
        ).join('');
    }

    if (isNode) {
        const {createHash} = await import('node:crypto');
        return createHash('sha256').update(bytes).digest('hex');
    }

    throwWithRuntimeError(
        buildRuntimeError({
            code: 'ERR_CAPABILITY',
            message: 'Orch WASM verification requires SHA-256 support.',
            reason: 'policy',
            kind: 'security',
            details: {operation: 'verify-public-build-meta'},
        })
    );
}

function derivePublicMeta(buildMeta, target, url) {
    const targetMeta = buildMeta?.targets?.[target];
    const expectedFilename = new URL(url).pathname.split('/').pop();
    if (
        buildMeta?.schema !== 'orch.public-wasm-build-meta/v1' ||
        buildMeta?.kernel !== 'as' ||
        buildMeta?.sourceMap !== false ||
        !targetMeta ||
        targetMeta.file !== expectedFilename ||
        typeof targetMeta.previewTarget !== 'string' ||
        typeof targetMeta.sha256 !== 'string' ||
        typeof buildMeta.version !== 'string'
    ) {
        throwWithRuntimeError(
            buildRuntimeError({
                code: 'ERR_SCHEMA',
                message: `Invalid public Orch WASM build metadata for target "${target}".`,
                reason: 'invalid',
                kind: 'configuration',
                details: {target, operation: 'validate-public-build-meta'},
            })
        );
    }

    return {
        expectedSha256: targetMeta.sha256,
        meta: {
            abi: buildMeta.abi,
            abiHash: buildMeta.abiHash,
            previewTarget: targetMeta.previewTarget,
            version: buildMeta.version,
        },
    };
}

async function verifyOrchWasmArtifact({
    wasmBytes,
    target,
    url,
    options,
    runtime,
    isNode,
}) {
    const verifyInput =
        options.verify && typeof options.verify === 'object'
            ? options.verify
            : {};

    let meta;
    let releaseManifest = verifyInput.releaseManifest ?? null;
    if (
        verifyInput.meta &&
        typeof verifyInput.meta === 'object' &&
        !Array.isArray(verifyInput.meta)
    ) {
        meta = verifyInput.meta;
    } else {
        const buildMetaUrl = siblingUrl(url, 'build-meta.json');
        const buildMeta = await readJsonResource({
            url: buildMetaUrl,
            options,
            runtime,
            isNode,
            target,
            label: 'build metadata',
        });
        const publicMeta = derivePublicMeta(buildMeta, target, url);
        const actualSha256 = await sha256Hex(wasmBytes, {runtime, isNode});
        if (actualSha256 !== publicMeta.expectedSha256) {
            throwWithRuntimeError(
                buildRuntimeError({
                    code: 'ERR_SCHEMA',
                    message: `Public Orch WASM SHA-256 mismatch for target "${target}".`,
                    reason: 'invalid',
                    kind: 'configuration',
                    details: {
                        target,
                        expected: publicMeta.expectedSha256,
                        actual: actualSha256,
                        operation: 'verify-public-build-meta',
                    },
                })
            );
        }
        meta = publicMeta.meta;
        if (verifyInput.releaseManifest === undefined) {
            releaseManifest = await readJsonResource({
                url: siblingUrl(url, 'orch.release.json'),
                options,
                runtime,
                isNode,
                target,
                label: 'release manifest',
            });
        }
    }

    const result = await verifySealedArtifact({
        wasmBytes,
        meta,
        target,
        allowWasi: target === 'wasi',
        releaseManifest,
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
                      details: {
                          target,
                          url,
                          operation: 'verify-sealed-artifact',
                      },
                  });

        throwWithRuntimeError(runtimeError);
    }

    return result;
}

async function loadOrchWasmArtifact(options = {}) {
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

    let verification = null;
    if (options.verify) {
        verification = await verifyOrchWasmArtifact({
            wasmBytes,
            target,
            url,
            options,
            runtime,
            isNode,
        });
    }

    return Object.freeze({
        previewTarget:
            verification?.fingerprintPayload?.previewTarget ??
            verification?.target ??
            null,
        target,
        url,
        verification,
        wasmBytes,
    });
}

async function loadOrchWasm(imports = {}, options = {}) {
    const runtime = options.runtime ?? globalThis;
    const posture = resolveRuntimePosture(options.posture, runtime);
    if (!NON_PRODUCTION_POSTURES.has(posture)) {
        throwWithRuntimeError(
            buildRuntimeError({
                code: 'ERR_CAPABILITY',
                message:
                    'Direct public WASM instantiation is unavailable in production; Runtime Core canonical Host Adapter composition is required.',
                reason: 'policy',
                kind: 'security',
                details: {
                    posture,
                    operation: 'forbidden-production-fallback',
                },
            })
        );
    }

    const artifact = await loadOrchWasmArtifact(options);

    try {
        const {instance} = await WebAssembly.instantiate(
            artifact.wasmBytes,
            imports
        );
        return instance;
    } catch (err) {
        throw new Error(
            `Failed to instantiate Orch WASM for target "${artifact.target}": ${err.message}`
        );
    }
}

export {
    ORCH_WASM_PATH,
    ORCH_WASM_PATHS,
    loadOrchWasm,
    loadOrchWasmArtifact,
    resolveOrchWasmArtifact,
    resolveOrchWasmTarget,
    resolveRuntimePosture,
};
