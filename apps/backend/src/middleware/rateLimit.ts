import { Request, Response, NextFunction } from 'express';

type Bucket = { count: number; resetAt: number };

const requests: Map<string, Bucket> = new Map();

// Basic in-memory rate limiter (per IP per route)
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 60; // 60 requests/minute

export default function rateLimit(req: Request, res: Response, next: NextFunction) {
  try {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const key = `${ip}:${req.path}`;
    const now = Date.now();

    const bucket = requests.get(key) || { count: 0, resetAt: now + WINDOW_MS };

    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + WINDOW_MS;
    }

    bucket.count += 1;
    requests.set(key, bucket);

    if (bucket.count > MAX_REQUESTS) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many requests', retryAfter });
    }

    next();
  } catch (err) {
    // Fallback: allow request rather than block the route on limiter failure
    next();
  }
}


