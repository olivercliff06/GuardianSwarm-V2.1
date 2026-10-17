import { createPublicClient, http, getAddress, type Address } from 'viem';
import { bsc } from 'viem/chains';
import type { Evidence } from './contracts.js';

const pairAbi = [
  { type: 'function', name: 'token0', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'token1', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'getReserves', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint112' }, { type: 'uint112' }, { type: 'uint32' }] }
] as const;
const erc20Abi = [
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] }
] as const;

export async function inspectLivePool(pool: string) {
  const rpc = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org';
  const client = createPublicClient({ chain: bsc, transport: http(rpc, { timeout: 12_000 }) });
  const address = getAddress(pool) as Address;
  const code = await client.getCode({ address });
  if (!code || code === '0x') throw new Error('Address is not a deployed contract on BNB Smart Chain.');
  const [token0, token1, reserves, block] = await Promise.all([
    client.readContract({ address, abi: pairAbi, functionName: 'token0' }),
    client.readContract({ address, abi: pairAbi, functionName: 'token1' }),
    client.readContract({ address, abi: pairAbi, functionName: 'getReserves' }), client.getBlockNumber()
  ]);
  const safeSymbol = async (token: Address) => {
    try { const s = await client.readContract({ address: token, abi: erc20Abi, functionName: 'symbol' }); return String(s).slice(0, 20).replace(/[^\w.$-]/g, '?'); }
    catch { return `${token.slice(0, 6)}…`; }
  };
  const [symbol0, symbol1] = await Promise.all([safeSymbol(token0), safeSymbol(token1)]);
  const evidence: Evidence[] = [
    { id: 'live-contract', source: `bsc-rpc:${new URL(rpc).host}`, summary: `Pair interface verified at block ${block}.`, verificationStatus: 'VERIFIED', blockNumber: block.toString(), url: `https://bscscan.com/address/${address}` },
    { id: 'live-reserves', source: 'pair:getReserves', summary: `Raw reserves: ${reserves[0].toString()} / ${reserves[1].toString()}.`, verificationStatus: 'VERIFIED', blockNumber: block.toString() }
  ];
  return { poolAddress: address, tokenPair: `${symbol0}/${symbol1}`, evidence, block: block.toString() };
}
