/**
 * @license Apache License 2.0
 * @file orch/system/plugins/pluginRegistry.js
 * @title Plugin Registry (Public Runtime)
 * @description Runtime-only registry for Orch plugins; validates contracts, prevents mutation, and exposes introspection for devtools.
 * @version 1.2.1
 */

const _plugins = new Map();
const MAX_PLUGINS = 1024;

// Output sinks (host/app wires these; default no-ops)
const _sinks = {
    log: (/*evt*/) => {},
    metric: (/*evt*/) => {},
    overlay: (/*evt*/) => {},
};

// Enforce that plugins expose lawful introspection
const STRICT_INTROSPECTION = true;

// Default budgets/outputs (observer-only)
const DEFAULT_BUDGETS = Object.freeze({
    cpuMsPerTick: 4,
    memoryMB: 32,
    eventsPerSecond: 200,
    outputBytesPerSecond: 64_000,
});
const DEFAULT_OUTPUTS = Object.freeze(['log', 'metric', 'overlay']);

function assertString(name, value) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new TypeError(
            `[pluginRegistry] ${name} must be a non-empty string`
        );
    }
}
function uniqStrings(arr = []) {
    return [...new Set(arr.filter((v) => typeof v === 'string' && v.trim()))];
}
function keyOf(label) {
    // Prevent case-variant duplicates: "Logger" vs "logger"
    return String(label).toLowerCase();
}
function isFn(x) {
    return typeof x === 'function';
}
function pickBudget(value, fallback) {
    return value && typeof value === 'object'
        ? {...fallback, ...value}
        : fallback;
}
function pickOutputs(arr, fallback) {
    return Array.isArray(arr) && arr.length ? uniqStrings(arr) : fallback;
}

// ─────────────────────── Token bucket (per plugin / per channel) ───────────────────────
class TokenBucket {
    constructor(eventsPerSecond, bytesPerSecond) {
        this.eventsPerSecond = Math.max(1, eventsPerSecond | 0);
        this.bytesPerSecond = Math.max(1024, bytesPerSecond | 0);
        this._t0 = Date.now();
        this._events = this.eventsPerSecond; // start full
        this._bytes = this.bytesPerSecond; // start full
    }
    _replenish() {
        const now = Date.now();
        const dt = (now - this._t0) / 1000;
        if (dt <= 0) return;
        this._t0 = now;
        this._events = Math.min(
            this.eventsPerSecond,
            this._events + dt * this.eventsPerSecond
        );
        this._bytes = Math.min(
            this.bytesPerSecond,
            this._bytes + dt * this.bytesPerSecond
        );
    }
    tryConsume(eventBytes) {
        this._replenish();
        // cost: one event + N bytes
        if (this._events >= 1 && this._bytes >= eventBytes) {
            this._events -= 1;
            this._bytes -= eventBytes;
            return true;
        }
        return false;
    }
}

// ─────────────── Internal helpers ───────────────
function makeId(label) {
    try {
        // Prefer stable, human readable id; plugin label is already unique (normalized by key)
        return `plugin:${label}`;
    } catch {
        return `plugin:${label}:${Date.now()}`;
    }
}

function shallowFreeze(obj) {
    try {
        return Object.freeze(obj);
    } catch {
        return obj;
    }
}

/* ─────────────── Public API ─────────────── */
export const pluginRegistry = Object.freeze({
    /**
     * Register a plugin by metadata. This does NOT touch the sealed orch.wasm.
     * Expected meta:
     *  - label: string (required)
     *  - id?: string (defaults to "plugin:<label>")
     *  - version?: string
     *  - public?: boolean
     *  - runtime?: "js"|"wasm"
     *  - contract?: { observe?: string[], mutate?: never[] }
     *  - budgets?: { cpuMsPerTick, memoryMB, eventsPerSecond, outputBytesPerSecond }
     *  - outputs?: ("log"|"metric"|"overlay")[]
     *  - status: () => any
     *  - data: () => any
     *  - error: (msg?) => any
     *  - perf?: () => any | any
     *  - disable?: () => void    // optional shutdown hook
     *
     * Returns a mutable HANDLE with:
     *  - emit(channel, event)
     *  - upgrade({ status, data, error, perf })
     *  - flagError(message)
     */
    register(meta = {}) {
        assertString('label', meta.label);
        const key = keyOf(meta.label);

        if (_plugins.has(key)) {
            throw new Error(`[pluginRegistry] Duplicate plugin: ${meta.label}`);
        }
        if (_plugins.size >= MAX_PLUGINS) {
            throw new Error(
                `[pluginRegistry] Registry at capacity (${MAX_PLUGINS})`
            );
        }

        // Capability policy: NO mutations from plugins
        const observe = uniqStrings(
            meta.contract?.observe || meta.observe || []
        );
        const mutate = meta.contract?.mutate || meta.mutate || [];
        if (Array.isArray(mutate) && mutate.length > 0) {
            throw new Error(
                `[pluginRegistry] Mutations are not permitted for plugins ("${meta.label}")`
            );
        }

        // Enforce introspection contract
        const status = meta.status;
        const data = meta.data;
        const error = meta.error;
        if (STRICT_INTROSPECTION) {
            if (!isFn(status) || !isFn(data) || !isFn(error)) {
                throw new Error(
                    `[pluginRegistry] "${meta.label}" must provide status(), data(), and error()`
                );
            }
        }

        // Normalize perf getter
        const perfGetter = isFn(meta.perf)
            ? () => {
                  try {
                      return meta.perf();
                  } catch {
                      return null;
                  }
              }
            : () => meta.perf ?? null;

        const budgets = pickBudget(meta.budgets, DEFAULT_BUDGETS);
        const outputs = pickOutputs(meta.outputs, DEFAULT_OUTPUTS);
        const runtime =
            meta.runtime === 'wasm'
                ? 'wasm'
                : meta.runtime === 'js'
                  ? 'js'
                  : 'js';

        // Per-plugin token bucket (shared across channels)
        const bucket = new TokenBucket(
            budgets.eventsPerSecond,
            budgets.outputBytesPerSecond
        );

        // Frozen record stored in the registry (values are functions; we can replace via upgrade())
        let record = shallowFreeze({
            id:
                typeof meta.id === 'string' && meta.id.trim()
                    ? meta.id
                    : makeId(meta.label),
            label: meta.label, // original casing for display
            key, // normalized key for lookups
            version: typeof meta.version === 'string' ? meta.version : '0.0.0',
            public: meta.public !== false,
            runtime,
            graphRole: 'plugin',
            observe: Object.freeze(observe),
            budgets: shallowFreeze({...budgets}),
            outputs: Object.freeze(outputs),
            registeredAt: Date.now(),
            enabled: true,
            status,
            data,
            error,
            perf: perfGetter,
            disable: isFn(meta.disable) ? meta.disable : () => {},
        });

        _plugins.set(key, record);

        // Handle: controlled mutation APIs for the owner (plugin.js) to integrate
        const handle = {
            /**
             * Emit a structured event to a permitted output channel (rate-limited).
             * Channels: "log" | "metric" | "overlay"
             */
            emit(channel, event) {
                if (!record.enabled) return false;
                if (!outputs.includes(channel)) return false;
                // Estimate serialized bytes quickly (safe upper bound)
                let bytes = 0;
                try {
                    const s =
                        typeof event === 'string'
                            ? event
                            : JSON.stringify(event);
                    bytes = s.length;
                } catch {
                    bytes = 256; // fallback constant
                }
                if (!bucket.tryConsume(bytes)) return false;

                try {
                    _sinks[channel]?.(event);
                    return true;
                } catch {
                    return false;
                }
            },

            /**
             * Upgrade introspection surfaces after async init (e.g., pluginAsync).
             * Replaces status/data/error/perf in the stored record.
             */
            upgrade(next = {}) {
                const current = _plugins.get(key);
                if (!current) return false;

                const updated = shallowFreeze({
                    ...current,
                    status: isFn(next.status) ? next.status : current.status,
                    data: isFn(next.data) ? next.data : current.data,
                    error: isFn(next.error) ? next.error : current.error,
                    perf: isFn(next.perf)
                        ? () => {
                              try {
                                  return next.perf();
                              } catch {
                                  return null;
                              }
                          }
                        : current.perf,
                });
                _plugins.set(key, updated);
                record = updated;
                return true;
            },

            /**
             * Ask the plugin to record an error into its own history (if supported).
             */
            flagError(message) {
                try {
                    return record.error?.(message);
                } catch {
                    // swallow – introspection will show failure
                    return null;
                }
            },
        };

        return handle;
    },

    /** Wire output sinks (host or devtools). All handlers are optional. */
    setOutputSinks({log, metric, overlay} = {}) {
        if (isFn(log)) _sinks.log = log;
        if (isFn(metric)) _sinks.metric = metric;
        if (isFn(overlay)) _sinks.overlay = overlay;
    },

    /** Enable a plugin (idempotent) */
    enable(label) {
        const k = keyOf(label);
        const rec = _plugins.get(k);
        if (!rec || rec.enabled) return rec || null;
        const updated = shallowFreeze({...rec, enabled: true});
        _plugins.set(k, updated);
        return updated;
    },

    /** Disable a plugin and call its disable hook (idempotent) */
    disable(label) {
        const k = keyOf(label);
        const rec = _plugins.get(k);
        if (!rec || !rec.enabled) return rec || null;
        try {
            rec.disable?.();
        } catch (e) {
            console.error(`[pluginRegistry] disable("${label}") failed:`, e);
        }
        const updated = shallowFreeze({...rec, enabled: false});
        _plugins.set(k, updated);
        return updated;
    },

    /** Remove a plugin entirely (primarily for tests/devtools). */
    unregister(label) {
        const k = keyOf(label);
        return _plugins.delete(k);
    },

    /** Lookup helpers */
    get(label) {
        return _plugins.get(keyOf(label)) ?? null;
    },
    has(label) {
        return _plugins.has(keyOf(label));
    },
    list() {
        return Array.from(_plugins.values());
    },

    /** Introspection surfaces for devtools/overlays */
    data() {
        const plugins = this.list().map((p) => {
            let perf = null;
            try {
                perf = p.perf?.();
            } catch {
                perf = null;
            }
            let hasError = false;
            try {
                const e = p.error?.();
                hasError = Array.isArray(e) ? e.length > 0 : !!e;
            } catch {
                hasError = true;
            }
            return {
                id: p.id,
                label: p.label,
                version: p.version,
                runtime: p.runtime,
                public: p.public,
                observe: p.observe,
                budgets: p.budgets,
                outputs: p.outputs,
                enabled: p.enabled,
                perf,
                hasError,
            };
        });

        return Object.freeze({
            type: 'plugin-registry',
            count: plugins.length,
            plugins: Object.freeze(plugins),
        });
    },

    status() {
        const all = this.list();
        const enabled = all.filter((p) => p.enabled).length;
        const disabled = all.length - enabled;

        const errors = [];
        let errorCount = 0;
        for (const p of all) {
            try {
                const e = p.error?.();
                if (Array.isArray(e)) {
                    if (e.length) {
                        errorCount += e.length;
                        errors.push({label: p.label, error: e});
                    }
                } else if (e) {
                    errorCount += 1;
                    errors.push({label: p.label, error: e});
                }
            } catch (ex) {
                errorCount += 1;
                errors.push({label: p.label, error: ex?.message || String(ex)});
            }
        }

        return Object.freeze({
            type: 'plugin-registry',
            total: all.length,
            enabled,
            disabled,
            errorCount,
            errors: Object.freeze(errors),
        });
    },

    /** For tests/dev-only resets */
    clear(opts = {}) {
        if (opts.force === true) _plugins.clear();
    },
});

Object.freeze(pluginRegistry);
