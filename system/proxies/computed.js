/**
 * @license Apache License 2.0
 * @file orch/system/proxies/computed.js
 * @title computed
 * @description Developer-facing proxy for `createComputed` inside orch.wasm. Validates args and forwards to the sealed kernel.
 * @version 1.1.0
 */

import {kernel} from 'orch-kernel';

/**
 * Creates a memoized reactive computation.
 * Re-evaluates only when dependencies change.
 *
 * Usage:
 *   computed(fn)
 *   computed(fn, key)
 *   computed(fn, key, ctx)
 *
 * @param {Function} fn - Computation function (sync or async).
 * @param {string} [key] - Optional debug key.
 * @param {object} [ctx] - Optional Orch context (advanced).
 * @returns {ComputedSignal} - Introspectable computed node from the sealed kernel.
 * @throws {TypeError} If arguments are invalid.
 */
export const computed = Object.freeze(function computed(fn, key, ctx) {
    if (typeof fn !== 'function') {
        throw new TypeError('computed() requires a function as first argument');
    }
    if (key !== undefined && typeof key !== 'string') {
        throw new TypeError('computed key must be a string if provided');
    }
    if (ctx !== undefined && typeof ctx !== 'object') {
        throw new TypeError('computed ctx must be an object if provided');
    }

    return kernel.call('createComputed', {fn, key, ctx});
});
