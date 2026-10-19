# Orch Runtime End-User License Agreement (EULA)

**DRAFT — FOR PROJECT-OWNER AND QUALIFIED LEGAL COUNSEL REVIEW ONLY. NOT EFFECTIVE; NOT APPROVED FOR PUBLICATION.**

**Draft date:** October 19, 2026  
**Effective date:** To be established only after separate approval and lawful publication.  
**Licensor:** Jacob Perez (“Licensor”).  
**Applies to:** Official sealed Orch runtime WebAssembly binary artifacts in the `orch*.wasm` family and accompanying materials expressly designated as governed by this Agreement for the applicable official release (collectively, the “Runtime Artifact Set”).

This Agreement governs the proprietary Runtime Artifact Set, **not** public integration files expressly licensed under Apache License 2.0 or other separately identified terms. The Runtime is proprietary and source-protected; the no-fee permission granted below is not an open-source or source-availability license.

By downloading, installing, copying, distributing as permitted, accessing, or running a Runtime Artifact Set, you indicate acceptance of this Agreement for the applicable release. If you do not agree to its terms, you may not exercise the rights it grants. Applicable law may impose additional requirements for effective assent.

---

## 1. Definitions

1. **“You” or “Recipient”** means the individual accepting this Agreement or the legal entity on whose behalf that individual has authority to accept it.
2. **“Official Runtime” or “Runtime”** means an unmodified sealed Orch runtime WebAssembly binary from an officially authorized Orch release, including an identified `orch*.wasm` variant. An independently compiled, modified, reconstructed, or purportedly compatible runtime is not an Official Runtime merely because it uses similar interfaces or identifiers.
3. **“Sidecars”** means accompanying runtime-specific manifests, notices, provenance, fingerprints, integrity or attestation files, policy materials, and other release materials **expressly identified as subject to this Agreement**. A Sidecar does not become governed by this Agreement merely because it is distributed in the same package as the Runtime.
4. **“Runtime Artifact Set”** means the Official Runtime and its EULA-governed Sidecars identified for the applicable release. Files bearing an express Apache License 2.0 designation or another separate license remain subject to their respective licenses.
5. **“Apache-Licensed Materials”** means public integration materials expressly covered by Apache License 2.0, such as qualifying proxies, SDK shims, loaders, examples, documentation, and integration utilities. Their applicable license governs them independently of this Agreement.
6. **“Ordinary Application or SaaS”** means a software application or hosted service that uses an Official Runtime to deliver its own application-specific functionality. It includes proprietary or open-source products and customer-configurable workflows within the product's application domain, without regard to whether the provider charges customers or hosts the application in the cloud.
7. **“General-Purpose Runtime Platform”** means a separately offered service whose principal product is giving third parties general-purpose access to provision, host, or execute arbitrary Orch runtime workloads as an independent execution environment, rather than using the Runtime as part of the provider's own application-specific functionality.
8. **“Permitted Application Distribution”** means inclusion of exact, unmodified Official Runtime artifacts as components of a lawful larger software application, device software deployment, service deployment, installer, or application-specific container or image, under Sections 2 and 4.
9. **“Official Release Materials”** means the applicable official release's accompanying license notices, artifact identity and integrity information, and public instructions needed to identify and lawfully use the released artifacts. Materials governed by separate licenses retain those licenses.
10. **“Auxiliary Module” or “Custom Module”** means separately developed plugin, accelerator, helper, adapter-side tool, external WASM module, or other integration that communicates with the Runtime through permitted public or host interfaces.
11. **“Reserved Platform Rights”** means rights to operate a General-Purpose Runtime Platform or otherwise exercise a premium right expressly reserved under Section 16.
12. **“Separate Agreement”** means a distinct written agreement entered into by Licensor and the party receiving rights outside this Agreement. Ordinary commercial use does not, by itself, require a Separate Agreement.

## 2. No-Fee License Grant; Permitted Use and Distribution

### 2.1 No-fee use

Subject to compliance with this Agreement, Licensor grants You a worldwide, non-exclusive, no-license-fee license, for the applicable release and for as long as this Agreement remains in force for You under Section 7, to download, install, reproduce as permitted below, and execute unmodified Official Runtime artifacts for personal, educational, research, testing, development, internal-business, commercial, proprietary, customer-facing, and production use, including use in Ordinary Applications or SaaS.

**No separate production or commercial runtime-execution license fee is required** merely because a permitted application is proprietary, revenue-generating, hosted, embedded in a product, customer-facing, operated for internal business purposes, or deployed in production. No per-execution royalty is imposed by this Agreement for such permitted use.

### 2.2 Internal copying and deployment

You may make reasonable, exact copies of the Runtime Artifact Set for permitted installation, backup, testing, internal distribution, storage, caching, mirroring within environments under Your control, and deployment of a permitted application or service. Packaging an unchanged binary within a larger installer, container, application bundle, or deployment image does not itself constitute a prohibited modification of that binary.

### 2.3 Bounded redistribution with applications

You may distribute exact, unmodified Official Runtime artifacts as part of a Permitted Application Distribution, including to Your customers or downstream application distributors, if You:

1. Preserve the integrity of the official binary, its embedded identity and provenance information, and any accompanying verification or integrity materials required for that released artifact;
2. Include or make available this Agreement, required copyright and third-party notices, and the relevant Official Release Materials in a form reasonably accessible to recipients;
3. Clearly distinguish Your application and Your own marks from the Official Runtime and do not imply Orch certification, partnership, approval, or endorsement without separate permission;
4. Do not impose terms that purport to authorize alteration of the proprietary Runtime, suppress these conditions, or grant broader rights in the Official Runtime than this Agreement provides; and
5. Ensure that any distinct license applicable to an accompanying Apache-Licensed Material or third-party component remains intact.

Recipients who wish to exercise rights in the Runtime do so under the applicable Runtime license, rather than by receiving a sublicense to the Runtime from You. You remain responsible for Your own distribution conduct; each recipient is independently responsible for its compliance with the license applicable to its use.

### 2.4 Distribution boundaries

Sections 2.2 and 2.3 do not authorize distributing modified or reconstructed Orch runtime binaries, offering standalone general-purpose runtime distribution or hosting as an independently marketed platform, operating an unauthorized official Orch service, granting certification, or exercising a Reserved Platform Right. Reasonable delivery, hosting, caching, or mirroring incidental to a Permitted Application Distribution is not, by itself, a Reserved Platform Right.

### 2.5 No implied rights

This grant conveys neither proprietary source code nor any right to modify, patch, create derivative versions of, or independently represent a runtime as the Official Runtime. Other rights are reserved except as expressly granted by this Agreement, a Separate Agreement, or applicable law.

## 3. Ownership; Applications, Data, and No Implied Rights

The proprietary Runtime is licensed, not sold. Licensor and any applicable licensors retain their respective intellectual-property rights in the Runtime Artifact Set. This Agreement does not transfer ownership of the Runtime or license any Orch trademark except as separately permitted by law or written policy.

Use of the Runtime does **not**, solely by virtue of that use, transfer to Licensor ownership of independently developed applications, workflows, graphs, configurations, prompts, business logic, models, integrations, Auxiliary Modules, customer data, or runtime outputs. Ownership and rights in such material remain determined by the applicable parties' rights, third-party licenses, and law.

This Agreement does not, solely by virtue of installation or execution, grant Licensor permission to collect, sell, train on, or otherwise reuse Your data, prompts, or outputs. Any separate service that involves data processing must have its own applicable disclosures, permissions, and terms.

Orch and related marks are marks of Licensor. Truthful, non-misleading references to compatibility or interoperability do not by themselves confer official or certified status.

## 4. Restrictions; Proprietary Integrity and Official Identity

Except where this Agreement, a Separate Agreement, or applicable law expressly permits otherwise, You must not:

1. Modify, patch, translate, adapt, decompile, disassemble, reconstruct, or distribute altered versions of the proprietary Runtime, or create derivative runtime binaries from protected proprietary implementation material. This restriction does not prohibit acts that applicable law makes non-waivable, including lawful interoperability activities where protected;
2. Remove, falsify, or materially impair protected copyright notices, embedded fingerprints, signatures, provenance, runtime identity, verification evidence, or integrity and policy-enforcement mechanisms;
3. Deliberately circumvent documented runtime security, authorization, capability, identity, or integrity protections, or package the Runtime in a manner intended to falsify their operation;
4. Distribute a third-party or modified implementation as an Official Runtime, or claim that a host, wrapper, application, module, service, or runtime is officially certified, endorsed, or approved by Orch without the corresponding authorization;
5. Operate a General-Purpose Runtime Platform or another Reserved Platform Right without the applicable Separate Agreement; or
6. Redistribute the Runtime outside the bounded copying and distribution permissions of Section 2 or a Separate Agreement.

Nothing in this Section prohibits ordinary production use, Ordinary Applications or SaaS, lawful application-domain workflow customization, permitted redistribution of unchanged Official Runtime artifacts, independent development based on lawfully obtained public interfaces, or truthful statements of compatibility.

This Agreement imposes **no blanket prohibition on truthful public performance reporting or benchmarking**. Such activity remains subject to applicable law, independent confidentiality commitments, protection of nonpublic information, and the prohibition on false claims of official approval or certification. It does not convey access to protected internal code or nonpublic benchmarks.

## 5. Third-Party Components and Separately Licensed Materials

A Runtime release may include, depend on, or accompany third-party components subject to their respective licenses. Those licenses govern the applicable third-party material, including any required attributions or additional rights.

Apache-Licensed Materials remain governed by Apache License 2.0; this Agreement does not override that license merely because those materials are distributed with or used to invoke the Official Runtime. Likewise, an officially released verification file or notice bearing a different express license remains under that license.

If a conflict exists as to a separately identified component, its express applicable license governs that component; this Agreement continues to govern the proprietary Runtime Artifact Set to which it applies.

## 6. Voluntary Feedback

If You knowingly and voluntarily submit suggestions, bug reports, proposed improvements, or other comments to Licensor **as feedback for Orch** (“Feedback”), You grant Licensor a non-exclusive, worldwide, perpetual, irrevocable, royalty-free license to use, reproduce, modify, adapt, incorporate, and distribute that Feedback for developing, maintaining, supporting, and commercializing Orch products and services, to the extent You have the rights to grant that permission.

Feedback does **not** include private application content, customer data, prompts, outputs, confidential materials, security reports supplied under a separate coordinated-disclosure arrangement, or information processed by the Runtime solely in the course of its use, unless You expressly and separately authorize its submission and treatment as Feedback. No obligation to provide Feedback arises from this Agreement.

Do not provide confidential third-party information as Feedback without authorization. Confidential submissions, when permitted, should be governed by an applicable separate confidentiality agreement or disclosure process rather than an implied unrestricted feedback license.

## 7. Term; Termination; Existing Recipients

This Agreement takes effect for You upon legally effective acceptance of the terms applicable to the particular Runtime release and remains in effect unless terminated in accordance with this Section.

Licensor may terminate Your rights under this Agreement for a **material breach** that You fail to cure within 30 calendar days after receipt of reasonably specific written notice of that breach. Where a breach cannot reasonably be cured, or applicable law permits immediate relief for infringement, misuse of protected source code, intentional identity falsification, or similar serious misconduct, Licensor may seek appropriate immediate relief, including termination where legally permitted.

Upon termination of Your rights, You must stop exercising the terminated rights and cease further distribution of the applicable proprietary Runtime artifacts. You must remove copies under Your control except where retention is required by law; legally required retained copies may not be used beyond what the law allows.

Termination of Your rights does not **automatically** terminate the independent rights of downstream recipients who lawfully obtained unmodified artifacts under Section 2 and remain compliant with the license applicable to them. Termination does not extinguish accrued claims or obligations that by their nature survive, including applicable ownership, confidentiality, restriction, warranty-disclaimer, liability-limitation, dispute, and notice provisions.

Changes to the terms for a future release do not, by themselves, terminate or narrow rights already lawfully granted to a compliant recipient for an earlier released artifact; see Section 15.

## 8. No Included Support or Service Level; Optional Services

The no-fee Runtime license does not include technical support, service levels, guaranteed availability, security maintenance, updates, patches, compatibility certification, indemnification, or a commitment to provide future releases. These may be offered under a Separate Agreement.

Purchase of support, extended maintenance, certification, or another optional service is not a prerequisite for otherwise permitted use of a Runtime release under Section 2. Expiration or cancellation of a separate support arrangement does not by itself terminate rights independently granted by this Agreement.

This Section does not limit mandatory rights that cannot lawfully be disclaimed.

## 9. Runtime Integrity, Policy Controls, and Local Operation

You must not intentionally falsify or bypass official Runtime identity, provenance, integrity, attestation, verification, capability-enforcement, or policy-enforcement mechanisms applicable to the specific released artifact. You are responsible for complying with publicly documented technical prerequisites of that artifact, including applicable host interfaces and documented serialization boundaries.

Where a release uses policy or capability bundles, their validation and permission scope are determined by the released artifact and its applicable published technical requirements. This Agreement does not itself create new runtime capabilities, define an ABI or CBOR schema, require new signing infrastructure, or authorize circumvention of technical restrictions.

The no-fee execution grant does not require a **paid Orch account, separate commercial execution license, or mandatory Orch-operated subscription or control-plane service** merely to exercise otherwise permitted ordinary Runtime rights. This contractual statement must be read together with actual technical prerequisites for the specific released artifact; it is not a promise that the artifact runs without a compatible local host, lawful input, or applicable local verification.

Optional updates, managed attestation, enterprise verification, certification, or trust services may be separately offered, but obtaining such services does not automatically become a condition of the ordinary no-fee license grant.

## 10. Custom Modules (Auxiliary Modules)

You may independently develop, operate, and commercially distribute Auxiliary Modules for use with an Official Runtime, subject to the applicable public interface and host-capability requirements, rights in third-party material, and this Agreement's protection of the sealed Runtime.

When invoking the Runtime, an Auxiliary Module must use applicable authorized public or host interfaces; preserve documented serialization and integrity boundaries; and must not bypass enforced host capabilities or claim direct graph-write, source, signing, certification, or other rights not lawfully granted. Requirements relating to permitted I/O, computation, observation, and mutation follow the applicable released technical contracts, not new rights created by this Agreement.

A separately distributed Auxiliary Module is not itself a modified Orch Runtime merely because it is third-party-developed, interoperable, or commercially sold. Its distribution does not grant broader rights over the Runtime. An Auxiliary Module package may include or arrange delivery of official unchanged Runtime artifacts only within Section 2's permitted distribution conditions or a Separate Agreement.

## 11. High-Risk Use

The Runtime is not provided under this Agreement with a representation that it has been validated, certified, or designed for safety-critical or fail-safe applications. You are responsible for determining whether Your use complies with applicable laws, safety obligations, and third-party requirements.

You may not use the Runtime as a safety-critical control component in a system in which its failure could reasonably cause death, serious bodily injury, severe property damage, or severe environmental harm—including life-support, aviation safety, nuclear control, or comparable hazardous applications—without a Separate Agreement expressly addressing that use. A Separate Agreement does not replace any legally required certification or regulatory authorization.

This restriction is limited to such high-risk control uses and does not independently prohibit an ordinary commercial application merely because it operates in an industry that is sometimes regulated or safety-sensitive.

## 12. Disclaimers

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE RUNTIME ARTIFACT SET IS PROVIDED **“AS IS”** AND **“AS AVAILABLE,”** WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF TITLE, NON-INFRINGEMENT, MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, AVAILABILITY, SECURITY, RELIABILITY, OR ERROR-FREE OPERATION.

YOU ARE RESPONSIBLE FOR EVALUATING THE RUNTIME'S SUITABILITY FOR YOUR INTENDED PERMITTED USE, INCLUDING ANY PRODUCTION OR COMMERCIAL DEPLOYMENT, AND FOR APPROPRIATE BACKUPS, TESTING, SAFEGUARDS, AND COMPLIANCE CONTROLS.

NOTHING IN THIS SECTION DISCLAIMS A WARRANTY OR RIGHT THAT CANNOT LAWFULLY BE EXCLUDED, OR AN EXPRESS OBLIGATION SPECIFICALLY ACCEPTED BY LICENSOR UNDER A SEPARATE AGREEMENT.

## 13. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, LICENSOR WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, PUNITIVE, OR ENHANCED DAMAGES, OR FOR LOST PROFITS, REVENUE, DATA, GOODWILL, BUSINESS OPPORTUNITY, OR INTERRUPTION, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, LICENSOR'S TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THIS AGREEMENT OR THE RUNTIME ARTIFACT SET WILL NOT EXCEED **USD $100**.

THE FOREGOING LIMITATIONS DO NOT EXCLUDE LIABILITY TO THE EXTENT ITS EXCLUSION OR LIMITATION IS PROHIBITED BY APPLICABLE LAW. RIGHTS AND OBLIGATIONS UNDER A SEPARATE SIGNED AGREEMENT ARE GOVERNED BY THAT AGREEMENT TO THE EXTENT IT EXPRESSLY PROVIDES OTHERWISE.

## 14. Export; Government; Compliance

You are responsible for compliance with applicable export controls, sanctions, import laws, and other laws governing Your possession, use, and distribution of the Runtime Artifact Set.

To the extent applicable, the Runtime Artifact Set is “commercial computer software” under FAR 12.212 and DFARS 227.7202, and U.S. Government rights are limited as provided by those provisions and this Agreement, subject to mandatory law.

This Agreement does not authorize use or distribution prohibited by applicable law.

## 15. Updates, New Releases, and Stability of Granted Rights

Licensor may publish revised license terms for **future** Runtime releases and may change, replace, discontinue, or withdraw the availability of future releases, download channels, updates, support, or optional services, subject to applicable law and separate binding commitments.

The license terms applicable to an Official Runtime release are those validly made applicable to that release and accepted by the applicable recipient. Obtaining and accepting a later release may subject that later release to updated terms; merely publishing updated terms does not, by itself, rewrite the granted rights for a previously obtained version.

Subject to Section 7 and applicable law, a recipient who remains compliant with the terms applicable to a previously lawfully obtained Official Runtime release may continue exercising the rights granted for that release even when Licensor later changes the terms for other releases or stops offering that release for new download.

Nothing here guarantees continued availability of a particular download, update, vulnerability fix, maintenance period, support window, or compatibility target.

## 16. Separately Licensed Platform, OEM, Certification, and Premium Rights

**Ordinary business operations, proprietary applications, production use, embedding an unchanged Official Runtime in a permitted application, and Ordinary Applications or SaaS do not require a paid production license.**

Activities outside the grant in Section 2 may require a Separate Agreement, including:

1. Operating a General-Purpose Runtime Platform or selling independently provisioned third-party runtime execution as the principal service;
2. Marketing a hosting or runtime service as officially certified, approved, or operated by Orch;
3. Redistributing modified runtime binaries, obtaining proprietary source access, or creating authorized derivatives or custom runtime builds;
4. Offering specialized standalone runtime redistribution, OEM, marketplace, or partner channels beyond the bounded exact-artifact redistribution rights of Section 2;
5. Obtaining official certification, managed trust, managed verification, certification marks, or official platform or host status; or
6. Obtaining premium enterprise services such as SLAs, extended maintenance, security coordination, compliance assistance, source escrow, indemnification, fixed-version support, or special air-gapped distribution arrangements.

For avoidance of doubt, a product does not become a General-Purpose Runtime Platform **solely** because its owner charges fees, hosts it in the cloud, provides customers configurable workflows within its application domain, or uses the Runtime behind its application functionality. A mixed offering that separately markets general-purpose runtime execution may require a Separate Agreement for that **separate offering**, without converting the product's otherwise lawful Ordinary Application or SaaS use into a paid license.

Separate Agreements govern only the additional rights or services they expressly provide. No compatibility statement, performance result, successful local runtime execution, or use of published integration materials implies official certification, managed verification, admission, or an endorsement.

For information about separately offered rights and services, see [COMMERCIAL.md](./COMMERCIAL.md). For a non-operative explanation of the public distribution model, see [DISTRIBUTION.md](./DISTRIBUTION.md). Those explanatory documents do not expand or restrict the license granted by this Agreement.

## 17. Governing Law; Disputes; Notices

This Agreement is governed by the laws of the State of Texas, excluding its conflict-of-law rules, except where mandatory law requires otherwise.

Subject to non-waivable rights and applicable jurisdictional restrictions, the exclusive venue and jurisdiction for disputes arising out of or relating to this Agreement are the state and federal courts located in Austin, Travis County, Texas.

Notices under this Agreement must be in writing and communicated by a method reasonably calculated to provide actual notice. A notice is effective when received through a channel Licensor has designated for legal notices, or as otherwise required by applicable law. Licensor's existing public contact reference is <https://github.com/jacobxperez>; this profile link is not itself proof of delivery or a promise that a particular GitHub feature accepts formal legal notices.

If a provision is unenforceable under applicable law, the remainder of this Agreement remains effective to the extent lawful and consistent with its essential purpose. A failure to enforce a provision is not a waiver of future enforcement of that provision.

---

© 2026 Jacob Perez. Orch® is a trademark of Jacob Perez. All rights reserved.

**DRAFT — NOT EFFECTIVE.** This proposed full-text revision is provided solely for project-owner and qualified legal counsel review under OORM-1. It does not amend the currently applicable Runtime EULA, grant present runtime rights, establish an effective date, or authorize public release.
