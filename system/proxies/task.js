/**
 * @license Apache License 2.0
 * @file orch/system/proxies/task.js
 * @title task
 * @description Developer-facing proxy for `createTask` inside orch.wasm. Validates the public task call shape and forwards to the sealed kernel.
 * @version 1.1.1
 */

import {kernel} from 'orch-kernel';
import {admitNativeMutation} from '../runtime/localBoundary.js';

/**
 * Declares an async task primitive.
 *
 * Usage:
 *   task(label, fn)
 *
 * @param {string} label - Stable task label / key hint
 * @param {Function} fn - Async task implementation
 * @returns {TaskNode} Introspectable task node
 * @throws {TypeError} If arguments are invalid.
 */
export const task = Object.freeze(function task(label, fn) {
    if (typeof label !== 'string') {
        throw new TypeError('task label must be a string');
    }
    if (typeof fn !== 'function') {
        throw new TypeError('task function must be callable');
    }

    admitNativeMutation('task');

    return kernel.call('createTask', {
        label,
        fn,
        name: label,
        handler: fn,
    });
});
