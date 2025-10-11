/**
 * @license Apache License 2.0
 * @file orch/system/proxies/style.js
 * @title style
 * @description Developer-facing proxy for `createStyle` inside orch.wasm. Validates args and forwards to the sealed kernel.
 * @version 1.1.0
 */

import {kernel} from 'orch-kernel';

/**
 * Declares a reactive style instance with introspectable fields.
 *
 * Usage:
 *   style(config)
 *   style(config, options)
 *   style(ctx, config, options)
 *
 * @param {object} config - Style definitions (signals, validators, etc.)
 * @param {object} [options] - Optional configuration
 * @param {object} [ctx] - Optional Orch context
 * @returns {StyleNode} Introspectable style node
 * @throws {TypeError} If arguments are invalid
 */
export const style = Object.freeze(function style(...args) {
    let ctx, config, options;

    if (args.length === 1) {
        [config] = args;
    } else if (args.length === 2) {
        [config, options] = args;
    } else if (args.length === 3) {
        [ctx, config, options] = args;
    } else {
        throw new TypeError(
            'style() expects (config), (config, options), or (ctx, config, options)'
        );
    }

    if (
        config === null ||
        typeof config !== 'object' ||
        Array.isArray(config)
    ) {
        throw new TypeError('style config must be a plain object');
    }
    if (
        options !== undefined &&
        (typeof options !== 'object' || Array.isArray(options))
    ) {
        throw new TypeError('style options must be a plain object if provided');
    }
    if (ctx !== undefined && ctx !== null && typeof ctx !== 'object') {
        throw new TypeError('style ctx must be an object, null, or undefined');
    }

    return kernel.call('createStyle', {ctx, styleConfig: config, options});
});
