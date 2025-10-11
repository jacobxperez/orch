/**
 * @license Apache License 2.0
 * @file orch/system/proxies/intent.js
 * @title intent
 * @description Developer-facing proxy for `createIntent` inside orch.wasm. Validates args and forwards to the sealed kernel.
 * @version 1.1.0
 */

import {kernel} from 'orch-kernel';

/**
 * Declares a cognitive intent — a runtime goal or behavior to be fulfilled.
 * Often used with agents or dynamic orchestration contexts.
 *
 * Usage:
 *   intent(config)
 *   intent(ctx, config)
 *
 * @param {object} config - Intent configuration ({ key?, initial? })
 * @param {object} [ctx] - Optional Orch context
 * @returns {IntentNode} Introspectable intent signal
 * @throws {TypeError} If arguments are invalid.
 */
export const intent = Object.freeze(function intent(...args) {
    let ctx, config;

    if (args.length === 1) {
        config = args[0];
    } else if (args.length === 2) {
        [ctx, config] = args;
    } else {
        throw new TypeError('intent() expects (config) or (ctx, config)');
    }

    if (
        config === null ||
        typeof config !== 'object' ||
        Array.isArray(config)
    ) {
        throw new TypeError('intent config must be a plain object');
    }
    if (ctx !== undefined && typeof ctx !== 'object') {
        throw new TypeError('intent ctx must be an object if provided');
    }

    return kernel.call('createIntent', {ctx, config});
});
