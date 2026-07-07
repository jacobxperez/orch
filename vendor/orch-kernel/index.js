/**
 * @license Apache License 2.0
 * @file orch/vendor/orch-kernel/index.js
 * @title orch-kernel (dev shim)
 * @description Minimal shim to run the public Orch repo without the sealed WASM kernel, including deterministic unsupported public introspection. In sealed builds, the real kernel is used.
 * @version 0.8.0
 */

/* ──────────────────────────────────────────────────────────
   Tiny reactivity (signals, computed, effect)
   ────────────────────────────────────────────────────────── */
const __effectStack = [];
const __subs = new WeakMap();

function createSignal(initial) {
    let v = initial;
    const sig = function next(val) {
        if (arguments.length === 0) {
            // read
            const watcher = __effectStack[__effectStack.length - 1];
            if (watcher) {
                let set = __subs.get(sig);
                if (!set) __subs.set(sig, (set = new Set()));
                set.add(watcher);
            }
            return v;
        }
        // write
        if (v !== val) {
            v = val;
            const set = __subs.get(sig);
            if (set) {
                for (const eff of Array.from(set)) {
                    try {
                        eff();
                    } catch {}
                }
            }
        }
        return v;
    };
    return sig;
}

function createEffect(fn) {
    const run = () => {
        try {
            __effectStack.push(run);
            fn();
        } finally {
            __effectStack.pop();
        }
    };
    run();
    return run;
}

function createComputed(fn) {
    const s = createSignal(undefined);
    createEffect(() => s(fn()));
    return () => s();
}

/* ──────────────────────────────────────────────────────────
   Scope + expose (dev registry)
   ────────────────────────────────────────────────────────── */
let __currentScope = null;
const __scopeStack = [];
const __exposureRegistry = new Map();

function beginScope(name) {
    const scope = {name: name || 'scope', values: new Map()};
    __scopeStack.push(scope);
    __currentScope = scope;
    return scope;
}
function endScope() {
    __scopeStack.pop();
    __currentScope = __scopeStack[__scopeStack.length - 1] || null;
}
function createScope(label, fn) {
    beginScope(label || 'scope');
    try {
        return typeof fn === 'function' ? fn() : undefined;
    } finally {
        endScope();
    }
}
function expose(name, api) {
    if (!__currentScope) beginScope('root');
    __exposureRegistry.set(name || __currentScope.name || 'root', api);
    return api;
}

/* ──────────────────────────────────────────────────────────
   Style injector (dev)
   ────────────────────────────────────────────────────────── */
function style(selector, rules) {
    if (typeof document === 'undefined') return; // node env
    const css = `${selector}{${Object.entries(rules)
        .map(([k, v]) => `${camelToKebab(k)}:${v}`)
        .join(';')}}`;
    let el = document.getElementById('__orch_dev_styles__');
    if (!el) {
        el = document.createElement('style');
        el.id = '__orch_dev_styles__';
        document.head.appendChild(el);
    }
    el.appendChild(document.createTextNode(css));
}
function camelToKebab(s) {
    return s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}

/* ──────────────────────────────────────────────────────────
   Task wrapper (dev)
   ────────────────────────────────────────────────────────── */
function createTask(_name, handler) {
    const loading = createSignal(false);
    const error = createSignal(null);
    const result = createSignal(undefined);

    async function run(...args) {
        loading(true);
        error(null);
        try {
            const out = await handler(...args);
            result(out);
            return out;
        } catch (e) {
            error(e);
            throw e;
        } finally {
            loading(false);
        }
    }

    return {loading, error, result, run};
}

/* ──────────────────────────────────────────────────────────
   Component + mount (very small dev helpers)
   ────────────────────────────────────────────────────────── */
function createComponent(render) {
    // returns a function you can call with props to get DOM/string
    return (props) => render(props);
}

function mountComponent(target, component, props) {
    // Accepts selector or element; supports string/HTMLElement render output
    const el =
        typeof target === 'string'
            ? typeof document !== 'undefined'
                ? document.querySelector(target)
                : null
            : target;

    let node = component(props || {});
    if (el && typeof document !== 'undefined') {
        if (node instanceof Node) {
            el.innerHTML = '';
            el.appendChild(node);
        } else {
            el.innerHTML = node != null ? String(node) : '';
        }
    }
    return {
        unmount() {
            if (el && typeof document !== 'undefined') el.innerHTML = '';
        },
    };
}

function unmount(target) {
    const el =
        typeof target === 'string'
            ? typeof document !== 'undefined'
                ? document.querySelector(target)
                : null
            : target;
    if (el && typeof document !== 'undefined') el.innerHTML = '';
}

/* ──────────────────────────────────────────────────────────
   fetch proxy (dev)
   ────────────────────────────────────────────────────────── */
async function fetchProxy(url, opts) {
    const impl = typeof fetch === 'function' ? fetch : null;
    if (!impl) throw new Error('fetch is not available in this environment');
    const res = await impl(url, opts);
    // mirror what your proxies expect: either Response or text/json passthrough
    return res;
}

/* ──────────────────────────────────────────────────────────
   route (dev): simple URL param-backed signal
   ────────────────────────────────────────────────────────── */
function createRoute(param = 'doc') {
    // In browser: wire to location.search ?param=...
    // In Node: fall back to a plain signal
    const s = createSignal('');

    if (
        typeof window !== 'undefined' &&
        typeof URLSearchParams !== 'undefined'
    ) {
        const params = new URLSearchParams(window.location.search);
        const initial = params.get(param) || '';
        s(initial);

        const set = (val) => {
            const u = new URL(window.location.href);
            if (val) u.searchParams.set(param, val);
            else u.searchParams.delete(param);
            window.history.replaceState({}, '', u.toString());
            s(val);
        };
        s.set = set;
    } else {
        // Node/server fallback
        s.set = (val) => s(val);
    }

    return s;
}

/* ──────────────────────────────────────────────────────────
   agent / intent (dev): no-op capability wrappers
   ────────────────────────────────────────────────────────── */
const __agents = new Map();
const __intents = new Map();

function requirePrimitiveHandle(handles, id, kind) {
    const handle = handles.get(id);
    if (!handle) throw new Error(`[orch-kernel shim] Unknown ${kind} id: ${String(id)}`);
    return handle;
}

function createAgent(spec = {}) {
    const id = spec.name ?? spec.spec?.key;
    let phase = 'ready';
    let suspendedReason = null;
    let cancellationState = 'none';
    const allowedSuspendReasons = new Set([
        'backpressure',
        'resource',
        'external-wait',
    ]);
    const deferControl = (fn) => {
        if (typeof queueMicrotask === 'function') queueMicrotask(fn);
        else Promise.resolve().then(fn);
    };
    const status = () => {
        if (cancellationState !== 'none') return cancellationState;
        if (phase === 'running') return 'running';
        if (phase === 'terminated') return 'done';
        return 'idle';
    };
    const handle = {
        data: () => Object.freeze({
            type: 'agent',
            key: id,
            status: status(),
            phase,
            suspendedReason,
        }),
        status,
        error: () => null,
        errors: () => Object.freeze([]),
        perf: () => Object.freeze({start: 0, end: 0, duration: 0, timestamp: 0}),
        suspend: (reason) => {
            if (cancellationState !== 'none' || phase === 'terminated') return;
            if (reason !== undefined && !allowedSuspendReasons.has(reason)) {
                const error = new TypeError(
                    '[orch-kernel shim] suspend reason must be backpressure, resource, or external-wait'
                );
                error.code = 'ERR_SCHEMA';
                throw error;
            }
            deferControl(() => {
                if (cancellationState !== 'none' || phase === 'terminated') return;
                suspendedReason = reason ?? null;
                phase = 'suspended';
            });
        },
        resume: () => {
            if (cancellationState !== 'none' || phase !== 'suspended') return;
            deferControl(() => {
                if (cancellationState !== 'none' || phase !== 'suspended') return;
                suspendedReason = null;
                phase = 'running';
            });
        },
        terminate: () => {
            if (cancellationState !== 'none' || phase === 'terminated') return;
            cancellationState = 'canceling';
            deferControl(() => {
                if (cancellationState !== 'canceling') return;
                suspendedReason = null;
                phase = 'terminated';
                cancellationState = 'cancelled';
            });
        },
    };
    __agents.set(id, handle);
    return id;
}
function createIntent(spec = {}) {
    const id = spec.humanPath ?? spec.config?.key ?? 'intent:default';
    let value = spec.initial ?? spec.config?.initial ?? null;
    const handle = {
        set: (next) => { value = next; },
        get: () => value,
        clear: () => { value = null; },
        status: () => 'idle',
        error: () => null,
        errors: () => Object.freeze([]),
        data: () => Object.freeze({type: 'intent', key: id, value, status: 'idle'}),
        perf: () => Object.freeze({start: 0, end: 0, duration: 0, timestamp: 0}),
    };
    __intents.set(id, handle);
    return id;
}

/* ──────────────────────────────────────────────────────────
   schema (dev): simple passthrough wrapper
   ────────────────────────────────────────────────────────── */
function createSchema(def) {
    return Object.freeze({...def});
}

/* ──────────────────────────────────────────────────────────
   Introspection + data (dev)
   ────────────────────────────────────────────────────────── */
const __introspection = new Map();
function introspectRegister(key, api) {
    __introspection.set(key, api);
}
function introspectGet(key) {
    return __introspection.get(key);
}
function introspectGetAll() {
    return Array.from(__introspection.values());
}

const __dataRegistry = new Map();
function dataRegister(key, value) {
    __dataRegistry.set(key, value);
}
function dataGet(key) {
    return __dataRegistry.get(key);
}
function dataGetAll() {
    return Array.from(__dataRegistry.values());
}

function createUnsupportedIntrospectionResult() {
    return Object.freeze({
        schemaVersion: 'introspection-unsupported-result.v1',
        supported: false,
        reason: 'unsupported',
    });
}

/* ──────────────────────────────────────────────────────────
   Kernel shim
   Map proxy call names → dev implementations.
   Extend this switch as new proxy methods are introduced.
   ────────────────────────────────────────────────────────── */
export const kernel = Object.freeze({
    env: 'js-dev-shim',
    call(name, args = {}) {
        switch (name) {
            /* Reactivity */
            case 'createSignal':
                return createSignal(args.initial);
            case 'createComputed':
                return createComputed(args.fn);
            case 'createEffect':
                return createEffect(args.fn);

            /* Scope / expose */
            case 'createScope':
                return createScope(args.label || args.name, args.fn);
            case 'beginScope':
                return beginScope(args.name || args.label);
            case 'endScope':
                return endScope();
            case 'expose':
                return expose(args.name, args.api);

            /* Style */
            case 'style':
                return style(args.selector, args.rules);

            /* Task */
            case 'createTask':
                return createTask(args.name, args.handler);

            /* UI */
            case 'createComponent':
                return createComponent(args.render);
            case 'mountComponent':
                return mountComponent(args.target, args.component, args.props);
            case 'unmount':
                return unmount(args.target);

            /* Async */
            case 'fetch':
                return fetchProxy(args.url, args.opts);

            /* Routing */
            case 'createRoute':
                return createRoute(args.param);

            /* AI */
            case 'createAgent':
                return createAgent(args.spec);
            case 'createIntent':
                return createIntent(args.name, args.fn);
            case 'K_AGENT_CREATE':
                return createAgent(args);
            case 'K_AGENT_SUSPEND':
                return requirePrimitiveHandle(__agents, args.id, 'agent').suspend(args.reason);
            case 'K_AGENT_RESUME':
                return requirePrimitiveHandle(__agents, args.id, 'agent').resume();
            case 'K_AGENT_TERMINATE':
                return requirePrimitiveHandle(__agents, args.id, 'agent').terminate();
            case 'K_AGENT_DATA':
                return requirePrimitiveHandle(__agents, args.id, 'agent').data();
            case 'K_AGENT_STATUS':
                return requirePrimitiveHandle(__agents, args.id, 'agent').status();
            case 'K_AGENT_ERROR':
                return requirePrimitiveHandle(__agents, args.id, 'agent').error();
            case 'K_AGENT_ERRORS':
                return requirePrimitiveHandle(__agents, args.id, 'agent').errors();
            case 'K_AGENT_PERF':
                return requirePrimitiveHandle(__agents, args.id, 'agent').perf();
            case 'K_INTENT_CREATE':
                return createIntent(args);
            case 'K_INTENT_SET':
                return requirePrimitiveHandle(__intents, args.id, 'intent').set(args.next);
            case 'K_INTENT_GET':
                return requirePrimitiveHandle(__intents, args.id, 'intent').get();
            case 'K_INTENT_CLEAR':
                return requirePrimitiveHandle(__intents, args.id, 'intent').clear();
            case 'K_INTENT_STATUS':
                return requirePrimitiveHandle(__intents, args.id, 'intent').status();
            case 'K_INTENT_ERROR':
                return requirePrimitiveHandle(__intents, args.id, 'intent').error();
            case 'K_INTENT_ERRORS':
                return requirePrimitiveHandle(__intents, args.id, 'intent').errors();
            case 'K_INTENT_DATA':
                return requirePrimitiveHandle(__intents, args.id, 'intent').data();
            case 'K_INTENT_PERF':
                return requirePrimitiveHandle(__intents, args.id, 'intent').perf();
            case 'K_INTENTM_TRIGGER':
                throw new Error('[orch-kernel shim] Intent manager trigger is unavailable');

            /* Schema */
            case 'createSchema':
                return createSchema(args.def);

            /* Introspection */
            case 'createIntrospect':
                return createUnsupportedIntrospectionResult();
            case 'introspect.register':
                return introspectRegister(args.key, args.api);
            case 'introspect.get':
                return introspectGet(args.key);
            case 'introspect.getAll':
                return introspectGetAll();

            /* Data registry (if your proxies use it) */
            case 'data.register':
                return dataRegister(args.key, args.value);
            case 'data.get':
                return dataGet(args.key);
            case 'data.getAll':
                return dataGetAll();

            default:
                if (typeof console !== 'undefined' && console.warn) {
                    console.warn(
                        `[orch-kernel shim] Unimplemented kernel.call("${name}")`,
                        args
                    );
                }
                return undefined;
        }
    },
});
