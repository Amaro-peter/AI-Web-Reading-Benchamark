import { describe, expect, it } from 'vitest';
import { generateAcademicCitation } from '../../src/evaluation/bibtex.js';

describe('generateAcademicCitation', () => {
  it('generates standard BibTeX with Pedro Amaro as sole author', () => {
    const citation = generateAcademicCitation('Test Page', 'https://example.com');
    expect(citation.bibtex).toContain('author={Amaro, Pedro}');
    expect(citation.bibtex).toContain('@article{amaro2026aiwebreading');
    expect(citation.bibtex).toContain('note={Evaluation target: Test Page}');
  });

  it('generates APA citation correctly', () => {
    const citation = generateAcademicCitation();
    expect(citation.apa).toContain('Amaro, P. (2026).');
  });

  it('includes scientific methodology description referencing the 5 dimensions', () => {
    const citation = generateAcademicCitation();
    expect(citation.methodologySummary).toContain('Semantic Information Density (SID');
    expect(citation.methodologySummary).toContain('Heading Path Consistency Index (HPCI');
    expect(citation.methodologySummary).toContain('Accessibility Affordance Completeness (AAC');
    expect(citation.methodologySummary).toContain('DOM Complexity & Structural Entropy (DCE');
    expect(citation.methodologySummary).toContain('Multimodal & Entity Grounding (MEG');
  });
});
