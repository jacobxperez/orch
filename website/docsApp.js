/**
 * @license Apache License 2.0
 * @file orch/website/docsApp.js
 * @title Orch Docs Viewer App
 * @description Interactive markdown viewer powered by Orch and GraphRegistry (WASM-arch compliant)
 * @version 1.1.1
 */

import {
    state,
    effect,
    expose,
    scope,
    route,
    task,
    fetch,
    introspect,
} from 'orch';
import {parseMarkdown} from './markdownParser.js';
import {setupDocsViewerStyles} from './docsViewerStyles.js';

export function setupDocsViewerApp() {
    scope('docsApp', () => {
        setupDocsViewerStyles();

        const renderedHtml = state('<p>Loading documentation...</p>');
        const isLoading = state(false);

        // ─────────────────────────────────────────────────────────────
        // Get available docs via public introspection
        // ─────────────────────────────────────────────────────────────
        function getAvailableFiles() {
            try {
                const i =
                    typeof introspect === 'function' ? introspect() : null;
                const all = i?.graph?.getAll?.() || i?.docs?.getAll?.() || [];
                return all
                    .map((x) => x.file)
                    .filter((f) => typeof f === 'string' && f.endsWith('.md'));
            } catch {
                return [];
            }
        }

        const availableFiles = getAvailableFiles();
        const fileOptions = availableFiles.map((f) => ({
            label: f.replace(/\.md$/i, ''),
            value: f,
        }));

        // ─────────────────────────────────────────────────────────────
        // Router support (prefer route() primitive)
        // ─────────────────────────────────────────────────────────────
        let routerSignal = null;
        try {
            routerSignal = typeof route === 'function' ? route('doc') : null;
        } catch {
            routerSignal = null;
        }

        const selectedFile =
            routerSignal && typeof routerSignal === 'function'
                ? routerSignal
                : state('');

        // ─────────────────────────────────────────────────────────────
        // Fetch helper (prefers WASM-aware fetch)
        // ─────────────────────────────────────────────────────────────
        async function fetchText(url, opts) {
            const impl = typeof fetch === 'function' ? fetch : globalThis.fetch;
            const res = await impl(url, opts);
            if (!res || !res.ok)
                throw new Error(`Fetch failed (${res?.status || 'no status'})`);
            return res.text();
        }

        // ─────────────────────────────────────────────────────────────
        // Load logic (prefers task() primitive, shims if absent)
        // ─────────────────────────────────────────────────────────────
        let loadDoc;
        try {
            if (typeof task === 'function') {
                loadDoc = task('docs:load', async (file) => {
                    if (!file) return '<p>No file selected.</p>';
                    const text = await fetchText(`/docs/${file}`);
                    return parseMarkdown(text);
                });
            }
        } catch {}

        if (!loadDoc) {
            const loading = state(false);
            const error = state(null);
            const result = state(null);
            const run = async (file) => {
                loading(true);
                error(null);
                try {
                    const html = file
                        ? parseMarkdown(await fetchText(`/docs/${file}`))
                        : '<p>No file selected.</p>';
                    result(html);
                } catch (e) {
                    error(e);
                    result(`<p>⚠️ Error loading file: ${file}</p>`);
                    console.warn('[DocsApp] Load error (shim):', e);
                } finally {
                    loading(false);
                }
            };
            loadDoc = Object.freeze({
                loading: () => loading(),
                error: () => error(),
                result: () => result(),
                run,
            });
        }

        // ─────────────────────────────────────────────────────────────
        // Ensure selection is valid
        // ─────────────────────────────────────────────────────────────
        effect(() => {
            const current =
                routerSignal && typeof routerSignal === 'function'
                    ? routerSignal()
                    : selectedFile();

            const valid = availableFiles.includes(current);
            if (!valid && availableFiles.length > 0) {
                const fallback = availableFiles[0];
                selectedFile(fallback);
                try {
                    if (
                        routerSignal &&
                        typeof routerSignal.set === 'function'
                    ) {
                        routerSignal.set(fallback);
                    }
                } catch {}
            }
        });

        // ─────────────────────────────────────────────────────────────
        // Load file when selection changes
        // ─────────────────────────────────────────────────────────────
        effect(() => {
            const file =
                routerSignal && typeof routerSignal === 'function'
                    ? routerSignal()
                    : selectedFile();

            if (!file && availableFiles.length === 0) {
                renderedHtml('<p>No documentation found.</p>');
                return;
            }
            try {
                if (loadDoc.run) loadDoc.run(file);
            } catch (e) {
                console.warn('[DocsApp] Load run error:', e);
                renderedHtml(`<p>⚠️ Error loading file: ${file}</p>`);
            }
        });

        // ─────────────────────────────────────────────────────────────
        // Sync loading + result into UI
        // ─────────────────────────────────────────────────────────────
        effect(() => {
            try {
                if (typeof loadDoc.loading === 'function') {
                    isLoading(!!loadDoc.loading());
                }
                if (typeof loadDoc.result === 'function' && loadDoc.result()) {
                    renderedHtml(loadDoc.result());
                }
            } catch {}
        });

        // ─────────────────────────────────────────────────────────────
        // Public surface
        // ─────────────────────────────────────────────────────────────
        expose({
            $data: Object.freeze({
                role: 'docs-viewer',
                plugin: 'Docs',
                orchestrated: true,
                public: true,
                description: 'WASM-arch compliant docs viewer surface',
            }),
            selectedFile,
            availableFiles,
            fileOptions,
            renderedHtml,
            isLoading,
        });
    });
}
