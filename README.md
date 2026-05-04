# Orch

![Orch Logo](./docs/assets/banner.png)

Downloadable software for building deterministic AI workflows on a sealed runtime.

---

## Download Orch

Download the current Orch public distribution archive:

**[Download Orch](https://github.com/jacobxperez/orch/archive/refs/heads/main.zip)** <<<

> **Commercial note:** The sealed runtime binary (`orch/public/wasm/orch*.wasm`) is licensed for **evaluation use only**.  
> To use Orch in **production**, **business**, or **embedded** settings, a **commercial license** is required. See **COMMERCIAL.md**.  
> Evaluation terms are defined in **RUNTIME-EULA.md**.

Orch uses a **public artifact distribution model**. The public repository includes Apache-licensed integration code, documentation, examples, and public SDK/proxy surfaces. The sealed runtime artifact is publicly available for evaluation only and is not open source. Production, hosted, embedded, internal business, OEM, or commercial use of the sealed runtime requires a commercial license.

See **DISTRIBUTION.md** for the full public distribution model.

---

## About

**Orch is not a framework.**  
In Orch, **orchestration is the runtime** — not an abstraction layer.

Every `state()`, `effect()`, `task()`, or `agent()` you declare is:

- Scoped for lifecycle safety
- Registered into a live orchestration graph
- Observable in real time through `.data()`, `.status()`, and `.error()`

The graph is not a visual add-on. It is the system.

---

## The Orch Web API Model

Think of Orch as a **local Web API for orchestration**:

- **Client SDK semantics** — Public calls such as `state()` and `task()` act as client requests to the sealed orchestration runtime.
- **WASM service boundary** — Calls execute inside `orch.wasm`, a sealed binary that enforces orchestration rules.
- **Zero-network execution** — Orch keeps API discipline while running locally.
- **Stable introspection** — API-visible nodes expose `.data()`, `.status()`, and `.error()` for tooling, auditing, and automation.

In short: Orch provides **API-style orchestration** with **local execution**.

---

## How Orch Orchestrates

Unlike systems that rely on hooks, lifecycles, or config trees, Orch treats orchestration as a **runtime-native truth layer**.

- Declare primitives in code.
- Scope execution with `scope()` or `component()`.
- Run on the sealed orchestration runtime (`orch.wasm`).
- Inspect every node through introspectable methods.

All orchestration is enforced inside the sealed runtime.

---

## API Guarantees

1. **Graph-registered execution**  
   Every unit joins the live orchestration graph — the single source of runtime truth.

2. **Introspectable by design**  
   Nodes expose `.data()`, `.status()`, and `.error()` for real-time visibility, audit, and tooling.

3. **Lifecycle-safe and cancelable**  
   Async flows are scoped for teardown, cancellation, and cleanup.

4. **No hidden state**  
   Orch is designed around explicit runtime state and observable boundaries.

5. **Sealed orchestration logic**  
   The orchestration model is enforced in `orch.wasm`, reducing structural drift across public surfaces.

---

## Why Orch

| Capability | Orch |
| --- | --- |
| Runtime orchestration | Native to execution |
| Graph-based enforcement | Built in |
| Live introspection | `.data()`, `.status()`, `.error()` |
| Lifecycle control | Scoped and cancelable |
| Runtime boundary | Sealed WASM execution |

---

## Using Orch

```js
import {state, effect, scope} from 'orch';

scope('counter', () => {
    const count = state(0);

    effect(() => {
        console.log(`Count: ${count.data().value}`);
    });
});
```

The above runs through Orch’s sealed orchestration runtime. No manual lifecycle management, no hidden magic — just lawful, introspectable execution.

---

## Local Website Preview

To preview the public website locally from the repository root:

```sh
node orch/server/index.js --root=orch/docs --port=3000
```

Then open:

```txt
http://127.0.0.1:3000/
```

The local server is intended for static website testing and trademark-specimen review before publishing the public page.

---

## License

This repository uses a **multi-license boundary**:

- **Apache License 2.0** — Applies to **all content in `orch/**`** except the Runtime Artifact Set. This includes public proxies, SDKs, tooling, docs, examples, and other folders under `orch/` unless explicitly excluded. See **LICENSE-APACHE.md**.

- **Orch Runtime EULA** — Applies to the Runtime Artifact Set, including the sealed binary at `orch/public/wasm/orch*.wasm` and its sidecars, including fingerprints, manifests, policy bundles, provenance files, attestation files, integrity files, and notices. See **RUNTIME-EULA.md**. For production or commercial use, see **COMMERCIAL.md**.

For a plain-language explanation of how Orch separates Apache-licensed public integration materials from the sealed runtime artifact, see **DISTRIBUTION.md**.

### Summary Table

| Component / Path                                   | License Type                        |
| -------------------------------------------------- | ----------------------------------- |
| `orch/**` excluding the Runtime Artifact Set       | Apache License 2.0                  |
| `orch/public/wasm/orch*.wasm` and runtime sidecars | Orch Runtime EULA (Evaluation Only) |

---

© 2026 Jacob Perez. Orch™ is a trademark of Jacob Perez. All rights reserved.
