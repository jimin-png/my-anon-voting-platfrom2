// app/api/event/sync/route.ts

import { NextResponse } from 'next/server';
import { syncEventAndConfirm } from '@/lib/services/db.service';

export async function POST(request: Request) {

  // 🚨 DB_URI 확인 로직 제거 (dbConnect가 대신 처리)

  try {
    const body = await request.json();
    const { eventId, requestId } = body;

    if (!eventId || !requestId) {
        return NextResponse.json({ success: false, message: "Missing required fields." }, { status: 400 });
    }

    // 🚨 syncEventAndConfirm 호출 시 uri 인수를 제거합니다.
    const result = await syncEventAndConfirm(eventId, requestId);

    // 성공 응답 반환
    return NextResponse.json({
        success: true,
        message: `Event '${eventId}' processed. Status: ${result.status}.`,
        status: result.status,
        confirmationCount: result.confirmationCount,
    }, { status: 200 });

  } catch (error: unknown) {
    const retryAfterSeconds = 50;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Event Sync API Error (Retry Backoff Suggested):", errorMessage);

    return NextResponse.json({
      success: false,
      message: `Internal server error. Please retry after ${retryAfterSeconds} seconds.`,
      error_type: 'TRANSIENT_FAILURE',
      details: errorMessage
    }, {
      status: 503,
      headers: { 'Retry-After': retryAfterSeconds.toString(), }
    });
  }
}