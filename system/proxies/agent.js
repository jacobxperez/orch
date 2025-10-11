/**
 * @license Apache License 2.0
 * @file orch/system/proxies/agent.js
 * @title agent
 * @description Developer-facing proxy for agents. Supports both createAgent (sealed kernel) and orchestration-forwarding mode (spec-based).
 * @version 1.1.0
 */

import {kernel} from 'orch-kernel';

/**
 * agent() usage:
 *
 * 1. Legacy: agent(label: string, fn: Function)
 *    → Forwards to kernel.createAgent (sealed kernel runs full registration + introspection).
 *
 * 2. Proxy: agent(spec: object)
 *    → Thin forwarding proxy to orchestrate.run/stream inside orch.wasm.
 *    → No orchestration logic here — only forwarding + snapshot normalization.
 */
export const agent = Object.freeze(function agent(...args) {
    // ────────── Mode A: legacy createAgent pass-through ──────────
    if (args.length === 2) {
        const [label, fn] = args;
        if (typeof label !== 'string') {
            throw new TypeError('agent label must be a string');
        }
        if (typeof fn !== 'function') {
            throw new TypeError('agent function must be callable');
        }
        return kernel.call('createAgent', {label, fn});
    }

    // ────────── Mode B: spec-based proxy ──────────
    if (args.length === 1 && args[0] && typeof args[0] === 'object') {
        const spec = args[0];
        const baseKey = spec.key || `agent:${spec.name || 'unnamed'}`;

        async function* stream(input = {}, options = {}) {
            const key = options.key || `${baseKey}:stream:${Date.now()}`;
            const payload = {key, spec, input};

            if (kernel?.env === 'js-dev-shim' && options.devPlan) {
                payload.plan = options.devPlan; // dev-only
            }

            const iterator = await kernel.call('orchestrate.stream', payload);

            if (
                !iterator ||
                typeof iterator[Symbol.asyncIterator] !== 'function'
            ) {
                const snapApi = await kernel.call('orchestrate.run', payload);
                yield snapshotFromApi(snapApi);
                return;
            }

            const signal = options.signal;
            try {
                for await (const api of iterator) {
                    if (signal?.aborted) {
                        try {
                            await kernel.call('orchestrate.cancel', {key});
                        } catch {}
                        break;
                    }
                    yield snapshotFromApi(api);
                }
            } finally {
                if (typeof options.onFinally === 'function') {
                    try {
                        options.onFinally();
                    } catch {}
                }
            }
        }

        async function runOnce(input = {}, options = {}) {
            const key = options.key || `${baseKey}:run:${Date.now()}`;
            const payload = {key, spec, input};

            if (kernel?.env === 'js-dev-shim' && options.devPlan) {
                payload.plan = options.devPlan; // dev-only
            }

            const api = await kernel.call('orchestrate.run', payload);
            return snapshotFromApi(api);
        }

        function snapshotFromApi(api) {
            try {
                const snap = {
                    at: new Date().toISOString(),
                    status: api?.status?.() ?? 'error',
                    data: safe(api?.data?.()),
                    error: safe(api?.error?.()),
                    ...(typeof api?.perf === 'function'
                        ? {perf: safe(api.perf())}
                        : {}),
                };
                return Object.freeze(snap);
            } catch (e) {
                return Object.freeze({
                    at: new Date().toISOString(),
                    status: 'error',
                    data: null,
                    error: {code: 'AGENT_PROXY_SNAPSHOT', message: String(e)},
                });
            }
        }

        function safe(x) {
            try {
                return x == null ? x : JSON.parse(JSON.stringify(x));
            } catch {
                return null;
            }
        }

        return Object.freeze({stream, runOnce, spec});
    }

    throw new TypeError(
        'agent() expects either (label: string, fn: function) or (spec: object)'
    );
});
