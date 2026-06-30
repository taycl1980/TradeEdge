import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Per-user + per-IP rate limiting for the AI endpoint.
// Uses Upstash Redis (serverless, free tier). If env vars are absent
// (e.g. local dev), we degrade gracefully to "allow" so the app still runs.

let limiter: Ratelimit | null = null;

function getLimiter(): Ratelimit | null {
  if (limiter) return limiter;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null; // not configured -> no-op

  const windowSecs = process.env.RATE_LIMIT_WINDOW_SECONDS || '60';
  limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    // Sliding window: max requests per window, per identifier.
    limiter: Ratelimit.slidingWindow(
      parseInt(process.env.RATE_LIMIT_MAX || '8', 10),
      `${windowSecs} s` as `${number} s`
    ),
    prefix: 'te_ratelimit',
    analytics: true,
  });
  return limiter;
}

export async function checkRateLimit(identifier: string): Promise<{
  ok: boolean;
  remaining: number;
  reset: number;
}> {
  const rl = getLimiter();
  if (!rl) return { ok: true, remaining: 999, reset: 0 }; // not configured
  const { success, remaining, reset } = await rl.limit(identifier);
  return { ok: success, remaining, reset };
}
