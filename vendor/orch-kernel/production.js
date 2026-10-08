/**
 * @license Apache License 2.0
 * @file orch/vendor/orch-kernel/production.js
 * @title Orch Kernel Package Selector
 * @description Selects the sealed-runtime production boundary by default and loads the development kernel shim only in explicit development, test, or bootstrap posture.
 * @version 0.1.1
 */

import {productionKernel} from '../../system/runtime/productionKernel.js';
import {resolveRuntimePosture} from '../../system/runtime/loadOrchWasm.js';

function isNodeTestRuntime(runtime = globalThis) {
    const processLike = runtime?.process;
    return (
        typeof processLike?.env?.NODE_TEST_CONTEXT === 'string' ||
        processLike?.execArgv?.includes?.('--test') === true
    );
}

function resolvePackagePosture(runtime = globalThis) {
    const environment = runtime?.process?.env?.NODE_ENV;
    if (typeof environment === 'string' && environment.trim().length > 0) {
        return resolveRuntimePosture(environment, runtime);
    }

    return isNodeTestRuntime(runtime) ? 'test' : 'production';
}

const posture = resolvePackagePosture();

const kernel =
    posture === 'production'
        ? productionKernel
        : (await import('./index.js')).kernel;

export {kernel};
