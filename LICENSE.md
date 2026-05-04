# Orch License Index

This repository uses a **multi-license boundary** to separate Apache-licensed public integration materials from the sealed Orch runtime artifact.

For a plain-language explanation of this model, see [DISTRIBUTION.md](./DISTRIBUTION.md).

---

## 1) Apache License 2.0

**Applies to:**

- All content in `orch/**` except the Runtime Artifact Set

This includes public proxies, SDKs, CLI tools, docs, examples, website materials, and other public integration surfaces unless explicitly excluded.

See the full license text: [LICENSE-APACHE.md](./LICENSE-APACHE.md)

---

## 2) Orch Runtime EULA

**Applies to the Runtime Artifact Set.**

The Runtime Artifact Set includes:

- `orch/public/wasm/orch*.wasm`
- runtime fingerprints
- runtime manifests
- runtime notices
- policy bundles
- provenance sidecars
- attestation sidecars
- integrity sidecars
- other runtime sidecars shipped with or for the sealed runtime

**Key Notes:**

- The Runtime Artifact Set is not licensed under Apache License 2.0.
- It is provided for Evaluation Use only under [RUNTIME-EULA.md](./RUNTIME-EULA.md).
- Production, hosted, embedded, internal business, OEM, or commercial use requires a commercial license.

Commercial licensing options: [COMMERCIAL.md](./COMMERCIAL.md)

---

## Summary Table

| Component / Path | License Type |
| --- | --- |
| `orch/**` excluding the Runtime Artifact Set | Apache License 2.0 |
| Runtime Artifact Set | Orch Runtime EULA (Evaluation Only) |

---

© 2026 Jacob Perez. Orch™ is a trademark of Jacob Perez. All rights reserved.
