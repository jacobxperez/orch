/**
 * @license Apache License 2.0
 * @file orch/system/proxies/state.js
 * @title state
 * @description Developer-facing proxy for `createState` inside orch.wasm. Validates args and forwards to the sealed kernel.
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
        throw new TypeError('state options must be a plain object if provided');
    }
    for (const field of ['key', 'scope', 'label']) {
        if (options[field] !== undefined && typeof options[field] !== 'string') {
            throw new TypeError(`state options.${field} must be a string`);
        }
    }
    for (const field of ['required', 'skipValidation']) {
        if (options[field] !== undefined && typeof options[field] !== 'boolean') {
            throw new TypeError(`state options.${field} must be a boolean`);
        }
    }
    const hooks = options.validate;
    if (
        hooks !== undefined &&
        typeof hooks !== 'function' &&
        (!Array.isArray(hooks) || hooks.some((hook) => typeof hook !== 'function'))
    ) {
        throw new TypeError('state options.validate must be a function or array of functions');
    }
}

/**
 * Declares a reactive state signal.
 *
 * Usage:
 *   state(initial)
 *   state(initial, options)
 *   state(ctx, initial, options)
 *
 * @param {any} initial - Initial signal value
 * @param {object} [options] - Optional state configuration
 * @param {object} [ctx] - Optional Orch context (advanced)
 * @returns {StateNode} Introspectable state node
 * @throws {TypeError} If arguments are invalid.
 */
export const state = Object.freeze(function state(...args) {
    let ctx, initial, options;

    if (args.length === 1) {
        [initial] = args;
    } else if (args.length === 2) {
        [initial, options] = args;
    } else if (args.length === 3) {
        [ctx, initial, options] = args;
    } else {
        throw new TypeError(
            'state() expects (initial), (initial, options), or (ctx, initial, options)'
        );
    }

    if (
        args.length === 1 &&
        isPlainOptions(initial) &&
        Object.prototype.hasOwnProperty.call(initial, 'initialValue') &&
        (Object.prototype.hasOwnProperty.call(initial, 'options') ||
            Object.prototype.hasOwnProperty.call(initial, 'ctx'))
    ) {
        throw new TypeError('state() does not accept an owner payload object');
    }
    validateOptions(options);
    if (ctx !== undefined && (ctx === null || typeof ctx !== 'object')) {
        throw new TypeError('state ctx must be an object if provided');
    }

    admitNativeMutation('state');

    return kernel.call('createState', {
        initialValue: initial,
        options,
        ctx, // ← standardized payload key
    });
});
