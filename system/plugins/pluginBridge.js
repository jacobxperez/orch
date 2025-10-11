/**
 * @license Apache License 2.0
 * @file orch/system/plugins/pluginBridge.js
 * @title Plugin Bridge (Public Wiring)
 * @description Wires host/devtools sinks into pluginRegistry and (optionally) subscribes to public runtime events.
 * @version 1.0.0
 */

import {pluginRegistry} from './pluginRegistry.js';

export function wirePluginSinks({log, metric, overlay} = {}) {
    pluginRegistry.setOutputSinks({log, metric, overlay});
}

/**
 * Example hook-up: call this from your app bootstrap (public layer),
 * NOT from maestro/source.
 */
export function startPluginBridge({subscribeRuntime} = {}) {
    // subscribeRuntime is a public-layer function that yields events
    // e.g. dispatcher.on('nodeUpdate', …), error bus, perf taps, etc.
    if (typeof subscribeRuntime === 'function') {
        subscribeRuntime((evt) => {
            // Decide routing based on evt.type
            if (evt.type === 'perf')
                pluginRegistry.setOutputSinks().metric?.(evt);
            if (evt.type === 'error')
                pluginRegistry.setOutputSinks().log?.(evt);
            if (evt.type === 'overlay')
                pluginRegistry.setOutputSinks().overlay?.(evt);
        });
    }
}
