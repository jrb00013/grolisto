# Grolisto — applied mathematics (discovery)

## System (plain language)

A household has a weekly spend ceiling, a set of days they will cook, and a subset of meal times to fill. Recipes are proposals; ingredients have store prices. Allergies forbid some dishes outright. Liked foods and past feedback nudge which dishes feel good. The planner must fill every chosen meal slot, not overspend, avoid serving near-duplicates too often, and update taste as feedback arrives.

## 1. Inventory

| Kind | Items |
|---|---|
| **Entities** | Days \(d=1..D\); meal slots \(s\in M\subseteq\{\mathrm{bf},\mathrm{lu},\mathrm{di}\}\); candidate recipes \(r\in R\); ingredients \(i\in I\); allergen set \(A\); liked set \(L\); store price map \(p_i\). |
| **Actions** | Assign recipe \(r\) to slot \((d,s)\); buy ingredient bundle for the week; record like/dislike after eating. |
| **Measurables** | Budget \(B\) (\$); cost of recipe \(c_r=\sum_i q_{ri}p_i\) (\$); servings; embedding \(e_r\in\mathbb{R}^k\); taste vector \(\theta\in\mathbb{R}^k\); feedback \(y\in\{-1,+1\}\). |
| **Constraints** | \(\sum\) weekly ingredient spend \(\le B\); no recipe intersecting \(A\); each \((d,s)\) for \(d\le D\), \(s\in M\) gets exactly one recipe; repetition / diversity bounds (below). |

Fundamental units: currency (\$), count (meals, recipes), embedding similarity (dimensionless).

## 2. Invariants

**Budget residual (bounded, nearly conserved until purchase).** Let purchased spend be \(C\). Then slack \(S=B-C\) with \(S\ge 0\) hard. Internally redistributing recipes changes \(C\) but never increases the feasible set beyond \(B\). Break attempt: leftover pantry inventory can reduce *new* spend without changing \(B\) — true conserved quantity is *new outlay*, not total food value.

**Meal-slot coverage (exact, combinatorial).** Number of filled slots \(N=D\cdot|M|\) must equal \(\sum_{d,s,r} x_{dsr}\). Break attempt: skipping a lunch fails coverage; “snack instead” is outside \(M\) and does not restore the invariant.

**Day-relabeling symmetry.** For fixed \(D\) and no calendar priors, permuting day indices leaves the feasible set and objective unchanged → solutions may be reported up to day permutation (or broken deliberately by weekday habits later).

## 3. Dimensionless groups

| Group | Definition | Meaning |
|---|---|---|
| Cost intensity | \(\kappa = C/(B)\) | Fraction of budget used; \(\kappa\le 1\) hard. Limit \(\kappa\to 0\): under-utilizing budget is soft (prefer \(\kappa\) near a target \(\kappa^\star\)). |
| Per-meal cost load | \(\lambda = C/(N\cdot \bar c)\) where \(\bar c\) = median \(c_r\) | How expensive the plan is vs typical recipes. |
| Variety index | \(V = 1 - \frac{1}{N(N-1)}\sum_{(u,v):u\neq v}\mathrm{sim}(e_{r_u},e_{r_v})\) | Mean pairwise dissimilarity of assigned embeddings; weekly diversity floor \(V\ge V_{\min}\). |

Any true “good plan” score should depend on \((\kappa,\lambda,V,\langle\theta,e_r\rangle)\), not raw \$ alone (currency rescaling symmetry).

## 4. Optimization formulation

**Decision vars.** \(x_{dsr}\in\{0,1\}\): assign recipe \(r\) to day \(d\), slot \(s\).

**Information.** At plan time: \(B,D,M,A,L,\{p_i\},R,\{e_r\},\theta\) known; post-meal \(y\) arrives online afterward.

\[
\begin{aligned}
\max_x\quad
& \underbrace{\sum_{d,s,r} x_{dsr}\,u(r;\theta,L)}_{\text{preference}}
- \underbrace{\alpha\,P_{\mathrm{nov}}(x)}_{\text{novelty penalty}}
- \underbrace{\beta\,(B-C)_+^{\gamma}}_{\text{budget-slack penalty (under-spend)}} \\
\text{s.t.}\quad
& \sum_r x_{dsr}=1 && \forall d\le D,\,s\in M && \text{(hard: coverage)} \\
& C=\mathrm{cost}(x;\{p_i\})\le B && && \text{(hard: budget)} \\
& x_{dsr}=0 \text{ if } r\cap A\neq\emptyset && && \text{(hard: allergy)} \\
& V(x)\ge V_{\min} && && \text{(hard or soft diversity floor)} \\
& x_{dsr}\in\{0,1\}.
\end{aligned}
\]

Utility sketch: \(u(r;\theta,L)=\langle\theta,e_r\rangle + \eta\,\mathbf{1}_{r\in L}\). Soft: under-spend, mild repetition, weak likes. Hard: allergies, coverage, \(C\le B\).

## 5. Novelty / anti-repetition

Let recent assignments have ages \(t_\tau\) (meals ago). Exponentially decayed similarity pressure:

\[
P_{\mathrm{nov}}(x)=\sum_{(d,s)}\sum_{\tau\in\mathrm{hist}} e^{-t_\tau/\tau_0}\,\mathrm{sim}\bigl(e_{r(d,s)},e_{r_\tau}\bigr)
+ \mu\sum_{(d,s)\neq(d',s')}\mathrm{sim}\bigl(e_{r(d,s)},e_{r(d',s')}\bigr).
\]

Weekly diversity floor: \(V(x)\ge V_{\min}\) (e.g. \(V_{\min}=0.45\)). Same recipe twice in one week: \(\mathrm{sim}=1\) → large penalty; near-duplicates (same protein+sauce embedding) also suppressed. \(\tau_0\) sets memory length (e.g. ~6 meals).

## 6. Preference learning

Taste \(\theta_t\) updated after feedback \(y_t\in\{+1,-1\}\) on served embedding \(e_t\):

**Exponential smoothing / linear bandit step**

\[
\theta_{t+1}=(1-\rho)\theta_t + \rho\, y_t e_t
\quad\text{or}\quad
\theta_{t+1}=\theta_t + \rho\,(y_t-\langle\theta_t,e_t\rangle)\,e_t.
\]

\(\rho\in(0,1)\) learning rate. Likes pull \(\theta\) toward \(e_t\); dislikes push away. Optional: project \(\|\theta\|\le 1\). Cold start: seed \(\theta\) from liked foods \(L\) as the mean of their embeddings.

## 7. Worked example — \(B=\$80\), \(D=5\), \(M=\{\mathrm{lunch},\mathrm{dinner}\}\)

\(N=10\) slots. Candidate costs (allergy-safe): A rice-bowl \$6, B pasta \$7, C chili \$9, D stir-fry \$8, E salad-protein \$10, F tacos \$8, G soup+bread \$5, H roast-veg \$7.

Pick 10 assignments with mean ~\$7.6 → \(C\approx \$76\), \(\kappa=76/80=0.95\), slack \(S=\$4\). Avoid repeating A more than twice; keep pairwise mean \(\mathrm{sim}\) low enough that \(V\approx 0.55\ge V_{\min}\). If \(\theta\) favors spicy/bean dishes, prefer C,F over H. Objective: high \(\sum u\) from C/F/D mix, small \(P_{\mathrm{nov}}\) (no adjacent near-clones), small under-spend penalty on \(S=4\).

If forced \(C=\$88>B\), infeasible — drop E’s or swap E→G until \(C\le 80\). Allergy peanut in a Thai candidate: \(x_{*r}=0\) regardless of utility.

## Domain of validity / leaves out

Assumes additive ingredient costs, stable prices for the week, independent slot utilities (no “leftover coupling” except via shared \(C\)), and that embeddings capture culinary nearness. Fails when: pantry stock dominates new spend; multi-week batch cooking; hard nutrition macros; household members with conflicting \(\theta\); or store stockouts (need recourse).
