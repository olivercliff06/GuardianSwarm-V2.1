# Architecture

```text
PancakeSwap page ── minimal URL detection ──> Chrome side panel
                                                  │ HTTP polling
                                                  ▼
                                           Fastify backend
                                                  │
                    ┌─────────────────────────────┼────────────────────────────┐
                    ▼                             ▼                            ▼
             Single baseline               Security Agent          Independent Verifier
                                                                              │
                                      material disagreement? ── yes ──> Arbitrator
                                                                              │
                                                                              ▼
                                                              Evidence-backed final report
```

Long-running work stays in the backend rather than the extension service worker. Investigation state is keyed by ID and polled by the side panel. Production should replace the in-memory map with durable storage.

## Independence boundary

Security and Verification receive the same raw evidence and evidence hash. The Verification input is created before its assessment and excludes the Security assessment and verdict. Independence is architectural, not absolute: the agents still share the same codebase, schemas, machine, RPC source, and deterministic fixtures.

## Arbitration policy

Arbitration runs when verdicts differ materially or either side returns insufficient evidence. An agent failure must be represented as a failure/insufficient result, never converted into agreement.
