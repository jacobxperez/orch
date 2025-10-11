/**
 * @license Apache License 2.0
 * @file orch/website/docsViewerStyles.js
 * @title Docs Viewer Styles
 * @description Provides scoped styling for the Orch documentation viewer (WASM-arch compliant)
 * @version 1.1.0
 */

import {style, scope} from 'orch';

export const setupDocsViewerStyles = Object.freeze(
    function setupDocsViewerStyles() {
        scope('docsViewer:styles', () => {
            const base = '[data-scope="docsViewer"]';

            style(base, {
                display: 'flex',
                flexDirection: 'column',
                gap: '2rem',
                maxWidth: '720px',
                margin: '4rem auto',
                padding: '0 1rem',
                fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                fontSize: '16px',
                color: '#222',
                lineHeight: '1.6',
                background: '#fefefe',
            });

            style(`${base} select`, {
                padding: '0.5rem 1rem',
                fontSize: '1rem',
                border: '1px solid #ccc',
                borderRadius: '8px',
                background: '#fff',
                color: '#222',
                appearance: 'none',
                width: '100%',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            });

            // NOTE: updated to match current viewer binding: data-bind="markdown"
            style(`${base} div[data-bind="markdown"]`, {
                background: '#fafafa',
                border: '1px solid #eee',
                padding: '2rem',
                borderRadius: '12px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
            });

            style(`${base} h1`, {fontSize: '1.75rem'});
            style(`${base} h2`, {fontSize: '1.4rem'});
            style(`${base} h3`, {fontSize: '1.2rem'});

            style(`${base} h1, ${base} h2, ${base} h3`, {
                fontWeight: '600',
                marginTop: '2rem',
                marginBottom: '1rem',
                color: '#111',
            });

            style(`${base} p`, {margin: '1rem 0'});

            style(`${base} code`, {
                background: '#eee',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '0.95em',
                color: '#111',
            });

            style(`${base} hr`, {
                border: 'none',
                borderTop: '1px solid #ddd',
                margin: '2rem 0',
            });

            style(`${base} a`, {
                color: '#007bff',
                textDecoration: 'none',
            });

            style(`${base} a:hover`, {
                textDecoration: 'underline',
            });

            style(`${base} *`, {
                transition: 'all 0.15s ease-in-out',
            });

            // 🌙 Dark theme
            const dark = `${base}[data-theme="dark"]`;

            style(dark, {
                background: '#111',
                color: '#eee',
            });

            style(`${dark} select`, {
                background: '#222',
                color: '#eee',
                border: '1px solid #555',
            });

            style(`${dark} div[data-bind="markdown"]`, {
                background: '#1a1a1a',
                borderColor: '#333',
                color: '#ddd',
            });

            style(`${dark} h1, ${dark} h2, ${dark} h3`, {
                color: '#fff',
            });

            style(`${dark} code`, {
                background: '#333',
                color: '#f1f1f1',
            });

            style(`${dark} a`, {
                color: '#66bfff',
            });

            style(`${dark} hr`, {
                borderTop: '1px solid #444',
            });
        });
    }
);
