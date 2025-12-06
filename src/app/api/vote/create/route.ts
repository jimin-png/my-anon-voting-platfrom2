/**
 * 투표 생성 API
 *
 * POST /api/vote/create
 *
 * 사용자가 투표를 제출하는 엔드포인트입니다.
 *
 * 동작 방식 (WBS 일치):
 * 1. 요청 데이터 검증 (pollId, walletAddress, candidate 필수)
 * 2. 유권자 조회 (walletAddress로)
 * 3. 유권자가 없으면 자동 등록 (QR 찍고 메타마스크 연결 = 자동 유권자)
 * 4. 투표 저장 (재투표 시 업데이트)
 *
 * 재투표 처리:
 * - 같은 pollId + nullifierHash 조합이면 중복으로 인식 (409 오류)
 * - 다른 pollId에서 같은 nullifierHash 사용은 허용 (선거별 1인 1표)
 *
 * WBS 요구사항:
 * - QR 찍고 메타마스크 연결 → 자동으로 유효한 투표권자 인정
 * - ZKP Proof 검증은 블록체인 컨트랙트에서 처리 (merkleRoot 검증 포함)
 */

// src/app/api/vote/create/route.ts

import dbConnect from '@/lib/dbConnect'
import Vote from '@/models/Vote'
import Voter from '@/models/Voter'
import { verify } from '@/lib/zk/verify'

export async function POST(req: Request) {
  try {
    await dbConnect()

    const body = await req.json()
    const { pollId, walletAddress, proof, publicSignals, voteIndex } = body

    // ---------------------------
    // 1) 필수 값 검증
    // ---------------------------
    if (
      !pollId ||
      !walletAddress ||
      !proof ||
      !publicSignals ||
      voteIndex === undefined
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          message:
            'pollId, walletAddress, proof, publicSignals, voteIndex 필수',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ---------------------------
    // 2) publicSignals → 반드시 배열이어야 함
    // ---------------------------
    if (!Array.isArray(publicSignals)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'publicSignals must be an array',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // circom 출력 기준:
    // publicSignals = [root, pollId, nullifierHash, voteCommitment]
    const [root, pollIdSignal, nullifierHash, voteCommitment] = publicSignals

    // pollId 불일치 체크
    if (pollIdSignal.toString() !== pollId.toString()) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `ZKP pollId mismatch: ZK=${pollIdSignal} / API=${pollId}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ---------------------------
    // 3) ZKP 검증 (순서 중요)
    // verify(vKey, publicSignals, proof)
    // ---------------------------
    const isValid = await verify(proof, publicSignals)

    console.log('ZKP verified:', isValid)

    if (!isValid) {
      return new Response(
        JSON.stringify({
          success: false,
          message: '유효하지 않은 ZK Proof',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ---------------------------
    // 4) 유권자 자동 등록
    // ---------------------------
    let voterDoc = await Voter.findOne({ walletAddress }).lean()

    if (!voterDoc?._id) {
      const newVoter = await Voter.create({
        walletAddress,
        name: body?.name || `Voter-${walletAddress.slice(0, 8)}`,
        studentId: body?.studentId || null,
      })
      voterDoc = newVoter.toObject()
    }

    // ---------------------------
    // 5) 재투표 로직 (pollId + nullifierHash)
    // ---------------------------
    const prevVote = await Vote.findOne({ pollId, nullifierHash })

    if (prevVote) {
      await Vote.updateOne(
        { pollId, nullifierHash },
        {
          root: root.toString(),
          voteCommitment: voteCommitment.toString(),
          voteIndex,
        }
      )

      return new Response(
        JSON.stringify({
          success: true,
          message: 'vote updated (재투표 반영)',
          isUpdate: true,
          pollId,
          voteIndex,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ---------------------------
    // 6) 최초 투표 저장
    // ---------------------------
    const newVote = await Vote.create({
      pollId,
      root: root.toString(),
      nullifierHash: nullifierHash.toString(),
      voteCommitment: voteCommitment.toString(),
      voteIndex,
      voter: voterDoc._id,
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'vote accepted (최초투표)',
        isUpdate: false,
        data: {
          voteId: newVote._id,
          pollId,
          voteIndex,
        },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('API Error /api/vote/create:', error)

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Internal Server Error',
        details: String(error?.message || error),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    )
  }
}
