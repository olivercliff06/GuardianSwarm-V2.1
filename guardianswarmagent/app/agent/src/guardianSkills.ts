import { z } from "zod";

const statusSchema = z.enum(["VERIFIED", "UNVERIFIED", "REJECTED"]);
const eventCountsSchema = z.object({
  mint: z.number().int().nonnegative().nullable(),
  burn: z.number().int().nonnegative().nullable(),
  swap: z.number().int().nonnegative().nullable(),
  sync: z.number().int().nonnegative().nullable(),
});

export const guardianInputShape = {
  investigation_id: z.string().min(1),
  pool_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  token_pair: z.string().min(1),
  provenance: z.string().min(1),
  chain_window: z.object({
    from_block: z.string().min(1),
    to_block: z.string().min(1),
    event_counts: eventCountsSchema,
  }),
  anomaly: z.object({
    type: z.string().min(1),
    change_percent: z.number().nullable(),
  }),
  evidence: z.array(
    z.object({
      id: z.string().min(1),
      source: z.string().min(1),
      summary: z.string().min(1),
      verification_status: statusSchema,
      block_number: z.string().optional(),
      transaction_hash: z.string().optional(),
    }),
  ),
};

const guardianInputSchema = z.object(guardianInputShape).strict();
export type GuardianInput = z.infer<typeof guardianInputSchema>;
type Verdict = "LOW" | "MEDIUM" | "HIGH" | "INSUFFICIENT_EVIDENCE";

export interface GuardianAssessment extends Record<string, unknown> {
  agent: "security" | "verification";
  verdict: Verdict;
  confidence: number;
  rationale: string;
  evidence_source_ids: string[];
  investigation_steps: string[];
  runtime: "bnb-agent-studio";
  received_prior_agent_verdict: false;
  timestamp: string;
}

function parseInput(raw: unknown): GuardianInput {
  if (raw && typeof raw === "object") {
    const { skill: _skill, ...payload } = raw as Record<string, unknown>;
    const forbidden = [
      "security_verdict",
      "security_assessment",
      "baseline_verdict",
      "final_verdict",
    ];
    for (const key of forbidden) {
      if (key in payload) {
        throw new Error(`independence violation: forbidden field ${key}`);
      }
    }
    return guardianInputSchema.parse(payload);
  }
  return guardianInputSchema.parse(raw);
}

function evidenceState(input: GuardianInput) {
  const verified = input.evidence.filter(
    (item) => item.verification_status === "VERIFIED",
  );
  const rejected = input.evidence.filter(
    (item) => item.verification_status === "REJECTED",
  );
  const counts = input.chain_window.event_counts;
  const complete = Object.values(counts).every((value) => value !== null);
  const activity = (counts.swap ?? 0) + (counts.burn ?? 0) + (counts.mint ?? 0);
  const enough = complete && (counts.sync ?? 0) >= 2 && activity > 0;
  return { verified, rejected, counts, enough };
}

export function investigateSecurity(raw: unknown): GuardianAssessment {
  const input = parseInput(raw);
  const state = evidenceState(input);
  let verdict: Verdict = "LOW";
  let confidence = 0.82;
  let rationale =
    "No material liquidity-removal signal was found in the verified block window.";

  if (
    input.anomaly.type === "EXPLOIT_CORROBORATED_POOL_DRAIN" &&
    state.verified.length >= 2
  ) {
    verdict = "HIGH";
    confidence = 0.9;
    rationale =
      "Verified on-chain references and an independent reconstruction corroborate a historical pool-drain exploit.";
  } else if (!state.enough) {
    verdict = "INSUFFICIENT_EVIDENCE";
    confidence = 0.35;
    rationale =
      "The verified event window does not contain enough pair activity for a reliable liquidity-risk classification.";
  } else if (
    input.anomaly.type === "LARGE_LIQUIDITY_REMOVAL" ||
    (state.counts.burn ?? 0) > 0 &&
      input.anomaly.change_percent !== null &&
      input.anomaly.change_percent <= -35
  ) {
    verdict = "MEDIUM";
    confidence = 0.74;
    rationale =
      "A material liquidity-removal signal was observed and requires contextual review; removal alone does not prove malicious intent.";
  }

  return {
    agent: "security",
    verdict,
    confidence,
    rationale,
    evidence_source_ids: state.verified.map((item) => item.id),
    investigation_steps: [
      "Validated the structured evidence envelope and pair address.",
      "Counted verified Mint, Burn, Swap, and Sync events.",
      "Evaluated reserve-change and liquidity-removal signals.",
      "Excluded rejected claims from the verdict.",
    ],
    runtime: "bnb-agent-studio",
    received_prior_agent_verdict: false,
    timestamp: new Date().toISOString(),
  };
}

export function verifyEvidence(raw: unknown): GuardianAssessment {
  const input = parseInput(raw);
  const state = evidenceState(input);
  let verdict: Verdict = "LOW";
  let confidence = 0.82;
  let rationale =
    "Verified pair events independently explain the observed activity without a material removal signal.";

  if (
    input.anomaly.type === "EXPLOIT_CORROBORATED_POOL_DRAIN" &&
    state.verified.length >= 2
  ) {
    verdict = "HIGH";
    confidence = 0.9;
    rationale =
      "Independent verified references corroborate the historical pool-drain incident.";
  } else if (!state.enough || state.verified.length === 0) {
    verdict = "INSUFFICIENT_EVIDENCE";
    confidence = 0.35;
    rationale =
      "The available evidence cannot independently verify a reliable liquidity-risk classification.";
  } else if (
    input.anomaly.type === "LARGE_LIQUIDITY_REMOVAL" ||
    (state.counts.burn ?? 0) > 0 &&
      input.anomaly.change_percent !== null &&
      input.anomaly.change_percent <= -35
  ) {
    verdict = "MEDIUM";
    confidence = 0.76;
    rationale =
      "Independent event checks corroborate a material removal signal, but intent is not established by the event alone.";
  }

  return {
    agent: "verification",
    verdict,
    confidence,
    rationale,
    evidence_source_ids: state.verified.map((item) => item.id),
    investigation_steps: [
      "Parsed evidence without receiving the Security Agent verdict.",
      "Verified event availability and minimum activity independently.",
      "Rejected unsupported or explicitly rejected claims.",
      "Derived an independent verdict from the supplied on-chain facts.",
    ],
    runtime: "bnb-agent-studio",
    received_prior_agent_verdict: false,
    timestamp: new Date().toISOString(),
  };
}
