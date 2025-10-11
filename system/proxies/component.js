/**
 * @license Apache License 2.0
 * @file orch/system/proxies/component.js
 * @title component
 * @description Developer-facing proxy for `createComponent` inside orch.wasm. Validates input and forwards to the sealed kernel.
 * @version 1.1.0
 */

import {kernel} from 'orch-kernel';

/**
 * Declares a lifecycle-safe Orch component.
 *
 * @param {string} name - Component name (DOM scope identifier).
 * @param {Function} setupFn - Component setup logic (called within the component’s scope).
 * @returns {ComponentInstance} - Introspectable component node from the sealed kernel.
 * @throws {TypeError} If arguments are invalid or count is incorrect.
 */
export const component = Object.freeze(function component(name, setupFn) {
    if (arguments.length !== 2) {
        throw new TypeError(
            'component() expects exactly 2 arguments: name, setupFn'
        );
    }
    if (typeof name !== 'string') {
        throw new TypeError('component name must be a string');
    }
    if (typeof setupFn !== 'function') {
        throw new TypeError('component setupFn must be callable');
    }

    // Forward to sealed kernel, which handles scheduler, perf, errors, registration, etc.
    return kernel.call('createComponent', {name, setupFn});
});
