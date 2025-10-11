/**
 * @license Apache License 2.0
 * @file orch/system/proxies/fetch.js
 * @title fetch
 * @description Developer-facing proxy for `createFetch` inside orch.wasm. Validates args and forwards to the sealed kernel.
 * @version 1.1.0
 */

import {kernel} from 'orch-kernel';

/**
 * Reactive fetch orchestration primitive.
 *
 * Usage:
 *   fetch(config)
 *   fetch(ctx, config)
 *
 * @param {object|string} config - Fetch config or URL string (if no ctx)
 * @param {object} [ctx] - Optional Orch context
 * @returns {FetchSignalAccessor} Introspectable accessor from sealed kernel
 * @throws {TypeError} If arguments are invalid.
 */
export const fetch = Object.freeze(function fetch(...args) {
    let ctx, config;

    if (args.length === 1) {
        config = args[0];
    } else if (args.length === 2) {
        [ctx, config] = args;
    } else {
        throw new TypeError(
            'fetch() expects either 1 or 2 arguments: (config) or (ctx, config)'
        );
    }

    const type = typeof config;
    if (config === null || (type !== 'string' && type !== 'object')) {
        throw new TypeError('fetch config must be a string or an object');
    }
    if (ctx !== undefined && typeof ctx !== 'object') {
        throw new TypeError('fetch ctx must be an object if provided');
    }

    return kernel.call('createFetch', {ctx, config});
});
