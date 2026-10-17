import type { Evidence, Risk } from './contracts.js';

export interface Scenario {
  id: 'normal' | 'withdrawal' | 'migration'; name: string; poolAddress: `0x${string}`; tokenPair: string;
  anomaly: { type: string; changePercent: number; windowMinutes: number };
  evidence: Evidence[]; expected: Risk; baseline: Risk; security: Risk; verification: Risk;
}
const tx = (n: string) => `0x${n.padStart(64, '0')}`;
export const scenarios: Record<string, Scenario> = {
  normal: {
    id: 'normal', name: 'Normal Pool Activity', poolAddress: '0x1111111111111111111111111111111111111111', tokenPair: 'CAKE/WBNB',
    anomaly: { type: 'NORMAL_TRADING', changePercent: -2.4, windowMinutes: 5 }, expected: 'LOW', baseline: 'LOW', security: 'LOW', verification: 'LOW',
    evidence: [
      { id: 'e1', source: 'fixture:sync-events', summary: 'Reserve movement remains inside the labeled normal range.', verificationStatus: 'VERIFIED', blockNumber: '41000001', transactionHash: tx('1') },
      { id: 'e2', source: 'fixture:swap-events', summary: 'Reserve changes are matched by Swap events.', verificationStatus: 'VERIFIED', blockNumber: '41000001', transactionHash: tx('1') }
    ]
  },
  withdrawal: {
    id: 'withdrawal', name: 'Suspicious Liquidity Withdrawal', poolAddress: '0x2222222222222222222222222222222222222222', tokenPair: 'DEMO/WBNB',
    anomaly: { type: 'LIQUIDITY_WITHDRAWAL', changePercent: -71.8, windowMinutes: 5 }, expected: 'HIGH', baseline: 'HIGH', security: 'HIGH', verification: 'HIGH',
    evidence: [
      { id: 'e1', source: 'fixture:burn-event', summary: 'Burn event removed 71.8% of quoted reserves.', verificationStatus: 'VERIFIED', blockNumber: '41000100', transactionHash: tx('100') },
      { id: 'e2', source: 'fixture:lp-holder-flow', summary: 'Dominant LP holder initiated the removal.', verificationStatus: 'VERIFIED', blockNumber: '41000100', transactionHash: tx('100') },
      { id: 'e3', source: 'fixture:metadata', summary: 'Token description claims guaranteed returns.', verificationStatus: 'REJECTED' }
    ]
  },
  migration: {
    id: 'migration', name: 'Conflicting Investigation: Migration', poolAddress: '0x3333333333333333333333333333333333333333', tokenPair: 'MOVE/WBNB',
    anomaly: { type: 'LIQUIDITY_WITHDRAWAL', changePercent: -65, windowMinutes: 5 }, expected: 'MEDIUM', baseline: 'HIGH', security: 'HIGH', verification: 'LOW',
    evidence: [
      { id: 'e1', source: 'fixture:burn-event', summary: 'A verified Burn event removed 65% of V2 liquidity.', verificationStatus: 'VERIFIED', blockNumber: '41000200', transactionHash: tx('200') },
      { id: 'e2', source: 'fixture:destination-pool', summary: 'Matching assets were deposited into a labeled migration pool in the same transaction group.', verificationStatus: 'VERIFIED', blockNumber: '41000202', transactionHash: tx('202') },
      { id: 'e3', source: 'fixture:announcement', summary: 'Project metadata announces migration; metadata alone is not trusted.', verificationStatus: 'UNVERIFIED' },
      { id: 'e4', source: 'fixture:false-reference', summary: 'A supplied transaction reference does not exist and is excluded.', verificationStatus: 'REJECTED', transactionHash: tx('999') }
    ]
  }
};
