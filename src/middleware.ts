/**
 * 전역 미들웨어
 *
 * 모든 API 요청에 적용되는 공통 로직:
 * 1. RequestID 생성 (로그 추적용)
 * 2. CORS 처리 (프론트엔드와의 통신 허용)
 * 3. RateLimit (DDoS 방지)
 */

import { NextRequest, NextResponse } from 'next/server';

// ======================================================
// 1) RateLimit 설정
// ======================================================
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15분
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();

function getClientIp(req: NextRequest): string | null {
  const xff =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('x-vercel-forwarded-for');

  if (!xff) return null;
  return xff.split(',')[0].trim();
}

function applyRateLimit(ip: string): boolean {
  const now = Date.now();

  if (!rateLimitCache.has(ip)) {
    rateLimitCache.set(ip, { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS });
  }

  const cache = rateLimitCache.get(ip)!;

  if (cache.resetTime < now) {
    cache.count = 0;
    cache.resetTime = now + RATE_LIMIT_WINDOW_MS;
  }

  cache.count += 1;
  return cache.count > RATE_LIMIT_MAX;
}

// ======================================================
// 2) CORS 허용 규칙 (와일드카드 포함)
// ======================================================

// 모든 Vercel Preview 도메인 허용: https://*.vercel.app
const vercelWildcard = /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true; // Origin 없는 요청 허용 (서버 간 호출 등)

  return (
    origin === 'http://localhost:3000' ||
    origin === 'http://localhost:3001' ||
    vercelWildcard.test(origin) // ← ★ 와일드카드 매칭
  );
}

// ======================================================
// 3) Middleware
// ======================================================
export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  const url = request.nextUrl.clone();

  // ============================================
  // OPTIONS (Preflight) 우선 처리
  // ============================================
  if (request.method === 'OPTIONS') {
    if (isAllowedOrigin(origin)) {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin || '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'Access-Control-Allow-Headers':
            'Content-Type, Authorization, X-Request-ID',
          'Access-Control-Allow-Credentials': 'true',
        },
      });
    }
    return new Response('CORS Not Allowed', { status: 403 });
  }

  // ============================================
  // 실제 요청 처리
  // ============================================
  const response = NextResponse.next();

  // RequestID 생성
  const requestId = globalThis.crypto.randomUUID();
  response.headers.set('X-Request-ID', requestId);

  // CORS 헤더 적용
  if (isAllowedOrigin(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin || '*');
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET,POST,PUT,DELETE,OPTIONS'
    );
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Request-ID'
    );
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  // ============================================
  // RateLimit 적용 (/api 경로만)
  // ============================================
  if (url.pathname.startsWith('/api')) {
    const ip = getClientIp(request) ?? 'anonymous';

    if (applyRateLimit(ip)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
          requestId,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimitCache.get(ip)!.resetTime),
            'X-Request-ID': requestId,
          },
        }
      );
    }
  }

  return response;
}

// ======================================================
// 4) Matcher 설정
// ======================================================
export const config = {
  matcher: ['/api/:path*', '/:path*'],
};
