/**
 * 전역 미들웨어
 * 
 * 모든 API 요청에 적용되는 공통 로직:
 * 1. RequestID 생성 (로그 추적용)
 * 2. CORS 처리 (프론트엔드와의 통신 허용)
 * 3. RateLimit (DDoS 방지)
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================
// 1. RateLimit 설정
// ============================================
// IP당 15분 동안 최대 100회 요청 허용
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15분 (900,000ms)

// 메모리 기반 캐시 (개발 환경용)
// 프로덕션에서는 Redis 사용 권장
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();

/**
 * 클라이언트 IP 주소 추출
 * 
 * 프록시나 로드밸런서를 거친 경우 실제 클라이언트 IP를 찾기 위해
 * 여러 헤더를 확인합니다.
 */
function getClientIp(req: NextRequest): string | null {
    // x-forwarded-for: 프록시를 거친 경우 원본 IP가 여기에 있음
    const xff = req.headers.get('x-forwarded-for')
        || req.headers.get('x-real-ip')
        || req.headers.get('x-vercel-forwarded-for');
    if (!xff) return null;
    // 여러 IP가 있을 수 있으므로 첫 번째 IP만 사용
    return xff.split(',')[0].trim();
}

// ============================================
// 2. CORS 허용 출처 설정
// ============================================
// 환경 변수에서 허용할 출처를 가져옴 (쉼표로 구분)
const envOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
    : [];

// 기본 허용 출처 (개발 환경)
const allowedOrigins = [
    'http://localhost:3000',  // Next.js 기본 포트
    'http://localhost:3001',  // 대체 포트
    ...envOrigins,            // 환경 변수에서 추가된 출처
];

/**
 * RateLimit 적용 함수
 * 
 * IP별로 요청 횟수를 추적하고, 제한을 초과하면 true를 반환합니다.
 * 
 * @param ip 클라이언트 IP 주소
 * @returns true: 제한 초과, false: 허용
 */
function applyRateLimit(ip: string): boolean {
    const now = Date.now();

    // 캐시에 IP가 없으면 초기화 (첫 요청)
    if (!rateLimitCache.has(ip)) {
        rateLimitCache.set(ip, { 
            count: 0, 
            resetTime: now + RATE_LIMIT_WINDOW_MS  // 15분 후 리셋
        });
    }

    const cache = rateLimitCache.get(ip)!;

    // 시간 윈도우가 지났으면 카운트 리셋
    if (cache.resetTime < now) {
        cache.count = 0;
        cache.resetTime = now + RATE_LIMIT_WINDOW_MS;
    }

    // 요청 횟수 증가
    cache.count += 1;
    
    // 제한 초과 여부 반환
    return cache.count > RATE_LIMIT_MAX;
}

/**
 * Next.js 미들웨어 함수
 * 
 * 모든 요청에 대해 다음을 수행합니다:
 * 1. RequestID 생성 (로그 추적)
 * 2. CORS 헤더 설정
 * 3. OPTIONS 요청 처리 (Preflight)
 * 4. RateLimit 적용 (API 경로만)
 */
export function middleware(request: NextRequest) {
    const url = request.nextUrl.clone();
    const origin = request.headers.get('origin');
    const response = NextResponse.next();

    // ============================================
    // 1. RequestID 생성 및 설정
    // ============================================
    // 모든 요청에 고유 ID를 부여하여 로그 추적 가능하게 함
    // Edge Runtime에서는 Web Crypto API 사용 (Node.js crypto 모듈 사용 불가)
    const requestId = globalThis.crypto.randomUUID();
    request.headers.set('X-Request-ID', requestId);
    response.headers.set('X-Request-ID', requestId);

    console.log(`[RequestID: ${requestId}] ${request.method} ${url.pathname}`);

    // ============================================
    // 2. CORS 처리
    // ============================================
    // 허용된 출처에서 온 요청에만 CORS 헤더 추가
    if ((origin && allowedOrigins.includes(origin)) || !origin) {
        response.headers.set('Access-Control-Allow-Origin', origin || '*');
        response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
        response.headers.set('Access-Control-Allow-Credentials', 'true');
    }

    // ============================================
    // 3. OPTIONS 요청 처리 (Preflight)
    // ============================================
    // 브라우저가 실제 요청 전에 보내는 사전 요청 처리
    if (request.method === 'OPTIONS') {
        if ((origin && allowedOrigins.includes(origin)) || !origin) {
            const preflight = new Response(null, { status: 204 }); // No Content
            preflight.headers.set('Access-Control-Allow-Origin', origin || '*');
            preflight.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
            preflight.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
            preflight.headers.set('Access-Control-Allow-Credentials', 'true');
            return preflight;
        }
        return new Response('Not Allowed', { status: 403 });
    }

    // ============================================
    // 4. RateLimit 적용 (API 경로만)
    // ============================================
    // /api로 시작하는 경로에만 RateLimit 적용
    if (url.pathname.startsWith('/api')) {
        const ip = getClientIp(request) ?? 'anonymous';
        if (applyRateLimit(ip)) {
            // 제한 초과 시 429 Too Many Requests 반환
            return new Response(
                JSON.stringify({
                    success: false,
                    message: '요청 속도가 너무 빠릅니다. 잠시 후 다시 시도해 주세요.',
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

// ============================================
// 5. 미들웨어 적용 경로 설정
// ============================================
// 모든 경로에 미들웨어 적용
export const config = {
    matcher: ['/api/:path*', '/:path*'],
};

