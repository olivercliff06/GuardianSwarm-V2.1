import { randomUUID } from 'node:crypto';
import type { Assessment, ChainWindow, Evidence } from './contracts.js';

export type GuardianStudioSkill = 'investigate_security' | 'verify_evidence';

interface StudioAssessment {
  agent: 'security' | 'verification';
  verdict: Assessment['verdict'];
  confidence: number;
  rationale: string;
  evidence_source_ids: string[];
  investigation_steps: string[];
  runtime: 'bnb-agent-studio';
  received_prior_agent_verdict: false;
  timestamp: string;
}

export interface StudioEvidencePayload {
  investigation_id: string;
  pool_address: string;
  token_pair: string;
  provenance: string;
  chain_window: {
    from_block: string;
    to_block: string;
    event_counts: ChainWindow['eventCounts'];
  };
  anomaly: { type: string; change_percent: number | null };
  evidence: Array<{
    id: string;
    source: string;
    summary: string;
    verification_status: Evidence['verificationStatus'];
    block_number?: string;
    transaction_hash?: string;
  }>;
}

const endpoint = () => (process.env.BNB_AGENT_STUDIO_URL || 'http://127.0.0.1:9000').replace(/\/$/, '');
const timeoutMs = () => Math.max(500, Number(process.env.BNB_AGENT_STUDIO_TIMEOUT_MS || 5000));

async function request(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`Agent Studio HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function findStudioAssessment(value: unknown): StudioAssessment | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (
    record.runtime === 'bnb-agent-studio' &&
    (record.agent === 'security' || record.agent === 'verification') &&
    typeof record.verdict === 'string' &&
    typeof record.rationale === 'string'
  ) return record as unknown as StudioAssessment;
  for (const nested of Object.values(record)) {
    const found = findStudioAssessment(nested);
    if (found) return found;
  }
  return undefined;
}

function findFailure(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (record.state === 'failed') {
    const message = record.message;
    if (message && typeof message === 'object') {
      const parts = (message as Record<string, unknown>).parts;
      if (Array.isArray(parts)) {
        const text = parts.find(part => part && typeof part === 'object' && typeof (part as Record<string, unknown>).text === 'string');
        if (text) return String((text as Record<string, unknown>).text);
      }
    }
    return 'Agent Studio task failed';
  }
  for (const nested of Object.values(record)) {
    const found = findFailure(nested);
    if (found) return found;
  }
  return undefined;
}

export function buildStudioPayload(input: {
  investigationId: string;
  poolAddress: string;
  tokenPair: string;
  provenance: string;
  chainWindow: ChainWindow;
  anomaly: { type: string; changePercent: number | null };
  evidence: Evidence[];
}): StudioEvidencePayload {
  return {
    investigation_id: input.investigationId,
    pool_address: input.poolAddress,
    token_pair: input.tokenPair,
    provenance: input.provenance,
    chain_window: {
      from_block: input.chainWindow.fromBlock,
      to_block: input.chainWindow.toBlock,
      event_counts: structuredClone(input.chainWindow.eventCounts),
    },
    anomaly: { type: input.anomaly.type, change_percent: input.anomaly.changePercent },
    evidence: input.evidence.map(item => ({
      id: item.id,
      source: item.source,
      summary: item.summary,
      verification_status: item.verificationStatus,
      ...(item.blockNumber ? { block_number: item.blockNumber } : {}),
      ...(item.transactionHash ? { transaction_hash: item.transactionHash } : {}),
    })),
  };
}

export async function callGuardianStudio(
  skill: GuardianStudioSkill,
  payload: StudioEvidencePayload,
  evidence: Evidence[],
): Promise<Assessment> {
  const started = Date.now();
  // Each call receives a fresh raw-evidence clone. No baseline, Security Agent,
  // or final verdict is present in the Verification Agent request.
  const data = { skill, ...structuredClone(payload) };
  const body = {
    jsonrpc: '2.0',
    id: randomUUID(),
    method: 'message/send',
    params: {
      message: {
        kind: 'message',
        role: 'user',
        messageId: randomUUID(),
        parts: [{ kind: 'data', data }],
      },
    },
  };
  const response = await request(`${endpoint()}/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = findStudioAssessment(response);
  if (!result) throw new Error(findFailure(response) || 'Agent Studio returned no structured assessment');
  const expectedAgent = skill === 'investigate_security' ? 'security' : 'verification';
  if (result.agent !== expectedAgent) throw new Error(`Agent Studio returned ${result.agent} for ${skill}`);
  if (result.received_prior_agent_verdict !== false) throw new Error('Agent independence assertion missing');
  return {
    agent: expectedAgent === 'security' ? 'Security Agent' : 'Independent Verification Agent',
    runtime: endpoint().includes('127.0.0.1') || endpoint().includes('localhost') ? 'studio-local' : 'studio-deployed',
    verdict: result.verdict,
    confidence: result.confidence,
    reasoning: result.rationale,
    evidence,
    evidenceSourceIds: result.evidence_source_ids,
    steps: result.investigation_steps,
    receivedPriorAgentVerdict: result.received_prior_agent_verdict,
    agentTimestamp: result.timestamp,
    latencyMs: Date.now() - started,
    estimatedCostUsd: 0,
  };
}

export async function probeAgentStudio(): Promise<Record<string, unknown>> {
  try {
    const card = await request(`${endpoint()}/.well-known/agent-card.json`) as Record<string, unknown>;
    const skills = Array.isArray(card.skills)
      ? card.skills.map(skill => skill && typeof skill === 'object' ? (skill as Record<string, unknown>).id : undefined).filter(Boolean)
      : [];
    return {
      available: true,
      status: endpoint().includes('127.0.0.1') || endpoint().includes('localhost') ? 'local-running' : 'deployed-running',
      endpoint: endpoint(),
      agentName: card.name ?? null,
      skills,
      identity: process.env.BNB_AGENT_STUDIO_IDENTITY || null,
    };
  } catch (error) {
    return {
      available: false,
      status: 'unreachable',
      endpoint: endpoint(),
      error: error instanceof Error ? error.message : String(error),
      identity: process.env.BNB_AGENT_STUDIO_IDENTITY || null,
    };
  }
}
