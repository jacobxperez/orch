/**
 * @license Apache License 2.0
 * @file orch/system/runtime/runtimeError.js
 * @title Runtime Error Builder
 * @description Shared helper for constructing canonical runtime error envelopes at host/runtime boundaries.
 * @version 0.1.0
 */

const VALID_ORIGINS = new Set([
    'kernel',
    'scheduler',
    'graph',
    'abi',
    'dva',
    'auxiliary',
    'storage',
    'host',
]);

const KNOWN_ERR_CODES = new Set([
    'ERR_SCHEMA',
    'ERR_CAPABILITY',
    'ERR_ORIGIN_DENIED',
    'ERR_INTERNAL',
    'ERR_IO',
]);

function buildRuntimeError({
    code = 'ERR_INTERNAL',
    message,
    origin = 'host',
    kind = 'bug',
    severity = 'error',
    reason = 'internal',
    retry = 'do_not_retry',
    component,
    details,
} = {}) {
    if (typeof message !== 'string' || message.length === 0) {
        throw new TypeError('buildRuntimeError: message must be a non-empty string');
    }

    if (!VALID_ORIGINS.has(origin)) {
        throw new TypeError(`buildRuntimeError: invalid origin "${String(origin)}"`);
    }

    if (typeof code !== 'string' || !code.startsWith('ERR_')) {
        throw new TypeError('buildRuntimeError: code must be an ERR_* string');
    }

    if (globalThis?.process?.env?.NODE_ENV !== 'production' && !KNOWN_ERR_CODES.has(code)) {
        throw new TypeError(`buildRuntimeError: unknown ERR_* code "${code}"`);
    }

    return {
        code,
        message,
        origin,
        kind,
        severity,
        reason,
        retry,
        ...(component ? {component} : null),
        ...(details !== undefined ? {details} : null),
    };
}

export {buildRuntimeError, KNOWN_ERR_CODES, VALID_ORIGINS};
