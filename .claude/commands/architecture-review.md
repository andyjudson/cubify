# /architecture-review — Strategic Architecture Review

Surface architectural friction and propose **deepening opportunities** — refactors that turn shallow modules into deep ones. Run this when the codebase feels like it's accumulating friction, before starting a major feature, or after several spec-driven features have built up without a structural review.

Distinct from `/housekeeping` (post-feature doc/branch maintenance). This is a periodic, strategic review.

## Vocabulary

Use these terms exactly in every suggestion. Consistent language is the point.

- **Module** — anything with an interface and an implementation (function, class, file, package)
- **Interface** — everything a caller must know: types, invariants, error modes, ordering, config. Not just the type signature
- **Depth** — leverage at the interface: a lot of behaviour behind a small surface. **Deep** = high leverage. **Shallow** = interface nearly as complex as the implementation
- **Seam** — where an interface lives; where behaviour can be altered without editing in place
- **Adapter** — a concrete thing satisfying an interface at a seam
- **Leverage** — what callers get from depth
- **Locality** — what maintainers get from depth: change, bugs, and knowledge concentrated in one place
- **Deletion test** — imagine deleting a module. If complexity vanishes, it was a pass-through. If complexity reappears across N callers, it was earning its keep

Key rules:
- **One adapter = hypothetical seam. Two adapters = real seam.** Don't introduce a port unless production + test both justify it.
- **The interface is the test surface.** Tests should survive internal refactors.
- **Old unit tests on shallow modules become waste** once tests at the deepened interface exist — delete them.

## Domain Context Sources

Before exploring, read these to understand the project's domain language and load-bearing decisions. Use the domain vocabulary in every suggestion — not generic terms like "service" or "component."

- `CLAUDE.md` — architecture table, current status, key facts (e.g. "mask travels with cubelet", "cubing.js is ground truth"). Decisions documented here should not be re-litigated unless friction is real enough to warrant it.
- `specs/cube-concepts.md` — KPattern model, face state, domain terminology
- `specs/cube-physical-rules.md` — CFOP conventions, physical geometry, masking philosophy
- `specs/cube-mapping-lessons.md` — hard-won implementation gotchas; invariants that must be preserved
- `specs/cubing-js-architecture.md` — cubing.js integration constraints
- `packages/cubify/src/index.ts` — public API surface (the seam callers cross)

## Process

### 1. Explore

Use the `Explore` subagent to walk the codebase organically. Don't follow rigid heuristics — explore where you experience friction:

- Where does understanding one concept require bouncing between many small modules?
- Where are modules **shallow** — interface nearly as complex as the implementation?
- Where have pure functions been extracted for testability, but real bugs hide in how they're called?
- Where do tightly-coupled modules leak across their seams?
- Which parts are untested or hard to test through their current interface?
- Which modules fail the **deletion test** — deleting them would just push complexity elsewhere?

Apply the deletion test to anything that looks like a pass-through.

### 2. Write a Markdown Report

Write the report **inline** (output directly to the user) unless the user explicitly asks for a file. If a file is requested, write to `specs/architecture-review-YYYY-MM-DD.md` (never in `packages/` or `src/`).

Use this structure for each candidate:

---

## Candidate N: [Name using domain vocabulary]

**Recommendation:** `Strong` | `Worth exploring` | `Speculative`

**Files involved:**
- `path/to/file.ts` — one-line description of its role

**Problem:**
Plain English description of the friction. Name the symptom (e.g. "four callers reconstruct the same setup-alg join logic") and the cause (shallow pass-through, missing seam, leaked coupling). Use the deletion test explicitly if it applies.

**Current shape (before):**
```
[ASCII diagram or code sketch showing the shallow structure]
```

**Proposed shape (after):**
```
[ASCII diagram or code sketch showing the deepened module]
```

**What changes:**
Concrete description — which files move, what new interface looks like, what gets deleted.

**Benefits:**
- **Leverage:** what callers stop having to know
- **Locality:** what change/bugs/knowledge concentrates
- **Tests:** how the test surface improves

---

End the report with:

### Top Recommendation
Which candidate to tackle first and why. Be opinionated.

### Load-bearing decisions not to re-open
Any CLAUDE.md decisions that constrain the candidates above — flag them explicitly so the review doesn't accidentally propose reverting them.

---

Do NOT propose full interface implementations yet. After the report, ask: **"Which of these would you like to explore further?"**

### 3. Grilling Loop

Once the user picks a candidate, explore the design interactively. Walk constraints, dependencies, the shape of the deepened module, what sits behind the seam, what tests survive.

Classify the candidate's dependencies as you go:
- **In-process** (pure computation, in-memory) — always deepenable, no adapter needed
- **Local-substitutable** (e.g. in-memory worker stub) — deepenable if stand-in exists
- **Remote but owned** — define a port, inject transport as adapter; in-memory adapter for tests
- **True external** — injected port, mock adapter for tests

Side effects during the grilling loop:
- **Term not in CLAUDE.md?** Propose adding it to the architecture table or key facts.
- **User rejects a candidate with a load-bearing reason?** Offer to record it in CLAUDE.md under "architectural decisions" so future reviews don't re-surface it. Only offer when the reason would genuinely prevent a future reviewer from re-suggesting the same thing.

### 4. Interface Design (optional — when user wants to compare alternatives)

Spawn 3 sub-agents in parallel, each designing a **radically different** interface for the chosen candidate. Give each a different constraint:

- Agent 1: "Minimise the interface — 1–3 entry points max, maximise leverage per entry point"
- Agent 2: "Maximise flexibility — support many use cases and extension points"
- Agent 3: "Optimise for the most common caller — make the default case trivial"

Each agent outputs: interface definition, usage example, what the implementation hides, trade-offs.

Present designs sequentially, then compare by **depth** (leverage), **locality** (where change concentrates), and **seam placement**. Give a firm recommendation — not a menu. If elements combine well, propose a hybrid.

## Scope Flags

Pass flags after the command to constrain scope:

- `/architecture-review library` — `packages/cubify/src/` only
- `/architecture-review react` — `packages/cubify-react/src/` only
- `/architecture-review cfop` — `src/cfop/` only
- `/architecture-review solver` — solver internals (CFOP + Kociemba workers)
- `/architecture-review full` — entire repo including harness and scripts (default)
