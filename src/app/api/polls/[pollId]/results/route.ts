// src/app/api/polls/[pollId]/results/route.ts
import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import Poll from '@/models/Poll'
import Vote from '@/models/Vote'

/**
 * 투표 결과 집계 API
 *
 * GET /api/polls/:pollId/results
 *
 * 특정 투표의 결과를 집계합니다.
 * 재투표(업데이트)를 고려하여 최신 투표만 집계합니다.
 *
 * 왜 이렇게 복잡한가?
 * - 같은 사람이 여러 번 투표할 수 있음 (재투표)
 * - 재투표는 최신 것만 유효해야 함
 * - nullifierHash별로 그룹화하여 중복 제거
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { pollId: string } }
) {
  try {
    await dbConnect()

    const { pollId } = params

    // ============================================
    // 1. 투표 존재 확인
    // ============================================
    const poll = await Poll.findOne({ pollId }).lean()
    if (!poll) {
      return NextResponse.json(
        { success: false, message: '투표를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // ============================================
    // 2. 투표 결과 집계 (혼합 100건 처리 개선)
    // ============================================
    // 재투표(업데이트)를 고려하여 최신 투표만 집계
    const aggregationPipeline = [
      // 2-1. 해당 pollId만 필터링
      { $match: { pollId } },

      // 2-2. nullifierHash별로 그룹화하여 최신 투표만 선택
      // nullifierHash가 있으면 그것으로, 없으면 voter ID로 그룹화
      {
        $group: {
          _id: {
            $cond: [
              { $ifNull: ['$nullifierHash', false] }, // nullifierHash가 있는지 확인
              '$nullifierHash', // 있으면 nullifierHash 사용
              { $toString: '$voter' }, // 없으면 voter ID 사용
            ],
          },
          candidate: { $last: '$candidate' }, // 최신 투표의 candidate (재투표 시 업데이트된 것)
          timestamp: { $max: '$timestamp' },
        },
      },

      // 2-3. candidate별로 집계
      {
        $group: {
          _id: '$candidate',
          count: { $sum: 1 }, // 각 candidate를 선택한 고유 투표자 수
        },
      },

      // 2-4. 결과 형식 변환
      {
        $project: {
          _id: 0,
          candidate: '$_id',
          count: 1,
        },
      },

      // 2-5. 득표수 내림차순 정렬
      {
        $sort: { count: -1 as const },
      },
    ]

    // ============================================
    // 3. 집계 실행
    // ============================================
    const results = await Vote.aggregate(aggregationPipeline)

    // ============================================
    // 4. 총 투표 수 계산 (중복 제거)
    // ============================================
    // nullifierHash 또는 voter별로 그룹화하여 고유 투표자 수 계산
    const uniqueVotes = await Vote.aggregate([
      { $match: { pollId } },
      {
        $group: {
          _id: {
            $cond: [
              { $ifNull: ['$nullifierHash', false] },
              '$nullifierHash',
              { $toString: '$voter' },
            ],
          },
        },
      },
    ])
    const totalVotes = uniqueVotes.length // 재투표 제외한 실제 투표 수

    return NextResponse.json(
      {
        success: true,
        data: {
          pollId,
          title: poll.title,
          totalVotes,
          results,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error('Get Poll Results API Error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.',
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}
