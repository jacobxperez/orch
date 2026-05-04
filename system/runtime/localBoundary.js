/**
 * @license Apache License 2.0
 * @file orch/system/runtime/localBoundary.js
 * @title ONI Local Runtime Boundary Reflection
 * @description Reflects Runtime Core local admission outcomes for mutation-capable ONI surfaces without owning policy.
 * @version 0.1.0
 */

const FALLBACK_ERROR = Object.freeze({
    code: 'ERR_CAPABILITY',
    message: 'Runtime mutation denied by local runtime boundary.',
    origin: 'host',
    kind: 'security',
    severity: 'error',
    reason: 'policy',
    retry: 'do_not_retry',
    component: 'oni',
    details: Object.freeze({subcode: 'ONI_LOCAL_BOUNDARY_DENIED'}),
});

function getBoundary() {
    const candidate = globalThis?.ORCH_LOCAL_RUNTIME_BOUNDARY;
    if (candidate && typeof candidate.admitNativeMutation === 'function') {
        return candidate;
    }
    return null;
}

function normalizeBoundaryError(error, surface) {
    if (error && typeof error === 'object') {
        return Object.freeze({
            code:
                typeof error.code === 'string' && error.code.startsWith('ERR_')
                    ? error.code
                    : 'ERR_CAPABILITY',
            message:
                typeof error.message === 'string' && error.message
                    ? error.message
                    : FALLBACK_ERROR.message,
            origin: error.origin === 'host' ? 'host' : 'host',
            kind: error.kind || 'security',
            severity: error.severity || 'error',
            reason: error.reason || 'policy',
            retry: error.retry || 'do_not_retry',
            component: error.component || 'oni',
            details: Object.freeze({
                ...(error.details && typeof error.details === 'object'
                    ? error.details
                    : null),
                surface,
            }),
        });
    }

    return Object.freeze({
        ...FALLBACK_ERROR,
        details: Object.freeze({...FALLBACK_ERROR.details, surface}),
    });
}

function throwDenied(error, surface) {
    const runtimeError = normalizeBoundaryError(error, surface);
    const err = new Error(runtimeError.message);
    err.code = runtimeError.code;
    err.runtimeError = runtimeError;
    throw err;
}

export function admitNativeMutation(surface, payload = {}) {
    const boundary = getBoundary();
    if (!boundary) return Object.freeze({allow: true, decision: 'allow'});

    const decision = boundary.admitNativeMutation({
        surface,
        capability: `mutate:${surface}`,
        intent: `mutate:${surface}`,
        ...payload,
    });

    if (decision && decision.allow === false) {
        throwDenied(decision.error, surface);
    }

    return Object.freeze({
        allow: true,
        decision: decision?.decision || 'allow',
    });
}
