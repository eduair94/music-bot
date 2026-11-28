import "server-only";
import { createHash } from "crypto";
import type Redis from "ioredis";
import { getRedis } from "@/lib/redis";

/**
 * Fixed-window limits for POST /api/public/feedback, counted in Redis so
 * every dashboard instance shares them: 5 per IP per hour (the IP is stored
 * only as a truncated sha256) and 300 per day overall. When Redis is down or
 * slow the request is allowed and the miss is logged: losing feedback is
 * worse than a little spam, and the honeypot + same-origin check still apply.
 */
export const FEEDBACK_PER_IP_PER_HOUR = 5;
export const FEEDBACK_GLOBAL_PER_DAY = 300;
const REDIS_TIMEOUT_MS = 1500;

export type RateDecision = { allowed: true } | { allowed: false; scope: "ip" | "global"; retryAfterS: number };

export function ipKey(ip: string): string {
  return `feedback:rl:ip:${createHash("sha256").update(`bypass-feedback:${ip}`).digest("hex").slice(0, 32)}`;
}

export function dayKey(now: Date): string {
  return `feedback:rl:day:${now.toISOString().slice(0, 10)}`;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Redis did not answer in ${ms} ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function hit(redis: Redis, key: string, ttlS: number): Promise<number> {
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, ttlS);
  return count;
}

async function retryAfter(redis: Redis, key: string, fallbackS: number): Promise<number> {
  const ttl = await redis.ttl(key).catch(() => -1);
  return ttl > 0 ? ttl : fallbackS;
}

export async function checkFeedbackRate(ip: string | null, now: Date = new Date()): Promise<RateDecision> {
  const redis = getRedis();
  if (!redis) {
    console.warn("[feedback] Redis not configured; rate limit skipped");
    return { allowed: true };
  }
  try {
    return await withTimeout(
      (async (): Promise<RateDecision> => {
        if (ip) {
          const key = ipKey(ip);
          if ((await hit(redis, key, 3600)) > FEEDBACK_PER_IP_PER_HOUR) {
            return { allowed: false, scope: "ip", retryAfterS: await retryAfter(redis, key, 3600) };
          }
        }
        const key = dayKey(now);
        if ((await hit(redis, key, 2 * 86400)) > FEEDBACK_GLOBAL_PER_DAY) {
          return { allowed: false, scope: "global", retryAfterS: await retryAfter(redis, key, 3600) };
        }
        return { allowed: true };
      })(),
      REDIS_TIMEOUT_MS
    );
  } catch (error) {
    console.warn("[feedback] rate limit unavailable, allowing:", error instanceof Error ? error.message : error);
    return { allowed: true };
  }
}
