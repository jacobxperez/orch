# Orch Runtime End-User License Agreement (EULA)

**Effective Date:** 2025-11-02  
**Applies to:** The Orch Runtime Artifact Set distributed by Jacob Perez (“Licensor”), including the sealed Orch runtime WebAssembly module(s) named `orch*.wasm` and accompanying runtime sidecars in `orch/public/wasm/**`, such as fingerprints, manifests, notices, policy bundles, provenance files, attestation files, and integrity files.

This agreement does **not** apply to Apache-licensed public integration materials in `orch/**`, such as public proxies, SDK shims, documentation, examples, website materials, or public integration utilities, except where those materials are part of the Runtime Artifact Set.

By downloading, installing, copying, accessing, or running the Orch Runtime Artifact Set, you accept this EULA. If you do not agree, do not use the Runtime Artifact Set.

---

## 1. Definitions

- **“Runtime”** means the sealed Orch orchestration binary located at `orch/public/wasm/orch*.wasm`.
- **“Sidecars”** means files shipped with or for the Runtime to support provenance, integrity, policy, notices, attestation, compatibility, verification, or runtime identity, including fingerprints, manifests, policy bundles, provenance files, attestation files, integrity files, and notices.
- **“Runtime Artifact Set”** means the Runtime and Sidecars.
- **“Apache-Licensed Materials”** means materials in `orch/**` that are licensed under Apache License 2.0 and are not part of the Runtime Artifact Set.
- **“Evaluation Use”** means non-commercial, non-production use for internal testing, prototyping, education, and research.
- **“Commercial Use”** means any production, revenue-generating, fee-based, hosted, embedded, OEM, internal business, customer-facing, proprietary, or third-party service use, including use to develop, operate, or provide services, systems, tools, platforms, or products for third parties.
- **“Policy Bundle”** means a Licensor-signed capability or policy manifest that enables specific host capabilities. The default Runtime posture is deny-all unless a valid Policy Bundle grants narrower capability rights.
- **“Attestation”** means host verification of the Runtime ABI hash and loaded Policy Bundles at startup and, where applicable, at intervals defined by the host’s policy or a separate agreement.
- **“Host Compatibility Review”** means Licensor-provided requirements, checks, procedures, or verification criteria, if any, for hosts that run, embed, distribute, or provide access to the Runtime under a separate commercial agreement.
- **“Custom Module”** or **“Auxiliary Module”** means a separate artifact you author, such as a plugin, satellite, helper, adapter-side tool, or external WASM module, that interfaces with the Runtime through public host bridges.

> **Note:** The Runtime exposes no user-tunable internal configuration. Behavior is governed by the sealed binary and any Licensor-signed Policy Bundles.

---

## 2. License Grant (Evaluation Only)

Subject to this EULA, Licensor grants you a limited, non-exclusive, non-transferable, revocable license to download, install, copy, and run the Runtime Artifact Set solely for Evaluation Use.

You may allow your employees and individual contractors, under confidentiality obligations, to use the Runtime Artifact Set for Evaluation Use on your behalf.

You may make a reasonable number of internal copies necessary for Evaluation Use.

No public redistribution, hosting, re-hosting, mirroring, sublicensing, sale, or third-party distribution is permitted under this EULA.

---

## 3. Ownership; No Implied Rights

The Runtime Artifact Set is licensed, not sold. Licensor and its licensors retain all rights, title, and interest in and to the Runtime Artifact Set and all associated intellectual property.

Except for the limited Evaluation Use rights expressly granted in this EULA, no other rights are granted by implication, exhaustion, estoppel, or otherwise.

Orch and related marks are trademarks of Licensor.

---

## 4. Restrictions

You must not:

1. **Use in production or for any Commercial Use**, including SaaS, cloud, PaaS, on-prem products, robotics, embedded systems, real-time systems, blockchain or zk systems, cryptographic execution layers, agent platforms, orchestration platforms, developer platforms, or customer-facing systems.

2. **Host, re-host, mirror, sell, sublicense, publish, bundle, distribute, or redistribute** the Runtime Artifact Set or any portion of it to third parties, including through package registries, containers, CDNs, app stores, public repositories, public artifact stores, or third-party products.

3. **Modify, translate, adapt, patch, repack, clone, wrap as a replacement runtime, or create derivative works** of the Runtime or Sidecars.

4. **Reverse engineer, decompile, disassemble, inspect internal implementation, extract source-equivalent logic, or attempt to derive the Runtime’s internal design**, except to the extent applicable law requires such activity for interoperability and only after first requesting available interface documentation from Licensor.

5. **Circumvent, remove, disable, tamper with, or bypass** any fingerprinting, integrity, provenance, capability, policy, attestation, compatibility, verification, observability, traceability, or orchestration introspection feature.

6. **Wrap, proxy, mediate, or package the Runtime** in a way that disables, obscures, falsifies, or degrades attestation, observability, traceability, introspection, provenance, policy enforcement, or runtime identity.

7. **Benchmark publicly** or publish performance results of the Runtime without prior written consent from Licensor. Internal benchmarking for Evaluation Use is allowed.

8. **Use the Runtime Artifact Set to develop, train, validate, benchmark, or improve competing orchestration runtimes**, runtime clones, runtime replacements, or substantially similar sealed orchestration systems.

9. **Remove, alter, obscure, or falsify** any notices, trademarks, copyright statements, proprietary legends, fingerprints, manifests, or runtime identity metadata in the Runtime Artifact Set.

10. **Claim official certification, endorsement, runtime compatibility, host approval, or Orch-approved status** for any third-party runtime, host, wrapper, integration, module, or platform without written permission.

---

## 5. Third-Party Components

The Runtime may include, depend on, or link to third-party components subject to their own licenses. Those licenses govern your use of those components.

This EULA governs the Orch Runtime Artifact Set only.

Apache-Licensed Materials in `orch/**` remain governed by Apache License 2.0 and are not governed by this EULA unless they are part of the Runtime Artifact Set.

---

## 6. Feedback

If you provide feedback, suggestions, bug reports, performance data, ideas, comments, or other input relating to Orch or the Runtime Artifact Set (“Feedback”), you grant Licensor a perpetual, irrevocable, worldwide, royalty-free license to use, reproduce, modify, incorporate, distribute, sublicense, and commercialize that Feedback without restriction.

If you clearly mark Feedback as confidential or proprietary, Licensor will make reasonable efforts to treat it as confidential, but the license grant above still applies to the extent necessary for Licensor to evaluate, incorporate, improve, commercialize, or support Orch.

---

## 7. Term; Termination

This EULA is effective upon your first download, installation, copy, access, or use of the Runtime Artifact Set and continues until terminated.

Licensor may terminate this EULA immediately if you breach it.

Upon termination, you must stop using the Runtime Artifact Set and delete all copies under your control.

Sections 3 through 17 survive termination.

---

## 8. No Support or Service Level

The Runtime Artifact Set is provided “as is” with no support, updates, maintenance, patches, warranties, or service levels unless you have a separate written agreement with Licensor.

---

## 9. Attestation, Capability Policy, and Determinism (Runtime Integrity)

You agree that:

(a) The host must verify the Runtime ABI hash and any Policy Bundles at startup and at a reasonable interval defined by the host’s policy or by separate written agreement.

(b) The Runtime boundary is CBOR-only, and you will not inject JSON on the kernel boundary.

(c) Capabilities are deny-by-default and may only be widened through valid Licensor-signed Policy Bundles.

(d) You will not attempt to bypass the Runtime’s single-writer enforcement, event discipline, post-commit behavior, comparator semantics, policy enforcement, or orchestration integrity rules.

(e) You will not falsify, suppress, or replace runtime identity, provenance, attestation, policy, compatibility, or integrity signals.

---

## 10. Custom Modules (Auxiliary Modules)

You may author and run Custom Modules during Evaluation Use, provided they:

1. Interface through public host bridges only.
2. Are observe-only, compute-only, or otherwise limited to the public capability boundary allowed by the applicable host bridge and Policy Bundle.
3. Never write directly to the orchestration graph.
4. Perform no ambient I/O, including network, filesystem, GPU, DOM, device, or host-resource access, except through host capabilities granted by valid Policy Bundles.
5. Use CBOR envelopes on the wire where required by the Runtime boundary.
6. Preserve deterministic ordering and runtime-visible integrity expectations.
7. Do not disable, proxy, wrap, bypass, degrade, or obscure Runtime attestation, observability, traceability, provenance, or policy enforcement.

You may distribute Custom Modules as separate artifacts, but this does not grant any right to distribute, host, re-host, mirror, bundle, publish, sublicense, sell, auto-fetch, or include the Runtime Artifact Set.

You must ensure any Custom Module packaging does not include, automatically download, automatically fetch, mirror, re-host, or redistribute the Runtime Artifact Set unless you have a separate written agreement allowing that activity.

---

## 11. High-Risk Use

The Runtime Artifact Set is not designed for use in hazardous environments or systems requiring fail-safe performance, including medical devices, aviation, nuclear systems, life support, emergency response, weapons systems, critical infrastructure, or environments where failure could lead to death, personal injury, severe property damage, or severe environmental damage.

You must not use the Runtime Artifact Set for high-risk use without a separate written agreement expressly authorizing that use.

---

## 12. Disclaimers

TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE RUNTIME ARTIFACT SET IS PROVIDED “AS IS” AND “AS AVAILABLE,” WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF TITLE, NON-INFRINGEMENT, MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, AVAILABILITY, SECURITY, RELIABILITY, OR ERROR-FREE OPERATION.

YOU ARE SOLELY RESPONSIBLE FOR DETERMINING WHETHER THE RUNTIME ARTIFACT SET IS SUITABLE FOR YOUR EVALUATION USE.

---

## 13. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, LICENSOR WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, PUNITIVE, OR ENHANCED DAMAGES, OR FOR LOSS OF PROFITS, REVENUE, DATA, GOODWILL, BUSINESS OPPORTUNITY, OR BUSINESS INTERRUPTION, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

LICENSOR’S TOTAL LIABILITY FOR ALL CLAIMS RELATING TO THE RUNTIME ARTIFACT SET WILL NOT EXCEED USD $100.

---

## 14. Export; Government; Compliance

You are responsible for complying with export controls, sanctions, import laws, and other applicable laws.

The Runtime Artifact Set is “commercial computer software” under FAR 12.212 and DFARS 227.7202. U.S. Government use is subject to those provisions and this EULA.

---

## 15. Updates and Changes

Licensor may update this EULA for new Runtime releases.

Your download, installation, copy, access, or use of a new Runtime Artifact Set release indicates acceptance of the then-current EULA for that release.

Licensor may change, replace, remove, or discontinue public evaluation access to the Runtime Artifact Set at any time.

---

## 16. Commercial Licensing and OEM/Host Exception

For production or other Commercial Use, including hosting, re-hosting, redistribution, OEM distribution, embedded use, proprietary integration, internal business use, or third-party platform use, you must obtain a commercial license.

See **[COMMERCIAL.md](./COMMERCIAL.md)** for commercial licensing options.

For a plain-language explanation of the public distribution model, see **[DISTRIBUTION.md](./DISTRIBUTION.md)**.

**OEM/Host Exception:** Notwithstanding Section 4(2), you may host, re-host, bundle, or distribute the Runtime Artifact Set only under a separate, signed OEM, host, platform, or partner agreement with Licensor and only while satisfying Licensor’s host compatibility or verification requirements, if any. Rights are non-exclusive and may be revoked if you fail attestation, compatibility, policy, payment, support-window, or agreement requirements.

---

## 17. Governing Law; Notices

This EULA is governed by the laws of the State of Texas, excluding its conflict-of-law rules.

The exclusive venue and jurisdiction for any dispute arising out of or relating to this EULA are the state and federal courts located in Austin, Travis County, Texas.

**Notices to Licensor:**

- <https://github.com/jacobxperez>

---

© 2026 Jacob Perez. Orch™ is a trademark of Jacob Perez. All rights reserved.
