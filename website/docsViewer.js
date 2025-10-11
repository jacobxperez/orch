/**
 * @license Apache License 2.0
 * @file orch/website/docsViewer.js
 * @title Orch Docs Viewer Setup
 * @description Reactive documentation viewer for the sealed WASM runtime (no getContext; task/route/introspect compliant)
 * @version 1.1.1
 */

import {
    state,
    effect,
    style,
    expose,
    scope,
    route,
    task,
    fetch,
    introspect,
} from 'orch';

export function setupDocsViewer() {
    scope('docsViewer', () => {
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // State signals
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const currentDoc = state('', {key: 'currentDoc'});
        const markdown = state('<p>Loading documentation...</p>', {
            key: 'markdown',
        });
        const availableDocs = state([], {key: 'availableDocs'});
        const isLoading = state(false, {key: 'isLoading'});
        const errorMsg = state('', {key: 'errorMsg'});

        // Router: prefer public route('doc'); fallback to local state
        let routeSignal = null;
        try {
            routeSignal = typeof route === 'function' ? route('doc') : null;
        } catch {
            routeSignal = null;
        }

        // Keep route -> currentDoc in sync if router exists
        if (routeSignal && typeof routeSignal === 'function') {
            effect(
                () => {
                    const v = routeSignal();
                    if (v && currentDoc() !== v) currentDoc(v);
                },
                {key: 'syncRouteToDoc'}
            );
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // Load docs list via public introspection (GraphRegistry)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        function readDocsFromIntrospection() {
            try {
                const i =
                    typeof introspect === 'function' ? introspect() : null;
                const all = i?.graph?.getAll?.() || i?.docs?.getAll?.() || [];
                return all
                    .filter(
                        (f) =>
                            f?.docs === 'updated' &&
                            typeof f.file === 'string' &&
                            f.file.endsWith('.md')
                    )
                    .map((f) => ({
                        label: f.title || f.file.replace(/\.md$/i, ''),
                        value: f.file.replace(/\.md$/i, ''),
                    }));
            } catch {
                return [];
            }
        }

        effect(
            () => {
                const docs = readDocsFromIntrospection();
                availableDocs(docs);

                const selected = currentDoc();
                const isValid = docs.some((d) => d.value === selected);

                if (!isValid && docs.length > 0) {
                    const fallback = docs[0].value;
                    currentDoc(fallback);
                    try {
                        if (
                            routeSignal &&
                            typeof routeSignal.set === 'function'
                        )
                            routeSignal.set(fallback);
                    } catch {}
                }
            },
            {key: 'loadMetadataEffect'}
        );

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // Unified fetch helper (prefers Orch fetch proxy)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        async function fetchText(url, opts) {
            const impl = typeof fetch === 'function' ? fetch : globalThis.fetch;
            const res = await impl(url, opts);
            if (!res || !res.ok)
                throw new Error(
                    `Fetch failed for ${url} (${res?.status || 'no status'})`
                );
            return res.text();
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // Markdown load/parse via task() with graceful shim
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        let loadDoc;
        try {
            if (typeof task === 'function') {
                loadDoc = task('docs:load', async (name) => {
                    if (!name) return '<p>No document selected.</p>';
                    const text = await fetchText(`/docs/${name}.md`);

                    return text
                        .replace(/^# (.*)$/gim, '<h1>$1</h1>')
                        .replace(/^## (.*)$/gim, '<h2>$1</h2>')
                        .replace(/^### (.*)$/gim, '<h3>$1</h3>')
                        .replace(/\*\*(.*?)\*\*/gim, '<b>$1</b>')
                        .replace(/\*(.*?)\*/gim, '<i>$1</i>')
                        .replace(/`(.*?)`/gim, '<code>$1</code>')
                        .replace(/\n/gim, '<br>');
                });
            }
        } catch {}

        if (!loadDoc) {
            const _loading = state(false);
            const _error = state(null);
            const _result = state(null);
            const run = async (name) => {
                _loading(true);
                _error(null);
                try {
                    const text = name
                        ? await fetchText(`/docs/${name}.md`)
                        : '';
                    const html = name
                        ? text
                              .replace(/^# (.*)$/gim, '<h1>$1</h1>')
                              .replace(/^## (.*)$/gim, '<h2>$1</h2>')
                              .replace(/^### (.*)$/gim, '<h3>$1</h3>')
                              .replace(/\*\*(.*?)\*\*/gim, '<b>$1</b>')
                              .replace(/\*(.*?)\*/gim, '<i>$1</i>')
                              .replace(/`(.*?)`/gim, '<code>$1</code>')
                              .replace(/\n/gim, '<br>')
                        : '<p>No document selected.</p>';
                    _result(html);
                } catch (e) {
                    _error(e);
                    _result('<p>⚠️ Error loading document.</p>');
                    console.warn('[DocsViewer] Fetch error (shim):', e);
                } finally {
                    _loading(false);
                }
            };
            loadDoc = Object.freeze({
                loading: () => _loading(),
                error: () => _error(),
                result: () => _result(),
                run,
            });
        }

        // Trigger load when currentDoc changes
        effect(
            () => {
                const name = currentDoc();
                if (!name) {
                    markdown('<p>No document selected.</p>');
                    return;
                }
                try {
                    loadDoc.run(name);
                } catch (e) {
                    console.warn('[DocsViewer] load run error:', e);
                    errorMsg(String(e?.message || e));
                    markdown('<p>⚠️ Error loading document.</p>');
                }
            },
            {key: 'loadMarkdownEffect'}
        );

        // Reflect task state into UI
        effect(
            () => {
                try {
                    if (typeof loadDoc.loading === 'function')
                        isLoading(!!loadDoc.loading());
                    if (typeof loadDoc.error === 'function') {
                        const err = loadDoc.error();
                        errorMsg(err ? String(err?.message || err) : '');
                    }
                    if (
                        typeof loadDoc.result === 'function' &&
                        loadDoc.result()
                    ) {
                        markdown(loadDoc.result());
                    }
                } catch {}
            },
            {key: 'reflectTaskState'}
        );

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // Scoped viewer styles
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const base = '[data-scope="docsViewer"]';
        style(base, {
            padding: '1.5rem',
            maxWidth: '800px',
            margin: '0 auto',
            fontFamily: 'Georgia, serif',
            lineHeight: '1.7',
            fontSize: '16px',
            color: '#222',
            backgroundColor: '#fff',
        });

        style(`${base} h1`, {fontSize: '2em', marginTop: '1rem'});
        style(`${base} h2`, {fontSize: '1.5em', marginTop: '1rem'});
        style(`${base} h3`, {fontSize: '1.2em', marginTop: '1rem'});

        style(`${base} code`, {
            background: '#eee',
            padding: '2px 4px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '14px',
            overflowX: 'auto',
        });

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // Public bindings for template + devtools
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        expose({
            $data: Object.freeze({
                role: 'docs-viewer',
                plugin: 'Docs',
                orchestrated: true,
                public: true,
                description: 'WASM-compliant docs viewer surface',
            }),
            currentDoc,
            markdown,
            availableDocs,
            isLoading,
            errorMsg,
        });
    });
}
