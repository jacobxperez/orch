/**
 * @license Apache License 2.0
 * @file orch/dva/verifyArtifactIdentity.js
 * @title Artifact Identity Verifier
 * @description Convenience entrypoint for verifying a selected artifact through the release-bundle verifier.
 * @version 0.1.0
 */

import {verifyReleaseBundle} from './verifyReleaseBundle.js';

function verifyArtifactIdentity(options = {}) {
    return verifyReleaseBundle(options);
}

export {verifyArtifactIdentity};
