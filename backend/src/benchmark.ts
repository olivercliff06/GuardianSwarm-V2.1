import { scenarios } from './fixtures.js';
import { executeInvestigation } from './orchestrator.js';

export async function runBenchmark() {
  const rows: Array<{ scenario:string; expected:string; baseline:string; swarm:string; baselineCorrect:boolean; swarmCorrect:boolean; evidenceVerificationRate:number; latencyMs:number; estimatedCostUsd:number }> = [];
  for (const scenario of Object.values(scenarios)) {
    const report = await executeInvestigation({ mode: 'demo', scenarioId: scenario.id }, 0);
    rows.push({ scenario: scenario.id, expected: scenario.expected, baseline: report.baseline.verdict, swarm: report.finalRisk, baselineCorrect: report.baseline.verdict === scenario.expected, swarmCorrect: report.finalRisk === scenario.expected, evidenceVerificationRate: report.metrics.evidenceVerificationRate, latencyMs: report.metrics.latencyMs, estimatedCostUsd: report.metrics.estimatedCostUsd });
  }
  const isPositive = (v: string) => v === 'HIGH';
  const score = (key: 'baseline' | 'swarm') => ({
    falsePositives: rows.filter(r => isPositive(r[key]) && !isPositive(r.expected)).length,
    falseNegatives: rows.filter(r => !isPositive(r[key]) && isPositive(r.expected)).length,
    correct: rows.filter(r => r[key] === r.expected).length
  });
  return { generatedAt: new Date().toISOString(), datasetSize: rows.length, rows, baseline: score('baseline'), swarm: score('swarm'), limitation: 'This three-case deterministic benchmark is illustrative and cannot establish real-world accuracy.' };
}
