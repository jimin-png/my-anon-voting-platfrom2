/**
 * 사용자 로그인 API
 * 
 * POST /api/user/login
 * 
 * 등록된 유권자가 로그인하는 엔드포인트입니다.
 * 
 * 동작 방식:
 * 1. walletAddress와 studentId로 유권자 조회
 * 2. 일치하는 유권자가 있으면 성공 반환
 * 3. 없으면 401 Unauthorized 반환
 * 
 * 주의: 실제 프로덕션에서는 JWT 토큰을 발급해야 합니다.
 */

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Voter from '@/models/Voter';

export async function POST(req: Request) {
    await dbConnect();

    // ============================================
    // 1. 요청 데이터 추출
    // ============================================
    // 등록 시 사용했던 walletAddress와 studentId를 받습니다.
    const { walletAddress, studentId } = await req.json();

    if (!walletAddress) {
        return NextResponse.json({ success: false, message: 'Wallet address is required.' }, { status: 400 });
    }

    try {
        // 1. DB에서 유권자 조회
        const voter = await Voter.findOne({ walletAddress, studentId });

        if (!voter) {
            return NextResponse.json({ success: false, message: 'User not found or credentials invalid.' }, { status: 401 });
        }

        // 2. 인증 성공 (토큰 발급 등은 생략하고 성공만 반환)
        // 🚨 실제로는 여기서 JWT 토큰을 생성하여 반환해야 합니다.
        return NextResponse.json({
            success: true,
            message: 'Login successful',
            // token: 'YOUR_AUTH_TOKEN',
            voterId: voter._id
        }, { status: 200 });

    } catch (err: unknown) {
        console.error("Login API Error:", err);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}