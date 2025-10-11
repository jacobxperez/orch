/**
 * @license Apache License 2.0
 * @file orch/system/runtime/index.js
 * @title Orch Runtime API
 * @description Public runtime-level utilities for Orch.
 * @version 1.0.0
 */

import {
    getBuildFingerprint,
    fetchWasmFingerprint,
} from './getBuildFingerprint.js';

export const runtime = Object.freeze({
    /**
     * Reads build fingerprint (Node.js).
     */
    buildFingerprint() {
        return getBuildFingerprint();
    },

    /**
     * Reads build fingerprint in the browser (via fetch).
     */
    async buildFingerprintBrowser(url) {
        return await fetchWasmFingerprint(url);
    },
});
