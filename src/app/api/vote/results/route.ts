/**
 * 투표 결과 집계 API
 *
 * GET /api/vote/results?pollId=...
 *
 * 투표 결과를 집계하여 반환하는 엔드포인트입니다.
 *
 * 동작 방식:
 * 1. pollId가 있으면 해당 투표만, 없으면 전체 투표 집계
 * 2. 재투표(업데이트)를 고려하여 최신 투표만 집계
 * 3. nullifierHash별로 그룹화하여 중복 제거
 *
 * 집계 로직:
 * - nullifierHash가 있으면 nullifierHash별로 그룹화
 * - 없으면 voter ID별로 그룹화
 * - 각 그룹에서 최신 투표의 candidate만 사용
 * - candidate별로 카운트하여 반환
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Vote from '@/models/Vote';
import Poll from '@/models/Poll';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const pollId = searchParams.get('pollId');

    if (!pollId) {
      return NextResponse.json(
        { success: false, message: 'pollId는 필수입니다.' },
        { status: 400 }
      );
    }

    // ============================================
    // 1. Poll 존재 확인 & 후보 label 맵 생성
    // ============================================
    const poll = await Poll.findOne({ pollId }).lean();

    if (!poll) {
      return NextResponse.json(
        { success: false, message: '투표를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 후보 label 매핑용
    const candidateLabelMap: Record<string, string> = {};
    poll.candidates.forEach((c: any) => {
      candidateLabelMap[c.id] = c.label;
    });

    // ============================================
    // 2. 최신 투표만 집계 (재투표 반영)
    // ============================================
    const aggregated = await Vote.aggregate([
      { $match: { pollId } },

      // nullifierHash 또는 voterID 그룹
      {
        $group: {
          _id: {
            $cond: [
              { $ifNull: ['$nullifierHash', false] },
              '$nullifierHash',
              { $toString: '$voter' }
            ]
          },
          candidate: { $last: '$candidate' } // 최신 투표 적용
        }
      },

      // candidate별 득표수
      {
        $group: {
          _id: '$candidate',
          votes: { $sum: 1 }
        }
      },

      // 결과 형태 변환
      {
        $project: {
          _id: 0,
          candidate: '$_id',
          votes: 1
        }
      },

      // 득표 내림차순 정렬
      { $sort: { votes: -1 } }
    ]);

    // ============================================
    // 3. 총 투표 수 계산 (중복 제거)
    // ============================================
    const unique = await Vote.aggregate([
      { $match: { pollId } },
      {
        $group: {
          _id: {
            $cond: [
              { $ifNull: ['$nullifierHash', false] },
              '$nullifierHash',
              { $toString: '$voter' }
            ]
          }
        }
      }
    ]);

    const totalVotes = unique.length;

    // ============================================
    // 4. 프론트 요구 포맷에 맞게 재가공
    // ============================================
    const results = aggregated.map((item: any) => ({
      candidate: item.candidate,
      label: candidateLabelMap[item.candidate] ?? '',
      votes: item.votes
    }));

    return NextResponse.json(
      {
        success: true,
        data: {
          pollId,
          totalVotes,
          results
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Results API Error:', error);

    return NextResponse.json(
      {
        success: false,
        message: '서버 내부 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
