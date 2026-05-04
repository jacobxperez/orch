/**
 * @license Apache License 2.0
 * @file orch/system/runtime/verifySealedArtifact.js
 * @title Sealed Artifact Verifier
 * @description Host-callable ONI verifier for sealed Orch kernel artifacts using embedded fingerprint, import sovereignty, target alignment, and DVA/meta consistency checks.
 * @version 0.2.0
 */

import {cborDecode} from '../../../source/wasm/cbor/deterministicCbor.js';
import {
    readCustomSectionPayloads,
    scanImportSet,
} from '../../../source/wasm/wasmSections.js';
import {computeManifestRoot} from '../../../source/dva/manifestRoot.js';
import {buildRuntimeError} from './runtimeError.js';

const ALLOWED_IMPORT_PREFIX = 'orch:';

function makeRuntimeError({code, message, details, component = 'verifySealedArtifact'}) {
    if (code === 'ERR_SCHEMA') {
        return buildRuntimeError({
            code,
            message,
            origin: 'host',
            kind: 'configuration',
            severity: 'error',
            reason: 'invalid',
            retry: 'do_not_retry',
            component,
            details,
        });
    }

    if (code === 'ERR_CAPABILITY' || code === 'ERR_ORIGIN_DENIED') {
        return buildRuntimeError({
            code,
            message,
            origin: 'host',
            kind: 'security',
            severity: 'error',
            reason: 'policy',
            retry: 'do_not_retry',
            component,
            details,
        });
    }

    return buildRuntimeError({
        code: 'ERR_INTERNAL',
        message,
        origin: 'host',
        kind: 'bug',
        severity: 'error',
        reason: 'internal',
        retry: 'retry_with_backoff',
        component,
        details,
    });
}

function fail(code, message, details) {
    return Object.freeze({ok: false, error: makeRuntimeError({code, message, details})});
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.length > 0;
}

function normalizeTarget(target) {
    if (!isNonEmptyString(target)) return null;
    const lowered = target.toLowerCase();
    if (lowered === 'wasi') return 'wasi-p1';
    return lowered;
}

function pickMetaFingerprint(meta) {
    if (!meta || typeof meta !== 'object') return null;

    const candidates = [
        meta.sha256Pre,
        meta.sha256SansFingerprint,
        meta?.dva?.fingerprint,
        meta?.fingerprint?.dva?.fingerprint,
    ];

    for (const value of candidates) {
        if (isNonEmptyString(value)) {
            return value;
        }
    }

    return null;
}

function toSha256BytesWithWebCrypto() {
    if (!globalThis?.crypto?.subtle?.digest) {
        return null;
    }

    return async (bytes) => {
        const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
        return new Uint8Array(digest);
    };
}

async function verifyManifestRootIfRequested({releaseManifest, embeddedRoot}) {
    if (releaseManifest == null) return {ok: true};

    if (!releaseManifest || typeof releaseManifest !== 'object') {
        return fail('ERR_SCHEMA', 'releaseManifest must be an object when provided.');
    }

    if (!Array.isArray(releaseManifest.entries)) {
        return fail('ERR_SCHEMA', 'releaseManifest.entries must be an array.');
    }

    if (!isNonEmptyString(releaseManifest.manifestRoot)) {
        return fail(
            'ERR_SCHEMA',
            'releaseManifest.manifestRoot must be a non-empty string.'
        );
    }

    const sha256Bytes = toSha256BytesWithWebCrypto();
    if (!sha256Bytes) {
        return fail(
            'ERR_INTERNAL',
            'releaseManifest verification requires crypto.subtle.digest support.'
        );
    }

    let recomputed;
    try {
        recomputed = await computeManifestRoot(releaseManifest.entries, {
            sha256: sha256Bytes,
        });
    } catch (error) {
        return fail('ERR_SCHEMA', String(error?.message || error));
    }

    if (recomputed !== releaseManifest.manifestRoot) {
        return fail(
            'ERR_SCHEMA',
            'releaseManifest.manifestRoot mismatch with recomputed root.',
            {
                expected: recomputed,
                actual: releaseManifest.manifestRoot,
            }
        );
    }

    if (recomputed !== embeddedRoot) {
        return fail(
            'ERR_SCHEMA',
            'Embedded dva.manifestRoot mismatch with releaseManifest.manifestRoot.',
            {
                expected: recomputed,
                actual: embeddedRoot,
            }
        );
    }

    return {ok: true, recomputed};
}

async function verifySealedArtifact({
    wasmBytes,
    meta,
    target,
    allowWasi = false,
    releaseManifest = null,
} = {}) {
    try {
        if (!(wasmBytes instanceof Uint8Array)) {
            return fail('ERR_SCHEMA', 'verifySealedArtifact: wasmBytes must be Uint8Array or Buffer.');
        }

        if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
            return fail('ERR_SCHEMA', 'verifySealedArtifact: meta must be a plain object.');
        }

        const payloads = readCustomSectionPayloads(wasmBytes, 'orch.fingerprint');
        if (payloads.length !== 1) {
            return fail(
                'ERR_SCHEMA',
                `Artifact must contain exactly one orch.fingerprint section (found ${payloads.length}).`
            );
        }

        let fingerprintPayload;
        try {
            fingerprintPayload = cborDecode(payloads[0]);
        } catch (error) {
            return fail(
                'ERR_SCHEMA',
                `Failed to decode orch.fingerprint payload as deterministic CBOR: ${String(error?.message || error)}`
            );
        }

        if (!fingerprintPayload || typeof fingerprintPayload !== 'object' || Array.isArray(fingerprintPayload)) {
            return fail('ERR_SCHEMA', 'Fingerprint payload must decode to an object.');
        }

        const dva = fingerprintPayload.dva;
        if (!dva || typeof dva !== 'object' || Array.isArray(dva)) {
            return fail('ERR_SCHEMA', 'Fingerprint payload must contain a nested dva object.');
        }

        if (!isNonEmptyString(dva.fingerprint)) {
            return fail('ERR_SCHEMA', 'Fingerprint payload dva.fingerprint must be a string.');
        }
        if (!isNonEmptyString(dva.version)) {
            return fail('ERR_SCHEMA', 'Fingerprint payload dva.version must be a string.');
        }
        if (!isNonEmptyString(dva.manifestRoot)) {
            return fail('ERR_SCHEMA', 'Fingerprint payload dva.manifestRoot must be a string.');
        }

        const imports = scanImportSet(wasmBytes);
        const deniedImports = [];

        for (const imp of imports) {
            const moduleName = imp.module;
            const isWasi = moduleName.startsWith('wasi:') || moduleName.startsWith('wasi');
            const isAllowed = moduleName === 'env' || moduleName.startsWith(ALLOWED_IMPORT_PREFIX);

            if (isWasi && !allowWasi) {
                deniedImports.push(`${imp.module}.${imp.name}`);
                continue;
            }
            if (!isAllowed) {
                deniedImports.push(`${imp.module}.${imp.name}`);
            }
        }

        if (deniedImports.length > 0) {
            return fail(
                'ERR_CAPABILITY',
                'Import sovereignty policy denied one or more imports.',
                {deniedImports}
            );
        }

        const requestedTarget = normalizeTarget(target);
        const metaTarget = normalizeTarget(meta.previewTarget);
        const payloadTarget = normalizeTarget(fingerprintPayload.previewTarget);

        if (requestedTarget && metaTarget && requestedTarget !== metaTarget) {
            return fail('ERR_SCHEMA', 'Target mismatch: requested target does not match meta.previewTarget.', {
                requestedTarget,
                metaPreviewTarget: metaTarget,
            });
        }

        if (requestedTarget && payloadTarget && requestedTarget !== payloadTarget) {
            return fail(
                'ERR_SCHEMA',
                'Target mismatch: requested target does not match fingerprint.previewTarget.',
                {
                    requestedTarget,
                    fingerprintPreviewTarget: payloadTarget,
                }
            );
        }

        if (metaTarget && payloadTarget && metaTarget !== payloadTarget) {
            return fail('ERR_SCHEMA', 'Target mismatch: meta.previewTarget and fingerprint.previewTarget differ.', {
                metaPreviewTarget: metaTarget,
                fingerprintPreviewTarget: payloadTarget,
            });
        }

        if (isNonEmptyString(meta?.dva?.manifestRoot) && dva.manifestRoot !== meta.dva.manifestRoot) {
            return fail('ERR_SCHEMA', 'dva.manifestRoot mismatch between embedded payload and meta sidecar.', {
                embedded: dva.manifestRoot,
                meta: meta.dva.manifestRoot,
            });
        }

        if (isNonEmptyString(meta.version) && dva.version !== meta.version) {
            return fail('ERR_SCHEMA', 'dva.version mismatch between embedded payload and meta sidecar.', {
                embedded: dva.version,
                meta: meta.version,
            });
        }

        const metaFingerprint = pickMetaFingerprint(meta);
        if (isNonEmptyString(metaFingerprint) && dva.fingerprint !== metaFingerprint) {
            return fail('ERR_SCHEMA', 'dva.fingerprint mismatch between embedded payload and meta sidecar.', {
                embedded: dva.fingerprint,
                meta: metaFingerprint,
            });
        }

        const manifestVerification = await verifyManifestRootIfRequested({
            releaseManifest,
            embeddedRoot: dva.manifestRoot,
        });
        if (!manifestVerification.ok) {
            return manifestVerification;
        }

        return Object.freeze({
            ok: true,
            target: requestedTarget ?? metaTarget ?? payloadTarget ?? null,
            dva: {
                fingerprint: dva.fingerprint,
                version: dva.version,
                manifestRoot: dva.manifestRoot,
            },
            fingerprintPayload,
            importsSummary: {
                count: imports.length,
                modules: Array.from(new Set(imports.map((imp) => imp.module))),
                imports,
            },
        });
    } catch (error) {
        return fail(
            'ERR_INTERNAL',
            `verifySealedArtifact failed unexpectedly: ${String(error?.message || error)}`,
            {subcode: 'VERIFY_SEALED_ARTIFACT_UNEXPECTED'}
        );
    }
}

export {verifySealedArtifact};
