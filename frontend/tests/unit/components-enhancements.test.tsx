import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AcademicExportHub } from '@/components/AcademicExportHub';
import { AiFixPack } from '@/components/AiFixPack';
import { HeadingTreeInspector } from '@/components/HeadingTreeInspector';
import { MetricRadarChart } from '@/components/MetricRadarChart';
import { ResultsPanel } from '@/components/ResultsPanel';
import { benchmarkResultFixture } from '../helpers/fixture';

describe('MetricRadarChart', () => {
  it('renders SVG radar with 5 dimension labels', () => {
    const metrics = { sid: 80, hpci: 90, aac: 75, dce: 85, meg: 70 };
    render(<MetricRadarChart metrics={metrics} />);

    expect(screen.getByText(/SID \(80%\)/)).toBeInTheDocument();
    expect(screen.getByText(/HPCI \(90%\)/)).toBeInTheDocument();
    expect(screen.getByText(/AAC \(75%\)/)).toBeInTheDocument();
    expect(screen.getByText(/DCE \(85%\)/)).toBeInTheDocument();
    expect(screen.getByText(/MEG \(70%\)/)).toBeInTheDocument();
  });
});

describe('HeadingTreeInspector', () => {
  it('renders root H1 and heading tree', () => {
    const headings = ['Introduction', 'Methodology', 'Results'];
    render(<HeadingTreeInspector title="Research Paper" headings={headings} />);

    expect(screen.getByText('Research Paper')).toBeInTheDocument();
    expect(screen.getByText('Introduction')).toBeInTheDocument();
    expect(screen.getByText('Methodology')).toBeInTheDocument();
    expect(screen.getByText('Results')).toBeInTheDocument();
    expect(screen.getByText('3 sections')).toBeInTheDocument();
    expect(screen.getByText('Semantic Outline Present')).toBeInTheDocument();
  });

  it('renders warning when no headings exist', () => {
    render(<HeadingTreeInspector title="Single Page" headings={[]} />);

    expect(screen.getByText('0 sections')).toBeInTheDocument();
    expect(screen.getByText('No Headings Found')).toBeInTheDocument();
    expect(screen.getByText('Missing Semantic Headings (H2 / H3)')).toBeInTheDocument();
  });
});

describe('AiFixPack', () => {
  it('generates copy-ready Schema.org JSON-LD and meta tags', () => {
    const page = {
      title: 'Guide to Clean Architecture',
      byline: 'Jane Engineer',
      siteName: 'DevPortal',
      wordCount: 500,
      charCount: 3000,
      truncated: false,
      publishedTime: '2025-01-01',
      lang: 'en',
      headings: ['Intro'],
      extractionStrategy: 'readability',
    };

    render(<AiFixPack page={page} url="https://example.com/guide" />);

    expect(screen.getByText('One-Click AI Optimization Fix Pack')).toBeInTheDocument();
    expect(screen.getByText('1. Schema.org JSON-LD Microdata')).toBeInTheDocument();
    expect(screen.getByText('2. Semantic Head Metadata')).toBeInTheDocument();
    expect(screen.getByText('3. AI Crawler Directives (robots.txt)')).toBeInTheDocument();
    expect(screen.getByText('4. Agent Accessible Action Markup')).toBeInTheDocument();
  });

  it('supports copying snippet and full bundle to clipboard', () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    const page = {
      title: 'Test',
      byline: null,
      siteName: null,
      wordCount: 100,
      charCount: 600,
      truncated: false,
      publishedTime: null,
      lang: null,
      headings: [],
      extractionStrategy: 'readability',
    };

    render(<AiFixPack page={page} url="https://example.com" />);

    const copyBundleBtn = screen.getByRole('button', { name: 'Copy Complete AI Bundle' });
    fireEvent.click(copyBundleBtn);

    expect(writeTextMock).toHaveBeenCalled();
    expect(screen.getByText('✓ Complete Bundle Copied')).toBeInTheDocument();
  });
});

describe('AcademicExportHub', () => {
  it('renders LaTeX table, BibTeX citation, and methodology paragraph', () => {
    const result = benchmarkResultFixture();
    render(<AcademicExportHub result={result} />);

    expect(screen.getByText('Academic Research & Publication Export Hub')).toBeInTheDocument();
    expect(screen.getByText('LaTeX Table (booktabs)')).toBeInTheDocument();
    expect(screen.getByText('BibTeX Citation')).toBeInTheDocument();
    expect(
      screen.getByText('Scientific Evaluation Methodology (Paper Paragraph)'),
    ).toBeInTheDocument();
  });

  it('copies BibTeX citation to clipboard', () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    const result = benchmarkResultFixture();
    render(<AcademicExportHub result={result} />);

    const copyBibtexBtn = screen.getByRole('button', { name: 'Copy BibTeX' });
    fireEvent.click(copyBibtexBtn);

    expect(writeTextMock).toHaveBeenCalled();
    expect(screen.getByText('✓ Copied')).toBeInTheDocument();
  });
});

describe('ResultsPanel Tab Navigation', () => {
  it('allows switching between tabs', () => {
    const result = benchmarkResultFixture();
    render(<ResultsPanel result={result} />);

    // Switch to Heading Outline tab
    const outlineTabBtn = screen.getByRole('button', { name: /Heading Outline/ });
    fireEvent.click(outlineTabBtn);
    expect(screen.getByText('Document Outline & Heading Hierarchy')).toBeInTheDocument();

    // Switch to AI Fix Pack tab
    const fixPackTabBtn = screen.getByRole('button', { name: 'AI Fix Pack' });
    fireEvent.click(fixPackTabBtn);
    expect(screen.getByText('One-Click AI Optimization Fix Pack')).toBeInTheDocument();

    // Switch to Academic & BibTeX tab
    const academicTabBtn = screen.getByRole('button', { name: 'Academic & BibTeX' });
    fireEvent.click(academicTabBtn);
    expect(screen.getByText('Academic Research & Publication Export Hub')).toBeInTheDocument();

    // Switch back to Overview & Answers tab
    const overviewTabBtn = screen.getByRole('button', { name: 'Overview & Answers' });
    fireEvent.click(overviewTabBtn);
    expect(screen.getByText('Scores')).toBeInTheDocument();
  });
});
