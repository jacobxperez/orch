/**
 * @license Apache License 2.0
 * @file orch/system/introspection/data.js
 * @title data
 * @description Safe developer-facing proxy for `createData` inside orch.wasm
 * @version 1.1.0
 */

import {kernel} from 'orch-kernel';

/**
 * Exposes current Orch orchestration metadata from context.
 *
 * Usage:
 *   data()
 *   data(ctx)
 *
 * @param {object} [ctx] - Optional Orch context
 * @returns {object} Runtime metadata with .data(), .status(), .error(), .perf()
 * @throws {TypeError} If arguments are invalid.
 */
export const data = Object.freeze(function data(ctx) {
    if (arguments.length > 1) {
        throw new TypeError('data() accepts at most 1 argument: ctx');
    }
    if (ctx !== undefined && ctx !== null && typeof ctx !== 'object') {
        throw new TypeError('data ctx must be an object, null, or undefined');
    }

    return kernel.call('createData', {ctx});
});
