/**
 * @license Apache License 2.0
 * @file orch/system/plugins/wasmPluginLoader.js
 * @title wasmPluginLoader
 * @description Generic WASM plugin host. Instantiates a WASM module and adapts it to createPluginAsync(). Boundary is CBOR-only.
 * @version 0.1.0
 */

import {createPluginAsync} from './createPlugin.js';

export async function wasmPluginLoader({
    bytes, // ArrayBuffer|Uint8Array
    manifest, // { id|name, version, budgets?, outputs?, observe?, runtime:"wasm" }
    codec, // { encode(obj)->Uint8Array, decode(buf)->any }
    imports = {}, // extra imports namespaces
}) {
    if (!bytes) throw new TypeError('wasmPluginLoader: bytes required');
    if (
        !codec ||
        typeof codec.encode !== 'function' ||
        typeof codec.decode !== 'function'
    ) {
        throw new TypeError(
            'wasmPluginLoader: codec with encode/decode required'
        );
    }
    const env = {
        env: {
            host_now: () => BigInt(Date.now()),
            host_emit: (channel_id, ptr, len) => {
                try {
                    const view = new Uint8Array(
                        instance.exports.memory.buffer,
                        ptr,
                        len
                    );
                    const payload = codec.decode(view);
                    const ch =
                        channel_id === 1
                            ? 'log'
                            : channel_id === 2
                              ? 'metric'
                              : 'overlay';
                    pendingEmit?.(ch, payload);
                } catch (e) {
                    // swallow; plugin error path will surface via .error()
                }
            },
            host_alloc: (size) => {
                const p = instance.exports.__alloc
                    ? instance.exports.__alloc(size)
                    : 0;
                return p;
            },
            host_free: (ptr) => {
                if (instance.exports.__free) instance.exports.__free(ptr);
            },
            ...(imports.env || {}),
        },
        ...imports,
    };

    let instance;
    const {instance: inst} = await WebAssembly.instantiate(bytes, env);
    instance = inst;

    let pendingEmit = null;

    return createPluginAsync({...manifest, runtime: 'wasm'}, async (ctx) => {
        // Wire ctx.emit into host_emit indirection
        pendingEmit = (ch, payload) => ctx.emit[ch]?.(payload);

        // init(manifest)
        const initBuf = codec.encode({manifest: manifest});
        const {ptr, len} = writeToMemory(instance.exports.memory, initBuf);
        const out = call(instance, 'plugin_init', ptr, len);
        readAndFree(instance, out); // ignore result for now

        // Return hook shims that forward to plugin_call(op_id, payload)
        const callOp = (op, payload) => {
            const buf = codec.encode(payload || {});
            const w = writeToMemory(instance.exports.memory, buf);
            const res = call(instance, 'plugin_call', op, w.ptr, w.len);
            return codec.decode(readAndFree(instance, res));
        };

        return {
            onBoot() {
                callOp(1, {});
            },
            onGraphReady(_ctx, snapshot) {
                callOp(2, {snapshot});
            },
            onNodeUpdate(_ctx, evt) {
                callOp(3, evt);
            },
            onStatusChange(_ctx, evt) {
                callOp(4, evt);
            },
            onError(_ctx, evt) {
                callOp(5, evt);
            },
            onPerf(_ctx, evt) {
                callOp(6, evt);
            },
            onDispose() {
                callOp(7, {});
            },
        };
    });
}

// ─── helpers ───
function writeToMemory(memory, buf) {
    const len = buf.byteLength;
    const ptr = allocate(memory, len);
    new Uint8Array(memory.buffer, ptr, len).set(new Uint8Array(buf));
    return {ptr, len};
}
function allocate(memory, len) {
    // naive bump alloc; for real usage rely on plugin __alloc
    const page = memory.grow ? memory.grow(0) : 0; // keep type happy; plugin should export __alloc
    return 0; // placeholder; rely on plugin's __alloc in host_alloc path
}
function call(instance, name, ...args) {
    if (typeof instance.exports[name] !== 'function') {
        throw new Error(`WASM plugin missing export: ${name}`);
    }
    return instance.exports[name](...args);
}
function readAndFree(instance, ptrAndLen) {
    // Expect pair return via two globals or a struct; left abstract since ABIs vary.
    // Implement per actual ABI in your plugin toolchain (AssemblyScript/Rust/C++).
    return new Uint8Array(); // placeholder
}
