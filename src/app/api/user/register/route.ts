// src/app/api/user/register/route.ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import Voter from '@/models/Voter';

// 요청 데이터에 대한 Zod 스키마 정의
// WBS: name, studentId는 선택사항 (QR 찍고 메타마스크 연결 시 자동 등록)
const RegisterSchema = z.object({
    name: z.string().min(1, "이름은 필수 항목입니다.").optional(), // 선택사항으로 변경
    walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "올바른 지갑 주소 형식이 아닙니다."),
    studentId: z.string().length(8, "학번은 8자리여야 합니다.").optional(), // 선택사항
    email: z.string().email("유효한 이메일 형식이 아닙니다.").optional(),
});

export async function POST(req: NextRequest) {
    // API POST 핸들러 진입 확인 로그 (디버깅용)
    console.log("--- API POST Handler Entered (Register) ---");

    await dbConnect();

    let data;

    try {
        // 1. JSON 본문을 파싱
        data = await req.json();
    } catch (e: unknown) {
        // JSON 파싱 실패 시 400 Bad Request 반환
        const errorMessage = e instanceof Error ? e.message : String(e);
        return new Response(
            JSON.stringify({ success: false, message: '유효하지 않은 JSON 형식입니다.', details: errorMessage }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    try {
        // 2. Zod 스키마를 사용하여 데이터 유효성 검사
        const validatedData = RegisterSchema.parse(data);

        // 3. 중복 유권자 검사 (walletAddress 기준)
        // WBS: studentId는 선택사항이므로 중복 체크에서 제외
        const existingVoter = await Voter.findOne({
            walletAddress: validatedData.walletAddress,
        });

        if (existingVoter) {
            return new Response(
                JSON.stringify({ success: false, message: '이미 등록된 지갑 주소입니다.' }),
                { status: 409, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // 4. 새로운 유권자 생성
        // WBS: name, studentId는 선택사항
        const newVoter = await Voter.create({
            walletAddress: validatedData.walletAddress,
            name: validatedData.name || `Voter-${validatedData.walletAddress.slice(0, 8)}`,
            studentId: validatedData.studentId || null,
            email: validatedData.email || null,
        });

        console.log("--- New Voter Registered ---", newVoter.walletAddress);

        return new Response(
            JSON.stringify({ success: true, message: '유권자 등록 완료', data: newVoter }),
            { status: 201, headers: { 'Content-Type': 'application/json' } }
        );

    } catch (error: unknown) {
        // Zod 유효성 검사 실패 (400 처리)
        if (error instanceof z.ZodError) {
          const firstMessage = error.issues?.[0]?.message ?? '유효성 검사에 실패했습니다.';
          return new Response(
                JSON.stringify({ success: false, message: firstMessage }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // 기타 서버 오류 (Mongoose Validation 등)
        console.error("API Error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // MongoDB 중복 키 오류 처리
        if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
            return new Response(
                JSON.stringify({ success: false, message: '이미 등록된 지갑 주소입니다.' }),
                { status: 409, headers: { 'Content-Type': 'application/json' } }
            );
        }
        
        return new Response(
            JSON.stringify({ success: false, message: '서버 오류가 발생했습니다.', details: errorMessage }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}