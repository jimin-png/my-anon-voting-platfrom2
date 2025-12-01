// /api/health/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect'; // Mongoose 기반 연결 함수 임포트

export async function GET() {
  try {
    await dbConnect(); // dbConnect 실행 (Mongoose 연결 성공 시 반환)

    return NextResponse.json({ ok: true, db: 'connected' }, { status: 200 });
  } catch (e: unknown) { // 🚨 e: any 대신 e: unknown 사용 (타입 오류 해결)
    // 오류 객체가 존재하면 메시지를 문자열로 반환
    const errorMessage = e instanceof Error ? e.message : String(e);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}