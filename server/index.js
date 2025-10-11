#!/usr/bin/env node

/**
 * @license Apache License 2.0
 * @file orch/server/index.js
 * @title Orch Server Entrypoint
 * @description Launches Orch runtime server (dev by default; --sealed to allow dist alias). Warns if sealed requested but build alias inactive.
 * @version 1.2.0
 */

import {serve} from './server.js';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const args = process.argv.slice(2);
const flag = (k, def) => {
    const hit = args.find((a) => a === `--${k}` || a.startsWith(`--${k}=`));
    if (!hit) return def;
    const eq = hit.indexOf('=');
    if (eq === -1) return true;
    const v = hit.slice(eq + 1);
    if (v === 'true') return true;
    if (v === 'false') return false;
    const n = Number(v);
    return Number.isNaN(n) ? v : n;
};

const port = Number(flag('port', 3000));
const rootDir = flag('root', 'orch/website');
const allowBuildAlias = !!flag('sealed', false); // only true when you pass --sealed
const message = flag('message', '✅ Orch Runtime Active');

// Optional: warn if --sealed was passed but exports["."] isn’t ./dist/index.js
if (allowBuildAlias) {
    try {
        const here = fileURLToPath(import.meta.url);
        const repoRoot = path.resolve(path.dirname(here), '..'); // orch/
        const pkgPath = path.join(repoRoot, 'package.json');
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            let target = null;
            const exp = pkg?.exports;
            if (typeof exp === 'string') target = exp;
            else if (exp && typeof exp === 'object') {
                const dot = exp['.'];
                target =
                    typeof dot === 'string'
                        ? dot
                        : (dot?.node ?? dot?.default ?? null);
            }
            const active =
                typeof target === 'string' && target.includes('/dist/index.js');
            if (!active) {
                console.warn(
                    '⚠️  --sealed passed, but build alias is not active. ' +
                        'In dev, exports["."] typically points to ./system/index.js. ' +
                        'Build from the maestro repo to flip it to ./dist/index.js for a true sealed test.'
                );
            }
        }
    } catch {
        /* non-fatal */
    }
}

serve({port, rootDir, allowBuildAlias, message});
