# Model Risk Rating — How It Works

*A one-page explanation of the automatic risk-rating approach used in the Model Inventory & Risk Tracker. Suitable for sharing with colleagues, model owners, or auditors.*

---

## Purpose

Every model in the inventory is given a **risk tier** — Tier 1 (high), Tier 2 (medium) or Tier 3 (low). The tier determines how much oversight the model gets and how often it must be independently re-validated.

The tier is **calculated by the tool, not entered by hand.** This keeps ratings consistent, comparable across the whole inventory, and free from individual bias. Just as importantly, the tool always shows the **scores behind the rating**, so any tier can be explained and challenged.

## The five risk factors

Each model is assessed on five factors. Each factor is scored **Low (1)**, **Medium (2)** or **High (3)**.

| Factor | What it measures | Low (1) → High (3) |
|---|---|---|
| **Materiality** | How much money or how large a portfolio depends on the model | Small exposure → very large exposure |
| **Regulatory impact** | Whether it feeds capital, financial reporting, or external/regulatory submissions | Internal use only → directly feeds regulatory numbers |
| **Reliance / interconnectedness** | How many decisions and other models depend on its output | Stand-alone → feeds many decisions and downstream models |
| **Complexity** | How complex and transparent the methodology is | Simple rules-based → machine-learning / AI |
| **Uncertainty** | Data quality and how mature / proven the model is | Rich data, proven method → sparse data, new method |

## How the score is calculated

The five scores are combined into a single **weighted score** using these weights:

```
weighted score = 0.30 × Materiality
               + 0.25 × Regulatory impact
               + 0.20 × Reliance
               + 0.15 × Complexity
               + 0.10 × Uncertainty
```

Because the weights add up to 1.0, the result is just a **weighted average** of the five scores, always between **1.00 and 3.00**. (The 0–100 figure shown on each model is the same number rescaled for quick reading: 1.00 → 0, 3.00 → 100.)

**Why these weights?**

- **Materiality leads (30%)** — the size of the exposure is the single biggest driver of how much damage a wrong model can cause.
- **Regulatory impact is second (25%)** — models that feed capital or financial reporting carry regulatory and reputational risk *on top of* financial risk.
- **Reliance (20%)** captures contagion — an error in a heavily-relied-upon model spreads further.
- **Complexity (15%)** reflects how hard a model is to understand and challenge; opaque ML/AI models score highest.
- **Uncertainty (10%)** carries the least weight because poor data or an unproven method is usually the *most fixable* of the five factors.

The weights are deliberately simple and transparent so the scheme is easy to govern and defend.

## From score to tier

The 1–3 range is split into three equal bands:

| Tier | Weighted score | Re-validation cycle | What it means |
|---|---|---|---|
| **Tier 1 — High** | 2.33 – 3.00 | **Every 12 months** | Highest model risk; most intensive oversight |
| **Tier 2 — Medium** | 1.67 – 2.32 | **Every 24 months** | Standard oversight and validation cadence |
| **Tier 3 — Low** | 1.00 – 1.66 | **Every 36 months** | Lower model risk; lighter-touch oversight |

The re-validation intervals are configurable in the tool (Validation Schedule → Schedule settings).

## Validation status flags

From each model's **last validation date** and its tier's interval, the tool works out the **next-due date** and flags it:

- **Overdue** — the next-due date has already passed.
- **Due soon** — due within the configured window (90 days by default).
- **Current** — validated and not yet approaching its due date.
- **Pending initial** — still in development; first validation not yet due.

Retired models carry no live validation obligation.

## Worked example

*Retail Mortgage PD* is assessed as Materiality **High (3)**, Regulatory **High (3)**, Reliance **High (3)**, Complexity **Medium (2)**, Uncertainty **Medium (2)**:

```
(0.30×3) + (0.25×3) + (0.20×3) + (0.15×2) + (0.10×2)
= 0.90 + 0.75 + 0.60 + 0.30 + 0.20
= 2.75  →  Tier 1 (High)  →  re-validate every 12 months
```

Anyone reviewing this rating can see exactly which factors drove it: the model is large, regulatory and widely relied upon, which outweighs its only-moderate complexity and uncertainty.

---

*This scheme is intentionally simple, rule-based and fully transparent. It is a consistent **starting point** for tiering; documented expert judgement can always be applied on top, but any such override should be recorded against the model.*
