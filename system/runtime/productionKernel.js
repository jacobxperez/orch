/**
 * @license Apache License 2.0
 * @file orch/system/runtime/productionKernel.js
 * @title Orch Production Kernel Selection Boundary
 * @description Internal package-selection boundary that forwards production proxy calls only to an installed sealed-runtime composition and otherwise fails closed.
 * @version 0.1.0
 */

import {buildRuntimeError} from './runtimeError.js';

let productionBoundary = null;

function throwWithRuntimeError(runtimeError) {
    const error = new Error(runtimeError.message);
    error.name = 'OrchRuntimeError';
    error.code = runtimeError.code;
    error.runtimeError = runtimeError;
    throw error;
}

function unavailableCompositionError(operation) {
    return buildRuntimeError({
        code: 'ERR_CAPABILITY',
        message:
            'Production proxy execution requires an initialized sealed runtime composition.',
        origin: 'host',
        kind: 'security',
        severity: 'error',
        reason: 'policy',
        retry: 'do_not_retry',
        component: 'runtime.productionKernelSelection',
        details: Object.freeze({
            operation: 'production-composition-unavailable',
            requestedOperation: String(operation),
        }),
    });
}

function installProductionKernelBoundary(boundary) {
    if (
        !boundary ||
        typeof boundary !== 'object' ||
        typeof boundary.invokeHighLevelOperation !== 'function'
    ) {
        throw new TypeError(
            'installProductionKernelBoundary: boundary must expose invokeHighLevelOperation()'
        );
    }

    productionBoundary = Object.freeze({
        invokeHighLevelOperation:
            boundary.invokeHighLevelOperation.bind(boundary),
    });
    return productionBoundary;
}

const productionKernel = Object.freeze({
    call(operation, payload) {
        if (!productionBoundary) {
            throwWithRuntimeError(unavailableCompositionError(operation));
        }
        return productionBoundary.invokeHighLevelOperation(operation, payload);
    },
});

export {installProductionKernelBoundary, productionKernel};
