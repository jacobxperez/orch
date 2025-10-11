/**
 * @license Apache License 2.0
 * @file orch/introspection/introspectionPanel.js
 * @title Devtools Panel
 * @description Reactive state container for Orch devtools UI: visibility toggle, search/filter controls, filtered results, grouped by graphHash, updated for WASM runtime.
 * @version 3.1.1
 */

import {
    state,
    computed,
    introspect as _introspect,
    scheduler as _scheduler,
    self as _self,
} from 'orch';

export function IntrospectionPanel() {
    // Early WASM availability guard
    if (typeof globalThis.WebAssembly === 'undefined') {
        console.warn(
            '[IntrospectionPanel] Running in environment without WASM support'
        );
    }

    const visible = state(true, {key: 'visible'});
    const search = state('', {key: 'search'});
    const pluginFilter = state('', {key: 'pluginFilter'});
    const statusFilter = state('', {key: 'statusFilter'});
    const runtimeInfo = state(null, {key: 'runtimeInfo'});
    const grouped = state({}, {key: 'grouped'});
    const errorSignal = state(null, {key: 'error'});

    // ──────────────────────────────────────────────
    // Runtime Info Loader
    // ──────────────────────────────────────────────
    async function loadRuntimeInfo() {
        try {
            let info = null;
            if (typeof _self === 'function') {
                const selfNode = _self();
                if (selfNode && typeof selfNode.data === 'function') {
                    // Always handle async regardless of asyncData flag
                    const result = selfNode.data();
                    info = result instanceof Promise ? await result : result;
                }
            }
            runtimeInfo(info);
            groupNodes(info?.graphHash || null);
        } catch (err) {
            errorSignal(err);
        }
    }

    // ──────────────────────────────────────────────
    // Grouping by Graph Hash
    // ──────────────────────────────────────────────
    function groupNodes(activeHash) {
        try {
            const i = typeof _introspect === 'function' ? _introspect() : null;
            const all = i?.graph?.getAll?.() || [];
            const groups = {};

            all.forEach((node) => {
                const hash = node.graphHash || 'unknown';
                if (!groups[hash]) {
                    groups[hash] = {
                        graphHash: hash,
                        runtime:
                            hash === activeHash ? 'sealed-wasm' : 'public-js',
                        nodes: [],
                    };
                }
                groups[hash].nodes.push(node);
            });

            grouped(groups);
        } catch (err) {
            errorSignal(err);
        }
    }

    // ──────────────────────────────────────────────
    // Filtered Results
    // ──────────────────────────────────────────────
    const filtered = computed(
        () => {
            const term = search().trim().toLowerCase();
            const allGroups = Object.values(grouped() || {});
            const results = [];

            allGroups.forEach((group) => {
                const filteredNodes = group.nodes.filter((entry) => {
                    const matchesSearch =
                        !term ||
                        entry.title?.toLowerCase().includes(term) ||
                        entry.description?.toLowerCase().includes(term);
                    const matchesPlugin =
                        !pluginFilter() || entry.plugin === pluginFilter();
                    const matchesStatus =
                        !statusFilter() || entry.status === statusFilter();
                    return matchesSearch && matchesPlugin && matchesStatus;
                });
                if (filteredNodes.length) {
                    results.push({...group, nodes: filteredNodes});
                }
            });

            return results;
        },
        {key: 'filtered'}
    );

    function resetFilters() {
        search('');
        pluginFilter('');
        statusFilter('');
    }

    // ──────────────────────────────────────────────
    // Init & Auto-Refresh
    // ──────────────────────────────────────────────
    loadRuntimeInfo();

    try {
        if (typeof _scheduler === 'function') {
            _scheduler()?.when?.('fingerprint:ready').then(loadRuntimeInfo);
        }
    } catch {}

    // ──────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────
    const api = Object.freeze({
        $data: Object.freeze({
            role: 'devtools-panel',
            plugin: 'Devtools',
            orchestrated: true,
            public: false,
            description: 'WASM-arch compliant devtools panel surface',
        }),
        visible,
        search,
        pluginFilter,
        statusFilter,
        filtered,
        runtimeInfo,
        grouped,
        resetFilters,
        error: () => errorSignal(),
        data: () => ({
            type: 'devtools-panel',
            plugin: 'Devtools',
            public: false,
            orchestrated: true,
            hasError: !!errorSignal(),
            filters: {
                plugin: pluginFilter(),
                status: statusFilter(),
                term: search(),
            },
            visible: visible(),
            groupCount: Object.keys(grouped() || {}).length,
            filteredCount: filtered()?.reduce(
                (sum, g) => sum + g.nodes.length,
                0
            ),
            runtime: runtimeInfo(),
        }),
        status: () => ({
            reactive: true,
            headlessSafe: true,
            initialized: true,
            asyncDataSupported: true,
            runtimeLoaded: !!runtimeInfo(),
            groupsAvailable: !!Object.keys(grouped() || {}).length,
        }),
    });

    // ──────────────────────────────────────────────
    // Introspection Registration
    // ──────────────────────────────────────────────
    try {
        const i = typeof _introspect === 'function' ? _introspect() : null;
        i?.register?.('IntrospectionPanel', api);
    } catch (err) {
        errorSignal(err);
    }

    return api;
}
