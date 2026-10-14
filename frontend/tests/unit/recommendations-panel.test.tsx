import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RecommendationsPanel } from '@/components/RecommendationsPanel';
import { ResultsPanel } from '@/components/ResultsPanel';
import type { AIReadinessScore, Optimization } from '@/lib/types';
import { benchmarkResultFixture } from '../helpers/fixture';

const sampleReadiness: AIReadinessScore = {
  overall: 82,
  grade: 'B',
  breakdown: {
    structure: 85,
    metadata: 75,
    contentDensity: 90,
    affordance: 70,
  },
};

const sampleOptimizations: Optimization[] = [
  {
    id: 'opt-jsonld',
    category: 'METADATA',
    severity: 'CRITICAL',
    title: 'Embed Schema.org Structured Data',
    explanation: 'No JSON-LD structured metadata was detected on the page.',
    action: 'Add a <script type="application/ld+json"> tag in your <head>.',
    targetModels: ['openai', 'claude', 'gemini'],
    codeSnippet: '<script type="application/ld+json">{"@context":"https://schema.org"}</script>',
  },
  {
    id: 'opt-claude-density',
    category: 'CONTENT_DENSITY',
    severity: 'IMPORTANT',
    title: 'Preserve Key Context in Initial Viewport',
    explanation: 'Long boilerplate header sections delay core content delivery.',
    action: 'Ensure high information density before interactive widgets.',
    targetModels: ['claude'],
  },
  {
    id: 'opt-affordances-openai',
    category: 'AFFORDANCE',
    severity: 'BEST_PRACTICE',
    title: 'Expose Semantic Action Targets',
    explanation: 'Div-based buttons fail accessibility and agent tree inspection.',
    action: 'Use standard <button> or <a> tags with explicit accessible names.',
    targetModels: ['openai'],
  },
];

describe('RecommendationsPanel', () => {
  it('renders null when readiness or optimizations are omitted', () => {
    const { container: c1 } = render(<RecommendationsPanel />);
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(
      <RecommendationsPanel readiness={sampleReadiness} optimizations={[]} />,
    );
    expect(c2.firstChild).toBeNull();
  });

  it('renders overall readiness score and grade badge', () => {
    render(
      <RecommendationsPanel readiness={sampleReadiness} optimizations={sampleOptimizations} />,
    );

    expect(screen.getByText('82/100')).toBeInTheDocument();
    expect(screen.getByText('Grade B')).toBeInTheDocument();
    expect(screen.getByText('Structure & Headings')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('Metadata & Entity Grounding')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('renders all optimization items with severity and target models', () => {
    render(
      <RecommendationsPanel readiness={sampleReadiness} optimizations={sampleOptimizations} />,
    );

    expect(screen.getByText('Embed Schema.org Structured Data')).toBeInTheDocument();
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    expect(screen.getByText('Preserve Key Context in Initial Viewport')).toBeInTheDocument();
    expect(screen.getByText('IMPORTANT')).toBeInTheDocument();
    expect(screen.getByText('Expose Semantic Action Targets')).toBeInTheDocument();
    expect(screen.getByText('BEST_PRACTICE')).toBeInTheDocument();
  });

  it('filters optimization cards by target model', () => {
    render(
      <RecommendationsPanel readiness={sampleReadiness} optimizations={sampleOptimizations} />,
    );

    // Initially all 3 are visible
    expect(screen.getByText('Embed Schema.org Structured Data')).toBeInTheDocument();
    expect(screen.getByText('Preserve Key Context in Initial Viewport')).toBeInTheDocument();
    expect(screen.getByText('Expose Semantic Action Targets')).toBeInTheDocument();

    // Filter by Claude only
    const claudeFilterBtn = screen.getByRole('button', { name: 'Claude' });
    fireEvent.click(claudeFilterBtn);

    expect(screen.getByText('Embed Schema.org Structured Data')).toBeInTheDocument(); // targetModels has claude
    expect(screen.getByText('Preserve Key Context in Initial Viewport')).toBeInTheDocument(); // claude only
    expect(screen.queryByText('Expose Semantic Action Targets')).toBeNull(); // openai only

    // Filter by ChatGPT only
    const chatGptFilterBtn = screen.getByRole('button', { name: 'ChatGPT' });
    fireEvent.click(chatGptFilterBtn);

    expect(screen.getByText('Embed Schema.org Structured Data')).toBeInTheDocument();
    expect(screen.queryByText('Preserve Key Context in Initial Viewport')).toBeNull();
    expect(screen.getByText('Expose Semantic Action Targets')).toBeInTheDocument();

    // Switch back to All Models
    const allFilterBtn = screen.getByRole('button', { name: 'All Models' });
    fireEvent.click(allFilterBtn);

    expect(screen.getByText('Preserve Key Context in Initial Viewport')).toBeInTheDocument();
  });

  it('renders inside ResultsPanel when results include readiness and optimizations', () => {
    const fixture = benchmarkResultFixture({
      readiness: sampleReadiness,
      optimizations: sampleOptimizations,
    });

    render(<ResultsPanel result={fixture} />);

    expect(screen.getByText('AI Web Readability & Discoverability')).toBeInTheDocument();
    expect(screen.getByText('82/100')).toBeInTheDocument();
    expect(screen.getByText('Grade B')).toBeInTheDocument();
  });
});
