/**
 * @license Apache License 2.0
 * @file orch/system/index.js
 * @title Orch Public API
 * @description Frozen export surface for all developer-facing primitives and runtime utilities (note: plugin() executes outside orch.wasm)
 * @version 1.5.0
 */

import {ORCH_WASM_PATH, ORCH_WASM_PATHS} from './runtime/loadOrchWasm.js';

export {
    loadOrchWasm,
    ORCH_WASM_PATH,
    ORCH_WASM_PATHS,
    resolveOrchWasmArtifact,
    resolveOrchWasmTarget,
} from './runtime/loadOrchWasm.js';

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

// 🛡️ Freeze the public API in dev mode to prevent accidental mutation
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
    try {
        // Note: ESM doesn't expose `exports`; this try/catch avoids errors in browsers.
        Object.freeze(ORCH_WASM_PATH);
        Object.freeze(ORCH_WASM_PATHS);
    } catch {
        /* no-op */
    }
}
