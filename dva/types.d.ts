/**
 * @license Apache License 2.0
 * @file orch/dva/types.d.ts
 * @title Verifier Types
 * @description Type declarations for the runtime verification surface.
 * @version 0.3.0
 */

export type DvaTrustDecision = 'accept' | 'deny' | 'observe-only' | 'quarantine';

export interface DvaPartBTrustRoot {
  kid: string;
  publicKeyPem: string;
}

export interface DvaPartBTrustPolicy {
  schema: 'dva:part-b:trust-policy:1';
  trustListVersion: string;
  policyVersion: string;
  trustListTtlSeconds: number;
  staleTrustListBehavior: 'deny' | 'observe-only' | 'quarantine';
  offlineVerifierBehavior: 'allow-if-fresh' | 'deny' | 'observe-only';
  keyRolloverOverlapSeconds: number;
  allowKids: string[];
  denyKids: string[];
  ext?: Record<string, unknown>;
}

export interface DvaPartBTrustRoots {
  schema: 'dva:part-b:trust-roots:1';
  keys: DvaPartBTrustRoot[];
  ext?: Record<string, unknown>;
}

export interface DvaPartBSupportWindowEntry {
  file: string;
  hash: string;
  manifestRoot: string;
  disposition: 'admit' | 'observe-only' | 'deny';
  admittedFrom?: string;
  admittedUntil?: string;
  ext?: Record<string, unknown>;
}

export interface DvaPartBSupportWindowPolicy {
  schema: 'dva:part-b:support-window:1';
  supportWindowVersion: string;
  policyVersion: string;
  entries: DvaPartBSupportWindowEntry[];
  ext?: Record<string, unknown>;
}

export interface DvaPartBRevokedReleaseMember {
  file: string;
  hash: string;
  manifestRoot: string;
  ext?: Record<string, unknown>;
}

export interface DvaPartBRevocationState {
  schema: 'dva:part-b:revocation-state:1';
  revocationStateVersion: string;
  policyVersion: string;
  revokedKids: string[];
  revokedArtifacts: string[];
  revokedManifestRoots: string[];
  revokedReleaseMembers: DvaPartBRevokedReleaseMember[];
  revokedAdmissionIdentities: string[];
  ext?: Record<string, unknown>;
}

export interface DvaPartBTrustMaterialFreshness {
  schema: 'dva:part-b:trust-material-freshness:1';
  trustListVersion: string;
  policyVersion: string;
  supportWindowVersion: string;
  revocationStateVersion: string;
  verificationTimestampClass: 'live-wall-clock' | 'cached-trust-clock' | 'omitted-deterministic';
  verificationTimestamp?: string;
  trustListAsOf?: string;
  supportWindowAsOf?: string;
  revocationStateAsOf?: string;
  ext?: Record<string, unknown>;
}

export interface DvaPartBVerificationResult {
  ok: boolean;
  trustDecision: DvaTrustDecision;
  audit: {
    signerKid: string;
    trustDecision: DvaTrustDecision;
    trustListVersion: string;
    policyVersion: string;
    supportWindowVersion: string;
    revocationStateVersion: string;
    verificationTimestampClass: string;
    admissionIdentity: string;
  };
  errors: Array<{code: string; message: string; details?: Record<string, unknown>}>;
  manifestRoot: string | null;
}

export interface RuntimeErrorEnvelope {
  code: string;
  message: string;
  origin: 'kernel' | 'scheduler' | 'graph' | 'abi' | 'dva' | 'auxiliary' | 'storage' | 'host';
  kind: string;
  severity: string;
  reason?: string;
  retry?: string;
  component?: string;
  details?: Record<string, unknown>;
}

export function verifyArtifactIdentity(options?: Record<string, unknown>): Promise<DvaPartBVerificationResult>;

export function runtimeErrorFromDvaPartBResult(
  result: DvaPartBVerificationResult,
  options?: {message?: string; component?: string}
): RuntimeErrorEnvelope | null;

export function verifyArtifactIdentityRuntimeError(
  options?: Record<string, unknown> & {
    runtimeError?: {message?: string; component?: string};
  }
): Promise<RuntimeErrorEnvelope | null>;
