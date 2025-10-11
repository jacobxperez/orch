/**
 * @license Apache License 2.0
 * @file orch/system/proxies/route.js
 * @title route
 * @description Developer-facing proxy for `createRoute` inside orch.wasm. Validates args and forwards to the sealed kernel.
 * @version 1.1.0
 */

import {kernel} from 'orch-kernel';

/**
 * Declares a reactive route signal.
 * Must be called within a scope() for lifecycle safety.
 *
 * Usage:
 *   route()         // uses default context
 *   route(ctx)      // explicit context
 *
 * @param {object} [ctx] - Optional Orch context
 * @returns {RouteSignal} Introspectable route signal node
 * @throws {TypeError} If ctx is invalid.
 */
export const route = Object.freeze(function route(ctx) {
    if (arguments.length > 1) {
        throw new TypeError('route() accepts at most 1 argument: ctx');
    }
    if (ctx !== undefined && typeof ctx !== 'object') {
        throw new TypeError('route ctx must be an object if provided');
    }

    return kernel.call('createRoute', {ctx});
});
