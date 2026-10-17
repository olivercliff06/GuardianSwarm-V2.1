import { z } from 'zod';

export const riskSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'INSUFFICIENT_EVIDENCE']);
export type Risk = z.infer<typeof riskSchema>;
export const evidenceSchema = z.object({
  id: z.string(), source: z.string(), summary: z.string(),
  verificationStatus: z.enum(['VERIFIED', 'UNVERIFIED', 'REJECTED']),
  blockNumber: z.string().optional(), transactionHash: z.string().optional(), url: z.string().url().optional()
});
export type Evidence = z.infer<typeof evidenceSchema>;
export const assessmentSchema = z.object({
  agent: z.string(), runtime: z.enum(['backend-local', 'studio-local', 'studio-deployed', 'fixture']),
  verdict: riskSchema, confidence: z.number().min(0).max(1), reasoning: z.string(),
  evidence: z.array(evidenceSchema), steps: z.array(z.string()), latencyMs: z.number().nonnegative(),
  estimatedCostUsd: z.number().nonnegative()
});
export type Assessment = z.infer<typeof assessmentSchema>;
export const reportSchema = z.object({
  investigationId: z.string(), mode: z.enum(['demo', 'live', 'historical']), scenarioId: z.string().optional(),
  network: z.string(), poolAddress: z.string(), tokenPair: z.string(), startedAt: z.string(), completedAt: z.string(),
  anomaly: z.object({ type: z.string(), changePercent: z.number().nullable(), windowMinutes: z.number().nullable() }),
  baseline: assessmentSchema, security: assessmentSchema, verification: assessmentSchema,
  arbitration: assessmentSchema.optional(), finalRisk: riskSchema, recommendation: z.string(),
  disagreement: z.boolean(), inputEvidenceHash: z.string(), dataProvenance: z.enum(['FIXTURE','LIVE_RPC','HISTORICAL_RPC','CACHED_HISTORICAL']),
  chainWindow: z.object({ fromBlock:z.string(), toBlock:z.string(), transactionHash:z.string().optional(), eventCounts:z.object({mint:z.number().nullable(),burn:z.number().nullable(),swap:z.number().nullable(),sync:z.number().nullable()}), sourceUrl:z.string().url().optional() }).optional(),
  metrics: z.object({ evidenceVerificationRate: z.number(), latencyMs: z.number(), estimatedCostUsd: z.number() }),
  limitations: z.array(z.string())
});
export type InvestigationReport = z.infer<typeof reportSchema>;
export const startRequestSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('demo'), scenarioId: z.enum(['normal', 'withdrawal', 'migration']) }),
  z.object({ mode: z.literal('live'), poolAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/) }),
  z.object({ mode: z.literal('historical'), preset:z.enum(['cut-attack']) })
]);
export type StartRequest = z.infer<typeof startRequestSchema>;
export type InvestigationStatus = 'queued' | 'liquidity' | 'baseline' | 'security' | 'verification' | 'arbitration' | 'completed' | 'failed';
export interface InvestigationState { id: string; status: InvestigationStatus; progress: number; message: string; report?: InvestigationReport; error?: string; }
