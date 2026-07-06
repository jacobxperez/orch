/**
 * @license Apache License 2.0
 * @file orch/system/proxies/effect.js
 * @title effect
 * @description Developer-facing proxy for `createEffect` inside orch.wasm. Validates args and forwards to the sealed kernel.
 * @version 2.0.0
 */

import {kernel} from 'orch-kernel';
import {admitNativeMutation} from '../runtime/localBoundary.js';

function isPlainOptions(value) {
    if (value === null || typeof value !== 'object') return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function validateOptions(options) {
    if (options === undefined) return;
    if (!isPlainOptions(options)) {
        throw new TypeError('effect options must be a plain object if provided');
    }
    for (const field of ['key', 'scope', 'description']) {
        if (options[field] !== undefined && typeof options[field] !== 'string') {
            throw new TypeError(`effect options.${field} must be a string`);
        }
    }
    if (options.autoRun !== undefined && typeof options.autoRun !== 'boolean') {
        throw new TypeError('effect options.autoRun must be a boolean');
    }
    for (const field of ['tags', 'dependsOn']) {
        if (
            options[field] !== undefined &&
            (!Array.isArray(options[field]) ||
                options[field].some((value) => typeof value !== 'string'))
        ) {
            throw new TypeError(`effect options.${field} must be an array of strings`);
        }
    }
    if (
        options.priority !== undefined &&
        typeof options.priority !== 'string' &&
        typeof options.priority !== 'number'
    ) {
        throw new TypeError('effect options.priority must be a string or number');
    }
}

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
export const effect = Object.freeze(function effect(...args) {
    if (args.length < 1 || args.length > 3) {
        throw new TypeError('effect() expects (fn), (fn, options), or (fn, options, ctx)');
    }
    const [fn, options, ctx] = args;
    if (typeof fn !== 'function') {
        throw new TypeError('effect() requires a function as first argument');
    }
    validateOptions(options);
    if (ctx !== undefined && (ctx === null || typeof ctx !== 'object')) {
        throw new TypeError('effect ctx must be an object if provided');
    }

    admitNativeMutation('effect');

    return kernel.call('createEffect', {fn, options, ctx});
});
