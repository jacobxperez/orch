/**
 * @license Apache License 2.0
 * @file orch/system/index.js
 * @title Orch Public API
 * @description Frozen export surface for all developer-facing primitives and runtime utilities (note: plugin() executes outside orch.wasm)
 * @version 1.4.0
 */

// 📦 Path to the sealed runtime WASM binary
export const ORCH_WASM_PATH = new URL(
    '../public/wasm/orch.wasm',
    import.meta.url
).href;

// 🧠 Core reactive orchestration
export {state} from './proxies/state.js';
export {computed} from './proxies/computed.js';
export {effect} from './proxies/effect.js';
export {scope} from './proxies/scope.js';
export {task} from './proxies/task.js';
export {schema} from './proxies/schema.js';
export {style} from './proxies/style.js';

// 🧩 UI Components
export {component} from './proxies/component.js';
export {mount} from './proxies/mount.js';

// 🌐 Async orchestration
export {fetch} from './proxies/fetch.js';

// 🧠 AI primitives
export {agent} from './proxies/agent.js';
export {intent} from './proxies/intent.js';

// 🛤️ Routing
export {route} from './proxies/route.js';

// 🧰 Utilities and lifecycle
export {expose} from './proxies/expose.js';
export {unmount} from './proxies/unmount.js';

// 🧩 System + plugin framework (JS-side; no kernel calls)
export {plugin} from './plugins/plugin.js';
export {pluginRegistry} from './plugins/pluginRegistry.js';

// 🔍 Introspection
export {introspect} from './introspection/introspect.js';
export {data} from './introspection/data.js';

/**
 * Load and instantiate the Orch WASM runtime in both browser and Node.js.
 * @param {object} [imports] - Optional imports for the WASM module
 * @returns {Promise<WebAssembly.Instance>} The initialized WASM instance
 */
export async function loadOrchWasm(imports = {}) {
    const isNode =
        typeof process !== 'undefined' &&
        process.versions != null &&
        process.versions.node != null;

    let wasmBuffer;

    if (isNode) {
        try {
            // Dynamically import only in Node context to avoid bundling in browsers
            const {readFile} = await import('node:fs/promises');
            const {fileURLToPath} = await import('node:url');
            const wasmPath = fileURLToPath(ORCH_WASM_PATH);
            wasmBuffer = await readFile(wasmPath);
        } catch (err) {
            throw new Error(
                `Failed to load orch.wasm in Node.js: ${err.message}`
            );
        }
    } else {
        const response = await fetch(ORCH_WASM_PATH);
        if (!response.ok) {
            throw new Error(
                `Failed to load orch.wasm: ${response.status} ${response.statusText}`
            );
        }
        wasmBuffer = await response.arrayBuffer();
    }

    try {
        const {instance} = await WebAssembly.instantiate(wasmBuffer, imports);
        return instance;
    } catch (err) {
        throw new Error(`Failed to instantiate orch.wasm: ${err.message}`);
    }
}

// 🛡️ Freeze the public API in dev mode to prevent accidental mutation
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
    try {
        // Note: ESM doesn't expose `exports`; this try/catch avoids errors in browsers.
        Object.freeze(ORCH_WASM_PATH);
    } catch {
        /* no-op */
    }
}
