/**
 * @license Apache License 2.0
 * @file orch/system/runtime/getBuildFingerprint.js
 * @title WASM Build Fingerprint Reader
 * @description Reads the embedded "orch_build" custom section from orch.wasm and returns the JSON fingerprint.
 * @version 1.2.0
 */

const normalizeVersion = (v) =>
    typeof v === 'string' && v.startsWith('v') ? v.slice(1) : v;

// ──────────────────────────────────────────────────────────────
// Node.js version — only imported in CLI/build contexts
// ──────────────────────────────────────────────────────────────
let getBuildFingerprintNode = null;
if (typeof process !== 'undefined' && process.versions?.node) {
    getBuildFingerprintNode = function () {
        try {
            const {readFileSync} = require('node:fs');
            const {resolve} = require('node:path');
            // Resolve relative to the current file to avoid ci/config import
            const orchRoot = resolve(__dirname, '../../..');
            const wasmPath = resolve(orchRoot, 'public', 'wasm', 'orch.wasm');

            const buffer = readFileSync(wasmPath);
            const sectionName = 'orch_build';
            const sectionNameBytes = Buffer.from(sectionName, 'utf8');

            const idx = buffer.indexOf(sectionNameBytes);
            if (idx === -1) {
                return null; // not found
            }

            const jsonStart = idx + sectionNameBytes.length;
            const jsonText = buffer.slice(jsonStart).toString('utf8').trim();
            const parsed = JSON.parse(jsonText.replace(/\0+$/, ''));

            if (parsed?.version) {
                parsed.version = normalizeVersion(parsed.version);
            }
            return parsed;
        } catch (err) {
            console.error(
                '[Orch] Failed to read build fingerprint:',
                err.message
            );
            return null;
        }
    };
}

// ──────────────────────────────────────────────────────────────
// Browser / WASM version — always safe
// ──────────────────────────────────────────────────────────────
export async function fetchWasmFingerprint(wasmUrl = '/wasm/orch.wasm') {
    try {
        const res = await fetch(wasmUrl);
        const buffer = new Uint8Array(await res.arrayBuffer());

        const sectionName = 'orch_build';
        const sectionNameBytes = new TextEncoder().encode(sectionName);

        let idx = -1;
        for (let i = 0; i < buffer.length - sectionNameBytes.length; i++) {
            let match = true;
            for (let j = 0; j < sectionNameBytes.length; j++) {
                if (buffer[i + j] !== sectionNameBytes[j]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                idx = i;
                break;
            }
        }
        if (idx === -1) return null;

        const jsonStart = idx + sectionNameBytes.length;
        const jsonText = new TextDecoder()
            .decode(buffer.slice(jsonStart))
            .trim();
        const parsed = JSON.parse(jsonText.replace(/\0+$/, ''));

        if (parsed?.version) {
            parsed.version = normalizeVersion(parsed.version);
        }
        return parsed;
    } catch (err) {
        console.error('[Orch] Failed to fetch build fingerprint:', err.message);
        return null;
    }
}

// ──────────────────────────────────────────────────────────────
// Unified export — chooses best version automatically
// ──────────────────────────────────────────────────────────────
export async function getBuildFingerprint() {
    if (getBuildFingerprintNode) {
        // Node environment
        return getBuildFingerprintNode();
    }
    // Browser / WASM
    return fetchWasmFingerprint();
}
