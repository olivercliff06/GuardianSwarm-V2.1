# Guardian Swarm V2

> Don't Trust One Agent. Let the Swarm Investigate.

Guardian Swarm V2 is a judge-ready Chrome Manifest V3 side-panel extension and Node.js backend for evidence-backed BNB Smart Chain liquidity-pool investigations. It compares a single-agent baseline with independent Security and Verification assessments, then invokes Arbitration only when their verdicts materially disagree.

## What V2 adds

- **Live Latest** retrieves real `Mint`, `Burn`, `Swap`, and `Sync` events across a configurable recent block window.
- **Historical Replay** analyzes the real CUT/BUSD incident at BSC block `42,131,696` and transaction `0x2c123…96827`.
- Historical Replay is RPC-first. When an archive RPC cannot return the old block, it falls back to a cached evidence envelope and labels the report `CACHED HISTORICAL`—never `LIVE`.
- Reports show provenance, block range, event counts, transaction references, and source links.
- V1's deterministic fixture scenarios remain available and unchanged.

## What is real in this build

- The Chrome extension, backend orchestration, report export, evaluation endpoint, three demo scenarios, and automated tests are functional.
- Live mode performs read-only BNB Smart Chain RPC calls against a supplied PancakeSwap V2-compatible pair, verifies the pair interface, reads current reserves, analyzes a recent event window, and links to BscScan.
- Demo evidence is deterministic and visibly labeled `FIXTURE`.
- All logical AI roles currently use transparent deterministic/backend-local policy logic. No external LLM is required.
- **BNB Agent Studio is not installed in the build environment and is not represented as deployed.** The Status screen states this explicitly. See `docs/BNB_AGENT_STUDIO.md` for the honest integration boundary.
- No ERC-8004 identity has been registered.

## Quick start on Windows

Requirements: Node.js 20+ and npm 10+.

```cmd
cd GuardianSwarm
copy .env.example .env
npm install
npm test
npm run build
npm start
```

Keep the backend terminal open. It listens on `http://127.0.0.1:8787`.

### Load the extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `extension\dist` directory.
5. Pin Guardian Swarm and click its icon. Chrome opens the side panel.

If the backend is online, the header displays **Backend online**.

## Judge demo (about 90 seconds)

1. Start the backend and open the extension.
2. Keep **Fixtures** selected.
3. Select **C · Conflicting migration** and click **Investigate pool**.
4. Point out the independent timeline: baseline → security → verification → arbitration.
5. In the report, compare baseline `HIGH` with swarm `MEDIUM`.
6. Explain that the verifier sees raw evidence—not Security's verdict—and identifies a verified destination-pool deposit.
7. Show that the fake transaction reference is `REJECTED`, not allowed to become a verified finding.
8. Export the timestamped JSON report.
9. Open **Status** to show the truthful deployment/runtime labels.

The demo illustrates investigative value by exposing an alternative explanation and reducing an unsupported high-risk conclusion. The three-case benchmark is too small to claim improved real-world accuracy.

### Real-data judge sequence

1. Use **Live latest** with WBNB/USDT pair `0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE`.
2. Show the live block range and event counts. A LOW result means only that no material signal was found in that analyzed window.
3. Use **Historical** to replay the CUT/BUSD incident.
4. Show whether provenance is `HISTORICAL RPC` or the explicit `CACHED HISTORICAL` fallback.
5. Open the transaction source and export the JSON report.

## API

```text
GET  /health
POST /api/investigations
GET  /api/investigations/:id
GET  /api/benchmark
```

Demo request:

```json
{ "mode": "demo", "scenarioId": "migration" }
```

Live-latest request:

```json
{ "mode": "live", "poolAddress": "0x..." }
```

Historical request:

```json
{ "mode": "historical", "preset": "cut-attack" }
```

## Benchmark semantics

`GET /api/benchmark` evaluates identical evidence bundles for both the baseline and the swarm. It reports verdicts, exact-label correctness, false positives, false negatives, evidence verification rate, latency, and estimated cost. Cost is `$0` because this build uses deterministic local policies; it must be configured from measured provider token usage when an LLM is connected.

The dataset contains only three curated fixtures:

| Scenario | Expected | Baseline | Swarm | Arbitration |
|---|---:|---:|---:|---:|
| Normal activity | LOW | LOW | LOW | No |
| Suspicious withdrawal | HIGH | HIGH | HIGH | No |
| Legitimate migration conflict | MEDIUM | HIGH | MEDIUM | Yes |

This table is an illustrative functional test, not proof of improved accuracy.

## Agent-independence guarantee

The orchestrator constructs the Verification input from a structured clone of the raw evidence, anomaly, pool, pair, and evidence hash. The `security` assessment object is never included. The verifier logs independent steps and preserves evidence provenance. Both agents still share code, RPC providers, fixtures, schemas, and host infrastructure, so correlated failures remain possible.

## Security

- No wallet permission, wallet connection, signing, trading, or custody.
- Strict Manifest V3 CSP; no remotely hosted executable scripts.
- User input is schema-validated; pool addresses must be 20-byte EVM addresses.
- Token symbols are treated as untrusted and reduced to a safe character set.
- Unsupported references remain `UNVERIFIED` or `REJECTED`.
- CORS is limited to extension origins and configured local development origins.
- Never commit `.env`, API keys, RPC secrets, or private keys.

## Repository layout

```text
extension/  React + TypeScript + Vite + Tailwind side panel
backend/    Fastify API, BSC reads, orchestration, benchmark and tests
shared/     Zod schemas and shared TypeScript contracts
docs/       Architecture and integration truth
```

## Known MVP limitations

- Public RPC providers may rate-limit recent logs or prune old history. Configure an archive-capable `BSC_RPC_URL` for authoritative historical RPC provenance.
- A large verified Burn is classified as concern, not automatically as fraud. HIGH requires corroborating incident evidence.
- In-memory investigation history resets with the backend process. Production should use SQLite or Postgres.
- Deterministic agent policies prove orchestration and evidence boundaries, not autonomous LLM reasoning.
- The current build does not claim BNB Agent Studio deployment or ERC-8004 registration.
