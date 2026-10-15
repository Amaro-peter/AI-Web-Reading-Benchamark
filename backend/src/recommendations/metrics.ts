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

interface DomComplexityResult {
  score: number;
  maxDepth: number;
  semanticRatio: number;
  issues: string[];
}

interface MultimodalGroundingResult {
  score: number;
  imageAltCoverage: number;
  hasJsonLd: boolean;
  openGraphCount: number;
  issues: string[];
}

/**
 * Computes DOM Structural Complexity & Entropy (DCE).
 * Grounded in DOM-LM (ACL 2022) and WebFormer (ACL 2022).
 * Measures DOM nesting depth, semantic element ratio, and non-semantic wrapper bloat.
 */
export function computeDomComplexityEntropy(rawHtml?: string): DomComplexityResult {
  const issues: string[] = [];
  if (!rawHtml) {
    return { score: 80, maxDepth: 4, semanticRatio: 0.6, issues: [] };
  }

  const voidElements = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
  ]);
  const semanticTags = new Set([
    'article',
    'section',
    'main',
    'header',
    'footer',
    'aside',
    'nav',
    'figure',
    'figcaption',
    'time',
    'address',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'ul',
    'ol',
    'li',
    'p',
    'blockquote',
    'form',
  ]);
  const genericTags = new Set(['div', 'span']);

  const tagRegex = /<\/?([a-zA-Z0-9]+)\b[^>]*>/g;
  let match: RegExpExecArray | null;
  let depth = 0;
  let maxDepth = 0;
  let semanticCount = 0;
  let genericCount = 0;

  while ((match = tagRegex.exec(rawHtml)) !== null) {
    const isClosing = match[0].startsWith('</');
    const tag = (match[1] ?? '').toLowerCase();

    if (voidElements.has(tag)) continue;

    if (isClosing) {
      depth = Math.max(0, depth - 1);
    } else {
      depth++;
      if (depth > maxDepth) maxDepth = depth;
      if (semanticTags.has(tag)) semanticCount++;
      if (genericTags.has(tag)) genericCount++;
    }
  }

  let score = 100;
  const totalStructural = semanticCount + genericCount;
  const semanticRatio = totalStructural > 0 ? semanticCount / totalStructural : 0.5;

  if (maxDepth > 14) {
    const depthPenalty = Math.min(35, (maxDepth - 14) * 3);
    score -= depthPenalty;
    issues.push(`Deep DOM nesting detected (max depth ${maxDepth} > recommended 14 levels)`);
  }

  if (semanticRatio < 0.2 && totalStructural > 15) {
    score -= 25;
    issues.push(
      `Low semantic element ratio (${Math.round(semanticRatio * 100)}%); excessive generic <div> and <span> wrappers`,
    );
  } else if (semanticRatio < 0.35 && totalStructural > 20) {
    score -= 10;
    issues.push(`Moderate semantic element ratio (${Math.round(semanticRatio * 100)}%)`);
  }

  const hasMainOrArticle = /<(main|article)\b/i.test(rawHtml);
  if (!hasMainOrArticle) {
    score -= 10;
    issues.push('Missing landmark <main> or <article> element for primary reading boundary');
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    maxDepth,
    semanticRatio,
    issues,
  };
}

/**
 * Computes Multimodal & Entity Grounding (MEG).
 * Grounded in VisualWebArena (Koh et al., NeurIPS 2024) and Mind2Web (Deng et al., NeurIPS 2023).
 * Evaluates image alt-text coverage, Schema.org JSON-LD microdata, and OpenGraph metadata.
 */
export function computeMultimodalEntityGrounding(rawHtml?: string): MultimodalGroundingResult {
  const issues: string[] = [];
  if (!rawHtml) {
    return { score: 70, imageAltCoverage: 1, hasJsonLd: false, openGraphCount: 0, issues: [] };
  }

  // 1. Image Alt Text Coverage
  const imgMatches = [...rawHtml.matchAll(/<img\b([^>]*)>/gi)];
  const totalImgs = imgMatches.length;
  let withAlt = 0;

  for (const match of imgMatches) {
    const attrs = match[1] ?? '';
    const hasAlt = /alt=["']([^"']*)["']/i.exec(attrs);
    const hasAria = /aria-label=["']([^"']+)["']/i.test(attrs);
    if ((hasAlt && hasAlt[1]!.trim().length > 0) || hasAria) {
      withAlt++;
    }
  }

  const imageAltCoverage = totalImgs > 0 ? withAlt / totalImgs : 1;
  const altScore = Math.round(imageAltCoverage * 35);

  if (totalImgs > 0 && imageAltCoverage < 0.8) {
    issues.push(
      `Only ${withAlt}/${totalImgs} images (${Math.round(imageAltCoverage * 100)}%) provide descriptive alt text or aria-labels`,
    );
  }

  // 2. Structured JSON-LD / Microdata
  const hasJsonLd =
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i.test(rawHtml);
  const jsonLdScore = hasJsonLd ? 35 : 0;
  if (!hasJsonLd) {
    issues.push('Missing Schema.org JSON-LD structured data for entity resolution');
  }

  // 3. OpenGraph / Twitter metadata
  const ogTitle = /<meta\b[^>]*property=["']og:title["'][^>]*>/i.test(rawHtml);
  const ogDesc = /<meta\b[^>]*property=["']og:description["'][^>]*>/i.test(rawHtml);
  const ogImage = /<meta\b[^>]*property=["']og:image["'][^>]*>/i.test(rawHtml);
  const twitterCard = /<meta\b[^>]*name=["']twitter:card["'][^>]*>/i.test(rawHtml);

  let openGraphCount = 0;
  if (ogTitle) openGraphCount++;
  if (ogDesc) openGraphCount++;
  if (ogImage) openGraphCount++;
  if (twitterCard) openGraphCount++;

  const metaScore = Math.min(30, openGraphCount * 8);
  if (openGraphCount < 2) {
    issues.push(
      'Incomplete OpenGraph / Social entity metadata (missing og:title, og:description, or og:image)',
    );
  }

  const score = Math.max(0, Math.min(100, Math.round(altScore + jsonLdScore + metaScore)));

  return {
    score,
    imageAltCoverage,
    hasJsonLd,
    openGraphCount,
    issues,
  };
}

/**
 * Calculates complete scientific metrics vector (SID, HPCI, AAC, DCE, MEG).
 */
export function calculateScientificMetrics(page: ScrapedPage): ScientificMetrics {
  const sid = computeSemanticInformationDensity(page);
  const hpciResult = computeHeadingPathConsistency(page.headings, page.rawHtml);
  const aacResult = computeAccessibilityAffordance(page.rawHtml);
  const dceResult = computeDomComplexityEntropy(page.rawHtml);
  const megResult = computeMultimodalEntityGrounding(page.rawHtml);

  return {
    sid,
    hpci: hpciResult.score,
    aac: aacResult.score,
    dce: dceResult.score,
    meg: megResult.score,
  };
}
