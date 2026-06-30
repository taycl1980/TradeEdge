import { Redis } from '@upstash/redis';

// App-wide daily ceiling on AI analyses as a hard cost backstop.
// Even if per-user caps and rate limits are bypassed somehow, this
// stops the global Anthropic bill from running away on a bad day.
// Counts successful analyses per UTC day. Falls back to "allow" if
// Redis isn't configured (local dev), since per-user caps still apply.

let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

function todayKey(): string {
  const d = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  return `te_spendcap:${d}`;
}

// Check whether we're under the daily ceiling. Does NOT increment.
export async function underDailyCap(): Promise<boolean> {
  const r = getRedis();
  if (!r) return true;
  const cap = parseInt(process.env.DAILY_ANALYSIS_CAP || '500', 10);
  const current = (await r.get<number>(todayKey())) ?? 0;
  return current < cap;
}

// Increment the daily counter after a successful paid call. Sets a
// 48h expiry so keys self-clean.
export async function incrementDailyCap(): Promise<void> {
  const r = getRedis();
  if (!r) return;
  const key = todayKey();
  const n = await r.incr(key);
  if (n === 1) await r.expire(key, 60 * 60 * 48);
}
