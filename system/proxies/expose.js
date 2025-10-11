/**
 * @license Apache License 2.0
 * @file orch/system/proxies/expose.js
 * @title expose
 * @description Developer-facing proxy for `createExpose` inside orch.wasm. Validates args and forwards to the sealed kernel.
 * @version 1.1.0
 */

import {kernel} from 'orch-kernel';

/**
 * Exposes reactive bindings with introspectable metadata.
 *
 * Usage:
 *   await expose(bindings)
 *   await expose(bindings, ctx)
 *
 * @param {object} bindings - Reactive signals or functions to expose.
 * @param {object} [ctx] - Optional Orch context.
 * @returns {Promise<object>} Introspectable proxy with .data(), .error(), .status(), .perf()
 * @throws {TypeError} If arguments are invalid.
 */
export const expose = Object.freeze(async function expose(bindings, ctx) {
    if (
        bindings === null ||
        typeof bindings !== 'object' ||
        Array.isArray(bindings)
    ) {
        throw new TypeError(
            'expose() requires a plain object as first argument'
        );
    }
    if (ctx !== undefined && typeof ctx !== 'object') {
        throw new TypeError('expose ctx must be an object if provided');
    }

    return kernel.call('createExpose', {bindings, ctx});
});
