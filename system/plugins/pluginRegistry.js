/**
 * @license Apache License 2.0
 * @file orch/system/plugins/pluginRegistry.js
 * @title Orch Plugin Registry
 * @description Lightweight JS-side registry for public plugin descriptors exposed by orch/system, reflecting Runtime Core local admission outcomes before mutation.
 * @version 0.2.0
 */

import {admitNativeMutation} from '../runtime/localBoundary.js';

const entries = [];

function cloneDescriptor(descriptor) {
    return Object.freeze({...descriptor});
}

function normalizeDescriptor(descriptor) {
    if (typeof descriptor === 'string' && descriptor.trim().length > 0) {
        return {name: descriptor.trim()};
    }

    if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
        throw new TypeError('pluginRegistry.register() expects a plugin name or descriptor object');
    }

    const name =
        typeof descriptor.name === 'string' && descriptor.name.trim().length > 0
            ? descriptor.name.trim()
            : null;

    if (!name) {
        throw new TypeError('pluginRegistry.register() requires descriptor.name');
    }

    return {...descriptor, name};
}

function findIndex(name) {
    return entries.findIndex((entry) => entry.name === name);
}

export const pluginRegistry = Object.freeze({
    register(descriptor) {
        const normalized = normalizeDescriptor(descriptor);
        admitNativeMutation('pluginRegistry.register', {
            component: 'plugin-host',
            capability: 'plugin:plugin-host:register',
            intent: 'plugin:register',
        });
        const frozen = cloneDescriptor(normalized);
        const index = findIndex(frozen.name);

        if (index >= 0) {
            entries[index] = frozen;
            return frozen;
        }

        entries.push(frozen);
        return frozen;
    },

    get(name) {
        const normalizedName =
            typeof name === 'string' && name.trim().length > 0 ? name.trim() : null;
        if (!normalizedName) return null;
        const index = findIndex(normalizedName);
        return index >= 0 ? entries[index] : null;
    },

    list() {
        return Object.freeze(entries.slice());
    },

    clear() {
        entries.length = 0;
    },
});
