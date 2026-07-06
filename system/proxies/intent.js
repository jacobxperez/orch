/**
 * @license Apache License 2.0
 * @file orch/system/proxies/intent.js
 * @title intent
 * @description Developer-facing intent primitive proxy. Validates args and forwards the spec-owned K_INTENT_* operations to the sealed kernel.
 * @version 1.2.0
 */

import {kernel} from 'orch-kernel';
import {admitNativeMutation} from '../runtime/localBoundary.js';

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

    admitNativeMutation('intent');

    const id = kernel.call('K_INTENT_CREATE', {
        ctx,
        humanPath: config.key,
        initial: config.initial,
        config,
    });

    return Object.freeze({
        set: (next) => {
            admitNativeMutation('intent');
            return kernel.call('K_INTENT_SET', {id, next});
        },
        get: () => kernel.call('K_INTENT_GET', {id}),
        clear: () => {
            admitNativeMutation('intent');
            return kernel.call('K_INTENT_CLEAR', {id});
        },
        status: () => kernel.call('K_INTENT_STATUS', {id}),
        error: () => kernel.call('K_INTENT_ERROR', {id}),
        errors: () => kernel.call('K_INTENT_ERRORS', {id}),
        data: () => kernel.call('K_INTENT_DATA', {id}),
        perf: () => kernel.call('K_INTENT_PERF', {id}),
    });
});
