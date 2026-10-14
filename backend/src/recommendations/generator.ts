import type { ScrapedPage } from '../scraper/index.js';
import type { Optimization, OptimizationResult } from './types.js';

/**
 * Generates an AI Readiness Score (0-100) and actionable engineering suggestions
 * tailored for ChatGPT, Claude, and Gemini web reading optimization.
 */
export function generateOptimizations(page: ScrapedPage): OptimizationResult {
  const optimizations: Optimization[] = [];

  let metadataScore = 100;
  let structureScore = 100;
  let contentDensityScore = 100;
  const affordanceScore = 85;

  // 1. Metadata Audit
  if (!page.byline) {
    metadataScore -= 25;
    optimizations.push({
      id: 'opt-meta-byline',
      category: 'METADATA',
      severity: 'IMPORTANT',
      targetModels: ['openai', 'claude', 'gemini'],
      title: 'Add an explicit author byline or meta author tag',
      explanation:
        'Frontier models look for explicit authorship to attribute claims and establish provenance. Without an author tag, models default to NOT IN PAGE or risk hallucinating an author.',
      action:
        'Include <meta name="author"> or semantic <address class="author"> in the page header.',
      codeSnippet:
        '<meta name="author" content="Jane Doe">\n<meta property="article:author" content="Jane Doe">',
    });
  }

  if (!page.publishedTime) {
    metadataScore -= 25;
    optimizations.push({
      id: 'opt-meta-published-time',
      category: 'METADATA',
      severity: 'IMPORTANT',
      targetModels: ['openai', 'gemini'],
      title: 'Specify publication and update timestamps',
      explanation:
        'ChatGPT Search and Gemini rely heavily on article:published_time to evaluate temporal freshness and avoid treating outdated facts as current.',
      action: 'Add OpenGraph article:published_time and semantic <time datetime="..."> elements.',
      codeSnippet:
        '<meta property="article:published_time" content="2025-01-15T09:00:00Z">\n<time datetime="2025-01-15">January 15, 2025</time>',
    });
  }

  if (!page.description) {
    metadataScore -= 20;
    optimizations.push({
      id: 'opt-meta-description',
      category: 'METADATA',
      severity: 'BEST_PRACTICE',
      targetModels: ['openai', 'gemini'],
      title: 'Provide a concise meta description for AI summarization',
      explanation:
        'Search models like ChatGPT and Gemini use meta[name="description"] as an initial factual anchor when generating page previews.',
      action: 'Add a 150-160 character factual summary in the document head.',
      codeSnippet:
        '<meta name="description" content="Concise, factual summary of the page topic and core findings.">',
    });
  }

  if (!page.lang) {
    metadataScore -= 10;
    optimizations.push({
      id: 'opt-meta-lang',
      category: 'METADATA',
      severity: 'BEST_PRACTICE',
      targetModels: ['openai', 'claude', 'gemini'],
      title: 'Declare language attribute on the root html element',
      explanation:
        'Declaring lang prevents AI tokenizer confusion and guarantees accurate multilingual entity parsing across non-English terms.',
      action: 'Add a lang attribute to your root <html> tag.',
      codeSnippet: '<html lang="en">',
    });
  }

  // 2. Semantic Structure & Headings Audit
  if (page.headings.length === 0) {
    structureScore -= 60;
    optimizations.push({
      id: 'opt-structure-no-headings',
      category: 'STRUCTURE',
      severity: 'CRITICAL',
      targetModels: ['openai', 'claude', 'gemini'],
      title: 'Structure your content with semantic section headings (H2/H3)',
      explanation:
        'This page has no section headings. LLMs cannot navigate multi-topic pages without headings, leading to severe drops in relation and multi-hop reasoning.',
      action: 'Divide content into thematic sections using semantic <h2> and <h3> tags.',
      codeSnippet: '<h2>Core Architecture</h2>\n<p>...</p>\n<h2>Installation</h2>\n<p>...</p>',
    });
  } else if (page.headings.length < 2) {
    structureScore -= 25;
    optimizations.push({
      id: 'opt-structure-few-headings',
      category: 'STRUCTURE',
      severity: 'IMPORTANT',
      targetModels: ['claude', 'openai'],
      title: 'Divide body into multiple distinctive subheadings',
      explanation:
        'A single heading limits an AI model capability to index distinct topics or use prompt caching effectively (crucial for long-context Claude models).',
      action: 'Use 2-4 distinct section headings for any content longer than 300 words.',
      codeSnippet: '<h2>Overview</h2>\n<p>...</p>\n<h2>Specifications</h2>\n<p>...</p>',
    });
  }

  if (!page.title || page.title.length < 5) {
    structureScore -= 20;
    optimizations.push({
      id: 'opt-structure-title-weak',
      category: 'STRUCTURE',
      severity: 'CRITICAL',
      targetModels: ['openai', 'claude', 'gemini'],
      title: 'Ensure a clear, descriptive headline in H1 and Title',
      explanation:
        'Page title is missing or too short. AI models use the primary title to define the topic scope for all extraction tasks.',
      action: 'Provide a descriptive <title> and matching <h1> element (15-70 characters).',
      codeSnippet: '<h1>Lisbon Tram Network Celebrates 150th Anniversary</h1>',
    });
  }

  // 3. Content Density & Truncation Audit
  if (page.truncated) {
    contentDensityScore -= 40;
    optimizations.push({
      id: 'opt-content-truncated',
      category: 'CONTENT_DENSITY',
      severity: 'CRITICAL',
      targetModels: ['openai', 'claude', 'gemini'],
      title: 'Content exceeded context threshold and was truncated',
      explanation:
        'The page body exceeded 12,000 characters. In AI search pipelines and agents, deep monolithic pages get truncated, risking critical facts being dropped.',
      action:
        'Place essential factual takeaways, specifications, and answers in the top 1,500 words of the document.',
      codeSnippet:
        '<div class="summary-key-points">\n  <h3>Key Takeaways</h3>\n  <ul>...</ul>\n</div>',
    });
  }

  if (page.wordCount < 120) {
    contentDensityScore -= 30;
    optimizations.push({
      id: 'opt-content-thin',
      category: 'CONTENT_DENSITY',
      severity: 'IMPORTANT',
      targetModels: ['openai', 'claude', 'gemini'],
      title: 'Low text content detected — ensure server-side rendered prose',
      explanation:
        'Fewer than 120 words were extracted. If your site relies on client-side JS frameworks (React/Vue/Angular), AI scrapers may receive an empty shell.',
      action:
        'Use server-side rendering (SSR) or static site generation (SSG) so full prose is present in the initial HTML payload.',
    });
  }

  // 4. Actionability & Agent Usability
  optimizations.push({
    id: 'opt-affordance-semantic-buttons',
    category: 'AFFORDANCE',
    severity: 'IMPORTANT',
    targetModels: ['claude', 'openai'],
    title: 'Use semantic <button> and accessible labels for interactive actions',
    explanation:
      'Autonomous web agents (Claude Computer-Use, OpenAI Operator) search for semantic <button> and <form> elements. Non-semantic <div> or <span> clickables are often stripped as noise.',
    action:
      'Always wrap user actions in semantic <button type="button"> or <a role="button"> with explicit text or aria-label.',
    codeSnippet:
      '<button type="submit" class="cta-primary" aria-label="Add item to cart">\n  Add to basket\n</button>',
  });

  // 5. General AI Discovery
  optimizations.push({
    id: 'opt-ai-robots-txt',
    category: 'METADATA',
    severity: 'BEST_PRACTICE',
    targetModels: ['openai', 'claude', 'gemini'],
    title: 'Configure explicit robots.txt permissions for Frontier AI crawlers',
    explanation:
      'To ensure your site appears in ChatGPT Search, Claude citations, and Gemini AI Overviews, explicitly allow their official user agents in robots.txt.',
    action: 'Add permissive directives for GPTBot, ClaudeBot, and Google-Extended.',
    codeSnippet:
      'User-agent: GPTBot\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: Google-Extended\nAllow: /',
  });

  const clamp = (val: number) => Math.max(0, Math.min(100, Math.round(val)));
  const cleanMetadata = clamp(metadataScore);
  const cleanStructure = clamp(structureScore);
  const cleanDensity = clamp(contentDensityScore);
  const cleanAffordance = clamp(affordanceScore);

  const overall = clamp(
    cleanStructure * 0.3 + cleanMetadata * 0.25 + cleanDensity * 0.25 + cleanAffordance * 0.2,
  );

  const grade =
    overall >= 90 ? 'A' : overall >= 80 ? 'B' : overall >= 70 ? 'C' : overall >= 60 ? 'D' : 'F';

  return {
    readiness: {
      overall,
      grade,
      breakdown: {
        structure: cleanStructure,
        metadata: cleanMetadata,
        contentDensity: cleanDensity,
        affordance: cleanAffordance,
      },
    },
    optimizations,
  };
}
