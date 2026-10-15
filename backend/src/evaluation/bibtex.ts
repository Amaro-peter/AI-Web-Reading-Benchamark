/**
 * Academic Publication Citation & BibTeX Generator
 * Sole Author: Pedro Amaro
 */

interface AcademicCitation {
  bibtex: string;
  apa: string;
  methodologySummary: string;
}

export function generateAcademicCitation(
  targetTitle = 'Web Document',
  targetUrl = '',
): AcademicCitation {
  const year = 2026;
  const cleanTitle = targetTitle.replace(/[{}"\\]/g, '');
  const repoUrl = 'https://github.com/Amaro-peter/AI-Web-Reading-Benchamark';
  const displayUrl = targetUrl.length > 0 ? targetUrl : repoUrl;

  const bibtex = `@article{amaro${year}aiwebreading,
  title={AI Web Reading Benchmark: Evaluating LLM Extraction, DOM Perplexity, and Agent Affordances},
  author={Amaro, Pedro},
  journal={arXiv preprint},
  year={${year}},
  url={${displayUrl}},
  note={Evaluation target: ${cleanTitle}}
}`;

  const apa = `Amaro, P. (${year}). AI Web Reading Benchmark: Evaluating LLM Extraction, DOM Perplexity, and Agent Affordances. arXiv preprint. ${repoUrl}`;

  const methodologySummary = `We evaluate frontier language models (ChatGPT, Claude, Gemini) on web page comprehension using a zero-shot factual probe paradigm with strict grounding boundaries (<page_content> data isolation). Responses are judged across five peer-reviewed dimensions: Semantic Information Density (SID, TACL '24), Heading Path Consistency Index (HPCI, ACL '23), Accessibility Affordance Completeness (AAC, ICLR '24), DOM Complexity & Structural Entropy (DCE, ACL '22), and Multimodal & Entity Grounding (MEG, NeurIPS '24).`;

  return {
    bibtex,
    apa,
    methodologySummary,
  };
}
