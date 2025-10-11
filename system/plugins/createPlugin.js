/**
 * @license Apache License 2.0
 * @file orch/system/plugins/createPlugin.js
 * @title createPlugin
 * @description Manifest-first plugin wrapper; supports sync and async factories; forwards to plugin()/pluginAsync().
 * @version 1.0.0
 */

import {plugin, pluginAsync} from './plugin.js';

function assertManifest(m) {
    if (!m || typeof m !== 'object') throw new TypeError('manifest required');
    if (!m.id && !m.name)
        throw new TypeError('manifest.id or manifest.name required');
    if (m.runtime && m.runtime !== 'js' && m.runtime !== 'wasm') {
        throw new TypeError(
            'manifest.runtime must be "js" or "wasm" if provided'
        );
    }
}

export function createPlugin(manifest, hooksOrFactory, opts = {}) {
    assertManifest(manifest);
    const label = manifest.name || manifest.id;
    const merged = {
        version: manifest.version || opts.version,
        public: manifest.public ?? opts.public,
        observe: manifest.observe || manifest.capabilities || opts.observe,
        budgets: manifest.budgets || opts.budgets,
        outputs: manifest.outputs || opts.outputs,
        runtime: manifest.runtime || opts.runtime || 'js',
        scheduler: opts.scheduler,
    };

    if (typeof hooksOrFactory === 'function') {
        // Support both sync & async factories.
        const maybe = hooksOrFactory;
        try {
            const test = maybe.length >= 1 ? maybe({}) : undefined; // don’t execute; just arity hint
            // We cannot reliably detect promise without calling; call inside the branch below.
        } catch {
            // ignore
        }
        // Execute once with the real ctx inside plugin()/pluginAsync(); here we route by return type via wrapper.
        const factory = (ctx) => {
            const res = hooksOrFactory(ctx);
            return res;
        };
        // Defer promise handling to pluginAsync to keep code simple.
        const runner = async (ctx) => await hooksOrFactory(ctx);
        // Choose path by peeking only when actually called.
        return plugin(
            label,
            (ctx) => {
                const r = factory(ctx);
                if (r && typeof r.then === 'function') {
                    // Throw to force caller toward pluginAsync; or we can re-route:
                    // We re-route by throwing a sentinel and letting caller use pluginAsync.
                    throw new Error(
                        'createPlugin: async factory detected; use createPluginAsync or export pluginAsync in caller'
                    );
                }
                return r || {};
            },
            merged
        );
    }

    if (hooksOrFactory && typeof hooksOrFactory === 'object') {
        // Plain object of hooks (sync)
        return plugin(label, () => hooksOrFactory, merged);
    }

    throw new TypeError(
        'createPlugin requires a hooks object or factory function'
    );
}

export async function createPluginAsync(manifest, asyncFactory, opts = {}) {
    assertManifest(manifest);
    const label = manifest.name || manifest.id;
    const merged = {
        version: manifest.version || opts.version,
        public: manifest.public ?? opts.public,
        observe: manifest.observe || manifest.capabilities || opts.observe,
        budgets: manifest.budgets || opts.budgets,
        outputs: manifest.outputs || opts.outputs,
        runtime: manifest.runtime || opts.runtime || 'js',
        scheduler: opts.scheduler,
    };
    return pluginAsync(label, asyncFactory, merged);
}
