# Orch Public Distribution Model

## Summary

Orch uses a **public artifact distribution model**.

The public Orch repository is designed to let developers inspect, learn, integrate, and evaluate Orch while preserving the separate license boundary for the sealed runtime artifact.

This means:

- The public integration layer is open source under Apache License 2.0.
- The sealed Orch runtime artifact is publicly downloadable for evaluation only.
- Production, hosted, embedded, internal business, OEM, or commercial use of the sealed runtime requires a commercial license.
- Official certification, host redistribution, runtime re-hosting, and official host rights require separate written permission.

This document explains the distribution model in plain language. It does not replace the license files, EULA, trademark policy, or any signed commercial agreement.

## No Additional Rights Granted

This document is informational only.

It does not grant any copyright license, patent license, trademark license, runtime license, redistribution right, production-use right, certification right, hosting right, or commercial-use right.

Your rights are governed only by the applicable license or agreement, including:

- [LICENSE.md](./LICENSE.md)
- [LICENSE-APACHE.md](./LICENSE-APACHE.md)
- [RUNTIME-EULA.md](./RUNTIME-EULA.md)
- [COMMERCIAL.md](./COMMERCIAL.md)
- [TRADEMARK.md](./TRADEMARK.md)

If this document conflicts with any of those documents, the more specific license, EULA, trademark policy, or signed agreement controls.

## Distribution Layers

| Layer | Publicly Available? | License / Terms | Purpose |
| --- | ---: | --- | --- |
| Public integration layer | Yes | Apache License 2.0 | SDKs, proxies, documentation, examples, public wrappers, and integration surfaces |
| Runtime Artifact Set | Yes, for evaluation | Orch Runtime EULA | Sealed runtime execution for evaluation, testing, education, research, and prototyping |
| Production runtime rights | No, gated | Commercial license | Production, hosted, embedded, proprietary, internal business, OEM, or commercial use |
| Official host / redistribution / certification rights | No, gated | Separate written agreement | Runtime hosting, re-hosting, bundling, OEM distribution, certification, or partner distribution |

## Apache-Licensed Public Integration Layer

Unless explicitly excluded, the public integration materials in `orch/**` are licensed under Apache License 2.0.

This public layer may include, for example:

- public proxies
- SDK shims
- adapter-facing code
- examples
- documentation
- website materials
- public integration utilities
- other non-runtime materials under `orch/**`

You may use, copy, modify, and redistribute Apache-licensed materials under the terms of Apache License 2.0.

The Apache license does not apply to the Runtime Artifact Set.

## Runtime Artifact Set

The **Runtime Artifact Set** is not licensed under Apache License 2.0.

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

The Runtime Artifact Set is governed by [RUNTIME-EULA.md](./RUNTIME-EULA.md), unless you have a separate signed commercial agreement.

## Evaluation Use

The sealed Orch runtime is made publicly available so developers can evaluate the real runtime behavior.

Evaluation use may include:

- local testing
- prototyping
- education
- research
- internal non-commercial experimentation
- learning the public Orch API model
- testing integrations against the sealed runtime boundary

Evaluation use does not include production, hosted, embedded, internal business, OEM, revenue-generating, commercial, or third-party service use.

## Production and Commercial Use

Production or commercial use of the sealed Orch runtime requires a commercial license.

A commercial license is required for uses including:

- production applications
- hosted services
- SaaS, PaaS, cloud, or developer platforms
- internal business systems
- proprietary products
- embedded systems
- OEM distribution
- customer-facing deployments
- revenue-generating products or services
- orchestration platforms, agent platforms, or runtime products built around the sealed Orch runtime
- specialized domains such as robotics, blockchain or zk systems, embedded hardware, cryptographic execution layers, or hybrid/quantum orchestration systems

Commercial licensing terms are described in [COMMERCIAL.md](./COMMERCIAL.md).

## Redistribution and Re-Hosting

The public availability of the Runtime Artifact Set does not grant a right to redistribute, mirror, bundle, re-host, sublicense, sell, publish to package registries, place in containers, distribute through CDNs, or include the runtime in third-party products.

Runtime redistribution, hosting, re-hosting, OEM distribution, or partner distribution requires a separate written agreement.

Apache-licensed public integration materials may be redistributed under Apache License 2.0, but the Runtime Artifact Set remains separately governed by the Orch Runtime EULA.

## Auxiliary Modules and Ecosystem Extensions

Developers may build separate integrations, examples, adapters, tools, or Auxiliary Modules that work with Orch through public host bridges, subject to the applicable license terms.

Auxiliary Modules and similar extensions must remain separate artifacts unless a separate agreement says otherwise.

Building an integration or Auxiliary Module does not grant rights to:

- bundle the sealed runtime
- auto-fetch the sealed runtime
- re-host the sealed runtime
- modify the sealed runtime
- bypass runtime attestation
- disable runtime observability or traceability
- claim official certification
- claim endorsement by the Orch project
- use Orch trademarks beyond permitted nominative or compatibility references

## Compatibility Claims

You may make truthful, non-misleading compatibility statements about Orch, subject to [TRADEMARK.md](./TRADEMARK.md).

For example, a third-party project may describe itself as:

- “compatible with Orch”
- “an integration for Orch”
- “a toolkit for Orch”

Such statements must be accurate, testable, and must not imply official endorsement, sponsorship, certification, or affiliation unless you have written permission.

You may not use phrases such as:

- “Official Orch”
- “Certified for Orch”
- “Orch-approved”
- “canonical Orch runtime”
- “endorsed by Orch”

unless you have written permission.

## Certification and Official Host Rights

Official certification, host rights, runtime redistribution, OEM distribution, compatibility badges, partner distribution, or certified production-use rights are not included in the public distribution model.

Those rights may require one or more separate agreements, such as:

- commercial license
- OEM agreement
- host partner agreement
- certification agreement
- trademark permission
- host compatibility approval

Without written permission, compatibility with Orch does not mean certification by Orch.

## What the Public Model Is

The Orch public distribution model is intended to provide:

- a usable public integration layer
- real sealed-runtime evaluation
- public documentation and examples
- predictable API-facing behavior
- a clean boundary between public integration code and sealed runtime authority
- a path from evaluation to commercial production licensing
- a protected trademark and certification surface
- an ecosystem extension point for separate integrations and Auxiliary Modules

## What the Public Model Is Not

The Orch public distribution model is not:

- an open-source license for the sealed runtime
- permission to use the sealed runtime in production without a commercial license
- permission to redistribute or re-host the sealed runtime
- permission to modify, clone, repack, or replace the sealed runtime
- permission to remove or bypass attestation, provenance, policy, or observability features
- permission to use Orch trademarks as part of another product name
- certification of third-party runtimes, forks, wrappers, integrations, or hosts
- approval as an official Orch host, certified runtime, certified integration, or certified production deployment

## Practical Examples

### Example 1: Apache-Only Integration

A developer modifies Apache-licensed SDK code, examples, or documentation under `orch/**` and redistributes those changes under Apache License 2.0.

This is allowed under Apache License 2.0, provided the developer complies with the Apache license terms and does not include or redistribute the Runtime Artifact Set unless separately permitted.

### Example 2: Local Runtime Evaluation

A developer downloads the public repository and runs the sealed runtime locally for evaluation, testing, education, research, or prototyping.

This is evaluation use and is governed by the Runtime EULA.

### Example 3: Production Application

A company uses the sealed Orch runtime in a customer-facing application.

This requires a commercial license.

### Example 4: Hosted Developer Platform

A company hosts Orch-powered orchestration for third-party users.

This requires a commercial license and may require additional host, redistribution, or certification terms.

### Example 5: Third-Party Integration

A developer creates an “Acme Toolkit for Orch” that works with Orch through public host bridges and does not bundle, auto-fetch, mirror, modify, or re-host the sealed runtime.

This may be allowed, subject to Apache License 2.0, the Runtime EULA, and the Trademark Policy. The developer must not imply official endorsement or certification.

### Example 6: Runtime Fork or Replacement

A third party modifies, clones, repacks, reverse engineers, or replaces the sealed runtime and presents it as Orch-compatible, official, or certified.

This is not allowed under the public distribution model and does not create official Orch certification, host approval, runtime redistribution, or trademark rights.

## Summary

Orch separates public integration from sealed runtime authority.

The public repository gives developers a practical way to learn, integrate, and evaluate Orch. The sealed runtime remains protected, production rights are commercially licensed, and official certification rights remain gated.

This model is designed to support broad developer adoption without turning the sealed runtime, certification surface, or Orch brand authority into unrestricted redistribution rights.
