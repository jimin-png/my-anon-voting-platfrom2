/**
 * 투표 상세 조회 API
 * 
 * GET /api/polls/:pollId
 * 
 * 특정 투표의 상세 정보를 조회합니다.
 * 
 * 응답 데이터:
 * - pollId: 투표 ID
 * - creatorWallet: 생성자 지갑 주소
 * - title: 투표 제목
 * - description: 설명
 * - candidates: 후보 목록
 * - startTime: 시작 시간
 * - endTime: 마감 시간
 * - merkleRoot: Merkle Root (선택)
 * - createdAt: 생성 시간
 * - updatedAt: 수정 시간
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Poll from '@/models/Poll';

/**
 * 투표 상세 조회
 * 
 * @param req NextRequest 객체
 * @param params URL 파라미터 (pollId)
 * @returns 투표 상세 정보 또는 404/500 오류
 */
export async function GET(req: NextRequest, { params }: { params: { pollId: string } }) {
  try {
    await dbConnect();

    const { pollId } = params;

    const poll = await Poll.findOne({ pollId }).lean();

    if (!poll) {
      return NextResponse.json({ success: false, message: '투표를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json(
      {
        success: true,
        data: poll,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('Get Poll Detail API Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.', details: errorMessage },
      { status: 500 }
    );
  }
}

