/**
 * @license Apache License 2.0
 * @file orch/dva/verifyArtifactIdentity.js
 * @title Artifact Identity Verifier
 * @description Runtime/public entrypoints for selected-artifact verification and RuntimeError mapping.
 * @version 0.2.0
 */

import {verifyReleaseBundle} from './verifyReleaseBundle.js';
import {buildRuntimeError} from '../system/runtime/runtimeError.js';

const POLICY_FAILURE_CODES = new Set([
    'denied-kid',
    'invalid-signature',
    'missing-public-key',
    'offline-denied',
    'revoked-admission-identity',
    'revoked-release-member',
    'revoked-signer',
    'rollover-overlap-expired',
    'stale-trust-list',
    'support-window-expired',
    'support-window-not-started',
    'unallowed-kid',
]);

function cmp(left, right) {
    if (left === right) return 0;
    return left < right ? -1 : 1;
}

function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

function toJsonSafe(value) {
    if (value == null || typeof value === 'string' || typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : String(value);
    }
    if (typeof value === 'bigint') return value.toString();
    if (Array.isArray(value)) return value.map(toJsonSafe);
    if (value instanceof Uint8Array) return {byteLength: value.byteLength};
    if (ArrayBuffer.isView(value)) return {byteLength: value.byteLength};
    if (value instanceof ArrayBuffer) return {byteLength: value.byteLength};
    if (isPlainObject(value)) {
        const out = {};
        for (const key of Object.keys(value).sort(cmp)) {
            if (value[key] !== undefined) out[key] = toJsonSafe(value[key]);
        }
        return out;
    }
    return String(value);
}

function normalizeVerifierErrors(errors) {
    return (Array.isArray(errors) ? errors : [])
        .map((error) => ({
            code: typeof error?.code === 'string' ? error.code : 'unknown',
            message:
                typeof error?.message === 'string'
                    ? error.message
                    : 'DVA verifier failed.',
            ...(error?.details !== undefined
                ? {details: toJsonSafe(error.details)}
                : null),
        }))
        .sort((a, b) => cmp(a.code, b.code) || cmp(a.message, b.message));
}

function chooseRuntimeMapping(errors) {
    const hasPolicyFailure = errors.some((error) =>
        POLICY_FAILURE_CODES.has(error.code)
    );
    if (hasPolicyFailure) {
        return {
            code: 'ERR_CAPABILITY',
            kind: 'security',
            reason: 'policy',
            retry: 'do_not_retry',
        };
    }
    return {
        code: 'ERR_SCHEMA',
        kind: 'configuration',
        reason: 'invalid',
        retry: 'do_not_retry',
    };
}

function verifyArtifactIdentity(options = {}) {
    return verifyReleaseBundle(options);
}

function runtimeErrorFromDvaPartBResult(result, options = {}) {
    if (result?.ok === true) return null;

    const errors = normalizeVerifierErrors(result?.errors);
    const primary = errors[0] || {
        code: 'dva-verifier-denied',
        message: 'DVA verifier denied artifact identity.',
    };
    const mapping = chooseRuntimeMapping(errors);
    const trustDecision =
        result?.trustDecision === 'accept' || result?.trustDecision === 'deny'
            ? result.trustDecision
            : 'deny';

    return buildRuntimeError({
        ...mapping,
        message:
            typeof options.message === 'string' && options.message.length > 0
                ? options.message
                : `DVA Part B verification failed: ${primary.message}`,
        origin: 'dva',
        severity: 'error',
        component:
            typeof options.component === 'string' && options.component.length > 0
                ? options.component
                : 'verifyArtifactIdentity',
        details: {
            subcode: primary.code,
            trustDecision,
            dva: {
                errors,
                manifestRoot: result?.manifestRoot || null,
                audit: toJsonSafe(result?.audit || null),
            },
        },
    });
}

async function verifyArtifactIdentityRuntimeError(options = {}) {
    const result = await verifyArtifactIdentity(options);
    return runtimeErrorFromDvaPartBResult(result, options.runtimeError || {});
}

export {
    runtimeErrorFromDvaPartBResult,
    verifyArtifactIdentity,
    verifyArtifactIdentityRuntimeError,
};
