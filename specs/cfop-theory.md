# CFOP Theory & Mathematical Background

Reference document covering the mathematics behind the Rubik's Cube and the CFOP solving method.
Companion to `cube-physical-rules.md` (conventions and masking) and `cube-concepts.md` (KPattern model).

---

## 1. Primary Sources

There is no single academic paper for CFOP. It is a practical speedsolving method documented informally:

| Source | What it covers |
|--------|---------------|
| **Jessica Fridrich — personal website (1997)** | Original description of the CFOP method, OLL/PLL case tables. The primary source. Search: "Fridrich method" + her Binghamton University page. |
| **Singmaster, D. — *Notes on Rubik's Magic Cube* (1981, Enslow)** | First rigorous mathematical treatment of the cube as a permutation group. Introduces the group structure, move notation (basis for WCA notation), and state-space analysis. |
| **Rokicki, T. et al. — "God's Number is 20" (2010)** | Proves every cube position can be solved in ≤ 20 moves (Half-Turn Metric). Computer-assisted proof via symmetry reduction + lookup tables. Not about CFOP, but establishes the bounds CFOP works within. |
| **Kociemba, H. — Two-Phase Algorithm (1992)** | The algorithm underlying most computer solvers (including cubing.js). Formal coset decomposition into two stages. The theoretical counterpart to CFOP's four-stage human approach. |

---

## 2. The Cube Group

The set of all reachable cube states forms a **finite group** under move composition.

### 2.1 State count

```
|G| = 8! × 3^7 × 12!/2 × 2^11 = 43,252,003,274,489,856,000  (~4.3 × 10^19)
```

Each factor has a reason:

| Factor | Meaning |
|--------|---------|
| `8!` | Permutations of 8 corners |
| `3^7` | Orientations of 7 corners (8th determined by the others — sum must be 0 mod 3) |
| `12!/2` | Permutations of 12 edges (constrained to match corner permutation parity) |
| `2^11` | Orientations of 11 edges (12th determined — sum must be 0 mod 2) |

The three constraints (corner orientation sum, edge orientation sum, parity) each divide by one degree of freedom — they are physical invariants of the cube mechanism.

### 2.2 Group structure

The cube group is a subgroup of the symmetric group S_48 (permutations of 48 non-center stickers). It is non-abelian — move order matters. The group decomposes as a semidirect product of the corner and edge subgroups, but the two subgroups are coupled by the shared parity constraint.

### 2.3 God's Number

- **HTM (Half-Turn Metric):** 20 moves maximum. Proved by Rokicki et al. (2010) via exhaustive computer search over all ~4.3 × 10^19 states, using symmetry to reduce to ~2 × 10^9 representative positions.
- **QTM (Quarter-Turn Metric):** 26 moves maximum. Proved by Rokicki (2014).
- CFOP averages ~55 HTM moves for top speedsolvers. It is not optimal per-move but is humanly executable at high speed.

---

## 3. CFOP as a Staged Decomposition

CFOP solves the cube in four sequential stages. Each stage reduces the problem to a smaller subgroup by fixing a subset of pieces:

```
All states  →  Cross solved  →  Full F2L  →  OLL done  →  Solved
     G       →      H1        →     H2      →    H3      →   {e}
```

This is conceptually similar to **Kociemba's two-phase algorithm**, which formally decomposes G into two cosets — CFOP uses four stages tuned for human execution rather than move-count optimality.

### 3.1 Stage 1 — Cross

- **Goal:** Place 4 D-layer edges correctly (solved position + correct orientation).
- **Subgroup reached H1:** States where the D-layer cross is solved.
- **Case count:** No fixed algorithm set — solved intuitively. Maximum 8 moves optimal; top solvers average 6–7.
- **Degrees of freedom eliminated:** 4 edges × (12 positions × 2 orientations) reduced to solved.

### 3.2 Stage 2 — F2L (First Two Layers)

- **Goal:** Insert 4 corner-edge pairs into the four slots between the D layer and U layer.
- **Subgroup reached H2:** States where the first two layers are solved.
- **Case count:** 41 distinct cases per pair slot (excluding the already-solved skip). Cases arise from the combinations of corner and edge positions and orientations relative to the slot.
- **Standard approach:** Recognise the pair's configuration, apply one of the 41 standard algorithms. Advanced solvers use lookahead to plan pairs simultaneously.

### 3.3 Stage 3 — OLL (Orientation of the Last Layer)

- **Goal:** Orient all 8 U-layer pieces so all yellow stickers face U. Permutation is ignored.
- **Subgroup reached H3:** States where all pieces are correctly oriented (all pieces in H — Kociemba's G1 subgroup).
- **Case count:** 57 algorithms (+ 1 skip = 58 total cases). Derived by enumerating all combinations of corner orientations (3^7 constrained = 2187 → divided by symmetry) and edge orientations (2^11 constrained → divided by symmetry) within the last layer.
  - **2-look OLL:** Solves OLL in two steps — cross first (5 cases), then corners (7 cases). 12 algorithms total; used by intermediate solvers.

### 3.4 Stage 4 — PLL (Permutation of the Last Layer)

- **Goal:** Permute all 8 U-layer pieces into their correct positions. All pieces already correctly oriented.
- **Subgroup reached:** Identity (solved).
- **Case count:** 21 algorithms (+ 1 skip = 22 total cases). Derived by enumerating permutations of 4 edges × 4 corners within the last layer, subject to the shared parity constraint.
  - **2-look PLL:** Corners first (6 cases including skip), edges second (5 cases including skip). Used by intermediate solvers.

### 3.5 Case count summary

| Stage | Cases (incl. skip) | 2-look |
|-------|-------------------|--------|
| Cross | — (intuitive) | — |
| F2L   | 41 per slot | — |
| OLL   | 57 + skip (58) | 12 algs |
| PLL   | 21 + skip (22) | 11 algs |

---

## 4. Move Notation

WCA notation descends directly from Singmaster (1981). The six face moves (U, D, R, L, F, B) are the generators of the cube group. Every cube state is reachable from the identity by some sequence of these generators — this is the group-theoretic statement that the generators span G.

| Symbol | Meaning |
|--------|---------|
| `U R F D L B` | 90° clockwise (from face's perspective) |
| `U' R' …` | 90° counter-clockwise |
| `U2 R2 …` | 180° |
| `M E S` | Slice moves (middle layers) |
| `x y z` | Whole-cube rotations |
| `u r f …` | Wide moves (two layers) |

---

## 5. Further Reading

- **Joyner, D. — *Adventures in Group Theory* (2008, Johns Hopkins)** — accessible treatment of the cube group and related puzzles in terms of undergraduate group theory.
- **cubing.js source** — implements KPattern (piece permutation + orientation arrays) and Kociemba's solver. The data model maps directly to the group-theoretic description above. See `cubing-js-architecture.md`.
