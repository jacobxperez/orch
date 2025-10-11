/**
 * @license Apache License 2.0
 * @file orch/system/introspection/introspect.js
 * @title introspect
 * @description Developer-facing proxy for `createIntrospect` inside orch.wasm. Validates args and forwards to the sealed kernel.
 * @version 1.1.0
 */

import {kernel} from 'orch-kernel';

/**
 * Returns the Orch introspection API for scopes, graph, and plugins.
 *
 * Usage:
 *   introspect()
 *   introspect(ctx)
 *
 * @param {object} [ctx] - Optional Orch context
 * @returns {object} Introspection interface with .data(), .status(), .error(), .perf()
 * @throws {TypeError} If arguments are invalid.
 */
export const introspect = Object.freeze(function introspect(ctx) {
    if (arguments.length > 1) {
        throw new TypeError('introspect() accepts at most 1 argument: ctx');
    }
    if (ctx !== undefined && ctx !== null && typeof ctx !== 'object') {
        throw new TypeError(
            'introspect ctx must be an object, null, or undefined'
        );
    }

    return kernel.call('createIntrospect', {ctx});
});
