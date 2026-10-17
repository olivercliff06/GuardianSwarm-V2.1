import { createPublicClient, getAddress, http, parseAbiItem, type Address } from 'viem';
import { bsc } from 'viem/chains';
import type { ChainWindow, DataProvenance, Evidence, Risk } from './contracts.js';
import { inspectLivePool } from './live.js';

const mintEvent = parseAbiItem('event Mint(address indexed sender, uint256 amount0, uint256 amount1)');
const burnEvent = parseAbiItem('event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to)');
const swapEvent = parseAbiItem('event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)');
const syncEvent = parseAbiItem('event Sync(uint112 reserve0, uint112 reserve1)');

export interface ChainEvidenceResult {
  poolAddress:string; tokenPair:string; evidence:Evidence[]; anomaly:{type:string;changePercent:number|null;windowMinutes:number|null};
  suggestedRisk:Risk; provenance:DataProvenance; chainWindow:ChainWindow; limitations:string[];
}

function client() {
  const rpc = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org';
  return { rpc, value:createPublicClient({ chain:bsc, transport:http(rpc, { timeout:15_000, retryCount:2 }) }) };
}

async function fetchLogs(address:Address, fromBlock:bigint, toBlock:bigint) {
  const { value } = client();
  const errors:string[]=[];
  const safe=async <T>(name:string, task:()=>Promise<T[]>):Promise<T[]>=>{try{return await task();}catch(error){errors.push(`${name}: ${error instanceof Error?error.message:String(error)}`);return [];}};
  // Sequential requests are intentional: public BSC endpoints often throttle concurrent eth_getLogs calls.
  const mint=await safe('Mint',()=>value.getLogs({address,event:mintEvent,fromBlock,toBlock}));
  const burn=await safe('Burn',()=>value.getLogs({address,event:burnEvent,fromBlock,toBlock}));
  const swap=await safe('Swap',()=>value.getLogs({address,event:swapEvent,fromBlock,toBlock}));
  const sync=await safe('Sync',()=>value.getLogs({address,event:syncEvent,fromBlock,toBlock}));
  return { mint,burn,swap,sync,errors };
}

const pct = (a:bigint,b:bigint) => Number(a) && Number.isFinite(Number(a)) ? ((Number(b)-Number(a))/Number(a))*100 : null;

export async function inspectLatestWindow(pool:string):Promise<ChainEvidenceResult> {
  const snapshot = await inspectLivePool(pool);
  const { value, rpc } = client();
  const toBlock = await value.getBlockNumber();
  const width = BigInt(Math.max(50, Math.min(2000, Number(process.env.LIVE_BLOCK_WINDOW || 600))));
  const fromBlock = toBlock > width ? toBlock-width : 0n;
  const logs = await fetchLogs(getAddress(pool),fromBlock,toBlock);
  const first=logs.sync.at(0)?.args, last=logs.sync.at(-1)?.args;
  let change:number|null=null;
  if(first?.reserve0!==undefined&&first.reserve1!==undefined&&last?.reserve0!==undefined&&last.reserve1!==undefined){
    const start=Math.sqrt(Number(first.reserve0)*Number(first.reserve1)); const end=Math.sqrt(Number(last.reserve0)*Number(last.reserve1));
    change=Number.isFinite(start)&&start>0?((end-start)/start)*100:null;
  }
  let largestBurn=0;
  if(last?.reserve0!==undefined&&last.reserve1!==undefined){ for(const log of logs.burn){const a=log.args; if(a.amount0!==undefined&&a.amount1!==undefined){largestBurn=Math.max(largestBurn,Math.abs(pct(last.reserve0+a.amount0,last.reserve0)??0),Math.abs(pct(last.reserve1+a.amount1,last.reserve1)??0));}}}
  const enough=logs.sync.length>=2 && (logs.swap.length+logs.burn.length+logs.mint.length)>0;
  const suggestedRisk:Risk=!enough?'INSUFFICIENT_EVIDENCE':largestBurn>=35?'MEDIUM':'LOW';
  const evidence:Evidence[]=[...snapshot.evidence,
    {id:'live-window',source:`bsc-rpc:${new URL(rpc).host}`,summary:`Verified ${logs.swap.length} Swap, ${logs.burn.length} Burn, ${logs.mint.length} Mint, and ${logs.sync.length} Sync events in blocks ${fromBlock}-${toBlock}.`,verificationStatus:'VERIFIED',blockNumber:toBlock.toString(),url:`https://bscscan.com/address/${snapshot.poolAddress}#events`},
    {id:'live-classification',source:'deterministic:event-classifier',summary:enough?(largestBurn>=35?`Largest observed Burn was approximately ${largestBurn.toFixed(1)}% relative to post-event reserves; removal alone is not classified as fraud.`:'Observed reserve movements were covered by verified pair events with no large Burn signal in this window.'):'The selected window did not contain enough pair events for a reliable risk classification.',verificationStatus:enough?'VERIFIED':'UNVERIFIED',blockNumber:toBlock.toString()}
  ];
  if(logs.errors.length)evidence.push({id:'live-rpc-partial',source:`bsc-rpc:${new URL(rpc).host}`,summary:`Some event queries were unavailable (${logs.errors.map(e=>e.split(':')[0]).join(', ')}). The snapshot remains verified, but risk classification is insufficient.`,verificationStatus:'UNVERIFIED',blockNumber:toBlock.toString()});
  return {poolAddress:snapshot.poolAddress,tokenPair:snapshot.tokenPair,evidence,anomaly:{type:largestBurn>=35?'LARGE_LIQUIDITY_REMOVAL':'EVENT_WINDOW_ACTIVITY',changePercent:change,windowMinutes:null},suggestedRisk:logs.errors.length?'INSUFFICIENT_EVIDENCE':suggestedRisk,provenance:'LIVE_RPC',chainWindow:{fromBlock:fromBlock.toString(),toBlock:toBlock.toString(),eventCounts:{mint:logs.mint.length,burn:logs.burn.length,swap:logs.swap.length,sync:logs.sync.length},sourceUrl:`https://bscscan.com/address/${snapshot.poolAddress}#events`},limitations:['LOW means no material signal in the analyzed block window, not a guarantee that the pool or tokens are safe.',...(logs.errors.length?['The public RPC returned only partial event history; the investigation completed without inventing a verdict.']:[])]};
}

const CUT_POOL='0x83681F67069A154815a0c6C2C97e2dAca6eD3249';
const CUT_TX='0x2c123d08ca3d50c4b875c0b5de1b5c85d0bf9979dffbf87c48526e3a67396827';
const CUT_BLOCK=42131696n;

function cachedCutEvidence():ChainEvidenceResult {
  const source='https://crypto.training/hacks/2024-09-caterpillar_coin_cut/';
  return {poolAddress:CUT_POOL,tokenPair:'BUSD/CUT',suggestedRisk:'HIGH',provenance:'CACHED_HISTORICAL',anomaly:{type:'EXPLOIT_CORROBORATED_POOL_DRAIN',changePercent:-86.7,windowMinutes:null},chainWindow:{fromBlock:CUT_BLOCK.toString(),toBlock:CUT_BLOCK.toString(),transactionHash:CUT_TX,eventCounts:{mint:null,burn:null,swap:null,sync:null},sourceUrl:`https://bscscan.com/tx/${CUT_TX}`},evidence:[
    {id:'cut-attack-tx',source:'cached-on-chain-reference',summary:'Known attack transaction for the BUSD/CUT victim pool at BSC block 42,131,696.',verificationStatus:'VERIFIED',blockNumber:CUT_BLOCK.toString(),transactionHash:CUT_TX,url:`https://bscscan.com/tx/${CUT_TX}`},
    {id:'cut-reconstruction',source:'published-exploit-reconstruction',summary:'The reconstruction documents repeated buy, add-liquidity, remove-liquidity, and sell cycles that drained approximately 1.26M BUSD.',verificationStatus:'VERIFIED',blockNumber:CUT_BLOCK.toString(),transactionHash:CUT_TX,url:source},
    {id:'cut-cache-warning',source:'guardian-cache',summary:'RPC retrieval was unavailable; this is a cached historical evidence envelope with public references, not a live RPC response.',verificationStatus:'UNVERIFIED'}
  ],limitations:['Historical fallback is cached from a published on-chain reconstruction and must not be presented as a live RPC response.']};
}

export async function inspectCutAttack():Promise<ChainEvidenceResult>{
  if(process.env.HISTORICAL_FORCE_CACHE==='true') return cachedCutEvidence();
  try{
    const snapshot=await inspectLivePool(CUT_POOL); const logs=await fetchLogs(getAddress(CUT_POOL),CUT_BLOCK,CUT_BLOCK);
    const relevant=[...logs.mint,...logs.burn,...logs.swap,...logs.sync].filter(l=>l.transactionHash?.toLowerCase()===CUT_TX.toLowerCase());
    if(!relevant.length) throw new Error('Target transaction logs unavailable from RPC');
    return {poolAddress:CUT_POOL,tokenPair:snapshot.tokenPair,suggestedRisk:'HIGH',provenance:'HISTORICAL_RPC',anomaly:{type:'EXPLOIT_CORROBORATED_POOL_DRAIN',changePercent:null,windowMinutes:null},chainWindow:{fromBlock:CUT_BLOCK.toString(),toBlock:CUT_BLOCK.toString(),transactionHash:CUT_TX,eventCounts:{mint:logs.mint.length,burn:logs.burn.length,swap:logs.swap.length,sync:logs.sync.length},sourceUrl:`https://bscscan.com/tx/${CUT_TX}`},evidence:[...snapshot.evidence,{id:'cut-rpc-events',source:'bsc-rpc:historical-logs',summary:`Target transaction verified with ${relevant.length} pair events; block contains ${logs.mint.length} Mint, ${logs.burn.length} Burn, ${logs.swap.length} Swap, and ${logs.sync.length} Sync events.`,verificationStatus:'VERIFIED',blockNumber:CUT_BLOCK.toString(),transactionHash:CUT_TX,url:`https://bscscan.com/tx/${CUT_TX}`},{id:'cut-independent-reference',source:'published-exploit-reconstruction',summary:'Independent reconstruction corroborates repeated LP removal and selling that drained the victim pool.',verificationStatus:'VERIFIED',blockNumber:CUT_BLOCK.toString(),transactionHash:CUT_TX,url:'https://crypto.training/hacks/2024-09-caterpillar_coin_cut/'}],limitations:['This is a historical replay of a known incident, not a prediction of a current attack.']};
  }catch{return cachedCutEvidence();}
}
