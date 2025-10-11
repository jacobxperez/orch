/**
 * @license Apache License 2.0
 * @file orch/system/proxies/state.js
 * @title state
 * @description Developer-facing proxy for `createState` inside orch.wasm. Validates args and forwards to the sealed kernel.
 * @version 1.1.0
 */

import {kernel} from 'orch-kernel';

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
        options !== undefined &&
        (typeof options !== 'object' || Array.isArray(options))
    ) {
        throw new TypeError('state options must be a plain object if provided');
    }
    if (ctx !== undefined && typeof ctx !== 'object') {
        throw new TypeError('state ctx must be an object if provided');
    }

    return kernel.call('createState', {
        initialValue: initial,
        options,
        ctx, // ← standardized payload key
    });
});
