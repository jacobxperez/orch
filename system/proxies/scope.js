/**
 * @license Apache License 2.0
 * @file orch/system/proxies/scope.js
 * @title scope
 * @description Developer-facing proxy for `createScope` inside orch.wasm. Validates args and forwards to the sealed kernel.
 * @version 1.1.0
 */

import {kernel} from 'orch-kernel';

/**
 * Creates a reactive execution scope.
 * All lifecycle-aware primitives must run within a scope.
 *
 * Usage:
 *   await scope(name, fn)
 *   await scope(name, options)
 *   await scope(name, options, fn)
 *   await scope(ctx, name, optionsOrFn, maybeFn)
 *
 * @param {string|object} nameOrCtx - Scope name string, or Orch context
 * @param {any} [optionsOrFn] - Setup fn or options object
 * @param {Function} [maybeFn] - Optional setup function if options passed
 * @param {object} [ctx] - Optional Orch context
 * @returns {Promise<ScopeNode>} Introspectable scope node
 * @throws {TypeError} If arguments are invalid
 */
export const scope = Object.freeze(async function scope(...args) {
    let ctx, name, optionsOrFn, maybeFn;

    if (
        args.length === 2 &&
        typeof args[0] === 'string' &&
        typeof args[1] === 'function'
    ) {
        [name, optionsOrFn] = args;
    } else if (
        args.length === 2 &&
        typeof args[0] === 'string' &&
        typeof args[1] === 'object'
    ) {
        [name, optionsOrFn] = args;
    } else if (
        args.length === 3 &&
        typeof args[0] === 'string' &&
        typeof args[1] === 'object' &&
        typeof args[2] === 'function'
    ) {
        [name, optionsOrFn, maybeFn] = args;
    } else if (args.length === 4 && typeof args[0] === 'object') {
        [ctx, name, optionsOrFn, maybeFn] = args;
    } else {
        throw new TypeError(
            'scope() expects (name, fn), (name, options), (name, options, fn), or (ctx, name, optionsOrFn, maybeFn)'
        );
    }

    if (typeof name !== 'string') {
        throw new TypeError('scope name must be a string');
    }
    if (maybeFn !== undefined && typeof maybeFn !== 'function') {
        throw new TypeError(
            'scope setup function must be callable if provided'
        );
    }
    if (ctx !== undefined && typeof ctx !== 'object') {
        throw new TypeError('scope ctx must be an object if provided');
    }

    return kernel.call('createScope', {name, optionsOrFn, maybeFn, ctx});
});
