# BNB Agent Studio integration status

Status in this build: **not installed / not deployed**.

The build environment was inspected for `bnb-agent` and `bnb-agent-studio` executables; neither was available. Therefore this project does not invent an SDK method, endpoint, deployment, or ERC-8004 identity.

The current logical agents run through the backend-local orchestrator. To integrate Studio responsibly:

1. Install the official CLI using the current official BNB Agent Studio instructions.
2. Record the CLI version and generated project convention.
3. Scaffold a Security Agent using the CLI rather than hand-writing an assumed SDK.
4. Map the shared Zod evidence envelope to the officially supported A2A or MCP interface.
5. Keep the independent verifier's request free of the Security verdict.
6. Configure its endpoint only on the backend; never bundle credentials in the extension.
7. Register ERC-8004 only on BSC Testnet if the installed runtime supports it, and record the real identity and transaction.
8. Change the runtime label to `studio-local` or `studio-deployed` only after a successful health/invocation test.

Until then, the UI truth panel intentionally reports `NOT INSTALLED` and `NOT REGISTERED`.
