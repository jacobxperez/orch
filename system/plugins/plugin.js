/**
 * @license Apache License 2.0
 * @file orch/system/plugins/plugin.js
 * @title Orch Plugin Registration Helper
 * @description Registers a JS-side plugin descriptor through the public plugin registry without invoking the sealed kernel.
 * @version 0.1.0
 */

import {pluginRegistry} from './pluginRegistry.js';

export function plugin(descriptor) {
    return pluginRegistry.register(descriptor);
}
