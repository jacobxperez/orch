/**
 * @license Apache License 2.0
 * @file orch/system/proxies/agent.js
 * @title agent
 * @description Developer-facing agent primitive proxy. Validates the public call shape and forwards the spec-owned K_AGENT_* operations to the sealed kernel.
 * @version 1.2.0
 */

import {kernel} from 'orch-kernel';
import {admitNativeMutation} from '../runtime/localBoundary.js';

/**
 * Usage:
 *   agent(name, setupFn)
 *   agent(name, setupFn, options)
 *   agent(ctx, name, setupFn)
 *   agent(ctx, name, setupFn, options)
 */
export const agent = Object.freeze(function agent(...args) {
    let ctx;
    let name;
    let setupFn;
    let options;

    if (args.length === 2) {
        [name, setupFn] = args;
    } else if (args.length === 3) {
        if (args[0] !== null && typeof args[0] === 'object') {
            [ctx, name, setupFn] = args;
        } else {
            [name, setupFn, options] = args;
        }
    } else if (args.length === 4) {
        [ctx, name, setupFn, options] = args;
    } else {
        throw new TypeError(
            'agent() expects (name, setupFn), (name, setupFn, options), (ctx, name, setupFn), or (ctx, name, setupFn, options)'
        );
    }

    if (typeof name !== 'string' || name.trim().length === 0) {
        throw new TypeError('agent name must be a non-empty string');
    }
    if (typeof setupFn !== 'function') {
        throw new TypeError('agent setupFn must be callable');
    }
    if (
        options !== undefined &&
        (options === null || typeof options !== 'object' || Array.isArray(options))
    ) {
        throw new TypeError('agent options must be a plain object if provided');
    }
    if (ctx !== undefined && ctx !== null && typeof ctx !== 'object') {
        throw new TypeError('agent ctx must be an object, null, or undefined');
    }

    admitNativeMutation('agent');

    const id = kernel.call('K_AGENT_CREATE', {
        ctx,
        spec: {key: name},
        setupFn,
        options,
    });
    const terminate = () => {
        admitNativeMutation('agent');
        return kernel.call('K_AGENT_TERMINATE', {id});
    };

    return Object.freeze({
        data: () => kernel.call('K_AGENT_DATA', {id}),
        status: () => kernel.call('K_AGENT_STATUS', {id}),
        error: () => kernel.call('K_AGENT_ERROR', {id}),
        errors: () => kernel.call('K_AGENT_ERRORS', {id}),
        perf: () => kernel.call('K_AGENT_PERF', {id}),
        suspend: (reason) => {
            admitNativeMutation('agent');
            return kernel.call('K_AGENT_SUSPEND', {id, reason});
        },
        resume: () => {
            admitNativeMutation('agent');
            return kernel.call('K_AGENT_RESUME', {id});
        },
        terminate,
        dispose: terminate,
    });
});
