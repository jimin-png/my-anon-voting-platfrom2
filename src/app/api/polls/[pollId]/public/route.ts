/**
 * 투표 공개 정보 조회 API
 * 
 * GET /api/polls/:pollId/public
 * 
 * 참여자가 투표에 참여하기 전에 확인할 수 있는 공개 정보를 조회합니다.
 * 
 * 응답 데이터:
 * - pollId: 투표 ID
 * - title: 투표 제목
 * - description: 설명
 * - candidates: 후보 목록
 * - startTime: 시작 시간
 * - endTime: 마감 시간
 * - isActive: 현재 투표 진행 중 여부
 * - status: 'active' | 'upcoming' | 'ended'
 * 
 * 주의: creatorWallet, merkleRoot 등 민감한 정보는 제외됩니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Poll from '@/models/Poll';

/**
 * 공개 정보 조회 (참여자용)
 * 
 * @param req NextRequest 객체
 * @param params URL 파라미터 (pollId)
 * @returns 투표 공개 정보 또는 404/500 오류
 */
export async function GET(req: NextRequest, { params }: { params: { pollId: string } }) {
  try {
    await dbConnect();

    const { pollId } = params;

    const poll = await Poll.findOne({ pollId }).select('pollId title description candidates startTime endTime').lean();

    if (!poll) {
      return NextResponse.json({ success: false, message: '투표를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 현재 시간 확인
    const now = new Date();
    const isActive = now >= poll.startTime && now <= poll.endTime;

    return NextResponse.json(
      {
        success: true,
        data: {
          ...poll,
          isActive,
          status: isActive ? 'active' : now < poll.startTime ? 'upcoming' : 'ended',
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('Get Poll Public API Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.', details: errorMessage },
      { status: 500 }
    );
  }
}

