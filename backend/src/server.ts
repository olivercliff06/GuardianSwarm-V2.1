import Fastify from 'fastify';
import cors from '@fastify/cors';
import { startRequestSchema } from './contracts.js';
import { startInvestigation, store } from './orchestrator.js';
import { runBenchmark } from './benchmark.js';
import { probeAgentStudio } from './agentStudio.js';

const app = Fastify({ logger: true });
const configured = (process.env.TRUSTED_ORIGINS || 'http://localhost:5173').split(',');
await app.register(cors, { origin(origin, cb) { if (!origin || origin.startsWith('chrome-extension://') || configured.includes(origin)) cb(null, true); else cb(new Error('Origin not allowed'), false); } });
app.get('/health', async () => {
  const agentStudio = await probeAgentStudio();
  return { ok: true, network: 'BNB Smart Chain', agentStudio, runtime: agentStudio.available ? agentStudio.status : 'backend-local' };
});
app.post('/api/investigations', async (request, reply) => {
  const parsed = startRequestSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid investigation request', details: parsed.error.flatten() });
  return reply.code(202).send(startInvestigation(parsed.data));
});
app.get('/api/investigations/:id', async (request, reply) => {
  const state = store.get((request.params as { id: string }).id);
  return state ?? reply.code(404).send({ error: 'Investigation not found' });
});
app.get('/api/benchmark', async () => runBenchmark());
const port = Number(process.env.PORT || 8787);
await app.listen({ port, host: '127.0.0.1' });
