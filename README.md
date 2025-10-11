---
file: orch/README.md
---

# Orch™

**The Reactive AI Orchestrator**  
*“We are the music makers, And we are the dreamers of dreams.”*  
— Arthur O’Shaughnessy, *Ode*, 1873

---

## About

**Orch™ is not a framework.**  
In Orch™, **orchestration is the runtime** — not an abstraction layer.

Every `state()`, `effect()`, `task()`, or `agent()` you declare is:

- Scoped for lifecycle safety  
- Registered into a live orchestration graph  
- Observable in real time via `.data()`, `.status()`, `.error()`

This graph is not a visual add-on. It *is* the system.

---

## The Orch Web API Model (Local-First)

Think of Orch as a **Web API delivered locally**:

- **Client SDK semantics** — Public calls like `state()` or `task()` act as **client requests** to the sealed orchestration runtime.  
- **WASM service boundary** — Calls are executed inside `orch.wasm`, a sealed binary that enforces orchestration rules.  
- **Zero network, API discipline** — You get the **safety and contract clarity of a hosted API** with the **speed and privacy of local execution**.  
- **Stable contracts** — All API-visible nodes are introspectable via `.data()`, `.status()`, `.error()` for tooling, auditing, and automation.

> **In short:** Orch provides **API-style orchestration** with **local execution**.

---

## How Orch Orchestrates

Unlike systems that rely on hooks, lifecycles, or config trees, Orch treats orchestration as a **runtime-native truth layer**.

- Declare primitives in code  
- Scope execution with `scope()` or `component()`  
- Run on the sealed orchestration runtime (`orch.wasm`)  
- Inspect every node through introspectable methods

All orchestration is enforced inside the sealed runtime — developers use Orch; they don’t control it.

---

## API Guarantees

1. **Graph-Registered Execution**  
   Every unit joins the live orchestration graph — the single source of runtime truth.

2. **Introspectable by Design**  
   Nodes emit `.data()`, `.status()`, `.error()` for real-time visibility, audit, and tooling.

3. **Lifecycle-Safe and Cancelable**  
   Async flows teardown automatically with scope — no leaks, no zombie processes.

4. **No Hidden State**  
   No globals, no ambient mutations, no surprises.

5. **Immutable Orchestration Logic**  
   The orchestration model is sealed in `orch.wasm`, preventing structural drift or unsafe forks.

---

## Why Orch Wins

| API Characteristic             | Orch™ (Local Web API)                  |
|--------------------------------|----------------------------------------|
| Runtime Orchestration          | ✅ Native to execution                 |
| Graph-Based Enforcement        | ✅ Built in, always on                 |
| Live Introspection             | ✅ `.data()`, `.status()`, `.error()`  |
| AGI-Safe Lifecycle Control     | ✅ Inside sealed runtime               |
| Fork / Mutation Resistance     | ✅ Orchestration cannot be altered     |

---

## Using Orch (SDK Style)

    import { state, effect, scope } from 'orch';

    scope('counter', () => {
      const count = state(0);           // ← client call into the Orch Web API
      effect(() => {                    // ← reacts via the sealed runtime
        console.log(`Count: ${count.data().value}`);
      });
    });

The above runs **inside** Orch’s sealed orchestration runtime.  
No manual lifecycle management, no hidden magic — just lawful, introspectable execution.

> **Commercial note:** Using `orch.wasm` in production or business contexts requires a commercial license — see **COMMERCIAL.md**.

---

## License

Orch™ is distributed under a **dual license**:

---

### 1. Apache License 2.0

**Applies to:**

- All public API proxies in `orch/system/`
- Any other explicitly designated public-facing files in this repository

**Full text:** [LICENSE-APACHE](./LICENSE-APACHE.md)

---

### 2. Business Source License 1.1 (Custom – No Auto-Conversion)

**Applies to:**

- The sealed orchestration runtime binary: `orch.wasm`
- All internal orchestration logic (kernel, scheduler, graph management, lifecycle enforcement)

**Notes:**

- Based on the original Business Source License 1.1  
- Retains **non-commercial grant**  
- **Removes automatic conversion clause** to preserve long-term protection of the Orch orchestration system  
- **Commercial use requires a separate license** — see [COMMERCIAL.md](./COMMERCIAL.md) for details.

**Full text:** [LICENSE-BSL](./LICENSE-BSL.md)

---

### Summary Table

| Component / Path                | License Type                                      |
|---------------------------------|---------------------------------------------------|
| `orch/system/*` (public proxies)| Apache 2.0                                        |
| `orch.wasm`                     | BSL-1.1 (Custom – No Auto-Conversion)             |
| Docs & examples (unless noted)  | Apache 2.0                                        |
