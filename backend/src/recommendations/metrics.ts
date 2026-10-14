import type { ScrapedPage } from '../scraper/index.js';
import type { ScientificMetrics } from './types.js';

interface HeadingAuditResult {
  score: number;
  violations: string[];
}

interface AffordanceAuditResult {
  score: number;
  interactiveCount: number;
  issues: string[];
}

/**
 * Computes Semantic Information Density (SID).
 * Grounded in GEO (Aggarwal et al., 2023) and Lost in the Middle (Liu et al., TACL 2024).
 * Quantifies the ratio of salient article content tokens against total document payload tokens.
 */
export function computeSemanticInformationDensity(page: ScrapedPage): number {
  const salientChars = Math.max(0, page.charCount);
  const rawBytes = Math.max(page.bytes, page.rawHtml ? page.rawHtml.length : salientChars * 2);

  if (rawBytes === 0 || salientChars === 0) {
    return 0;
  }

  // Baseline ratio of readable prose to total wire bytes.
  // High-density articles achieve ~25-45% text-to-markup ratio.
  const rawRatio = salientChars / rawBytes;
  let score = Math.min(100, Math.round((rawRatio / 0.3) * 100));

  // Truncation penalty: when pages exceed the 12,000 char threshold, models experience
  // severe context dilution and attention decay in middle/lower sections.
  if (page.truncated) {
    score = Math.max(0, score - 25);
  }

  // Thin content penalty: pages with very low word counts lack sufficient grounding facts.
  if (page.wordCount < 120) {
    score = Math.max(0, score - 20);
  } else if (page.wordCount > 300 && score < 70) {
    score = Math.min(100, score + 15);
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Computes Heading Path Consistency Index (HPCI).
 * Grounded in HTML-T5 (Gur et al., Google DeepMind, ACL 2023) and DOM-LM (ACL 2022).
 * Measures the strict hierarchical monotonicity of the document's heading tree (H1-H6).
 */
export function computeHeadingPathConsistency(
  headings: string[],
  rawHtml?: string,
): HeadingAuditResult {
  const violations: string[] = [];

  if (!rawHtml) {
    if (headings.length === 0) {
      return { score: 10, violations: ['No semantic section headings detected'] };
    }
    if (headings.length === 1) {
      return { score: 55, violations: ['Only one section heading found'] };
    }
    return { score: 100, violations: [] };
  }

  // Parse headings in document order
  const headingRegex = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  const tree: { level: number; text: string }[] = [];
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(rawHtml)) !== null) {
    const level = parseInt(match[1] ?? '0', 10);
    const text = (match[2] ?? '').replace(/<[^>]+>/g, '').trim();
    if (text.length > 0) {
      tree.push({ level, text });
    }
  }

  if (tree.length === 0) {
    return { score: 0, violations: ['Document contains no H1-H6 headings'] };
  }

  let penalty = 0;
  const h1Count = tree.filter((h) => h.level === 1).length;

  if (h1Count === 0) {
    penalty += 25;
    violations.push('Missing top-level <h1> heading for main document topic');
  } else if (h1Count > 1) {
    penalty += 15;
    violations.push(`Found ${h1Count} <h1> headings; standard convention requires exactly one`);
  }

  // Verify monotonic progression (no skipped levels, e.g. H1 -> H3)
  for (let i = 0; i < tree.length - 1; i++) {
    const current = tree[i]!;
    const next = tree[i + 1]!;
    const levelJump = next.level - current.level;

    if (levelJump > 1) {
      penalty += 10 * (levelJump - 1);
      violations.push(
        `Skipped heading level from <h${current.level}> to <h${next.level}> ("${next.text.slice(0, 30)}")`,
      );
    }
  }

  const score = Math.max(0, Math.min(100, 100 - penalty));
  return { score, violations };
}

/**
 * Computes Accessibility Affordance Completeness (AAC).
 * Grounded in WebArena (Zhou et al., CMU, ICLR 2024 Oral) and Mind2Web (Deng et al., NeurIPS 2023).
 * Evaluates semantic role clarity, accessible naming, and action disambiguation for web agents.
 */
export function computeAccessibilityAffordance(rawHtml?: string): AffordanceAuditResult {
  const issues: string[] = [];

  if (!rawHtml) {
    return { score: 85, interactiveCount: 0, issues: [] };
  }

  let score = 100;
  let interactiveCount = 0;

  // 1. Detect pseudo-buttons built with <div> or <span> (bad practice)
  const pseudoButtons =
    rawHtml.match(/<(div|span)[^>]*\b(onclick|role=["']button["'])[^>]*>/gi) ?? [];
  if (pseudoButtons.length > 0) {
    score -= Math.min(30, pseudoButtons.length * 10);
    issues.push(
      `Detected ${pseudoButtons.length} non-semantic pseudo-button(s) (<div> or <span> clickables)`,
    );
  }

  // 2. Scan native buttons
  const buttonRegex = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
  let btnMatch: RegExpExecArray | null;
  const buttonLabels: string[] = [];

  while ((btnMatch = buttonRegex.exec(rawHtml)) !== null) {
    interactiveCount++;
    const attrs = btnMatch[1] ?? '';
    const body = (btnMatch[2] ?? '').replace(/<[^>]+>/g, '').trim();
    const hasAriaLabel = /aria-label=["'][^"']+["']/i.test(attrs);
    const hasTitle = /title=["'][^"']+["']/i.test(attrs);

    if (body.length === 0 && !hasAriaLabel && !hasTitle) {
      score -= 10;
      issues.push('Icon button missing accessible name or aria-label');
    } else {
      const label = (hasAriaLabel ? attrs : body).toLowerCase();
      buttonLabels.push(label);
    }
  }

  // 3. Scan interactive links with href
  const linkRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let linkMatch: RegExpExecArray | null;
  const ambiguousLabels = new Set(['learn more', 'read more', 'click here', 'more', 'view']);
  let ambiguousCount = 0;

  while ((linkMatch = linkRegex.exec(rawHtml)) !== null) {
    const attrs = linkMatch[1] ?? '';
    if (!/href=/i.test(attrs)) continue;

    interactiveCount++;
    const text = (linkMatch[2] ?? '')
      .replace(/<[^>]+>/g, '')
      .trim()
      .toLowerCase();
    const hasAria = /aria-label=/i.test(attrs);

    if (ambiguousLabels.has(text) && !hasAria) {
      ambiguousCount++;
    }
  }

  if (ambiguousCount > 1) {
    score -= Math.min(20, ambiguousCount * 5);
    issues.push(
      `Found ${ambiguousCount} ambiguous links without contextual aria-labels (e.g. "Read more")`,
    );
  }

  // 4. Form accessibility
  const formInputs = rawHtml.match(/<input\b(?![^>]*type=["']hidden["'])[^>]*>/gi) ?? [];
  interactiveCount += formInputs.length;
  if (formInputs.length > 0) {
    const labeledInputs = rawHtml.match(/<label\b[^>]*>/gi) ?? [];
    if (labeledInputs.length === 0 && !/aria-label=/i.test(rawHtml)) {
      score -= 15;
      issues.push('Form inputs lack explicitly associated <label> or aria-label attributes');
    }
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    interactiveCount,
    issues,
  };
}

/**
 * Calculates complete scientific metrics vector (SID, HPCI, AAC).
 */
export function calculateScientificMetrics(page: ScrapedPage): ScientificMetrics {
  const sid = computeSemanticInformationDensity(page);
  const hpciResult = computeHeadingPathConsistency(page.headings, page.rawHtml);
  const aacResult = computeAccessibilityAffordance(page.rawHtml);

  return {
    sid,
    hpci: hpciResult.score,
    aac: aacResult.score,
  };
}
