/**
 * @license Apache License 2.0
 * @file orch/system/plugins/plugin.js
 * @title plugin / pluginAsync
 * @description JS-side runtime plugin() (executes outside orch.wasm; uses public pluginRegistry). No kernel calls; no graph writes. Adds async loader support for WASM-backed plugins.
 * @version 1.2.1
 */

import {pluginRegistry} from './pluginRegistry.js';

const nowMs =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? () => performance.now()
        : () => Date.now();

const DEFAULT_BUDGETS = Object.freeze({
    cpuMsPerTick: 4,
    memoryMB: 32,
    eventsPerSecond: 200,
    outputBytesPerSecond: 64_000,
});

const DEFAULT_OUTPUTS = Object.freeze(['log', 'metric', 'overlay']);

function normalizeOpts(label, opts = {}) {
    if (opts && typeof opts !== 'object') {
        throw new TypeError('plugin opts must be an object if provided');
    }
    const version =
        typeof opts.version === 'string' && opts.version.trim()
            ? opts.version
            : '0.0.0';
    const isPublic = opts.public !== false;
    const observe = Array.isArray(opts.observe) ? opts.observe : [];
    const budgets =
        opts.budgets && typeof opts.budgets === 'object'
            ? {...DEFAULT_BUDGETS, ...opts.budgets}
            : DEFAULT_BUDGETS;
    const outputs =
        Array.isArray(opts.outputs) && opts.outputs.length
            ? [...opts.outputs]
            : DEFAULT_OUTPUTS;
    const runtime = opts.runtime === 'wasm' ? 'wasm' : 'js';

    return {version, isPublic, observe, budgets, outputs, runtime};
}

function makeCtx(registryHandle) {
    // Minimal, sealed ctx for external plugins (no graph handle, no kernel access)
    const emit = {
        log(evt) {
            registryHandle?.emit?.('log', evt);
        },
        metric(evt) {
            registryHandle?.emit?.('metric', evt);
        },
        overlay(evt) {
            registryHandle?.emit?.('overlay', evt);
        },
    };
    const ctx = {
        devtools: globalThis?.__ORCH_DEVTOOLS__ ?? null,
        now: nowMs,
        emit,
    };
    return Object.freeze(ctx);
}

const PROTECTED = new Set([
    'state',
    'scope',
    'task',
    'effect',
    'orch',
    'plugin',
]);

/**
 * Synchronous plugin registration.
 * @param {string} label
 * @param {(ctx: object) => object} fn - must return an object (user API)
 * @param {Object} [opts]
 * @returns {object} frozen plugin handle with .data()/.status()/.error()/.perf() + user API
 */
export const plugin = Object.freeze(function plugin(label, fn, opts = {}) {
    const argc = arguments.length;
    if (argc < 2 || argc > 3) {
        throw new TypeError(
            'plugin() expects 2 or 3 arguments: label, fn[, opts]'
        );
    }
    if (typeof label !== 'string' || !label.trim()) {
        throw new TypeError('plugin label must be a non-empty string');
    }
    if (typeof fn !== 'function') {
        throw new TypeError('plugin function must be callable');
    }

    const {version, isPublic, observe, budgets, outputs, runtime} =
        normalizeOpts(label, opts);

    const perf = {start: nowMs(), end: 0, duration: 0};
    const errorHistory = [];

    // Temporary registry stub to build ctx; real handle is returned by registry.register
    let registryHandle = null;
    const ctx = makeCtx({
        emit: (ch, evt) => registryHandle?.emit?.(ch, evt),
    });

    const runInit = () => {
        const result = fn(ctx);
        if (!result || typeof result !== 'object') {
            throw new Error(`[plugin:${label}] must return an object`);
        }
        for (const key of Object.keys(result)) {
            if (PROTECTED.has(key)) {
                throw new Error(
                    `[plugin:${label}] attempted to override protected Orch symbol: ${key}`
                );
            }
        }

        const self = {
            // Introspection
            error(message = null, meta = null) {
                if (message) {
                    const msg =
                        message instanceof Error
                            ? message.message
                            : String(message);
                    const full =
                        meta && typeof meta === 'object'
                            ? `${msg} :: ${JSON.stringify(meta)}`
                            : msg;
                    console.error(`[Orch][plugin:${label}] Error: ${full}`);
                    errorHistory.push(full);
                    return;
                }
                return errorHistory.length ? [...errorHistory] : null;
            },
            status: () =>
                Object.freeze({
                    type: 'plugin',
                    key: label,
                    scope: label,
                    public: isPublic,
                    orchestrated: true,
                    graphRole: 'plugin',
                    hasError: errorHistory.length > 0,
                    errorCount: errorHistory.length,
                    runtime,
                    version,
                    perf: {...perf},
                }),
            data: () =>
                Object.freeze({
                    type: 'plugin',
                    key: label,
                    scope: label,
                    label,
                    public: isPublic,
                    orchestrated: true,
                    graphRole: 'plugin',
                    hasError: errorHistory.length > 0,
                    errorHistory: [...errorHistory],
                    runtime,
                    version,
                    budgets,
                    outputs,
                    perf: {...perf},
                    description: `Lifecycle-safe Orch plugin registered as "${label}"`,
                }),
            perf: () => Object.freeze({...perf}),

            // Spread user API last (read-only surface)
            ...result,
        };

        // Register in the public runtime registry (no graph writes).
        registryHandle = pluginRegistry.register({
            id: label, // label doubles as ID in current design
            label,
            version,
            public: isPublic,
            runtime,
            contract: {
                observe,
                mutate: [], // enforce no orchestration mutation from plugins
            },
            budgets,
            outputs,
            status: self.status,
            data: self.data,
            error: self.error,
            perf: () => self.perf(),
            disable:
                typeof result.disable === 'function'
                    ? () => {
                          try {
                              result.disable();
                          } catch (e) {
                              console.error(
                                  `[plugin:${label}] disable() failed:`,
                                  e
                              );
                          }
                      }
                    : undefined,
        });

        // Optional devtools signal (no graph mutation)
        ctx.devtools?.announce?.({type: 'plugin', label, runtime, version});

        perf.end = nowMs();
        perf.duration = perf.end - perf.start;
        Object.freeze(perf);

        return Object.freeze(self);
    };

    if (opts.scheduler && typeof opts.scheduler.schedule === 'function') {
        return opts.scheduler.schedule(runInit, {
            key: `plugin:init:${label}`,
            scope: label,
            priority: 'high',
            tags: ['plugin', 'init'],
            graphRole: 'plugin-init',
            public: isPublic,
            orchestrated: true,
            description: `Initialize Orch plugin "${label}"`,
        });
    }

    // Default: immediate init (no private imports, no kernel calls).
    return runInit();
});

/**
 * Asynchronous plugin registration (e.g., WASM loader).
 * Returns a Promise resolving to the same handle shape as plugin().
 * @param {string} label
 * @param {(ctx: object) => Promise<object>} asyncFactory
 * @param {Object} [opts]
 * @returns {Promise<object>}
 */
export async function pluginAsync(label, asyncFactory, opts = {}) {
    if (typeof asyncFactory !== 'function') {
        throw new TypeError(
            'pluginAsync factory must be a function returning a Promise'
        );
    }
    const {version, isPublic, observe, budgets, outputs, runtime} =
        normalizeOpts(label, opts);

    const perf = {start: nowMs(), end: 0, duration: 0};
    const errorHistory = [];
    let registryHandle = null;

    // Pre-register a running stub so devtools can see activation in progress.
    registryHandle = pluginRegistry.register({
        id: label,
        label,
        version,
        public: isPublic,
        runtime,
        contract: {observe, mutate: []},
        budgets,
        outputs,
        status: () =>
            Object.freeze({
                type: 'plugin',
                key: label,
                scope: label,
                public: isPublic,
                orchestrated: true,
                graphRole: 'plugin',
                hasError: errorHistory.length > 0,
                errorCount: errorHistory.length,
                runtime,
                version,
                state: 'running',
                perf: {...perf},
            }),
        data: () =>
            Object.freeze({
                type: 'plugin',
                key: label,
                scope: label,
                label,
                public: isPublic,
                orchestrated: true,
                graphRole: 'plugin',
                hasError: errorHistory.length > 0,
                errorHistory: [...errorHistory],
                runtime,
                version,
                budgets,
                outputs,
                perf: {...perf},
                description: `Activating Orch plugin "${label}" (async)...`,
            }),
        error: () => (errorHistory.length ? [...errorHistory] : null),
        perf: () => Object.freeze({...perf}),
    });

    const ctx = makeCtx(registryHandle);

    try {
        const result = await asyncFactory(ctx);
        if (!result || typeof result !== 'object') {
            throw new Error(
                `[pluginAsync:${label}] factory must resolve to an object`
            );
        }
        for (const key of Object.keys(result)) {
            if (PROTECTED.has(key)) {
                throw new Error(
                    `[pluginAsync:${label}] attempted to override protected Orch symbol: ${key}`
                );
            }
        }

        const self = Object.freeze({
            error(message = null, meta = null) {
                if (message) {
                    const msg =
                        message instanceof Error
                            ? message.message
                            : String(message);
                    const full =
                        meta && typeof meta === 'object'
                            ? `${msg} :: ${JSON.stringify(meta)}`
                            : msg;
                    console.error(`[Orch][plugin:${label}] Error: ${full}`);
                    errorHistory.push(full);
                    return;
                }
                return errorHistory.length ? [...errorHistory] : null;
            },
            status: () =>
                Object.freeze({
                    type: 'plugin',
                    key: label,
                    scope: label,
                    public: isPublic,
                    orchestrated: true,
                    graphRole: 'plugin',
                    hasError: errorHistory.length > 0,
                    errorCount: errorHistory.length,
                    runtime,
                    version,
                    perf: {...perf},
                }),
            data: () =>
                Object.freeze({
                    type: 'plugin',
                    key: label,
                    scope: label,
                    label,
                    public: isPublic,
                    orchestrated: true,
                    graphRole: 'plugin',
                    hasError: errorHistory.length > 0,
                    errorHistory: [...errorHistory],
                    runtime,
                    version,
                    budgets,
                    outputs,
                    perf: {...perf},
                    description: `Lifecycle-safe Orch plugin registered as "${label}"`,
                }),
            perf: () => Object.freeze({...perf}),
            ...result,
        });

        // Upgrade registry handle with final surfaces (registry should reconcile).
        registryHandle.upgrade?.({
            status: self.status,
            data: self.data,
            error: self.error,
            perf: self.perf,
        });

        ctx.devtools?.announce?.({type: 'plugin', label, runtime, version});
        perf.end = nowMs();
        perf.duration = perf.end - perf.start;
        Object.freeze(perf);

        return self;
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errorHistory.push(msg);
        registryHandle?.flagError?.(msg);
        throw e;
    }
}
