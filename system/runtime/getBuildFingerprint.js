/**
 * @license Apache License 2.0
 * @file orch/system/runtime/getBuildFingerprint.js
 * @title WASM Build Fingerprint Reader
 * @description Reads the embedded "orch.fingerprint" custom section from published Orch WASM artifacts and returns the DVA fingerprint.
 * @version 1.2.2
 */

import {resolveOrchWasmArtifact} from './loadOrchWasm.js';
import {readFingerprintPayload} from './verifySealedArtifact.js';

function isNodeRuntime(runtime = globalThis) {
    return !!runtime?.process?.versions?.node;
}

function selectFingerprint(payload) {
    const fingerprint = payload?.dva?.fingerprint;
    if (typeof fingerprint !== 'string' || fingerprint.length === 0) {
        throw new Error(
            'Invalid orch.fingerprint payload: missing string payload.dva.fingerprint'
        );
    }
    return fingerprint;
}

async function readWasmBytesForResolvedArtifact({
    url,
    runtime,
    fetchImpl,
    readFileImpl,
    fileURLToPathImpl,
}) {
    if (isNodeRuntime(runtime)) {
        const readFile =
            readFileImpl ?? (await import('node:fs/promises')).readFile;
        const fileURLToPath =
            fileURLToPathImpl ?? (await import('node:url')).fileURLToPath;
        return readFile(fileURLToPath(url));
    }

    const fetchFn = fetchImpl ?? runtime?.fetch;
    if (typeof fetchFn !== 'function') {
        throw new Error('Cannot read Orch WASM artifact: fetch is unavailable');
    }

    const response = await fetchFn(url);
    if (!response.ok) {
        throw new Error(
            `Failed to fetch Orch WASM artifact from ${url}: ${response.status} ${response.statusText}`
        );
    }

    return new Uint8Array(await response.arrayBuffer());
}

async function getFingerprintPayload(options = {}) {
    const runtime = options.runtime ?? globalThis;
    const {url} = await resolveOrchWasmArtifact({...options, runtime});
    const wasmBytes = await readWasmBytesForResolvedArtifact({
        url,
        runtime,
        fetchImpl: options.fetchImpl,
        readFileImpl: options.readFile,
        fileURLToPathImpl: options.fileURLToPath,
    });
    return readFingerprintPayload(wasmBytes);
}

async function fetchWasmFingerprint(wasmUrl, options = {}) {
    const runtime = options.runtime ?? globalThis;
    const fetchFn = options.fetchImpl ?? runtime?.fetch;

    if (typeof fetchFn !== 'function') {
        throw new Error(
            'Cannot fetch Orch WASM fingerprint: fetch is unavailable'
        );
    }

    if (typeof wasmUrl !== 'string' || wasmUrl.length === 0) {
        throw new TypeError(
            'fetchWasmFingerprint(wasmUrl): wasmUrl must be a non-empty string'
        );
    }

    const response = await fetchFn(wasmUrl);
    if (!response.ok) {
        throw new Error(
            `Failed to fetch Orch WASM artifact from ${wasmUrl}: ${response.status} ${response.statusText}`
        );
    }

    const payload = readFingerprintPayload(
        new Uint8Array(await response.arrayBuffer())
    );
    return selectFingerprint(payload);
}

async function getBuildFingerprint(options = {}) {
    const payload = await getFingerprintPayload(options);
    return selectFingerprint(payload);
}

export {
    fetchWasmFingerprint,
    getBuildFingerprint,
    getFingerprintPayload,
    readFingerprintPayload,
};

export default getBuildFingerprint;
