/**
 * @license Apache License 2.0
 * @file orch/system/proxies/schema.js
 * @title schema
 * @description Developer-facing proxy for `createSchema` inside orch.wasm. Validates args and forwards to the sealed kernel.
 * @version 1.1.1
 */

import {kernel} from 'orch-kernel';
import {admitNativeMutation} from '../runtime/localBoundary.js';

/**
 * Defines a reactive validation schema.
 * Used for form state, component props, and structure-safe orchestration.
 *
 * Usage:
 *   schema(config)
 *   schema(config, options)
 *   schema(ctx, config, options)
 *
 * @param {object} config - Schema configuration (field definitions)
 * @param {object} [options] - Optional configuration (scope, scheduler, errorManager, etc.)
 * @param {object} [ctx] - Optional Orch context (advanced)
 * @returns {SchemaNode} - Introspectable schema node from sealed kernel
 * @throws {TypeError} If arguments are invalid.
 */
export const schema = Object.freeze(function schema(...args) {
    let ctx, config, options;

    if (args.length === 1) {
        [config] = args;
    } else if (args.length === 2) {
        [config, options] = args;
    } else if (args.length === 3) {
        [ctx, config, options] = args;
    } else {
        throw new TypeError(
            'schema() expects (config), (config, options), or (ctx, config, options)'
        );
    }

    if (
        config === null ||
        typeof config !== 'object' ||
        Array.isArray(config)
    ) {
        throw new TypeError('schema config must be a plain object');
    }
    if (
        options !== undefined &&
        (typeof options !== 'object' || Array.isArray(options))
    ) {
        throw new TypeError('schema options must be a plain object if provided');
    }
    if (ctx !== undefined && typeof ctx !== 'object') {
        throw new TypeError('schema ctx must be an object if provided');
    }

    admitNativeMutation('schema');

    // Preserve the public schema() entrypoint while forwarding through the
    // state-family payload shape behind the existing compatibility op name.
    return kernel.call('createSchema', {initialValue: config, options, ctx});
});
