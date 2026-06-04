/**
 * @license Apache License 2.0
 * @file orch/dva/verifyReleaseBundle.js
 * @title Release Bundle Verifier
 * @description Verifier for signed release bundles, admission-bundle membership, artifact verification hashes, trust policy, support windows, revocation, and deterministic audit output.
 * @version 0.2.0
 */

const ZERO_SHA256 =
    '0000000000000000000000000000000000000000000000000000000₀₀₀₀₀₀₀₀';
const SHA256_HEX_RE = /^[0-9a-f]{64}$/u;
const TRUST_POLICY_SCHEMA = 'dva:part-b:trust-policy:1';
const REQUIRED_TRUST_POLICY_FIELDS = [
    'schema',
    'trustListVersion',
    'policyVersion',
    'trustListTtlSeconds',
    'staleTrustListBehavior',
    'offlineVerifierBehavior',
    'keyRolloverOverlapSeconds',
    'allowKids',
    'denyKids',
];
const ALLOWED_TRUST_POLICY_FIELDS = new Set([
    ...REQUIRED_TRUST_POLICY_FIELDS,
    'ext',
    'offline',
    'revocations',
    'rollover',
    'supportWindow',
    'trustListExpiresAt',
    'trustListIssuedAt',
    'trustRoots',
    'verificationTime',
]);
const STALE_TRUST_LIST_BEHAVIORS = new Set([
    'deny',
    'observe-only',
    'quarantine',
]);
const OFFLINE_VERIFIER_BEHAVIORS = new Set([
    'allow-if-fresh',
    'deny',
    'observe-only',
]);
const FIXED_DVA_COMPANION_ALIASES = new Map([
    ['dist/orch.release.json', 'orch.release.json'],
    ['orch.release.json', 'orch.release.json'],
    ['dist/orch.release.cose', 'orch.release.cose'],
    ['orch.release.cose', 'orch.release.cose'],
]);
const FIXED_DVA_COMPANIONS = new Set([
    'orch.release.json',
    'orch.release.cose',
]);
const te = new TextEncoder();
const td = new TextDecoder('utf-8', {fatal: true});

function cmp(a, b) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
}

function bytes(value, label = 'bytes') {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) {
        return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    if (typeof value === 'string') return te.encode(value);
    throw new TypeError(`${label} must be bytes or string`);
}

function concat(chunks) {
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
    }
    return out;
}

function hexFromBytes(input) {
    let out = '';
    for (const b of input) out += b.toString(16).padStart(2, '0');
    return out;
}

async function sha256Bytes(input, cryptoProvider) {
    const data = bytes(input);
    if (cryptoProvider?.sha256Bytes) {
        return bytes(await cryptoProvider.sha256Bytes(data), 'sha256Bytes result');
    }
    if (cryptoProvider?.sha256Hex) {
        const hex = await cryptoProvider.sha256Hex(data);
        if (!SHA256_HEX_RE.test(hex)) {
            throw new Error('cryptoProvider.sha256Hex returned invalid SHA-256 hex');
        }
        return Uint8Array.from(hex.match(/../gu).map((part) => parseInt(part, 16)));
    }
    if (globalThis.crypto?.subtle?.digest) {
        return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', data));
    }
    throw new Error('DVA verification requires a SHA-256 provider');
}

async function sha256Hex(input, cryptoProvider) {
    return hexFromBytes(await sha256Bytes(input, cryptoProvider));
}

function normalizePath(filePath) {
    if (typeof filePath !== 'string' || filePath.length === 0) {
        throw new TypeError('DVA path must be a non-empty string');
    }
    return filePath.replace(/\\+/gu, '/').replace(/^\/+/u, '').normalize('NFC');
}

function normalizeFixedDvaCompanionPath(filePath) {
    return FIXED_DVA_COMPANION_ALIASES.get(filePath) || filePath;
}

function encodeULEB(n) {
    if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) {
        throw new RangeError('encodeULEB expects a varuint32 value');
    }
    const out = [];
    let value = n >>> 0;
    do {
        let b = value & 0x7f;
        value >>>= 7;
        if (value) b |= 0x80;
        out.push(b);
    } while (value);
    return Uint8Array.from(out);
}

function decodeULEB(data, offset) {
    let result = 0;
    let shift = 0;
    let pos = offset;
    for (;;) {
        if (pos >= data.length) throw new Error('decodeULEB: out of range');
        const b = data[pos++];
        result |= (b & 0x7f) << shift;
        if ((b & 0x80) === 0) break;
        shift += 7;
        if (shift > 35) throw new Error('decodeULEB: overflow');
    }
    return [result, pos];
}

function assertWasmHeader(data) {
    if (
        data.length < 8 ||
        data[0] !== 0x00 ||
        data[1] !== 0x61 ||
        data[2] !== 0x73 ||
        data[3] !== 0x6d ||
        data[4] !== 0x01 ||
        data[5] !== 0x00 ||
        data[6] !== 0x00 ||
        data[7] !== 0x00
    ) {
        throw new Error('Not a valid WASM binary.');
    }
}

function readCustomSectionPayloads(wasmBytes, sectionName) {
    const data = bytes(wasmBytes, 'wasmBytes');
    assertWasmHeader(data);
    const nameUtf8 = te.encode(sectionName);
    const payloads = [];
    let p = 8;
    while (p < data.length) {
        const id = data[p++];
        const [size, afterSize] = decodeULEB(data, p);
        p = afterSize;
        const sectionEnd = p + size;
        if (sectionEnd > data.length) throw new Error('Malformed WASM section.');
        if (id === 0x00) {
            const [nameLen, afterNameLen] = decodeULEB(data, p);
            const nameStart = afterNameLen;
            const nameEnd = nameStart + nameLen;
            if (nameEnd > sectionEnd) throw new Error('Malformed custom section.');
            const matches =
                nameLen === nameUtf8.length &&
                nameUtf8.every((b, i) => b === data[nameStart + i]);
            if (matches) payloads.push(data.slice(nameEnd, sectionEnd));
        }
        p = sectionEnd;
    }
    return payloads;
}

function replaceCustomSectionBytes(wasmBytes, sectionName, payloadBytes) {
    const data = bytes(wasmBytes, 'wasmBytes');
    const payload = bytes(payloadBytes, 'payloadBytes');
    assertWasmHeader(data);
    const nameUtf8 = te.encode(sectionName);
    const chunks = [data.subarray(0, 8)];
    let removed = 0;
    let p = 8;
    while (p < data.length) {
        const sectionStart = p;
        const id = data[p++];
        const [size, afterSize] = decodeULEB(data, p);
        p = afterSize;
        const sectionEnd = p + size;
        if (sectionEnd > data.length) throw new Error('Malformed WASM section.');
        let keep = true;
        if (id === 0x00) {
            const [nameLen, afterNameLen] = decodeULEB(data, p);
            const nameStart = afterNameLen;
            const nameEnd = nameStart + nameLen;
            if (nameEnd > sectionEnd) throw new Error('Malformed custom section.');
            const matches =
                nameLen === nameUtf8.length &&
                nameUtf8.every((b, i) => b === data[nameStart + i]);
            if (matches) {
                keep = false;
                removed += 1;
            }
        }
        if (keep) chunks.push(data.subarray(sectionStart, sectionEnd));
        p = sectionEnd;
    }
    if (removed !== 1) {
        throw new Error(
            `Expected exactly one ${sectionName} custom section; found ${removed}`
        );
    }
    const name = concat([encodeULEB(nameUtf8.length), nameUtf8]);
    const content = concat([name, payload]);
    chunks.push(concat([Uint8Array.of(0x00), encodeULEB(content.length), content]));
    return concat(chunks);
}

function cborEncodeMajor(major, n) {
    if (!Number.isSafeInteger(n) || n < 0) {
        throw new TypeError('CBOR integer must be a non-negative safe integer');
    }
    if (n < 24) return Uint8Array.of((major << 5) | n);
    if (n <= 0xff) return Uint8Array.of((major << 5) | 24, n);
    if (n <= 0xffff) {
        return Uint8Array.of((major << 5) | 25, (n >> 8) & 0xff, n & 0xff);
    }
    return Uint8Array.of(
        (major << 5) | 26,
        (n >>> 24) & 0xff,
        (n >>> 16) & 0xff,
        (n >>> 8) & 0xff,
        n & 0xff
    );
}

function cborEncodeInt(value) {
    if (!Number.isSafeInteger(value)) throw new TypeError('CBOR integer expected');
    if (value >= 0) return cborEncodeMajor(0, value);
    return cborEncodeMajor(1, -1 - value);
}

function cborEncodeText(value) {
    const data = te.encode(String(value).normalize('NFC'));
    return concat([cborEncodeMajor(3, data.length), data]);
}

function cborEncodeBytes(value) {
    const data = bytes(value);
    return concat([cborEncodeMajor(2, data.length), data]);
}

function compareBytes(a, b) {
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        const d = a[i] - b[i];
        if (d !== 0) return d;
    }
    return a.length - b.length;
}

function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

function cborEncode(value) {
    if (value instanceof Uint8Array || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
        return cborEncodeBytes(value);
    }
    if (typeof value === 'number') return cborEncodeInt(value);
    if (typeof value === 'string') return cborEncodeText(value);
    if (typeof value === 'boolean') return Uint8Array.of(value ? 0xf5 : 0xf4);
    if (value === null) return Uint8Array.of(0xf6);
    if (Array.isArray(value)) return concat([cborEncodeMajor(4, value.length), ...value.map(cborEncode)]);
    if (value instanceof Map) return cborEncodeTextMap(mapToObject(value));
    if (isPlainObject(value)) {
        const entries = Object.keys(value).map((rawKey) => {
            const key = /^-?\d+$/u.test(rawKey) ? Number(rawKey) : rawKey;
            return {key, value: value[rawKey], keyBytes: cborEncode(key)};
        });
        entries.sort((a, b) => compareBytes(a.keyBytes, b.keyBytes));
        return concat([
            cborEncodeMajor(5, entries.length),
            ...entries.flatMap((entry) => [entry.keyBytes, cborEncode(entry.value)]),
        ]);
    }
    throw new TypeError(`Unsupported CBOR value: ${typeof value}`);
}

function cborDecode(dataLike) {
    const data = bytes(dataLike);
    const state = {data, offset: 0};
    const value = cborDecodeItem(state);
    if (state.offset !== data.length) throw new Error('CBOR trailing bytes');
    return value;
}

function readByte(state) {
    if (state.offset >= state.data.length) throw new Error('CBOR unexpected end');
    return state.data[state.offset++];
}

function cborReadUint(ai, state) {
    if (ai < 24) return ai;
    if (ai === 24) return readByte(state);
    if (ai === 25) return (readByte(state) << 8) | readByte(state);
    if (ai === 26) {
        return (
            (readByte(state) * 0x1000000) +
            (readByte(state) << 16) +
            (readByte(state) << 8) +
            readByte(state)
        );
    }
    throw new Error('Unsupported CBOR integer width');
}

function cborDecodeItem(state) {
    const head = readByte(state);
    const major = head >> 5;
    const ai = head & 0x1f;
    if (ai === 31) throw new Error('Indefinite CBOR is unsupported');
    if (major === 0) return cborReadUint(ai, state);
    if (major === 1) return -1 - cborReadUint(ai, state);
    if (major === 2) {
        const len = cborReadUint(ai, state);
        const end = state.offset + len;
        if (end > state.data.length) throw new Error('CBOR byte string overflow');
        const value = state.data.slice(state.offset, end);
        state.offset = end;
        return value;
    }
    if (major === 3) {
        const len = cborReadUint(ai, state);
        const end = state.offset + len;
        if (end > state.data.length) throw new Error('CBOR text overflow');
        const value = td.decode(state.data.subarray(state.offset, end));
        state.offset = end;
        return value;
    }
    if (major === 4) {
        const len = cborReadUint(ai, state);
        const out = [];
        for (let i = 0; i < len; i++) out.push(cborDecodeItem(state));
        return out;
    }
    if (major === 5) {
        const len = cborReadUint(ai, state);
        const out = new Map();
        for (let i = 0; i < len; i++) {
            out.set(cborDecodeItem(state), cborDecodeItem(state));
        }
        return out;
    }
    if (major === 7) {
        if (ai === 20) return false;
        if (ai === 21) return true;
        if (ai === 22) return null;
    }
    throw new Error(`Unsupported CBOR major type ${major}`);
}

function cborDecodeTextMap(dataLike) {
    const decoded = cborDecode(dataLike);
    if (!(decoded instanceof Map)) throw new Error('Expected CBOR map');
    return mapToObject(decoded);
}

function cborDecodedToPlain(value) {
    if (value instanceof Map) return mapToObject(value);
    if (Array.isArray(value)) return value.map(cborDecodedToPlain);
    return value;
}

function mapToObject(map) {
    const out = {};
    for (const [key, value] of map.entries()) {
        if (typeof key !== 'string') throw new Error('Expected text-keyed CBOR map');
        out[key] = cborDecodedToPlain(value);
    }
    return out;
}

function cborEncodeTextMap(value) {
    if (!isPlainObject(value)) throw new TypeError('Expected plain object');
    const entries = Object.keys(value).map((key) => ({
        key,
        value: value[key],
        keyBytes: cborEncodeText(key),
    }));
    entries.sort((a, b) => compareBytes(a.keyBytes, b.keyBytes));
    return concat([
        cborEncodeMajor(5, entries.length),
        ...entries.flatMap((entry) => [entry.keyBytes, cborEncodeTextMapValue(entry.value)]),
    ]);
}

function cborEncodeTextMapValue(value) {
    const normalized = cborDecodedToPlain(value);
    if (isPlainObject(normalized)) return cborEncodeTextMap(normalized);
    if (Array.isArray(normalized)) {
        return concat([
            cborEncodeMajor(4, normalized.length),
            ...normalized.map(cborEncodeTextMapValue),
        ]);
    }
    return cborEncode(normalized);
}

function normalizeDvaProjectionBytes(wasmBytes) {
    const payloads = readCustomSectionPayloads(wasmBytes, 'orch.fingerprint');
    if (payloads.length !== 1) {
        throw new Error(`Expected exactly one orch.fingerprint section; found ${payloads.length}`);
    }
    const payload = cborDecodeTextMap(payloads[0]);
    if (!isPlainObject(payload.dva)) {
        throw new Error('orch.fingerprint payload is missing DVA map');
    }
    payload.dva = {...payload.dva, manifestRoot: ZERO_SHA256};
    return replaceCustomSectionBytes(
        wasmBytes,
        'orch.fingerprint',
        cborEncodeTextMap(payload)
    );
}

async function computeArtifactVerificationHash(artifactBytes, options = {}) {
    const data = bytes(artifactBytes, 'artifactBytes');
    let projection = data;
    try {
        const payloads = readCustomSectionPayloads(data, 'orch.fingerprint');
        if (payloads.length === 1) {
            const payload = cborDecodeTextMap(payloads[0]);
            if (isPlainObject(payload.dva)) {
                projection = normalizeDvaProjectionBytes(data);
            }
        }
    } catch (error) {
        if (options.requireDvaProjection) throw error;
        projection = data;
    }
    return sha256Hex(projection, options.cryptoProvider);
}

function normalizeEntries(entries) {
    if (!Array.isArray(entries) || entries.length === 0) {
        throw new TypeError('manifest.entries must be a non-empty array');
    }
    const seen = new Set();
    const normalized = entries.map((entry, index) => {
        if (!isPlainObject(entry)) throw new TypeError(`entries[${index}] must be an object`);
        const file = normalizePath(entry.file);
        if (seen.has(file)) throw new Error(`Duplicate manifest entry: ${file}`);
        seen.add(file);
        for (const key of ['role', 'version', 'hash']) {
            if (typeof entry[key] !== 'string') {
                throw new TypeError(`entries[${index}].${key} must be a string`);
            }
        }
        if (!SHA256_HEX_RE.test(entry.hash)) {
            throw new Error(`entries[${index}].hash must be SHA-256 hex`);
        }
        return {file, hash: entry.hash, role: entry.role, version: entry.version};
    });
    normalized.sort((a, b) => cmp(a.file, b.file));
    return normalized;
}

async function computeManifestRoot(entries, options = {}) {
    let level = await Promise.all(
        normalizeEntries(entries).map((entry) =>
            sha256Bytes(
                JSON.stringify({
                    file: entry.file,
                    hash: entry.hash,
                    role: entry.role,
                    version: entry.version,
                }),
                options.cryptoProvider
            )
        )
    );
    while (level.length > 1) {
        const next = [];
        for (let i = 0; i < level.length; i += 2) {
            next.push(
                i + 1 < level.length
                    ? await sha256Bytes(concat([level[i], level[i + 1]]), options.cryptoProvider)
                    : level[i]
            );
        }
        level = next;
    }
    return hexFromBytes(level[0]);
}

function canonicalJson(value) {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    if (isPlainObject(value)) {
        return `{${Object.keys(value)
            .sort(cmp)
            .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
            .join(',')}}`;
    }
    const encoded = JSON.stringify(value);
    if (encoded === undefined) {
        throw new TypeError('DVA canonical JSON does not support undefined values');
    }
    return encoded;
}

function canonicalJsonBytes(value) {
    return te.encode(`${canonicalJson(value)}\n`);
}

function sameBytes(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function skipJsonWhitespace(text, index) {
    let i = index;
    while (/[\t\n\r ]/u.test(text[i] || '')) i++;
    return i;
}

function findJsonStringEnd(text, index) {
    let escaped = false;
    for (let i = index + 1; i < text.length; i++) {
        const ch = text[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            escaped = true;
            continue;
        }
        if (ch === '"') return i + 1;
    }
    throw new Error('Unterminated JSON string');
}

function scanJsonString(text, index) {
    if (text[index] !== '"') throw new Error('Expected JSON string');
    const end = findJsonStringEnd(text, index);
    return {value: JSON.parse(text.slice(index, end)), next: end};
}

function scanJsonLiteral(text, index, literal) {
    if (!text.startsWith(literal, index)) {
        throw new Error(`Expected JSON literal ${literal}`);
    }
    return index + literal.length;
}

function scanJsonNumber(text, index) {
    const match = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/uy.exec(text.slice(index));
    if (!match) throw new Error('Expected JSON number');
    return index + match[0].length;
}

function scanJsonArray(text, index) {
    let i = skipJsonWhitespace(text, index + 1);
    if (text[i] === ']') return i + 1;
    for (;;) {
        i = scanJsonValue(text, i);
        i = skipJsonWhitespace(text, i);
        if (text[i] === ']') return i + 1;
        if (text[i] !== ',') throw new Error('Expected comma or array end');
        i = skipJsonWhitespace(text, i + 1);
    }
}

function scanJsonObject(text, index) {
    const keys = new Set();
    let i = skipJsonWhitespace(text, index + 1);
    if (text[i] === '}') return i + 1;
    for (;;) {
        const key = scanJsonString(text, i);
        if (keys.has(key.value)) {
            throw new Error(`Duplicate JSON object key: ${key.value}`);
        }
        keys.add(key.value);
        i = skipJsonWhitespace(text, key.next);
        if (text[i] !== ':') throw new Error('Expected object key separator');
        i = scanJsonValue(text, skipJsonWhitespace(text, i + 1));
        i = skipJsonWhitespace(text, i);
        if (text[i] === '}') return i + 1;
        if (text[i] !== ',') throw new Error('Expected comma or object end');
        i = skipJsonWhitespace(text, i + 1);
    }
}

function scanJsonValue(text, index) {
    const i = skipJsonWhitespace(text, index);
    const ch = text[i];
    if (ch === '{') return scanJsonObject(text, i);
    if (ch === '[') return scanJsonArray(text, i);
    if (ch === '"') return scanJsonString(text, i).next;
    if (ch === 't') return scanJsonLiteral(text, i, 'true');
    if (ch === 'f') return scanJsonLiteral(text, i, 'false');
    if (ch === 'n') return scanJsonLiteral(text, i, 'null');
    return scanJsonNumber(text, i);
}

function assertNoDuplicateJsonKeys(text) {
    const end = scanJsonValue(text, 0);
    if (skipJsonWhitespace(text, end) !== text.length) {
        throw new Error('Trailing JSON content is not allowed');
    }
}

function parseIsoMillis(value, label, errors) {
    if (value == null || value === '') return null;
    if (typeof value !== 'string') {
        addError(errors, 'invalid-trust-time', `${label} must be an ISO string.`, {
            field: label,
        });
        return null;
    }
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) {
        addError(errors, 'invalid-trust-time', `${label} must be a valid ISO timestamp.`, {
            field: label,
            value,
        });
        return null;
    }
    return parsed;
}

function normalizeTtlSeconds(value, errors) {
    if (value == null) return null;
    const ttl = Number(value);
    if (!Number.isInteger(ttl) || ttl <= 0 || !Number.isSafeInteger(ttl)) {
        addError(errors, 'invalid-trust-list-ttl', 'trustListTtlSeconds must be a positive safe integer.', {
            trustListTtlSeconds: value,
        });
        return null;
    }
    return ttl;
}

function normalizedArray(value) {
    return Array.from(new Set(Array.isArray(value) ? value : [])).sort(cmp);
}

async function trustRootsIdentity(trustRoots, cryptoProvider) {
    const keys = Array.isArray(trustRoots?.keys) ? trustRoots.keys : [];
    const out = [];
    for (const key of keys) {
        if (!key || typeof key.kid !== 'string') continue;
        out.push({
            kid: key.kid,
            publicKeySha256:
                typeof key.publicKeyPem === 'string'
                    ? await sha256Hex(key.publicKeyPem, cryptoProvider)
                    : null,
        });
    }
    out.sort((a, b) => cmp(a.kid, b.kid));
    return out;
}

function revocationIdentity(revocations = {}) {
    return {
        revokedAdmissionIdentities: normalizedArray(
            revocations.revokedAdmissionIdentities
        ),
        revokedKids: normalizedArray(revocations.revokedKids),
        revokedManifestRoots: normalizedArray(revocations.revokedManifestRoots),
    };
}

function supportWindowIdentity(supportWindow = null) {
    if (!supportWindow) return null;
    return {
        notAfter: supportWindow.notAfter || null,
        notBefore: supportWindow.notBefore || null,
    };
}

async function buildAdmissionIdentityInput({
    actualArtifactHashes,
    bundle,
    companions,
    declared,
    embedded,
    manifest,
    manifestCanonicalHash,
    missingRequiredMembers,
    policy,
    selected,
    signerKid,
    undeclaredMembers,
    cryptoProvider,
}) {
    const selectedEntry = declared.get(selected) || null;
    const presentedMembers = Array.from(bundle.keys()).sort(cmp);
    const declaredFiles = Array.from(declared.keys()).sort(cmp);
    return {
        admissionBundleMembership: {
            missingRequiredMembers: [...missingRequiredMembers].sort(cmp),
            presentedMembers,
            undeclaredMembers: [...undeclaredMembers].sort(cmp),
        },
        compatibilityOnlyDenial: {
            selectedArtifactDeclared: !!selectedEntry,
            selectedArtifactPresented: bundle.has(selected),
        },
        embeddedFingerprintConsistency: {
            embeddedFingerprint: embedded.fingerprint || null,
            embeddedManifestRoot: embedded.manifestRoot || null,
            manifestFingerprint: manifest?.fingerprint || null,
            matchesFingerprint:
                !!manifest?.fingerprint &&
                !!embedded.fingerprint &&
                embedded.fingerprint === manifest.fingerprint,
            matchesManifestRoot:
                !!manifest?.manifestRoot &&
                !!embedded.manifestRoot &&
                embedded.manifestRoot === manifest.manifestRoot,
        },
        manifestDigest: manifestCanonicalHash,
        manifestMembership: {
            declaredFiles,
            selectedArtifact: selected,
            selectedArtifactDeclared: !!selectedEntry,
        },
        manifestRoot: manifest?.manifestRoot || null,
        revocationState: revocationIdentity(policy.revocations),
        selectedArtifact: selected,
        selectedArtifactVerificationHash: {
            actual: actualArtifactHashes.get(selected) || null,
            declared: selectedEntry?.hash || null,
        },
        signerKid: signerKid || null,
        supportWindowPolicy: supportWindowIdentity(policy.supportWindow),
        trustListPolicy: {
            allowKids: policy.allowKids,
            denyKids: policy.denyKids,
            keyRolloverOverlapSeconds: policy.keyRolloverOverlapSeconds,
            offline: policy.offline,
            offlineVerifierBehavior: policy.offlineVerifierBehavior,
            policyVersion: policy.policyVersion,
            rollover: policy.rollover || {},
            schema: policy.schema,
            staleTrustListBehavior: policy.staleTrustListBehavior,
            trustListExpiresAt: policy.trustListExpiresAt,
            trustListIssuedAt: policy.trustListIssuedAt,
            trustListTtlSeconds: policy.trustListTtlSeconds,
            trustListVersion: policy.trustListVersion,
            trustRoots: await trustRootsIdentity(policy.trustRoots, cryptoProvider),
        },
    };
}

function isSerializedPolicy(value) {
    return (
        typeof value === 'string' ||
        value instanceof Uint8Array ||
        value instanceof ArrayBuffer ||
        ArrayBuffer.isView(value)
    );
}

function parseTrustPolicyInput(input, errors) {
    if (!isSerializedPolicy(input)) return input;
    try {
        const text = typeof input === 'string' ? input : td.decode(bytes(input));
        assertNoDuplicateJsonKeys(text);
        return JSON.parse(text);
    } catch (error) {
        const message = String(error?.message || error);
        const duplicateKey = message.startsWith('Duplicate JSON object key:');
        addError(
            errors,
            duplicateKey ? 'duplicate-key-trust-policy' : 'malformed-trust-policy',
            duplicateKey
                ? 'Trust policy JSON contains a duplicate object key.'
                : 'Trust policy JSON is malformed.'
        );
        return null;
    }
}

function addMalformedPolicyError(errors, message, details = {}) {
    addError(errors, 'malformed-trust-policy', message, details);
}

function validateNonEmptyString(policy, field, errors) {
    if (typeof policy[field] !== 'string' || policy[field].length === 0) {
        addMalformedPolicyError(
            errors,
            `${field} must be a non-empty string.`,
            {field}
        );
    }
}

function validateInteger(policy, field, minimum, errors) {
    const value = policy[field];
    if (
        !Number.isSafeInteger(value) ||
        value < minimum
    ) {
        addMalformedPolicyError(
            errors,
            `${field} must be a safe JSON integer greater than or equal to ${minimum}.`,
            {field}
        );
    }
}

function validateKidArray(policy, field, errors) {
    const kids = policy[field];
    if (!Array.isArray(kids)) {
        addMalformedPolicyError(errors, `${field} must be an array.`, {field});
        return;
    }
    const seen = new Set();
    let previous = null;
    for (let index = 0; index < kids.length; index++) {
        const kid = kids[index];
        if (typeof kid !== 'string' || kid.length === 0) {
            addMalformedPolicyError(
                errors,
                `${field}[${index}] must be a non-empty string.`,
                {field, index}
            );
            continue;
        }
        if (seen.has(kid)) {
            addMalformedPolicyError(
                errors,
                `${field} must not contain duplicate kid values.`,
                {field}
            );
        }
        if (previous !== null && cmp(previous, kid) > 0) {
            addMalformedPolicyError(
                errors,
                `${field} must be sorted using the canonical comparator.`,
                {field}
            );
        }
        seen.add(kid);
        previous = kid;
    }
}

function validateTrustPolicy(policy, errors) {
    if (!isPlainObject(policy)) {
        addMalformedPolicyError(errors, 'Trust policy must be a JSON object.');
        return;
    }

    for (const field of REQUIRED_TRUST_POLICY_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(policy, field)) {
            addMalformedPolicyError(
                errors,
                `Trust policy is missing required field ${field}.`,
                {field}
            );
        }
    }
    for (const field of Object.keys(policy).sort(cmp)) {
        if (!ALLOWED_TRUST_POLICY_FIELDS.has(field)) {
            addMalformedPolicyError(
                errors,
                'Trust policy contains an unknown top-level field.'
            );
        }
    }

    if (policy.schema !== TRUST_POLICY_SCHEMA) {
        addMalformedPolicyError(
            errors,
            `schema must be exactly ${TRUST_POLICY_SCHEMA}.`,
            {field: 'schema'}
        );
    }
    validateNonEmptyString(policy, 'trustListVersion', errors);
    validateNonEmptyString(policy, 'policyVersion', errors);
    validateInteger(policy, 'trustListTtlSeconds', 1, errors);
    validateInteger(policy, 'keyRolloverOverlapSeconds', 0, errors);

    if (!STALE_TRUST_LIST_BEHAVIORS.has(policy.staleTrustListBehavior)) {
        addMalformedPolicyError(
            errors,
            'staleTrustListBehavior is invalid.',
            {field: 'staleTrustListBehavior'}
        );
    }
    if (!OFFLINE_VERIFIER_BEHAVIORS.has(policy.offlineVerifierBehavior)) {
        addMalformedPolicyError(
            errors,
            'offlineVerifierBehavior is invalid.',
            {field: 'offlineVerifierBehavior'}
        );
    }
    if (
        Object.prototype.hasOwnProperty.call(policy, 'ext') &&
        !isPlainObject(policy.ext)
    ) {
        addMalformedPolicyError(errors, 'ext must be an object.', {field: 'ext'});
    }
    validateKidArray(policy, 'allowKids', errors);
    validateKidArray(policy, 'denyKids', errors);
}

function normalizePolicy(input, errors) {
    const policy = parseTrustPolicyInput(input, errors);
    validateTrustPolicy(policy, errors);
    if (!isPlainObject(policy)) return null;
    return {
        schema: policy.schema,
        trustListVersion: policy.trustListVersion,
        policyVersion: policy.policyVersion,
        trustListTtlSeconds: policy.trustListTtlSeconds,
        staleTrustListBehavior: policy.staleTrustListBehavior,
        offlineVerifierBehavior: policy.offlineVerifierBehavior,
        keyRolloverOverlapSeconds: policy.keyRolloverOverlapSeconds,
        allowKids: policy.allowKids,
        denyKids: policy.denyKids,
        verificationTime: policy.verificationTime || null,
        trustListIssuedAt: policy.trustListIssuedAt || null,
        trustListExpiresAt: policy.trustListExpiresAt || null,
        offline: policy.offline === true,
        supportWindow: policy.supportWindow || null,
        revocations: policy.revocations || {},
        rollover: policy.rollover || {},
        trustRoots: policy.trustRoots || {},
    };
}

function failedPolicyAudit() {
    return {
        signerKid: '',
        trustDecision: 'deny',
        trustListVersion: '',
        policyVersion: '',
        verificationTimestampClass: 'omitted-deterministic',
        admissionIdentity: '',
    };
}

function compareIso(a, b) {
    if (!a || !b) return 0;
    const left = Date.parse(a);
    const right = Date.parse(b);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return 0;
    return left === right ? 0 : left < right ? -1 : 1;
}

function addError(errors, code, message, details = {}) {
    errors.push({code, message, details});
}

function getMember(bundle, name) {
    return bundle.get(normalizePath(name)) ?? bundle.get(name);
}

function decodeCoseSign1(coseBytes) {
    const cose = cborDecode(coseBytes);
    if (!Array.isArray(cose) || cose.length !== 4) {
        throw new Error('orch.release.cose must be COSE_Sign1 array');
    }
    const [protectedBytes, unprotected, payload, signature] = cose;
    if (!(protectedBytes instanceof Uint8Array)) throw new Error('COSE protected header must be bstr');
    if (!(payload instanceof Uint8Array)) throw new Error('COSE payload must be bstr');
    if (!(signature instanceof Uint8Array)) throw new Error('COSE signature must be bstr');
    const protectedHeader = cborDecode(protectedBytes);
    if (!(protectedHeader instanceof Map)) throw new Error('COSE protected header must be map');
    return {protectedBytes, protectedHeader, unprotected, payload, signature};
}

function encodeCoseSigStructure({protectedBytes, payload}) {
    return cborEncode(['Signature1', protectedBytes, new Uint8Array(), payload]);
}

function selectPublicKey(kid, policy) {
    const roots = policy.trustRoots;
    const keys = Array.isArray(roots.keys) ? roots.keys : [];
    return keys.find((entry) => entry?.kid === kid)?.publicKeyPem || null;
}

async function verifySignature({coseBytes, manifestBytes, policy, cryptoProvider, errors}) {
    let cose;
    try {
        cose = decodeCoseSign1(coseBytes);
    } catch (error) {
        addError(errors, 'malformed-envelope', String(error?.message || error));
        return null;
    }

    const alg = cose.protectedHeader.get(1);
    const kidBytes = cose.protectedHeader.get(4);
    const kid = kidBytes instanceof Uint8Array ? td.decode(kidBytes) : null;
    if (alg !== -8) {
        addError(errors, 'unsupported-algorithm', 'COSE alg must be EdDSA (-8).', {alg});
    }
    if (!kid) {
        addError(errors, 'missing-kid', 'COSE protected header is missing kid.');
    }

    const digest = await sha256Bytes(manifestBytes, cryptoProvider);
    if (hexFromBytes(cose.payload) !== hexFromBytes(digest)) {
        addError(errors, 'manifest-digest-mismatch', 'COSE payload does not match manifest digest.');
    }

    if (kid) {
        if (policy.denyKids.includes(kid)) {
            addError(errors, 'denied-kid', 'Signer kid is denied.', {kid});
        }
        if (!policy.allowKids.includes(kid)) {
            addError(errors, 'unallowed-kid', 'Signer kid is not allowed.', {kid});
        }
    }

    const publicKeyPem = kid ? selectPublicKey(kid, policy) : null;
    if (kid && !publicKeyPem) {
        addError(errors, 'missing-public-key', 'No public key is available for signer kid.', {kid});
    }
    if (publicKeyPem) {
        if (!cryptoProvider?.verifyEd25519) {
            throw new Error('DVA signature verification requires verifyEd25519 provider');
        }
        const ok = await cryptoProvider.verifyEd25519({
            publicKeyPem,
            data: encodeCoseSigStructure(cose),
            signature: cose.signature,
        });
        if (!ok) addError(errors, 'invalid-signature', 'COSE Ed25519 signature is invalid.', {kid});
    }
    return kid;
}

function evaluateTrustPolicy({policy, signerKid, admissionIdentity, manifestRoot, errors}) {
    const timeClass =
        policy.verificationTime || policy.trustListIssuedAt || policy.trustListExpiresAt
            ? 'cached-trust-clock'
            : 'omitted-deterministic';
    const now = policy.verificationTime;
    const preexistingErrorCount = errors.length;
    let policyDecision = 'accept';

    if (policy.offline && policy.offlineVerifierBehavior === 'deny') {
        addError(errors, 'offline-denied', 'Offline verification is denied by policy.');
        policyDecision = 'deny';
    } else if (
        policy.offline &&
        policy.offlineVerifierBehavior === 'observe-only'
    ) {
        addError(
            errors,
            'offline-observe-only',
            'Offline verification is observe-only under policy.'
        );
        policyDecision = 'observe-only';
    }
    const nowMillis = parseIsoMillis(now, 'verificationTime', errors);
    const explicitExpiryMillis = parseIsoMillis(
        policy.trustListExpiresAt,
        'trustListExpiresAt',
        errors
    );
    const issuedMillis = parseIsoMillis(
        policy.trustListIssuedAt,
        'trustListIssuedAt',
        errors
    );
    const ttlSeconds = normalizeTtlSeconds(policy.trustListTtlSeconds, errors);
    const ttlExpiryMillis =
        issuedMillis != null && ttlSeconds != null
            ? issuedMillis + ttlSeconds * 1000
            : null;
    const expiryMillis =
        explicitExpiryMillis != null && ttlExpiryMillis != null
            ? Math.min(explicitExpiryMillis, ttlExpiryMillis)
            : (explicitExpiryMillis ?? ttlExpiryMillis);

    if (nowMillis != null && expiryMillis != null && nowMillis > expiryMillis) {
        addError(errors, 'stale-trust-list', 'Trust list is stale under policy.', {
            staleTrustListBehavior: policy.staleTrustListBehavior,
            trustListExpiresAt: policy.trustListExpiresAt,
            trustListIssuedAt: policy.trustListIssuedAt,
            trustListTtlSeconds: policy.trustListTtlSeconds,
            ttlDerivedExpiresAt:
                ttlExpiryMillis == null
                    ? null
                    : new Date(ttlExpiryMillis).toISOString(),
            verificationTime: now,
        });
        if (policy.staleTrustListBehavior === 'deny') {
            policyDecision = 'deny';
        } else if (
            policy.staleTrustListBehavior === 'quarantine' ||
            policyDecision === 'accept'
        ) {
            policyDecision = policy.staleTrustListBehavior;
        }
    }
    if (now && policy.supportWindow?.notBefore && compareIso(now, policy.supportWindow.notBefore) < 0) {
        addError(errors, 'support-window-not-started', 'Support window has not started.');
    }
    if (now && policy.supportWindow?.notAfter && compareIso(policy.supportWindow.notAfter, now) < 0) {
        addError(errors, 'support-window-expired', 'Support window is expired.');
    }

    const revokedKids = new Set(policy.revocations.revokedKids || []);
    const revokedManifestRoots = new Set(policy.revocations.revokedManifestRoots || []);
    const revokedAdmissionIdentities = new Set(policy.revocations.revokedAdmissionIdentities || []);
    if (signerKid && revokedKids.has(signerKid)) {
        addError(errors, 'revoked-signer', 'Signer kid is revoked.', {kid: signerKid});
    }
    if (revokedManifestRoots.has(manifestRoot)) {
        addError(errors, 'revoked-release-member', 'Manifest root is revoked.', {manifestRoot});
    }
    if (revokedAdmissionIdentities.has(admissionIdentity)) {
        addError(errors, 'revoked-admission-identity', 'Admission identity is revoked.', {admissionIdentity});
    }
    if (
        signerKid &&
        now &&
        policy.rollover?.overlapNotAfterByKid?.[signerKid] &&
        compareIso(policy.rollover.overlapNotAfterByKid[signerKid], now) < 0
    ) {
        addError(errors, 'rollover-overlap-expired', 'Signer rollover overlap is expired.', {kid: signerKid});
    }

    const nonDenyPolicyErrors = new Set([
        'offline-observe-only',
        'stale-trust-list',
    ]);
    const hasHardFailure =
        preexistingErrorCount > 0 ||
        errors.some((error) => !nonDenyPolicyErrors.has(error.code)) ||
        (errors.some((error) => error.code === 'stale-trust-list') &&
            policy.staleTrustListBehavior === 'deny');

    return {
        timeClass,
        trustDecision: hasHardFailure ? 'deny' : policyDecision,
    };
}

function parseManifest(manifestBytes) {
    const suppliedBytes = bytes(manifestBytes, 'manifestBytes');
    const text = td.decode(suppliedBytes);
    assertNoDuplicateJsonKeys(text);
    const manifest = JSON.parse(text);
    if (!isPlainObject(manifest)) throw new Error('Manifest must be an object');
    if (!SHA256_HEX_RE.test(manifest.manifestRoot)) {
        throw new Error('manifest.manifestRoot must be SHA-256 hex');
    }
    const canonicalBytes = canonicalJsonBytes(manifest);
    return {canonicalBytes, manifest};
}

function normalizeBundleMembers(members) {
    if (members instanceof Map) {
        return normalizeBundleMemberEntries(Array.from(members.entries()));
    }
    if (isPlainObject(members)) {
        return normalizeBundleMemberEntries(
            Object.keys(members).map((k) => [k, members[k]])
        );
    }
    throw new TypeError('bundle members must be a Map or object');
}

function normalizeBundleMemberEntries(inputEntries) {
    const bundle = new Map();
    const fixedCompanionAliases = new Map();
    const duplicateFixedCompanionAliases = [];

    for (const [k, v] of inputEntries) {
        const normalizedPath = normalizePath(k);
        const memberPath = normalizeFixedDvaCompanionPath(normalizedPath);
        if (FIXED_DVA_COMPANIONS.has(memberPath)) {
            const aliases = fixedCompanionAliases.get(memberPath) || [];
            if (!aliases.includes(normalizedPath)) {
                aliases.push(normalizedPath);
                aliases.sort(cmp);
            }
            fixedCompanionAliases.set(memberPath, aliases);
            if (aliases.length === 2) {
                duplicateFixedCompanionAliases.push({
                    companion: memberPath,
                    aliases: [...aliases],
                });
            }
            if (!bundle.has(memberPath)) {
                bundle.set(memberPath, bytes(v, normalizedPath));
            }
            continue;
        }
        bundle.set(memberPath, bytes(v, normalizedPath));
    }

    duplicateFixedCompanionAliases.sort((a, b) => cmp(a.companion, b.companion));
    return {bundle, duplicateFixedCompanionAliases};
}

async function verifyReleaseBundle({
    members,
    selectedArtifact,
    trustPolicy = {},
    cryptoProvider,
} = {}) {
    const errors = [];
    const policy = normalizePolicy(trustPolicy, errors);
    if (errors.length > 0) {
        const audit = failedPolicyAudit();
        return Object.freeze({
            ok: false,
            trustDecision: audit.trustDecision,
            audit,
            manifestRoot: null,
            errors: errors.sort(
                (a, b) => cmp(a.code, b.code) || cmp(a.message, b.message)
            ),
        });
    }

    const {
        bundle,
        duplicateFixedCompanionAliases,
    } = normalizeBundleMembers(members || {});
    const selected = normalizePath(selectedArtifact || '');

    const manifestBytes = getMember(bundle, 'orch.release.json');
    const coseBytes = getMember(bundle, 'orch.release.cose');
    const selectedBytes = getMember(bundle, selected);

    for (const duplicate of duplicateFixedCompanionAliases) {
        addError(
            errors,
            'duplicate-fixed-companion-alias',
            'Admission bundle contains both fixed DVA companion aliases.',
            duplicate
        );
    }

    if (!selectedBytes) addError(errors, 'missing-selected-artifact', 'Selected artifact is missing.', {selected});
    const missingRequiredMembers = new Set();
    if (!selectedBytes) missingRequiredMembers.add(selected);
    if (!manifestBytes) {
        missingRequiredMembers.add('orch.release.json');
        addError(errors, 'missing-companion', 'orch.release.json is missing.');
    }
    if (!coseBytes) {
        missingRequiredMembers.add('orch.release.cose');
        addError(errors, 'missing-companion', 'orch.release.cose is missing.');
    }

    let manifest = null;
    let canonicalManifestBytes = null;
    let manifestCanonicalHash = null;
    let manifestRoot = null;
    let embeddedRoot = null;
    let admissionIdentity = null;

    if (manifestBytes) {
        try {
            const parsed = parseManifest(manifestBytes);
            manifest = parsed.manifest;
            canonicalManifestBytes = parsed.canonicalBytes;
            manifestCanonicalHash = await sha256Hex(canonicalManifestBytes, cryptoProvider);
            if (!sameBytes(bytes(manifestBytes), canonicalManifestBytes)) {
                addError(errors, 'non-canonical-manifest', 'Release manifest bytes are not canonical DVA JSON bytes.');
            }
            manifestRoot = await computeManifestRoot(manifest.entries, {cryptoProvider});
            if (manifestRoot !== manifest.manifestRoot) {
                addError(errors, 'manifest-root-mismatch', 'Manifest root does not match entries.', {
                    expected: manifestRoot,
                    actual: manifest.manifestRoot,
                });
            }
        } catch (error) {
            const message = String(error?.message || error);
            addError(
                errors,
                message.startsWith('Duplicate JSON object key:')
                    ? 'duplicate-key-manifest'
                    : 'malformed-manifest',
                message
            );
        }
    }

    const declared = new Map();
    const actualArtifactHashes = new Map();
    const undeclaredMembers = new Set();
    const embedded = {};
    if (manifest?.entries) {
        for (const entry of normalizeEntries(manifest.entries)) declared.set(entry.file, entry);
        const selectedEntry = declared.get(selected);
        if (!selectedEntry) {
            addError(errors, 'selected-artifact-not-declared', 'Selected artifact is not declared in manifest.', {selected});
        }
    }

    const companions = new Set(['orch.release.json', 'orch.release.cose']);
    for (const memberPath of Array.from(bundle.keys()).sort(cmp)) {
        if (companions.has(memberPath)) continue;
        const entry = declared.get(memberPath);
        if (!entry) {
            undeclaredMembers.add(memberPath);
            addError(errors, 'undeclared-member', 'Admission bundle contains undeclared member.', {path: memberPath});
            continue;
        }
        try {
            const hash = await computeArtifactVerificationHash(bundle.get(memberPath), {
                cryptoProvider,
                requireDvaProjection: memberPath === selected,
            });
            actualArtifactHashes.set(memberPath, hash);
            if (hash !== entry.hash) {
                addError(errors, 'artifact-hash-mismatch', 'Artifact verification hash mismatch.', {
                    path: memberPath,
                    expected: entry.hash,
                    actual: hash,
                });
            }
        } catch (error) {
            addError(errors, 'artifact-verification-failed', String(error?.message || error), {path: memberPath});
        }
    }

    if (selectedBytes) {
        try {
            const payloads = readCustomSectionPayloads(selectedBytes, 'orch.fingerprint');
            if (payloads.length !== 1) throw new Error(`found ${payloads.length} orch.fingerprint sections`);
            const payload = cborDecodeTextMap(payloads[0]);
            if (!isPlainObject(payload.dva)) throw new Error('missing DVA map');
            embeddedRoot = payload.dva.manifestRoot;
            embedded.manifestRoot = payload.dva.manifestRoot;
            embedded.fingerprint = payload.fingerprint;
            if (manifest?.manifestRoot && embeddedRoot !== manifest.manifestRoot) {
                addError(errors, 'embedded-manifest-root-mismatch', 'Embedded DVA manifestRoot differs from manifest.', {
                    embedded: embeddedRoot,
                    manifest: manifest.manifestRoot,
                });
            }
            if (
                manifest?.fingerprint &&
                typeof payload.fingerprint === 'string' &&
                payload.fingerprint !== manifest.fingerprint
            ) {
                addError(errors, 'embedded-fingerprint-drift', 'Embedded DVA fingerprint differs from manifest fingerprint.', {
                    embedded: payload.fingerprint,
                    manifest: manifest.fingerprint,
                });
            }
        } catch (error) {
            addError(errors, 'embedded-dva-invalid', String(error?.message || error));
        }
    }

    let signerKid = null;
    if (coseBytes && canonicalManifestBytes) {
        signerKid = await verifySignature({
            coseBytes,
            manifestBytes: canonicalManifestBytes,
            policy,
            cryptoProvider,
            errors,
        });
    }

    const admissionIdentityInput = await buildAdmissionIdentityInput({
        actualArtifactHashes,
        bundle,
        companions,
        declared,
        embedded,
        manifest,
        manifestCanonicalHash,
        missingRequiredMembers,
        policy,
        selected,
        signerKid,
        undeclaredMembers,
        cryptoProvider,
    });
    admissionIdentity = await sha256Hex(
        canonicalJson(admissionIdentityInput),
        cryptoProvider
    );

    const policyEvaluation = evaluateTrustPolicy({
        policy,
        signerKid,
        admissionIdentity,
        manifestRoot: manifest?.manifestRoot || null,
        errors,
    });

    const ok =
        errors.length === 0 && policyEvaluation.trustDecision === 'accept';
    const audit = {
        signerKid: signerKid || '',
        trustDecision: ok ? 'accept' : policyEvaluation.trustDecision,
        trustListVersion: policy.trustListVersion,
        policyVersion: policy.policyVersion,
        verificationTimestampClass: policyEvaluation.timeClass,
        admissionIdentity,
    };

    return Object.freeze({
        ok,
        trustDecision: audit.trustDecision,
        audit,
        manifestRoot: manifest?.manifestRoot || manifestRoot || embeddedRoot || null,
        errors: errors.sort((a, b) => cmp(a.code, b.code) || cmp(a.message, b.message)),
    });
}

export {
    ZERO_SHA256,
    canonicalJson,
    cborEncode,
    computeArtifactVerificationHash,
    computeManifestRoot,
    encodeCoseSigStructure,
    normalizeDvaProjectionBytes,
    verifyReleaseBundle,
};
