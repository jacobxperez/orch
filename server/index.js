#!/usr/bin/env node

/**
 * @license Apache License 2.0
 * @file orch/server/index.js
 * @title Orch Local Website Server Entrypoint
 * @description Launches a dependency-free local static server for the Orch public website.
 * @version 2.0.0
 */

import {serve} from './server.js';

const args = process.argv.slice(2);

function flag(name, fallback) {
    const hit = args.find((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
    if (!hit) return fallback;

    const eq = hit.indexOf('=');
    if (eq === -1) return true;

    const raw = hit.slice(eq + 1);
    if (raw === 'true') return true;
    if (raw === 'false') return false;

    const numeric = Number(raw);
    return Number.isNaN(numeric) ? raw : numeric;
}

function numberFlag(name, fallback) {
    const value = Number(flag(name, fallback));
    if (!Number.isInteger(value) || value < 0 || value > 65535) {
        throw new TypeError(`[orch-server] --${name} must be an integer from 0 to 65535.`);
    }
    return value;
}

const port = numberFlag('port', 3000);
const host = String(flag('host', '127.0.0.1'));
const rootDir = flag('root', undefined);
const message = String(flag('message', 'Orch local website server is running.'));

const localServer = serve({
    port,
    host,
    rootDir,
    message,
    onReady({url, rootDir: resolvedRootDir}) {
        console.log(`[orch-server] Serving ${resolvedRootDir}`);
        console.log(`[orch-server] Open ${url}`);
    },
});

process.on('SIGINT', () => {
    localServer.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    localServer.stop();
    process.exit(0);
});
