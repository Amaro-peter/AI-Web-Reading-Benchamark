import type { ProviderId } from '../config/env.js';

export type OptimizationCategory = 'STRUCTURE' | 'METADATA' | 'AFFORDANCE' | 'CONTENT_DENSITY';

export type OptimizationSeverity = 'CRITICAL' | 'IMPORTANT' | 'BEST_PRACTICE';

export interface Optimization {
  id: string;
  category: OptimizationCategory;
  severity: OptimizationSeverity;
  targetModels: ProviderId[];
  title: string;
  explanation: string;
  action: string;
  codeSnippet?: string;
}

export interface ScientificMetrics {
  sid: number;
  hpci: number;
  aac: number;
  dce: number;
  meg: number;
}

export interface AIReadinessScore {
  overall: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: {
    structure: number;
    metadata: number;
    affordance: number;
    contentDensity: number;
  };
  metrics?: ScientificMetrics;
}

export interface OptimizationResult {
  readiness: AIReadinessScore;
  optimizations: Optimization[];
}
