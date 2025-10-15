---
license: "BSL-1.1 (Custom - No Auto-Conversion)"
file: "orch/LICENSE.md"
title: "Orch Dual License Overview"
description: "Defines the dual licensing model for Orch — Apache 2.0 for public API proxies and a custom Business Source License (BSL-1.1) for the sealed orchestration runtime and internal systems."
version: "1.0.0"
---

# Orch Dual License

Orch is distributed under a **dual license**:

---

## 1. Apache License 2.0

Applies to:

- All public API proxies in `orch/system/`
- Any other explicitly designated public-facing files in this repository

See the full text here: [LICENSE-APACHE](./LICENSE-APACHE.md)

---

## 2. Business Source License 1.1 (Custom – No Auto-Conversion)

Applies to:

- The sealed orchestration runtime binary: `orch.wasm`
- All internal orchestration logic, including kernel, scheduler, graph management, and lifecycle enforcement code

This is a customized form of the Business Source License 1.1:

- Retains the **non-commercial grant** of the original license  
- **Removes the automatic conversion clause** to preserve long-term protection of the Orch orchestration system

See the full text here: [LICENSE-BSL](./LICENSE-BSL.md)

---

## Summary Table

| Component / Path                | License Type |
|---------------------------------|--------------|
| `orch/system/*` (public proxies) | Apache 2.0   |
| `orch.wasm`                      | BSL-1.1 (Custom – No Auto-Conversion) |
| Docs & examples (unless noted)   | Apache 2.0   |

---

© 2025 Jacob Perez. Orch™ is a registered software mark.  
All rights reserved where applicable.
