const params = new URL(location.href).searchParams;
const candidates = ['pair', 'pairAddress', 'pool', 'poolAddress'].map(k => params.get(k)).filter(Boolean) as string[];
const poolAddress = candidates.find(v => /^0x[a-fA-F0-9]{40}$/.test(v));
if (poolAddress) void chrome.storage.local.set({ detectedPool: { address: poolAddress, source: location.href, detectedAt: new Date().toISOString() } });
