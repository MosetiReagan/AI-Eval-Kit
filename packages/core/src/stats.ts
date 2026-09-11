import { LatencyStats } from './types.js';

export function calculateLatencyStats(latencies: number[]): LatencyStats {
  if (latencies.length === 0) {
    return {
      avgMs: 0,
      medianMs: 0,
      p95Ms: 0,
      p99Ms: 0,
      minMs: 0,
      maxMs: 0,
    };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const total = sorted.reduce((sum, val) => sum + val, 0);
  const avg = total / sorted.length;

  const getPercentile = (p: number): number => {
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    if (lower === upper) return sorted[lower] ?? 0;
    return (sorted[lower] ?? 0) * (1 - weight) + (sorted[upper] ?? 0) * weight;
  };

  return {
    avgMs: Math.round(avg),
    medianMs: Math.round(getPercentile(50)),
    p95Ms: Math.round(getPercentile(95)),
    p99Ms: Math.round(getPercentile(99)),
    minMs: sorted[0] ?? 0,
    maxMs: sorted[sorted.length - 1] ?? 0,
  };
}
