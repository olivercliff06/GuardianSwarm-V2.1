import { z } from 'zod';
export const riskSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'INSUFFICIENT_EVIDENCE']);
export type Risk = z.infer<typeof riskSchema>;
export const evidenceSchema = z.object({ id: z.string(), source: z.string(), summary: z.string(), verificationStatus: z.enum(['VERIFIED','UNVERIFIED','REJECTED']), blockNumber: z.string().optional(), transactionHash: z.string().optional(), url: z.string().url().optional() });
export type Evidence = z.infer<typeof evidenceSchema>;
export interface Assessment { agent:string; runtime:'backend-local'|'studio-local'|'studio-deployed'|'fixture'; verdict:Risk; confidence:number; reasoning:string; evidence:Evidence[]; evidenceSourceIds?:string[]; steps:string[]; receivedPriorAgentVerdict?:boolean; agentTimestamp?:string; latencyMs:number; estimatedCostUsd:number; }
export type DataProvenance='FIXTURE'|'LIVE_RPC'|'HISTORICAL_RPC'|'CACHED_HISTORICAL';
export interface ChainWindow { fromBlock:string; toBlock:string; transactionHash?:string; eventCounts:{mint:number|null;burn:number|null;swap:number|null;sync:number|null}; sourceUrl?:string; }
export interface InvestigationReport { investigationId:string; mode:'demo'|'live'|'historical'; scenarioId?:string; network:string; poolAddress:string; tokenPair:string; startedAt:string; completedAt:string; anomaly:{type:string;changePercent:number|null;windowMinutes:number|null}; baseline:Assessment; security:Assessment; verification:Assessment; arbitration?:Assessment; finalRisk:Risk; recommendation:string; disagreement:boolean; inputEvidenceHash:string; dataProvenance:DataProvenance; chainWindow?:ChainWindow; metrics:{evidenceVerificationRate:number;latencyMs:number;estimatedCostUsd:number}; limitations:string[]; }
export const startRequestSchema = z.discriminatedUnion('mode', [z.object({mode:z.literal('demo'),scenarioId:z.enum(['normal','withdrawal','migration'])}),z.object({mode:z.literal('live'),poolAddress:z.string().regex(/^0x[a-fA-F0-9]{40}$/)}),z.object({mode:z.literal('historical'),preset:z.enum(['cut-attack'])})]);
export type StartRequest=z.infer<typeof startRequestSchema>;
export type InvestigationStatus='queued'|'liquidity'|'baseline'|'security'|'verification'|'arbitration'|'completed'|'failed';
export interface InvestigationState{id:string;status:InvestigationStatus;progress:number;message:string;report?:InvestigationReport;error?:string}
