/**
 * @license Apache License 2.0
 * @file orch/system/proxies/effect.js
 * @title effect
 * @description Developer-facing proxy for `createEffect` inside orch.wasm. Validates args and forwards to the sealed kernel.
 * @version 1.1.0
 */

import {kernel} from 'orch-kernel';

/**
 * Registers a reactive effect that re-runs when dependencies change.
 *
 * Usage:
 *   effect(fn)
 *   effect(fn, options)
 *   effect(fn, options, ctx)
 *
 * @param {Function} fn - Effect function
 * @param {object} [options] - Optional config (key, scope, priority, description, dependsOn)
 * @param {object} [ctx] - Optional Orch context (advanced)
 * @returns {EffectNode} - Introspectable effect node from the sealed kernel
 * @throws {TypeError} If arguments are invalid.
 */
export const effect = Object.freeze(function effect(fn, options, ctx) {
    if (typeof fn !== 'function') {
        throw new TypeError('effect() requires a function as first argument');
    }
    if (options !== undefined && typeof options !== 'object') {
        throw new TypeError('effect options must be an object if provided');
    }
    if (ctx !== undefined && typeof ctx !== 'object') {
        throw new TypeError('effect ctx must be an object if provided');
    }

    return kernel.call('createEffect', {fn, options, ctx});
});
