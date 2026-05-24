/**
 * @license Apache License 2.0
 * @file orch/dva/types.d.ts
 * @title Verifier Types
 * @description Type declarations for the runtime verification surface.
 * @version 0.2.0
 */

export type DvaTrustDecision = 'accept' | 'deny' | 'observe-only' | 'quarantine';

export interface DvaPartBTrustRoot {
  kid: string;
  publicKeyPem: string;
}

export interface DvaPartBTrustPolicy {
  trustListVersion: string;
  policyVersion: string;
  allowKids: string[];
  denyKids?: string[];
  trustRoots: {keys: DvaPartBTrustRoot[]};
  verificationTime?: string;
  trustListExpiresAt?: string;
  supportWindow?: {notBefore?: string; notAfter?: string};
  revocations?: {
    revokedKids?: string[];
    revokedManifestRoots?: string[];
    revokedAdmissionIdentities?: string[];
  };
}

export interface DvaPartBVerificationResult {
  ok: boolean;
  trustDecision: DvaTrustDecision;
  audit: {
    signerKid: string;
    trustDecision: DvaTrustDecision;
    trustListVersion: string;
    policyVersion: string;
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
