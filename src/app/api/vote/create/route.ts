// src/app/api/vote/create/route.ts

/**
 * 투표 생성 / 갱신 API (v1.2 Spec)
 *
 * POST /api/vote/create
 *
 * - ZKP 검증은 온체인(스마트컨트랙트)에서 이미 완료된 상태라고 가정
 * - 이 API는 단순히 투표 결과를 DB에 저장/업데이트만 담당
 * - 같은 pollId + nullifierHash 가 오면 "재투표"로 간주하고 업데이트 처리
 */

import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import Vote from '@/models/Vote'

export async function POST(req: NextRequest) {
  try {
    await dbConnect()

    const body = await req.json()
    const { pollId, walletAddress, voteIndex, nullifierHash } = body

    // ------------------------------------------------
    // 1) 필수 값 검증
    // ------------------------------------------------
    if (
      !pollId ||
      !walletAddress ||
      voteIndex === undefined ||
      !nullifierHash
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            'pollId, walletAddress, voteIndex, nullifierHash는 필수입니다.',
        },
        { status: 400 }
      )
    }

    // ------------------------------------------------
    // 2) 같은 pollId 내에서 nullifierHash 중복 체크
    //    - 있으면 재투표로 간주 → 업데이트
    //    - 없으면 최초 투표 → 신규 저장
    // ------------------------------------------------
    const existing = await Vote.findOne({ pollId, nullifierHash })
    const now = new Date()

    if (existing) {
      // 재투표 → 기존 문서 업데이트
      await Vote.updateOne(
        { _id: existing._id },
        {
          voteIndex,
          updatedAt: now,
        }
      )

      return NextResponse.json(
        {
          success: true,
          isUpdate: true,
          message: 'Vote updated (re-vote applied).',
          pollId,
          voteIndex,
        },
        { status: 200 }
      )
    }

    // ------------------------------------------------
    // 3) 최초 투표 저장
    // ------------------------------------------------
    const newVote = await Vote.create({
      pollId,
      walletAddress,
      voteIndex,
      nullifierHash,
      createdAt: now,
      updatedAt: now,
    })

    return NextResponse.json(
      {
        success: true,
        isUpdate: false,
        message: 'Vote saved (on-chain verified).',
        data: {
          voteId: newVote._id,
          pollId,
          voteIndex,
        },
      },
      { status: 200 }
    )
  } catch (e: any) {
    console.error('API Error /api/vote/create:', e)
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류',
        details: String(e?.message || e),
      },
      { status: 500 }
    )
  }
}
