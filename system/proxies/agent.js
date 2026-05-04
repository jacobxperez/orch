/**
 * @license Apache License 2.0
 * @file orch/system/proxies/agent.js
 * @title agent
 * @description Developer-facing proxy for `createAgent` inside orch.wasm. Validates the public agent call shape and forwards to the sealed kernel.
 * @version 1.1.1
 */

import {kernel} from 'orch-kernel';
import {admitNativeMutation} from '../runtime/localBoundary.js';

/**
 * Usage:
 *   agent(name, setupFn)
 *   agent(name, setupFn, options)
 *   agent(ctx, name, setupFn)
 *   agent(ctx, name, setupFn, options)
 */
export const agent = Object.freeze(function agent(...args) {
    let ctx;
    let name;
    let setupFn;
    let options;

    if (args.length === 2) {
        [name, setupFn] = args;
    } else if (args.length === 3) {
        if (args[0] !== null && typeof args[0] === 'object') {
            [ctx, name, setupFn] = args;
        } else {
            [name, setupFn, options] = args;
        }
    } else if (args.length === 4) {
        [ctx, name, setupFn, options] = args;
    } else {
        throw new TypeError(
            'agent() expects (name, setupFn), (name, setupFn, options), (ctx, name, setupFn), or (ctx, name, setupFn, options)'
        );
    }

    if (typeof name !== 'string' || name.trim().length === 0) {
        throw new TypeError('agent name must be a non-empty string');
    }
    if (typeof setupFn !== 'function') {
        throw new TypeError('agent setupFn must be callable');
    }
    if (
        options !== undefined &&
        (options === null || typeof options !== 'object' || Array.isArray(options))
    ) {
        throw new TypeError('agent options must be a plain object if provided');
    }
    if (ctx !== undefined && ctx !== null && typeof ctx !== 'object') {
        throw new TypeError('agent ctx must be an object, null, or undefined');
    }

    admitNativeMutation('agent');

    return kernel.call('createAgent', {ctx, name, setupFn, options});
});
