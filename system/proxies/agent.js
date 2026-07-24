/**
 * @license Apache License 2.0
 * @file orch/system/proxies/agent.js
 * @title agent
 * @description Developer-facing agent primitive family proxy. Validates the public call shapes and forwards spec-owned K_AGENT_* and K_INTENT_* operations to the sealed kernel.
 * @version 2.0.1
 */

import {kernel} from 'orch-kernel';
import {admitNativeMutation} from '../runtime/localBoundary.js';

const hasOwn = (object, key) =>
    Object.prototype.hasOwnProperty.call(object, key);

function isPlainObject(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function normalizeOptions(options, surface) {
    if (options === undefined) return {};
    if (!isPlainObject(options)) {
        throw new TypeError(`${surface} options must be a plain object`);
    }
    for (const key of ['scope', 'ctx', 'orch']) {
        if (hasOwn(options, key)) {
            throw new TypeError(
                `${surface} options must not include independent context or scope overrides`
            );
        }
    }
    return options;
}

function assertContext(context, surface) {
    if (context === null || typeof context !== 'object') {
        throw new TypeError(`${surface} options.context must be an object`);
    }
    return context;
}

function resolveContext(options, surface) {
    if (hasOwn(options, 'context')) {
        return assertContext(options.context, surface);
    }

    const context = admitNativeMutation.getCurrentExecutionContext();
    if (context === null || typeof context !== 'object') {
        throw new TypeError(
            `${surface} requires options.context or a runtime-bound current context`
        );
    }
    return context;
}

function requireExplicitContext(options, surface) {
    if (!hasOwn(options, 'context')) {
        throw new TypeError(
            `${surface} requires options.context outside a runtime-bound current context`
        );
    }
    return assertContext(options.context, surface);
}

function stripContext(options) {
    const clean = {};
    for (const [key, value] of Object.entries(options)) {
        if (key !== 'context') clean[key] = value;
    }
    return clean;
}

function assertPath(path, surface) {
    if (typeof path !== 'string' || path.trim().length === 0) {
        throw new TypeError(`${surface} path must be a non-empty string`);
    }
}

function createIntentSignalHandle(id) {
    return Object.freeze({
        set: (next) => {
            admitNativeMutation('intent');
            return kernel.call('K_INTENT_SET', {id, next});
        },
        get: () => kernel.call('K_INTENT_GET', {id}),
        clear: () => {
            admitNativeMutation('intent');
            return kernel.call('K_INTENT_CLEAR', {id});
        },
        status: () => kernel.call('K_INTENT_STATUS', {id}),
        error: () => kernel.call('K_INTENT_ERROR', {id}),
        errors: () => kernel.call('K_INTENT_ERRORS', {id}),
        data: () => kernel.call('K_INTENT_DATA', {id}),
        perf: () => kernel.call('K_INTENT_PERF', {id}),
    });
}

function agentIntent(path, options = undefined) {
    assertPath(path, 'agent.intent');
    const normalized = normalizeOptions(options, 'agent.intent');
    const ctx = resolveContext(normalized, 'agent.intent');
    const config = {key: path};
    const payload = {ctx, humanPath: path, config};

    if (hasOwn(normalized, 'initial')) {
        config.initial = normalized.initial;
        payload.initial = normalized.initial;
    }

    admitNativeMutation('intent');
    const id = kernel.call('K_INTENT_CREATE', payload);
    return createIntentSignalHandle(id);
}

function intentTrigger(path, payload = null, options = undefined) {
    assertPath(path, 'agent.intent.trigger');
    const normalized = normalizeOptions(options, 'agent.intent.trigger');
    const ctx = resolveContext(normalized, 'agent.intent.trigger');

    admitNativeMutation('intent');
    return kernel.call('K_INTENTM_TRIGGER', {ctx, path, payload});
}

Object.defineProperty(agentIntent, 'trigger', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: intentTrigger,
});

Object.freeze(agentIntent);

const agentFacade = function agent(name, setupFn, options = undefined) {
    if (arguments.length < 2 || arguments.length > 3) {
        throw new TypeError('agent() expects (name, setupFn, options?)');
    }

    if (typeof name !== 'string' || name.trim().length === 0) {
        throw new TypeError('agent name must be a non-empty string');
    }
    if (typeof setupFn !== 'function') {
        throw new TypeError('agent setupFn must be callable');
    }

    const normalized = normalizeOptions(options, 'agent');
    const ctx = requireExplicitContext(normalized, 'agent');
    const ownerOptions = stripContext(normalized);

    admitNativeMutation('agent');

    const id = kernel.call('K_AGENT_CREATE', {
        ctx,
        spec: {key: name},
        setupFn,
        options: ownerOptions,
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
};

Object.defineProperty(agentFacade, 'intent', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: agentIntent,
});

export const agent = Object.freeze(agentFacade);
