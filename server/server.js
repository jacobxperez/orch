/**
 * @license Apache License 2.0
 * @file orch/server/server.js
 * @title Orch Local Website Server
 * @description Dependency-free Node.js static file server for local Orch public website testing.
 * @version 2.0.0
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));

/**
 * Starts a minimal local static server for the public website.
 *
 * Default root resolution is intentionally flexible so the same files work when:
 * - run from a repository root that contains orch/docs/index.html;
 * - run from orch/server/ beside ../docs/index.html;
 * - run from a standalone specimen folder beside index.html.
 *
 * @param {object} opts
 * @param {number} [opts.port=3000] Port to bind. Use 0 for an ephemeral port.
 * @param {string} [opts.host='127.0.0.1'] Host to bind. Defaults to loopback for local-only use.
 * @param {string} [opts.rootDir] Static root to serve. Defaults to the nearest local website root.
 * @param {string} [opts.message='Orch local website server is running.'] Fallback text response.
 * @param {(info: {url: string, port: number, host: string, rootDir: string}) => void} [opts.onReady]
 * @returns {object} Small server handle with data(), status(), error(), perf(), and stop().
 */
export function serve({
    port = 3000,
    host = '127.0.0.1',
    rootDir,
    message = 'Orch local website server is running.',
    onReady,
} = {}) {
    const startTime = performance.now();
    const absoluteRoot = resolveStaticRoot(rootDir);
    let status = 'starting';
    let error = null;

    const server = http.createServer((request, response) => {
        handleRequest({request, response, absoluteRoot, message});
    });

    server.on('error', (err) => {
        status = 'error';
        error = err;
    });

    server.listen(port, host, () => {
        status = 'listening';
        const address = server.address();
        const actualPort = typeof address === 'object' && address ? address.port : port;
        const url = `http://${hostForUrl(host)}:${actualPort}/`;
        onReady?.({url, port: actualPort, host, rootDir: absoluteRoot});
    });

    return Object.freeze({
        data: () => ({
            port: server.address()?.port ?? port,
            host,
            rootDir: absoluteRoot,
            url: `http://${hostForUrl(host)}:${server.address()?.port ?? port}/`,
        }),
        status: () => status,
        error: () => error,
        perf: () => ({uptimeMs: Math.max(0, performance.now() - startTime)}),
        stop: () => {
            try {
                server.close();
            } catch {
                // Closing an already-closed server is non-fatal for local use.
            }
        },
    });
}

function handleRequest({request, response, absoluteRoot, message}) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        sendText(response, 405, 'Method Not Allowed', request.method === 'HEAD', {
            Allow: 'GET, HEAD',
        });
        return;
    }

    const pathResult = resolveRequestPath(request.url, absoluteRoot);
    if (!pathResult.ok) {
        sendText(response, pathResult.status, pathResult.message, request.method === 'HEAD');
        return;
    }

    const resolvedFile = resolveIndexFile(pathResult.filePath);
    if (resolvedFile && isRegularFile(resolvedFile)) {
        response.writeHead(200, {
            'Content-Type': mimeType(path.extname(resolvedFile).toLowerCase()),
            'X-Content-Type-Options': 'nosniff',
        });
        if (request.method === 'HEAD') {
            response.end();
            return;
        }
        fs.createReadStream(resolvedFile).pipe(response);
        return;
    }

    sendText(response, 200, message, request.method === 'HEAD');
}

function resolveStaticRoot(rootDir) {
    if (typeof rootDir === 'string' && rootDir.trim() !== '') {
        return assertDirectory(path.resolve(process.cwd(), rootDir));
    }

    const candidates = [
        process.cwd(),
        path.resolve(process.cwd(), 'orch/docs'),
        path.resolve(process.cwd(), 'docs'),
        path.resolve(SERVER_DIR, '../docs'),
        SERVER_DIR,
    ];

    for (const candidate of candidates) {
        if (hasIndexHtml(candidate)) return candidate;
    }

    for (const candidate of candidates) {
        if (isDirectory(candidate)) return candidate;
    }

    return assertDirectory(process.cwd());
}

function resolveRequestPath(rawUrl, absoluteRoot) {
    const pathname = String(rawUrl || '/').split('?')[0] || '/';

    let decodedPathname;
    try {
        decodedPathname = decodeURIComponent(pathname);
    } catch {
        return {ok: false, status: 400, message: 'Bad Request'};
    }

    if (decodedPathname.includes('\0')) {
        return {ok: false, status: 400, message: 'Bad Request'};
    }

    const filePath = path.resolve(absoluteRoot, `.${decodedPathname}`);
    if (!isPathInside(filePath, absoluteRoot)) {
        return {ok: false, status: 403, message: 'Forbidden'};
    }

    return {ok: true, filePath};
}

function resolveIndexFile(filePath) {
    if (isDirectory(filePath)) {
        return path.join(filePath, 'index.html');
    }
    return filePath;
}

function isPathInside(child, parent) {
    const relative = path.relative(parent, child);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertDirectory(dir) {
    if (!isDirectory(dir)) {
        throw new TypeError(`[orch-server] Static root does not exist or is not a directory: ${dir}`);
    }
    return dir;
}

function hasIndexHtml(dir) {
    return isDirectory(dir) && isRegularFile(path.join(dir, 'index.html'));
}

function isDirectory(value) {
    try {
        return fs.statSync(value).isDirectory();
    } catch {
        return false;
    }
}

function isRegularFile(value) {
    try {
        return fs.statSync(value).isFile();
    } catch {
        return false;
    }
}

function sendText(response, statusCode, body, headOnly, headers = {}) {
    response.writeHead(statusCode, {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        ...headers,
    });
    response.end(headOnly ? undefined : body);
}

function hostForUrl(host) {
    if (host === '0.0.0.0' || host === '::') return '127.0.0.1';
    if (host.includes(':') && !host.startsWith('[')) return `[${host}]`;
    return host;
}

function mimeType(ext) {
    return (
        {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.mjs': 'application/javascript; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.md': 'text/markdown; charset=utf-8',
            '.txt': 'text/plain; charset=utf-8',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.map': 'application/json; charset=utf-8',
        }[ext] || 'application/octet-stream'
    );
}
