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

import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import Poll from '@/models/Poll'
import Vote from '@/models/Vote'

export async function GET(
  req: NextRequest,
  { params }: { params: { pollId: string } }
) {
  try {
    await dbConnect()
    const { pollId } = params

    // 1) Poll 존재 확인
    const poll = await Poll.findOne({ pollId }).lean()
    if (!poll) {
      return NextResponse.json(
        { success: false, message: '투표를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 후보 label 매핑
    const labelMap: Record<string, string> = {}
    poll.candidates.forEach((c: any) => {
      labelMap[c.id] = c.label
    })

    // 2) 최신 투표만 집계
    const aggregated = await Vote.aggregate([
      { $match: { pollId } },
      {
        $group: {
          _id: {
            $cond: [
              { $ifNull: ['$nullifierHash', false] },
              '$nullifierHash',
              { $toString: '$voter' }
            ]
          },
          candidate: { $last: '$candidate' }
        }
      },
      {
        $group: {
          _id: '$candidate',
          votes: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          candidate: '$_id',
          votes: 1
        }
      },
      { $sort: { votes: -1 } }
    ])

    // 3) totalVotes 계산
    const uniqueVotes = await Vote.aggregate([
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
    ])

    const totalVotes = uniqueVotes.length

    // 4) 프론트 요구 형식으로 변환
    const results = aggregated.map(item => ({
      candidate: item.candidate,
      label: labelMap[item.candidate] ?? "",
      votes: item.votes
    }))

    // 5) 최종 응답 (프론트 요구 포맷 100% 일치)
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
    )

  } catch (error) {
    console.error('Get Poll Results API Error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
