/**
 * @license Apache License 2.0
 * @file orch/system/proxies/unmount.js
 * @title unmount
 * @description Developer-facing proxy for `createUnmount` inside orch.wasm. Validates args and forwards to the sealed kernel.
 * @version 1.1.0
 */

import {kernel} from 'orch-kernel';

/**
 * Unmounts a scope by name, tearing down its bindings and removing it
 * from the orchestration graph and DOM.
 *
 * Usage:
 *   unmount(name)
 *   unmount(ctx, name)
 *
 * @param {object|string} ctxOrName - Scope name string, or Orch context
 * @param {string} [name] - Scope name if ctx provided
 * @returns {UnmountNode} Introspectable unmount node
 * @throws {TypeError} If arguments are invalid.
 */
export const unmount = Object.freeze(function unmount(...args) {
    let ctx, name;

    if (args.length === 1) {
        [name] = args;
    } else if (args.length === 2) {
        [ctx, name] = args;
    } else {
        throw new TypeError('unmount() expects (name) or (ctx, name)');
    }

    if (typeof name !== 'string' || !name.trim()) {
        throw new TypeError('unmount name must be a non-empty string');
    }
    if (ctx !== undefined && typeof ctx !== 'object') {
        throw new TypeError('unmount ctx must be an object if provided');
    }

    return kernel.call('createUnmount', {ctx, name});
});
