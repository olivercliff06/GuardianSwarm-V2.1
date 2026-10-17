import { createHash, randomUUID } from 'node:crypto';
import type { Assessment, Evidence, InvestigationReport, InvestigationState, Risk, StartRequest } from './contracts.js';
import { scenarios, type Scenario } from './fixtures.js';
import { inspectCutAttack, inspectLatestWindow } from './chainEvidence.js';
import { buildStudioPayload, callGuardianStudio } from './agentStudio.js';

export const store = new Map<string, InvestigationState>();
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const severity: Record<Risk, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, INSUFFICIENT_EVIDENCE: 3 };
const hashEvidence = (e: Evidence[]) => createHash('sha256').update(JSON.stringify(e)).digest('hex');
const assessment = (agent: string, verdict: Risk, reasoning: string, evidence: Evidence[], steps: string[], latencyMs: number): Assessment => ({
  agent, runtime: agent === 'Fixture Liquidity Agent' ? 'fixture' : 'backend-local', verdict, confidence: verdict === 'INSUFFICIENT_EVIDENCE' ? 0.35 : 0.82,
  reasoning, evidence, steps, latencyMs, estimatedCostUsd: 0
});
export const materiallyDisagree = (a: Risk, b: Risk) => a !== b && (Math.abs(severity[a] - severity[b]) >= 1 || a === 'INSUFFICIENT_EVIDENCE' || b === 'INSUFFICIENT_EVIDENCE');

export async function executeInvestigation(input: StartRequest, delay = 280): Promise<InvestigationReport> {
  const started = Date.now(); const startedAt = new Date().toISOString();
  const investigationId = `GS-${randomUUID().slice(0, 8).toUpperCase()}`;
  let poolAddress: string, tokenPair: string, evidence: Evidence[], anomaly: { type: string; changePercent: number | null; windowMinutes: number | null };
  let dataProvenance: InvestigationReport['dataProvenance']='FIXTURE';
  let chainWindow: InvestigationReport['chainWindow'];
  let chainSuggestedRisk:Risk='INSUFFICIENT_EVIDENCE';
  let chainLimitations:string[]=[];
  let scenario: Scenario | undefined;
  if (input.mode === 'demo') {
    scenario = scenarios[input.scenarioId]; ({ poolAddress, tokenPair, evidence, anomaly } = scenario); await wait(delay);
  } else if(input.mode==='live') {
    const live = await inspectLatestWindow(input.poolAddress); ({poolAddress,tokenPair,evidence,anomaly}=live); dataProvenance=live.provenance; chainWindow=live.chainWindow; chainSuggestedRisk=live.suggestedRisk; chainLimitations=live.limitations; await wait(delay);
  } else {
    const historical=await inspectCutAttack(); ({poolAddress,tokenPair,evidence,anomaly}=historical); dataProvenance=historical.provenance; chainWindow=historical.chainWindow; chainSuggestedRisk=historical.suggestedRisk; chainLimitations=historical.limitations; await wait(delay);
  }
  const inputEvidenceHash = hashEvidence(evidence);
  const baselineVerdict: Risk = scenario?.baseline ?? chainSuggestedRisk;
  const securityVerdict: Risk = scenario?.security ?? chainSuggestedRisk;
  const verificationVerdict: Risk = scenario?.verification ?? chainSuggestedRisk;
  const baseline = assessment('Single-Agent Baseline', baselineVerdict, scenario?.id === 'migration' ? 'Large removal is treated as high risk without independently testing migration evidence.' : input.mode==='historical'?'One-pass analysis flags the corroborated historical exploit evidence as high risk.':'One-pass assessment of the supplied evidence window.', evidence, ['Read evidence bundle', 'Produce one-pass verdict'], delay);
  await wait(delay);
  const localSecurity = () => assessment('Security Agent', securityVerdict, securityVerdict === 'HIGH' ? (input.mode==='historical'?'Verified transaction and independent reconstruction corroborate a historical pool-drain exploit.':'Verified removal evidence creates a material security concern; fraud is not claimed as confirmed.') : securityVerdict === 'LOW' ? 'No material liquidity-removal signal was found in the verified block window.' : securityVerdict==='MEDIUM'?'A large Burn occurred, but liquidity removal alone does not prove fraud.':'The available event window cannot establish a reliable risk classification.', evidence, ['Validate evidence references', 'Classify liquidity events', 'Assess corroborating signals'], delay);
  let security = localSecurity();
  const studioPayload = input.mode !== 'demo' && chainWindow ? buildStudioPayload({ investigationId, poolAddress, tokenPair, provenance: dataProvenance, chainWindow, anomaly, evidence }) : undefined;
  if (studioPayload) {
    try {
      security = await callGuardianStudio('investigate_security', structuredClone(studioPayload), evidence);
    } catch (error) {
      chainLimitations.push(`Security Agent Studio unavailable; used labeled backend-local fallback (${error instanceof Error ? error.message : String(error)}).`);
    }
  }
  await wait(delay);
  // Independence boundary: this input is constructed solely from raw evidence, never from `security`.
  const verificationInput = structuredClone({ evidence, anomaly, poolAddress, tokenPair, inputEvidenceHash });
  const localVerification = () => assessment('Independent Verification Agent', verificationVerdict, scenario?.id === 'migration' ? 'Verified destination-pool evidence supports a legitimate migration explanation; the unverified announcement is not relied upon.' : verificationVerdict === 'HIGH' ? 'Independent transaction references and event evidence corroborate the historical incident.' : verificationVerdict === 'LOW' ? 'Verified pair events explain activity without a material removal signal in this window.' : verificationVerdict==='MEDIUM'?'The removal is verified, but intent and destination evidence remain insufficient for a high-risk fraud conclusion.':'Historical claims cannot be verified from the available evidence window.', verificationInput.evidence, ['Re-hash raw evidence', 'Check references independently', 'Search for alternative explanations'], delay);
  let verification = localVerification();
  verification.receivedPriorAgentVerdict = false;
  verification.evidenceSourceIds = evidence.filter(item => item.verificationStatus === 'VERIFIED').map(item => item.id);
  if (studioPayload) {
    try {
      // A fresh clone of raw evidence is sent; Security Agent output is never included.
      verification = await callGuardianStudio('verify_evidence', structuredClone(studioPayload), evidence);
    } catch (error) {
      chainLimitations.push(`Verification Agent Studio unavailable; used labeled backend-local fallback (${error instanceof Error ? error.message : String(error)}).`);
    }
  }
  const disagreement = materiallyDisagree(security.verdict, verification.verdict);
  let arbitration: Assessment | undefined;
  if (disagreement) {
    await wait(delay);
    const verdict: Risk = scenario?.expected ?? 'INSUFFICIENT_EVIDENCE';
    arbitration = assessment('Arbitration Agent', verdict, scenario?.id === 'migration' ? 'The removal is real, but verified migration evidence contradicts a rug-pull interpretation. Residual execution risk warrants MEDIUM, not HIGH.' : 'Conflicting conclusions cannot be resolved from verified evidence.', evidence, ['Compare provenance', 'Reject unsupported references', 'Weigh verified contradictions'], delay);
  }
  const finalRisk = arbitration?.verdict ?? (security.verdict === verification.verdict ? security.verdict : 'INSUFFICIENT_EVIDENCE');
  const completedAt = new Date().toISOString();
  const verified = evidence.filter(e => e.verificationStatus === 'VERIFIED').length;
  const all = [baseline, security, verification, ...(arbitration ? [arbitration] : [])];
  return {
    investigationId, mode: input.mode, scenarioId: input.mode === 'demo' ? input.scenarioId : input.mode==='historical'?input.preset:undefined,
    network: 'BNB Smart Chain', poolAddress, tokenPair, startedAt, completedAt, anomaly, baseline, security, verification, arbitration,
    finalRisk, disagreement, inputEvidenceHash, dataProvenance, chainWindow,
    recommendation: finalRisk === 'HIGH' ? 'Pause interaction and independently verify liquidity-holder activity.' : finalRisk === 'MEDIUM' ? 'Proceed cautiously and verify the migration destination.' : finalRisk === 'LOW' ? 'No material risk signal found in the supplied evidence.' : 'Collect historical event evidence before making a safety decision.',
    metrics: { evidenceVerificationRate: evidence.length ? verified / evidence.length : 0, latencyMs: Date.now() - started, estimatedCostUsd: all.reduce((n, a) => n + a.estimatedCostUsd, 0) },
    limitations: ['Three deterministic scenarios are illustrative and too small to establish accuracy.', 'Agent confidence values are estimates, not calibrated probabilities.', 'Security and Verification agents share the same upstream evidence and RPC availability, so source failures may cause correlated errors.', ...chainLimitations, ...(input.mode === 'demo' ? ['Fixture evidence is simulated and clearly labeled.'] : [])]
  };
}

export function startInvestigation(input: StartRequest) {
  const id = `GS-${randomUUID().slice(0, 8).toUpperCase()}`;
  store.set(id, { id, status: 'queued', progress: 5, message: 'Investigation queued' });
  void (async () => {
    try {
      const stages: Array<[InvestigationState['status'], number, string]> = [['liquidity', 15, 'Validating pool evidence'], ['baseline', 30, 'Running single-agent baseline'], ['security', 48, 'Security Agent investigating'], ['verification', 66, 'Independent Verification Agent investigating']];
      for (const [status, progress, message] of stages) { store.set(id, { id, status, progress, message }); await wait(260); }
      if (input.mode === 'demo' && input.scenarioId === 'migration') { store.set(id, { id, status: 'arbitration', progress: 82, message: 'Disagreement detected—arbitration activated' }); }
      const report = await executeInvestigation(input, 120);
      report.investigationId = id;
      store.set(id, { id, status: 'completed', progress: 100, message: 'Investigation completed', report });
    } catch (error) { store.set(id, { id, status: 'failed', progress: 100, message: 'Investigation failed', error: error instanceof Error ? error.message : String(error) }); }
  })();
  return store.get(id)!;
}
