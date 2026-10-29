/**
 * @license Apache License 2.0
 * @file orch/system/runtime/verifySealedArtifact.js
 * @title Sealed Artifact Verifier
 * @description Host-callable ONI verifier for sealed Orch kernel artifacts using embedded fingerprint, import sovereignty, target alignment, and DVA-origin Part A artifact verification checks.
 * @version 0.2.3
 */

import {buildRuntimeError} from './runtimeError.js';

const ALLOWED_IMPORT_PREFIX = 'orch:';
const HASH_HEX_RE = /^[0-9a-f]{64}$/;
const I64_MIN = -(1n << 63n);
const CANONICAL_NAN_HALF_BITS = 0x7e00;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', {fatal: true});
const floatView = new DataView(new ArrayBuffer(8));

function toUint8Array(bytes) {
    if (bytes instanceof Uint8Array) return bytes;
    if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
    if (ArrayBuffer.isView(bytes)) {
        return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    }
    throw new TypeError('Expected WASM bytes as Uint8Array or ArrayBuffer');
}

function assertWasmHeader(bytes) {
    if (
        bytes.length < 8 ||
        bytes[0] !== 0x00 ||
        bytes[1] !== 0x61 ||
        bytes[2] !== 0x73 ||
        bytes[3] !== 0x6d
    ) {
        throw new Error('Not a valid WASM binary (bad magic).');
    }
    if (
        bytes[4] !== 0x01 ||
        bytes[5] !== 0x00 ||
        bytes[6] !== 0x00 ||
        bytes[7] !== 0x00
    ) {
        throw new Error('Unsupported WASM version (expected 0x1).');
    }
}

function decodeULEB(bytes, offset) {
    let result = 0;
    let shift = 0;
    let position = offset;
    for (;;) {
        if (position >= bytes.length)
            throw new Error('decodeULEB: out of range');
        const byte = bytes[position++];
        result |= (byte & 0x7f) << shift;
        if ((byte & 0x80) === 0) return [result >>> 0, position];
        shift += 7;
        if (shift > 35) throw new Error('decodeULEB: overflow');
    }
}

function readCustomSectionPayloads(bytesLike, sectionName) {
    const bytes = toUint8Array(bytesLike);
    assertWasmHeader(bytes);
    const expectedName = textEncoder.encode(sectionName);
    const payloads = [];
    let position = 8;

    while (position < bytes.length) {
        const sectionId = bytes[position++];
        const [sectionSize, contentStart] = decodeULEB(bytes, position);
        const sectionEnd = contentStart + sectionSize;
        if (sectionEnd > bytes.length) {
            throw new Error('Malformed WASM section (overflow).');
        }
        position = contentStart;
        if (sectionId === 0) {
            const [nameLength, nameStart] = decodeULEB(bytes, position);
            const nameEnd = nameStart + nameLength;
            if (nameEnd > sectionEnd) {
                throw new Error('Malformed custom section (name overflow).');
            }
            const matches =
                nameLength === expectedName.length &&
                expectedName.every(
                    (byte, index) => byte === bytes[nameStart + index]
                );
            if (matches) payloads.push(bytes.slice(nameEnd, sectionEnd));
        }
        position = sectionEnd;
    }
    return payloads;
}

function readWasmName(bytes, start, end) {
    if (end < start) throw new Error('Malformed WASM string bounds.');
    return textDecoder.decode(bytes.subarray(start, end));
}

function skipLimits(bytes, offset, sectionEnd) {
    if (offset >= sectionEnd)
        throw new Error('Malformed limits (missing flags).');
    const flags = bytes[offset++];
    let next = decodeULEB(bytes, offset)[1];
    if (flags & 0x01) next = decodeULEB(bytes, next)[1];
    if (next > sectionEnd) throw new Error('Malformed limits (overflow).');
    return next;
}

function scanImportSet(bytesLike) {
    const bytes = toUint8Array(bytesLike);
    assertWasmHeader(bytes);
    const imports = [];
    let position = 8;

    while (position < bytes.length) {
        const sectionId = bytes[position++];
        const [sectionSize, sectionStart] = decodeULEB(bytes, position);
        const sectionEnd = sectionStart + sectionSize;
        if (sectionEnd > bytes.length) {
            throw new Error('Malformed WASM section (overflow).');
        }
        position = sectionStart;
        if (sectionId === 0x02) {
            const [count, afterCount] = decodeULEB(bytes, position);
            let cursor = afterCount;
            for (let index = 0; index < count; index += 1) {
                const [moduleLength, moduleStart] = decodeULEB(bytes, cursor);
                const moduleEnd = moduleStart + moduleLength;
                if (moduleEnd > sectionEnd) {
                    throw new Error(
                        'Malformed import section (module overflow).'
                    );
                }
                const module = readWasmName(bytes, moduleStart, moduleEnd);
                const [nameLength, nameStart] = decodeULEB(bytes, moduleEnd);
                const nameEnd = nameStart + nameLength;
                if (nameEnd > sectionEnd) {
                    throw new Error(
                        'Malformed import section (name overflow).'
                    );
                }
                const name = readWasmName(bytes, nameStart, nameEnd);
                cursor = nameEnd;
                if (cursor >= sectionEnd) {
                    throw new Error('Malformed import section (kind missing).');
                }
                const kind = bytes[cursor++];
                if (kind === 0x00) {
                    cursor = decodeULEB(bytes, cursor)[1];
                } else if (kind === 0x01) {
                    if (cursor >= sectionEnd) {
                        throw new Error(
                            'Malformed import section (table type missing).'
                        );
                    }
                    cursor = skipLimits(bytes, cursor + 1, sectionEnd);
                } else if (kind === 0x02) {
                    cursor = skipLimits(bytes, cursor, sectionEnd);
                } else if (kind === 0x03) {
                    if (cursor + 2 > sectionEnd) {
                        throw new Error(
                            'Malformed import section (global type missing).'
                        );
                    }
                    cursor += 2;
                } else if (kind === 0x04) {
                    if (cursor >= sectionEnd) {
                        throw new Error(
                            'Malformed import section (tag attr missing).'
                        );
                    }
                    cursor = decodeULEB(bytes, cursor + 1)[1];
                } else {
                    throw new Error(
                        `Unknown import kind 0x${kind.toString(16)}.`
                    );
                }
                if (cursor > sectionEnd) {
                    throw new Error('Malformed import section (overflow).');
                }
                imports.push({module, name});
            }
        }
        position = sectionEnd;
    }

    imports.sort((left, right) =>
        left.module < right.module
            ? -1
            : left.module > right.module
              ? 1
              : left.name < right.name
                ? -1
                : left.name > right.name
                  ? 1
                  : 0
    );
    return imports;
}

function compareBytes(left, right) {
    const length = Math.min(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
        if (left[index] !== right[index]) return left[index] - right[index];
    }
    return left.length - right.length;
}

function readCborByte(state) {
    if (state.offset >= state.bytes.length)
        throw new Error('CBOR: unexpected end');
    return state.bytes[state.offset++];
}

function readCborUnsigned(additionalInfo, state, context) {
    if (additionalInfo < 24) return additionalInfo;
    if (additionalInfo === 24) {
        const value = readCborByte(state);
        if (value < 24)
            throw new Error(`CBOR: non-preferred ${context} encoding`);
        return value;
    }
    if (additionalInfo === 25) {
        const value = (readCborByte(state) << 8) | readCborByte(state);
        if (value <= 0xff)
            throw new Error(`CBOR: non-preferred ${context} encoding`);
        return value;
    }
    if (additionalInfo === 26) {
        const value =
            readCborByte(state) * 0x1000000 +
            (readCborByte(state) << 16) +
            (readCborByte(state) << 8) +
            readCborByte(state);
        if (value <= 0xffff)
            throw new Error(`CBOR: non-preferred ${context} encoding`);
        return value;
    }
    if (additionalInfo === 27) {
        let value = 0n;
        for (let index = 0; index < 8; index += 1) {
            value = (value << 8n) | BigInt(readCborByte(state));
        }
        if (value <= 0xffff_ffffn) {
            throw new Error(`CBOR: non-preferred ${context} encoding`);
        }
        return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value;
    }
    if (additionalInfo === 31)
        throw new Error('CBOR: indefinite lengths not supported');
    throw new Error(`CBOR: unsupported additional info ${additionalInfo}`);
}

function readCborLength(additionalInfo, state, context) {
    const length = readCborUnsigned(additionalInfo, state, context);
    if (typeof length === 'bigint')
        throw new Error(`CBOR: ${context} exceeds supported range`);
    return length;
}

function halfToNumber(bits) {
    const sign = bits & 0x8000 ? -1 : 1;
    const exponent = (bits >> 10) & 0x1f;
    const fraction = bits & 0x03ff;
    if (exponent === 0x1f) {
        return fraction === 0 ? sign * Infinity : Number.NaN;
    }
    if (exponent === 0) {
        if (fraction === 0) return sign < 0 ? -0 : 0;
        return sign * Math.pow(2, -14) * (fraction / 1024);
    }
    return sign * Math.pow(2, exponent - 15) * (1 + fraction / 1024);
}

function numberToHalfBits(value) {
    if (Number.isNaN(value)) return CANONICAL_NAN_HALF_BITS;
    if (value === Infinity) return 0x7c00;
    if (value === -Infinity) return 0xfc00;
    const sign = Object.is(value, -0) || value < 0 ? 0x8000 : 0;
    const absolute = Math.abs(value);
    if (absolute === 0) return sign;
    if (absolute > 65504) return sign | 0x7c00;
    if (absolute < Math.pow(2, -14)) {
        return sign | Math.min(Math.round(absolute / Math.pow(2, -24)), 0x03ff);
    }
    let exponent = Math.floor(Math.log2(absolute));
    let mantissa = Math.round((absolute / Math.pow(2, exponent) - 1) * 1024);
    if (mantissa === 1024) {
        exponent += 1;
        mantissa = 0;
    }
    return exponent > 15
        ? sign | 0x7c00
        : sign | ((exponent + 15) << 10) | mantissa;
}

function preservesNumber(value, candidate) {
    return Object.is(value, candidate) || value === candidate;
}

function validateCborFloat(value, width, bits = null) {
    if (Number.isNaN(value)) {
        if (width !== 16 || bits !== CANONICAL_NAN_HALF_BITS) {
            throw new Error('CBOR: non-canonical NaN encoding');
        }
        return Number.NaN;
    }
    if (!Number.isFinite(value))
        throw new Error('CBOR: infinities are forbidden');
    if (Number.isInteger(value)) {
        throw new Error('CBOR: integral floats must be reduced to integers');
    }
    const halfPreserves = preservesNumber(
        value,
        halfToNumber(numberToHalfBits(value))
    );
    if (width > 16 && halfPreserves) {
        throw new Error(
            'CBOR: float is wider than the shortest preserving width'
        );
    }
    if (width > 32) {
        floatView.setFloat32(0, value, false);
        if (preservesNumber(value, floatView.getFloat32(0, false))) {
            throw new Error(
                'CBOR: float is wider than the shortest preserving width'
            );
        }
    }
    return value;
}

function decodeCborFloat(additionalInfo, state) {
    if (additionalInfo === 25) {
        const bits = (readCborByte(state) << 8) | readCborByte(state);
        return validateCborFloat(halfToNumber(bits), 16, bits);
    }
    const width = additionalInfo === 26 ? 4 : 8;
    for (let index = 0; index < width; index += 1) {
        floatView.setUint8(index, readCborByte(state));
    }
    return validateCborFloat(
        width === 4
            ? floatView.getFloat32(0, false)
            : floatView.getFloat64(0, false),
        width * 8
    );
}

function decodeCborItem(state) {
    const head = readCborByte(state);
    const major = head >> 5;
    const additionalInfo = head & 0x1f;
    if (additionalInfo === 31)
        throw new Error('CBOR: indefinite lengths not supported');

    if (major === 0) return readCborUnsigned(additionalInfo, state, 'integer');
    if (major === 1) {
        const magnitude = readCborUnsigned(
            additionalInfo,
            state,
            'negative integer'
        );
        const value = -1n - BigInt(magnitude);
        if (value < I64_MIN)
            throw new Error('CBOR: integer outside Orch domain');
        return value >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(value) : value;
    }
    if (major === 2 || major === 3) {
        const length = readCborLength(
            additionalInfo,
            state,
            major === 2 ? 'byte string length' : 'text length'
        );
        const end = state.offset + length;
        if (end > state.bytes.length)
            throw new Error('CBOR: unexpected end of string');
        const value = state.bytes.slice(state.offset, end);
        state.offset = end;
        if (major === 2) return value;
        const text = textDecoder.decode(value);
        if (text !== text.normalize('NFC'))
            throw new Error('CBOR: text must be NFC normalized');
        return text;
    }
    if (major === 4) {
        const length = readCborLength(additionalInfo, state, 'array length');
        if (length > 0xffff) throw new Error('CBOR: array too large');
        return Array.from({length}, () => decodeCborItem(state));
    }
    if (major === 5) {
        const length = readCborLength(additionalInfo, state, 'map length');
        if (length > 0xffff) throw new Error('CBOR: map too large');
        const value = {};
        const seen = new Set();
        let previousKeyBytes = null;
        for (let index = 0; index < length; index += 1) {
            const keyStart = state.offset;
            const key = decodeCborItem(state);
            const keyBytes = state.bytes.slice(keyStart, state.offset);
            if (typeof key !== 'string')
                throw new Error('CBOR: map keys must be text strings');
            if (seen.has(key)) throw new Error('CBOR: duplicate map key');
            if (
                previousKeyBytes &&
                compareBytes(previousKeyBytes, keyBytes) > 0
            ) {
                throw new Error('CBOR: map keys not in deterministic order');
            }
            seen.add(key);
            previousKeyBytes = keyBytes;
            Object.defineProperty(value, key, {
                value: decodeCborItem(state),
                enumerable: true,
                writable: true,
                configurable: true,
            });
        }
        return value;
    }
    if (major === 6) {
        readCborUnsigned(additionalInfo, state, 'tag');
        throw new Error('CBOR: semantic tags are forbidden');
    }
    if (major === 7) {
        if (additionalInfo === 20) return false;
        if (additionalInfo === 21) return true;
        if (additionalInfo === 22) return null;
        if ([25, 26, 27].includes(additionalInfo)) {
            return decodeCborFloat(additionalInfo, state);
        }
        if (additionalInfo === 24) readCborByte(state);
        throw new Error(`CBOR: unsupported simple value ${additionalInfo}`);
    }
    throw new Error(`CBOR: unsupported major type ${major}`);
}

function cborDecode(bytesLike) {
    const state = {bytes: toUint8Array(bytesLike), offset: 0};
    const value = decodeCborItem(state);
    if (state.offset !== state.bytes.length)
        throw new Error('CBOR: trailing bytes detected');
    return value;
}

function makeFingerprintReadError(message, details = {}) {
    return Object.assign(new Error(message), details);
}

function readFingerprintPayload(bytesLike) {
    const wasmBytes = toUint8Array(bytesLike);
    let payloads;
    try {
        payloads = readCustomSectionPayloads(wasmBytes, 'orch.fingerprint');
    } catch (error) {
        throw makeFingerprintReadError(String(error?.message || error), {
            wasmInspectionFailure: true,
        });
    }
    if (payloads.length === 0) {
        throw makeFingerprintReadError(
            'Missing "orch.fingerprint" custom section in Orch WASM artifact',
            {fingerprintSectionCount: 0}
        );
    }
    if (payloads.length > 1) {
        throw makeFingerprintReadError(
            'Expected exactly one "orch.fingerprint" custom section',
            {fingerprintSectionCount: payloads.length}
        );
    }

    let payload;
    try {
        payload = cborDecode(payloads[0]);
    } catch (error) {
        throw makeFingerprintReadError(String(error?.message || error), {
            fingerprintDecodeFailure: true,
        });
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw makeFingerprintReadError(
            'Invalid orch.fingerprint payload: expected a CBOR map',
            {fingerprintPayloadShapeFailure: true}
        );
    }
    return payload;
}

function normalizeManifestEntries(entries) {
    if (!Array.isArray(entries))
        throw new TypeError('Manifest entries must be an array');
    const seen = new Set();
    const normalized = entries.map((entry, index) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            throw new TypeError(`Manifest entry ${index} must be an object`);
        }
        const file =
            typeof entry.file === 'string'
                ? entry.file.replace(/\\+/gu, '/').normalize('NFC')
                : null;
        if (file == null) {
            throw new TypeError(
                `Manifest entry ${index} field "file" must be a string`
            );
        }
        for (const field of ['role', 'version', 'hash']) {
            if (typeof entry[field] !== 'string') {
                throw new TypeError(
                    `Manifest entry ${index} field "${field}" must be a string`
                );
            }
        }
        if (!HASH_HEX_RE.test(entry.hash)) {
            throw new Error(
                `Manifest entry ${index} hash must be 64 lowercase hex characters`
            );
        }
        if (seen.has(file)) {
            throw new Error(
                `Duplicate manifest entry after POSIX+NFC normalization: ${file}`
            );
        }
        seen.add(file);
        return {
            file,
            hash: entry.hash,
            role: entry.role,
            version: entry.version,
        };
    });
    normalized.sort((left, right) =>
        left.file < right.file ? -1 : left.file > right.file ? 1 : 0
    );
    return normalized;
}

function concatBytes(left, right) {
    const bytes = new Uint8Array(left.length + right.length);
    bytes.set(left, 0);
    bytes.set(right, left.length);
    return bytes;
}

function bytesToHex(bytes) {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
        ''
    );
}

async function computeManifestRoot(entries, {sha256}) {
    const normalized = normalizeManifestEntries(entries);
    if (normalized.length === 0)
        throw new Error('Manifest root requires at least one entry');
    let level = await Promise.all(
        normalized.map((entry) =>
            sha256(textEncoder.encode(JSON.stringify(entry)))
        )
    );
    while (level.length > 1) {
        const next = [];
        for (let index = 0; index < level.length; index += 2) {
            next.push(
                index + 1 < level.length
                    ? await sha256(concatBytes(level[index], level[index + 1]))
                    : level[index]
            );
        }
        level = next;
    }
    return bytesToHex(level[0]);
}

function makeRuntimeError({
    code,
    message,
    details,
    component = 'verifySealedArtifact',
}) {
    if (code === 'ERR_SCHEMA') {
        return buildRuntimeError({
            code,
            message,
            origin: 'dva',
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
    return Object.freeze({
        ok: false,
        error: makeRuntimeError({code, message, details}),
    });
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

function verifyMetaFingerprintField({meta, fingerprintPayload, field}) {
    const metaValue = meta?.[field];
    if (!isNonEmptyString(metaValue)) return null;
    const embeddedValue = fingerprintPayload?.[field];
    if (embeddedValue === metaValue) return null;
    return fail(
        'ERR_SCHEMA',
        `ABI activation mismatch: embedded fingerprint ${field} does not match meta.${field}.`,
        {
            field,
            embedded: embeddedValue ?? null,
            meta: metaValue,
        }
    );
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
        return fail(
            'ERR_SCHEMA',
            'releaseManifest must be an object when provided.'
        );
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
            return fail(
                'ERR_SCHEMA',
                'verifySealedArtifact: wasmBytes must be Uint8Array or Buffer.'
            );
        }

        if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
            return fail(
                'ERR_SCHEMA',
                'verifySealedArtifact: meta must be a plain object.'
            );
        }

        let fingerprintPayload;
        try {
            fingerprintPayload = readFingerprintPayload(wasmBytes);
        } catch (error) {
            if (error?.wasmInspectionFailure) throw error;
            if (Number.isInteger(error?.fingerprintSectionCount)) {
                return fail(
                    'ERR_SCHEMA',
                    `Artifact must contain exactly one orch.fingerprint section (found ${error.fingerprintSectionCount}).`
                );
            }
            if (error?.fingerprintPayloadShapeFailure) {
                return fail(
                    'ERR_SCHEMA',
                    'Fingerprint payload must decode to an object.'
                );
            }
            return fail(
                'ERR_SCHEMA',
                `Failed to decode orch.fingerprint payload as deterministic CBOR: ${String(error?.message || error)}`
            );
        }

        const dva = fingerprintPayload.dva;
        if (!dva || typeof dva !== 'object' || Array.isArray(dva)) {
            return fail(
                'ERR_SCHEMA',
                'Fingerprint payload must contain a nested dva object.'
            );
        }

        if (!isNonEmptyString(dva.fingerprint)) {
            return fail(
                'ERR_SCHEMA',
                'Fingerprint payload dva.fingerprint must be a string.'
            );
        }
        if (!isNonEmptyString(dva.version)) {
            return fail(
                'ERR_SCHEMA',
                'Fingerprint payload dva.version must be a string.'
            );
        }
        if (!isNonEmptyString(dva.manifestRoot)) {
            return fail(
                'ERR_SCHEMA',
                'Fingerprint payload dva.manifestRoot must be a string.'
            );
        }

        for (const field of ['abi', 'abiHash']) {
            const mismatch = verifyMetaFingerprintField({
                meta,
                fingerprintPayload,
                field,
            });
            if (mismatch) return mismatch;
        }

        const imports = scanImportSet(wasmBytes);
        const deniedImports = [];

        for (const imp of imports) {
            const moduleName = imp.module;
            const isWasi =
                moduleName.startsWith('wasi:') || moduleName.startsWith('wasi');
            const isAllowed =
                moduleName === 'env' ||
                moduleName.startsWith(ALLOWED_IMPORT_PREFIX) ||
                (isWasi && allowWasi);

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
            return fail(
                'ERR_SCHEMA',
                'Target mismatch: requested target does not match meta.previewTarget.',
                {
                    requestedTarget,
                    metaPreviewTarget: metaTarget,
                }
            );
        }

        if (
            requestedTarget &&
            payloadTarget &&
            requestedTarget !== payloadTarget
        ) {
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
            return fail(
                'ERR_SCHEMA',
                'Target mismatch: meta.previewTarget and fingerprint.previewTarget differ.',
                {
                    metaPreviewTarget: metaTarget,
                    fingerprintPreviewTarget: payloadTarget,
                }
            );
        }

        if (
            isNonEmptyString(meta?.dva?.manifestRoot) &&
            dva.manifestRoot !== meta.dva.manifestRoot
        ) {
            return fail(
                'ERR_SCHEMA',
                'dva.manifestRoot mismatch between embedded payload and meta sidecar.',
                {
                    embedded: dva.manifestRoot,
                    meta: meta.dva.manifestRoot,
                }
            );
        }

        if (isNonEmptyString(meta.version) && dva.version !== meta.version) {
            return fail(
                'ERR_SCHEMA',
                'dva.version mismatch between embedded payload and meta sidecar.',
                {
                    embedded: dva.version,
                    meta: meta.version,
                }
            );
        }

        const metaFingerprint = pickMetaFingerprint(meta);
        if (
            isNonEmptyString(metaFingerprint) &&
            dva.fingerprint !== metaFingerprint
        ) {
            return fail(
                'ERR_SCHEMA',
                'dva.fingerprint mismatch between embedded payload and meta sidecar.',
                {
                    embedded: dva.fingerprint,
                    meta: metaFingerprint,
                }
            );
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

export {readFingerprintPayload, verifySealedArtifact};
