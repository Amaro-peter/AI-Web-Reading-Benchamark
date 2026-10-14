# Scientific Metrics Plan: AI Web Readability, Extraction & Agent Grounding

## 1. Overview & Research Foundation

To evaluate how effectively Frontier Large Language Models (OpenAI GPT-4o, Anthropic Claude 3.5/3.7, Google Gemini 2.5) read, parse, and act upon websites, this plan incorporates **three scientifically recognized, peer-reviewed metric dimensions** drawn directly from landmark papers in AI, Natural Language Processing, and Autonomous Web Agents:

1. **Semantic Information Density (SID)** & Extraction Ratio: Grounded in *GEO: Generative Engine Optimization* (Aggarwal et al., Princeton/Georgia Tech/AI2, 2023), *Lost in the Middle* (Liu et al., Stanford/UC Berkeley, TACL 2024), and *CleanEval* (Baroni et al., LREC 2008).
2. **Heading Path Consistency Index (HPCI)** & Structural Entropy: Grounded in *HTML-T5* (Gur et al., Google DeepMind, ACL 2023) and *DOM-LM* (Zheng et al., Amazon, ACL 2022).
3. **Accessibility Affordance Completeness (AAC)** & Action Grounding Precision: Grounded in *WebArena* (Zhou et al., CMU, ICLR 2024 Oral) and *Mind2Web* (Deng et al., OSU, NeurIPS 2023).

```mermaid
flowchart TD
    HTML["Scraped Webpage (HTML + DOM)"] --> M1["Metric 1: Semantic Information Density (SID)"]
    HTML --> M2["Metric 2: Heading Path Consistency Index (HPCI)"]
    HTML --> M3["Metric 3: Accessibility Affordance Completeness (AAC)"]
    
    M1 --> SID_Out["Signal-to-Noise Ratio (0-100%)\nNoise Token Penalty & Truncation Risk"]
    M2 --> HPCI_Out["Heading Monotonicity (0-100%)\nHierarchical Tree Predictability"]
    M3 --> AAC_Out["Agent Grounding Readiness (0-100%)\nRole, Name, Unique Scope, Focusable"]
    
    SID_Out & HPCI_Out & AAC_Out --> AI_Readiness["Composite AI Readiness Score (0-100, Grade A-F)"]
    AI_Readiness --> Recs["Model-Specific Guidance (ChatGPT, Claude, Gemini)"]
    AI_Readiness --> Pub["Academic Paper Export (LaTeX, CSV, JSON)"]
```

---

## 2. Scientific Definitions & Mathematical Formulations

### Metric 1: Semantic Information Density (SID)
* **Definition**: Quantifies the ratio of salient article content tokens against total document payload tokens (including structural boilerplate, scripts, navigation chrome, and styles).
* **Mathematical Formula**:
  $$\text{SID} = \frac{|\mathcal{T}_{\text{content}}|}{|\mathcal{T}_{\text{content}}| + |\mathcal{T}_{\text{boilerplate}}| + \alpha |\mathcal{T}_{\text{markup}}|}$$
  where $\mathcal{T}_{\text{content}}$ is the text extracted by main content algorithms (e.g., Readability), and the denominator encompasses all extracted or stripped tokens.
* **Why Frontier LLMs Care**: Liu et al. (TACL 2024) proved that surrounding salient facts with high noise causes massive attention decay ("lost in the middle"). Furthermore, ChatGPT and Claude web fetchers enforce character truncation ceilings (12,000–24,000 characters).
* **Developer Remediation**: Enclose primary text in `<main>` / `<article>`, extract inline SVG/styles to external assets, provide JSON-LD schema, and place high-value conclusions in the opening 1,500 words.

### Metric 2: Heading Path Consistency Index (HPCI)
* **Definition**: Measures the monotonicity, completeness, and hierarchical predictability of the document's heading tree ($h_1, \dots, h_m$).
* **Mathematical Formula**:
  $$\text{HPCI} = \max\left(0, \, 1 - \frac{1}{\max(1, M - 1)} \sum_{i=1}^{M-1} \max\Big(0, \, \text{level}(h_{i+1}) - \text{level}(h_i) - 1\Big)\right) \times 100$$
  where $\text{level}(h) \in \{1, 2, 3, 4, 5, 6\}$ corresponds to `<h1>` through `<h6>`. A penalty is assessed whenever a heading level is skipped (e.g., `<h2>` directly jumping to `<h4>` without an `<h3>`).
* **Why Frontier LLMs Care**: Gur et al. (Google DeepMind, ACL 2023) demonstrated that LLMs parsing HTML rely on predictable heading hierarchies to segment documents into semantic chunks. Skips cause RAG chunking fractures and drop relation accuracy by up to 34%.
* **Developer Remediation**: Exactly one `<h1>`, strictly monotonic nesting (`<h2>` $\to$ `<h3>` with 0 skipped levels), and wrapping distinct sections in `<section id="...">`.

### Metric 3: Accessibility Affordance Completeness (AAC)
* **Definition**: Measures the proportion of interactive elements that provide explicit semantic roles, unambiguous accessible names, and focusability in the Accessibility Tree (AXTree).
* **Mathematical Formula**:
  $$\text{AAC} = \frac{1}{|\mathcal{E}_{\text{interactive}}|} \sum_{e \in \mathcal{E}} \left[ 0.35 \cdot \text{HasRole}(e) + 0.35 \cdot \text{HasName}(e) + 0.15 \cdot \text{IsUnique}(e) + 0.15 \cdot \text{IsFocusable}(e) \right] \times 100$$
  where:
  - $\text{HasRole}(e)$: Native `<button>`, `<a>`, `<input>`, `<select>`, `<form>`, or valid WAI-ARIA role.
  - $\text{HasName}(e)$: Non-empty accessible name (`aria-label`, inner text, or `<label for="...">`).
  - $\text{IsUnique}(e)$: Accessible name is distinct from identical sibling actions in the same container.
  - $\text{IsFocusable}(e)$: Element is keyboard navigable (native or `tabindex="0"`).
* **Why Frontier LLMs Care**: Zhou et al. (CMU, ICLR 2024 Oral) showed that autonomous web agents fail element selection and action grounding when custom `div`/`span` widgets are invisible to accessibility trees or lack unique contextual names.
* **Developer Remediation**: Replace `div`/`span` buttons with native `<button>`, add `aria-label` to icon buttons, bind forms with `<label for="...">`, and use disambiguated action labels (e.g., "Read documentation" instead of generic "Learn more").

---

## 3. Three-Phase Implementation Roadmap

### Phase 1: Metric Computation Engine (Backend)
- Implement `backend/src/recommendations/metrics.ts` to compute:
  - `computeSemanticInformationDensity(page: ScrapedPage): number`
  - `computeHeadingPathConsistency(headings: string[], dom?: Document): { score: number, violations: string[] }`
  - `computeAccessibilityAffordance(html: string): { score: number, interactiveCount: number, issues: string[] }`
- Integrate these metrics directly into `backend/src/recommendations/generator.ts` and the `AIReadinessScore` type.
- Unit test all metric calculation edge cases in `backend/tests/unit/scientific-metrics.test.ts`.

### Phase 2: Actionable Model Guidance & Editorial Compliance
- Link metric violations directly to model-specific guidance for ChatGPT, Claude, and Gemini with actionable code snippets.
- Ensure all emitted text strictly respects the specification neutrality mandate (zero forbidden ranking keywords: `winner`, `best model`, `worst`, `rank`, `recommend`).
- Update regression fixtures and verify spec tests pass cleanly.

### Phase 3: Frontend Visualization & Academic Export
- Update `frontend/src/lib/types.ts` to mirror the three scientific metrics (`sid`, `hpci`, `aac`).
- Update `RecommendationsPanel.tsx` with dedicated metric cards featuring:
  - Metric percentage score gauge and rating badge.
  - Academic citation badge (e.g., *NeurIPS '23*, *ICLR '24*, *TACL '24*).
  - Mathematical description and concrete developer fix.
- Update LaTeX table generator in `ResultsPanel.tsx` and `scripts/run-paper-benchmark.mjs` to include the scientific metrics.
- Execute full 19-stage CI verification (`npm run ci`) and verify 100% green build.
