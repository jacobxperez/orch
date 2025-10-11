/**
 * @license Apache License 2.0
 * @file orch/system/proxies/mount.js
 * @title mount
 * @description Developer-facing proxy for `createMount` inside orch.wasm. Validates args and forwards to the sealed kernel.
 * @version 1.1.0
 */

import {kernel} from 'orch-kernel';

/**
 * Mounts the Orch context to the DOM and sets up bindings.
 *
 * Usage:
 *   mount(root)          // uses default context
 *   mount(ctx, root)     // explicit context
 *
 * @param {object|HTMLElement|DocumentFragment} ctxOrRoot - Either context or root element
 * @param {HTMLElement|DocumentFragment} [root] - DOM root (if ctx provided)
 * @returns {MountResult} Introspectable mount node
 * @throws {TypeError} If args are invalid.
 */
export const mount = Object.freeze(function mount(...args) {
    let ctx, root;

    if (args.length === 1) {
        root = args[0];
    } else if (args.length === 2) {
        [ctx, root] = args;
    } else if (args.length === 0) {
        root = document.body;
    } else {
        throw new TypeError(
            'mount() expects 0, 1, or 2 arguments: (root) or (ctx, root)'
        );
    }

    if (!(root instanceof HTMLElement) && !(root instanceof DocumentFragment)) {
        throw new TypeError(
            'mount root must be an HTMLElement or DocumentFragment'
        );
    }
    if (ctx !== undefined && typeof ctx !== 'object') {
        throw new TypeError('mount ctx must be an object if provided');
    }

    return kernel.call('createMount', {ctx, root});
});
