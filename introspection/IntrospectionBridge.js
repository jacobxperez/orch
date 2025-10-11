/**
 * @license Apache License 2.0
 * @file orch/introspection/IntrospectionBridge.js
 * @title Devtools Bridge for Orch
 * @description Interactive orchestration graph + runtime node inspector for Orch, WASM-aware.
 * @version 4.1.0
 */

export class IntrospectionBridge {
    static _instance;

    static init(context) {
        if (IntrospectionBridge._instance) return;
        const instance = new IntrospectionBridge(context);
        instance.init();
        IntrospectionBridge._instance = instance;
    }

    constructor(context) {
        this.context = context;
        this.panelMounted = false;
        this.buttonInjected = false;
        this.errorSignal = context.createSignal?.(null) || ((v) => v); // fallback no-op
        this.activeGraphHash = null;
        this.selectedNode = null; // key of selected node

        // local error history for introspection snapshots
        this._errors = [];
    }

    async init() {
        if (typeof window === 'undefined' || !document.body) {
            this.context?.warn?.(
                '[Devtools] Skipped — running in headless mode'
            );
            return;
        }

        try {
            this._injectButtonOnce();
            await this._loadRuntimeFingerprint();

            if (!this.context._renderingDevtools) {
                this.context._renderingDevtools = true;
                this.context.introspect?.register?.(
                    'IntrospectionBridge',
                    this
                );
                this.context._renderingDevtools = false;
            }

            this.context.registerPlugin?.('devtools');

            this.context.scheduler?.when?.('fingerprint:ready').then((fp) => {
                this.activeGraphHash = fp?.graphHash || null;
                if (this.panelMounted) this._renderGraph();
            });
        } catch (err) {
            this._pushError(err, 'init');
            this.context.error?.setError?.(
                'IntrospectionBridge',
                err,
                'global'
            );
        }
    }

    async _loadRuntimeFingerprint() {
        try {
            const selfNode = this.context.get?.('orch:self');
            if (!selfNode) return;
            const data = await selfNode.data();
            this.activeGraphHash = data?.buildFingerprint?.graphHash || null;
        } catch (err) {
            console.warn('[Devtools] Could not load runtime fingerprint:', err);
        }
    }

    mountPanel() {
        if (this.panelMounted) return;
        this.panelMounted = true;

        try {
            this._injectPanel();
            this._renderGraph();
            this._renderLegend();
            this._renderInspector();
        } catch (err) {
            this._pushError(err, 'mount');
            this.context.error?.setError?.(
                'IntrospectionBridge',
                err,
                'global'
            );
        }
    }

    // ─── Introspection surface ────────────────────────────────────────────

    isVisible() {
        return this.panelMounted;
    }

    /**
     * Returns a frozen list of error entries captured by the bridge (or an empty array).
     * Each entry: { message, stack?, phase, timestamp }
     */
    error() {
        return Object.freeze(this._errors.length ? this._errors.slice() : []);
    }

    /**
     * Returns a frozen status snapshot suitable for CI introspection.
     */
    status() {
        return Object.freeze({
            active: !!this.panelMounted,
            hasErrors: this._errors.length > 0,
            errorsCount: this._errors.length,
            selectedNode: this.selectedNode,
            activeGraphHash: this.activeGraphHash,
        });
    }

    /**
     * Returns a frozen metadata snapshot for the Devtools bridge.
     */
    data() {
        return Object.freeze({
            type: 'devtools',
            plugin: 'Core',
            public: true,
            orchestrated: true,
            mounted: this.panelMounted,
            hasError: this._errors.length > 0,
            status: this.panelMounted ? 'active' : 'idle',
            description:
                'Manages the Orch orchestration graph panel and introspection UI',
            activeGraphHash: this.activeGraphHash,
            selectedNode: this.selectedNode,
            methods: Object.freeze(['data', 'status', 'error']),
        });
    }

    // ─── UI wiring ────────────────────────────────────────────────────────

    _injectButtonOnce() {
        if (this.buttonInjected) return;
        this.buttonInjected = true;

        const button = document.createElement('button');
        button.textContent = 'Graph';
        button.setAttribute('data-orch-devtools-button', '');
        Object.assign(button.style, {
            position: 'fixed',
            bottom: '1rem',
            right: '1rem',
            zIndex: 9999,
            padding: '0.4rem 0.8rem',
            background: '#111',
            color: '#fff',
            fontSize: '12px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
        });

        button.onclick = () => this.mountPanel();
        document.body.appendChild(button);
    }

    _injectPanel() {
        if (document.getElementById('orch-devtools-panel')) return;

        const container = document.createElement('div');
        container.id = 'orch-devtools-panel';
        Object.assign(container.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100vw',
            height: '60vh',
            background: '#0a0a0a',
            color: '#fff',
            zIndex: 9998,
            display: 'grid',
            gridTemplateColumns: '2fr 1fr',
            overflow: 'hidden',
            fontFamily: 'monospace',
        });

        const graph = document.createElement('div');
        graph.id = 'orch-graph-view';
        graph.style.overflow = 'auto';
        container.appendChild(graph);

        const inspector = document.createElement('div');
        inspector.id = 'orch-node-inspector';
        inspector.style.background = '#111';
        inspector.style.padding = '1rem';
        inspector.style.overflow = 'auto';
        container.appendChild(inspector);

        const legend = document.createElement('div');
        legend.id = 'orch-graph-legend';
        legend.style.gridColumn = '1 / span 2';
        legend.style.padding = '0.5rem 1rem';
        legend.style.background = '#1a1a1a';
        container.appendChild(legend);

        document.body.appendChild(container);
    }

    _renderGraph() {
        const container = document.getElementById('orch-graph-view');
        if (!container) return;
        container.innerHTML = '';

        const graph = (this.context._graph?.getGraph?.() || []).filter(
            (n) => !n.key?.startsWith('Devtools')
        );

        const svg = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'svg'
        );
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '300');
        svg.setAttribute('style', 'background:#111;border:1px solid #333;');

        let x = 10;
        const y = 30;

        graph.forEach((node) => {
            const isFromWasm =
                node.graphHash && node.graphHash === this.activeGraphHash;

            const group = document.createElementNS(
                'http://www.w3.org/2000/svg',
                'g'
            );
            group.style.cursor = 'pointer';
            group.addEventListener('click', () => {
                this.selectedNode = node.key;
                this._renderInspector();
                this._renderGraph(); // refresh highlight
            });

            const rect = document.createElementNS(
                'http://www.w3.org/2000/svg',
                'rect'
            );
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', 140);
            rect.setAttribute('height', 50);
            rect.setAttribute(
                'fill',
                this.selectedNode === node.key
                    ? '#ff9800'
                    : isFromWasm
                      ? '#1e88e5'
                      : '#222'
            );
            rect.setAttribute('stroke', '#555');

            const text = document.createElementNS(
                'http://www.w3.org/2000/svg',
                'text'
            );
            text.setAttribute('x', x + 10);
            text.setAttribute('y', y + 25);
            text.setAttribute('fill', '#fff');
            text.setAttribute('font-size', '12');
            text.textContent = node.key;

            const errs = node.error?.();
            if (
                errs &&
                ((Array.isArray(errs) && errs.length) ||
                    (!Array.isArray(errs) && errs))
            ) {
                rect.setAttribute('fill', '#f44336');
                text.textContent = `${node.key} (Error)`;
            }

            group.appendChild(rect);
            group.appendChild(text);
            svg.appendChild(group);
            x += 160;
        });

        container.appendChild(svg);
    }

    async _renderInspector() {
        const panel = document.getElementById('orch-node-inspector');
        if (!panel) return;
        panel.innerHTML = `<h3 style="margin-top:0">Node Inspector</h3>`;

        if (!this.selectedNode) {
            panel.innerHTML += `<p style="color:#888">Select a node from the graph to inspect</p>`;
            return;
        }

        const node = this.context._graph?.get?.(this.selectedNode);
        if (!node) {
            panel.innerHTML += `<p style="color:#f44336">Node not found</p>`;
            return;
        }

        let nodeData = {};
        try {
            const raw = node.data?.();
            nodeData = raw instanceof Promise ? await raw : raw;
        } catch (err) {
            nodeData = {error: err?.message || String(err)};
        }

        panel.innerHTML += `<pre style="white-space:pre-wrap;font-size:12px">${JSON.stringify(
            nodeData,
            null,
            2
        )}</pre>`;
    }

    _renderLegend() {
        const legend = document.getElementById('orch-graph-legend');
        if (!legend || legend.children.length > 0) return;

        const tagColors = {
            'sealed-wasm': '#1e88e5',
            'public-js': '#222',
            selected: '#ff9800',
            error: '#f44336',
        };

        const heading = document.createElement('h4');
        heading.textContent = 'Legend';
        heading.style.marginBottom = '0.5rem';
        legend.appendChild(heading);

        for (const [tag, color] of Object.entries(tagColors)) {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.marginBottom = '4px';

            const swatch = document.createElement('span');
            Object.assign(swatch.style, {
                display: 'inline-block',
                width: '12px',
                height: '12px',
                background: color,
                marginRight: '6px',
                borderRadius: '2px',
            });

            const label = document.createElement('span');
            label.textContent = tag;
            label.style.fontSize = '12px';

            row.appendChild(swatch);
            row.appendChild(label);
            legend.appendChild(row);
        }
    }

    // ─── Internal helpers ─────────────────────────────────────────────────

    _pushError(err, phase) {
        try {
            const entry = Object.freeze({
                message: String(err?.message || err),
                stack: err?.stack ? String(err.stack) : undefined,
                phase: phase || 'unknown',
                timestamp: Date.now(),
            });
            this._errors.push(entry);
            // keep external observable signal in sync if available
            try {
                this.errorSignal(entry);
            } catch (_) {}
        } catch (_) {
            // best-effort; never throw from error path
        }
    }
}
