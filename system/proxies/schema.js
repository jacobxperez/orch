/**
 * @license Apache License 2.0
 * @file orch/system/proxies/schema.js
 * @title schema
 * @description Developer-facing proxy for `createSchema` inside orch.wasm. Validates args and forwards to the sealed kernel.
 * @version 1.1.0
 */

import {kernel} from 'orch-kernel';

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
    if (options !== undefined && typeof options !== 'object') {
        throw new TypeError('schema options must be an object if provided');
    }
    if (ctx !== undefined && typeof ctx !== 'object') {
        throw new TypeError('schema ctx must be an object if provided');
    }

    return kernel.call('createSchema', {schemaConfig: config, options, ctx});
});
