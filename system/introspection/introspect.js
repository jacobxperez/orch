/**
 * @license Apache License 2.0
 * @file orch/system/introspection/introspect.js
 * @title introspect
 * @description Developer-facing compatibility proxy for deterministic unsupported public introspection inside orch.wasm.
 * @version 2.0.0
 */

import {kernel} from 'orch-kernel';

/**
 * Returns the deterministic unsupported public introspection result.
 *
 * Usage:
 *   introspect()
 *
 * @returns {object} IntrospectionUnsupportedResultV1
 */
export const introspect = Object.freeze(function introspect() {
    return kernel.call('createIntrospect', {});
});
