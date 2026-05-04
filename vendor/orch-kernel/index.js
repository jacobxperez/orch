/**
 * @license Apache License 2.0
 * @file orch/vendor/orch-kernel/index.js
 * @title orch-kernel (dev shim)
 * @description Minimal shim to run the public Orch repo without the sealed WASM kernel. Covers the proxy calls used by orch/system/* in dev. In sealed builds, the real kernel is used.
 * @version 0.5.0
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
function createAgent(_spec = {}) {
    return {
        run: async (input) => input,
        spec: _spec,
    };
}
function createIntent(_name, fn = (x) => x) {
    const impl = async (...args) => fn(...args);
    impl.name = _name || 'intent';
    return impl;
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

            /* Schema */
            case 'createSchema':
                return createSchema(args.def);

            /* Introspection */
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
