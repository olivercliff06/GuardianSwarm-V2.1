import { describe, expect, it } from 'vitest';
import { executeInvestigation, materiallyDisagree } from '../src/orchestrator.js';
import { runBenchmark } from '../src/benchmark.js';

describe('Guardian Swarm orchestration', () => {
  it('triggers arbitration for conflicting migration assessments', async () => {
    const report = await executeInvestigation({ mode: 'demo', scenarioId: 'migration' }, 0);
    expect(report.security.verdict).toBe('HIGH'); expect(report.verification.verdict).toBe('LOW');
    expect(report.disagreement).toBe(true); expect(report.arbitration?.verdict).toBe('MEDIUM');
    expect(report.inputEvidenceHash).toHaveLength(64);
  });
  it('does not arbitrate matching independent assessments', async () => {
    const report = await executeInvestigation({ mode: 'demo', scenarioId: 'normal' }, 0);
    expect(report.arbitration).toBeUndefined(); expect(report.finalRisk).toBe('LOW');
  });
  it('never treats a rejected reference as verified', async () => {
    const report = await executeInvestigation({ mode: 'demo', scenarioId: 'migration' }, 0);
    expect(report.verification.evidence.find(e => e.id === 'e4')?.verificationStatus).toBe('REJECTED');
  });
  it('handles insufficient evidence as material disagreement', () => expect(materiallyDisagree('HIGH', 'INSUFFICIENT_EVIDENCE')).toBe(true));
  it('emits transparent benchmark limitations', async () => {
    const result = await runBenchmark(); expect(result.datasetSize).toBe(3); expect(result.limitation).toContain('cannot establish');
  });
  it('labels the offline historical replay instead of presenting it as live RPC', async () => {
    process.env.HISTORICAL_FORCE_CACHE='true';
    const report=await executeInvestigation({mode:'historical',preset:'cut-attack'},0);
    delete process.env.HISTORICAL_FORCE_CACHE;
    expect(report.dataProvenance).toBe('CACHED_HISTORICAL');
    expect(report.finalRisk).toBe('HIGH');
    expect(report.chainWindow?.transactionHash).toBe('0x2c123d08ca3d50c4b875c0b5de1b5c85d0bf9979dffbf87c48526e3a67396827');
  });
});
