/**
 * @license Apache License 2.0
 * @file orch/server/server.js
 * @title Orch Runtime Server
 * @description Minimal headless-compatible HTTP + static file server for Orch website testing (WASM-arch safe). Blocks running under build alias by default, and falls back to system/ in dev if alias is unavailable.
 * @version 1.3.0
 */

// Try to use the 'orch' self-reference; if not available (edge cases), fall back to system/
let orchApi;
try {
    orchApi = await import('orch'); // resolves via package.json "exports"
} catch {
    orchApi = await import('../system/index.js'); // dev fallback, no maestro required
}

const {scope, task, introspect: _introspect} = orchApi;

// Try to load Node's http/fs only in Node environments
let http = null;
let fs = null;
let path = null;
let urlmod = null;
try {
    http = await import('node:http');
    fs = await import('node:fs');
    path = await import('node:path');
    urlmod = await import('node:url');
} catch {
    // non-Node env — server won't start
}

/** Determine if package.json maps exports["."] → ./dist/index.js (build alias active). */
function isBuildAliasActive() {
    try {
        if (!fs || !path || !urlmod) return false;
        const here = urlmod.fileURLToPath(import.meta.url);
        const repoRoot = path.resolve(path.dirname(here), '..'); // orch/
        const pkgPath = path.join(repoRoot, 'package.json');
        if (!fs.existsSync(pkgPath)) return false;
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

        let target = null;
        const exp = pkg?.exports;
        if (typeof exp === 'string') {
            target = exp;
        } else if (exp && typeof exp === 'object') {
            // Handle common shapes: { ".": "./dist/index.js" } or conditional { ".": { "node": "...", "default": "..." } }
            const dot = exp['.'];
            if (typeof dot === 'string') target = dot;
            else if (dot && typeof dot === 'object')
                target = dot.node ?? dot.default ?? null;
        }
        return typeof target === 'string' && target.includes('/dist/index.js');
    } catch {
        return false;
    }
}

/**
 * Starts a minimal introspectable Orch-compatible server.
 * Emits `.data()`, `.status()`, `.error()`, `.perf()` for devtools compatibility.
 *
 * @param {object} opts
 * @param {number}   [opts.port=3000]                 Port to bind HTTP server.
 * @param {string}   [opts.rootDir='.']               Static root to serve.
 * @param {string}   [opts.message='✅ Orch Runtime Active'] Default text response.
 * @param {boolean}  [opts.allowBuildAlias=false]     Allow running when alias is in build mode (dist)?
 * @returns {object} Introspectable task with status, data, error, perf, stop().
 */
export function serve({
    port = 3000,
    rootDir = '.',
    message = '✅ Orch Runtime Active',
    allowBuildAlias = false,
} = {}) {
    return scope('orch.publicServer', () => {
        return task('orch.http.start', () => {
            let server;
            let status = 'starting';
            let error = null;
            let startTime = performance.now();
            const buildAliasActive = isBuildAliasActive();

            // Block serving when alias points to dist/ unless explicitly allowed
            if (buildAliasActive && !allowBuildAlias) {
                status = 'forbidden';
                error = new Error(
                    '[serve] Blocked: "orch" exports points to build entry (./dist/index.js). Pass allowBuildAlias=true to override.'
                );
                return buildApi(null, status, error, startTime, {
                    port,
                    rootDir,
                    buildAliasActive,
                });
            }

            if (!http || !fs || !path) {
                status = 'unavailable';
                error = new Error('[serve] Node.js core modules not available');
                return buildApi(null, status, error, startTime, {
                    port,
                    rootDir,
                    buildAliasActive,
                });
            }

            try {
                const absoluteRoot = path.resolve(rootDir);

                server = http.createServer((req, res) => {
                    try {
                        const urlPath = decodeURIComponent(
                            (req.url || '/').split('?')[0] || '/'
                        );

                        // Prevent path traversal: resolve against absoluteRoot and ensure containment
                        let resolved = path.resolve(
                            absoluteRoot,
                            '.' + urlPath
                        );
                        if (!resolved.startsWith(absoluteRoot)) {
                            res.writeHead(403, {'Content-Type': 'text/plain'});
                            res.end('Forbidden');
                            return;
                        }

                        // If directory or '/', try index.html
                        if (
                            fs.existsSync(resolved) &&
                            fs.statSync(resolved).isDirectory()
                        ) {
                            resolved = path.join(resolved, 'index.html');
                        }
                        if (urlPath === '/') {
                            const idx = path.join(absoluteRoot, 'index.html');
                            if (
                                fs.existsSync(idx) &&
                                fs.statSync(idx).isFile()
                            ) {
                                resolved = idx;
                            }
                        }

                        if (
                            fs.existsSync(resolved) &&
                            fs.statSync(resolved).isFile()
                        ) {
                            const ext = path.extname(resolved).toLowerCase();
                            const type = mimeType(ext);
                            res.writeHead(200, {'Content-Type': type});
                            fs.createReadStream(resolved).pipe(res);
                            return;
                        }

                        // Default response
                        res.writeHead(200, {'Content-Type': 'text/plain'});
                        res.end(message);
                    } catch (e) {
                        res.writeHead(500, {'Content-Type': 'text/plain'});
                        res.end('Internal Server Error');
                    }
                });

                server.listen(port, () => {
                    status = 'listening';
                    startTime = performance.now(); // reset when ready
                });

                return buildApi(server, status, null, startTime, {
                    port,
                    rootDir: absoluteRoot,
                    buildAliasActive,
                });
            } catch (err) {
                status = 'error';
                error = err;
                return buildApi(server, status, error, startTime, {
                    port,
                    rootDir,
                    buildAliasActive,
                });
            }
        });
    });
}

function buildApi(server, status, error, startTime, extra = {}) {
    const api = {
        $data: Object.freeze({
            role: 'orch-server',
            plugin: 'Server',
            orchestrated: true,
            public: true,
            description: 'WASM-arch compliant runtime HTTP server',
        }),
        data: () => ({
            port: server?.address?.().port ?? extra.port,
            rootDir: extra.rootDir,
            buildAliasActive: !!extra.buildAliasActive,
        }),
        status: () => status,
        error: () => error,
        perf: () => ({uptimeMs: Math.max(0, performance.now() - startTime)}),
        stop: () => {
            try {
                server?.close();
            } catch {}
        },
    };

    // Register for devtools
    try {
        const i = typeof _introspect === 'function' ? _introspect() : null;
        i?.register?.('orch-server', api);
    } catch {}

    return Object.freeze(api);
}

function mimeType(ext) {
    return (
        {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.md': 'text/markdown',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.map': 'application/json',
            '.txt': 'text/plain',
        }[ext] || 'application/octet-stream'
    );
}
