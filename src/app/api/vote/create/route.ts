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

    console.log('📌 body parsing 시작')
    const body = await req.json()
    console.log('📌 body parsing 완료, body:', body)

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
    // 2) publicSignals → 배열/객체 모두 지원
    //    circom 기준: [root, pollId, nullifierHash, voteCommitment]
    // ---------------------------
    let root: any
    let pollIdSignal: any
    let nullifierHash: any
    let voteCommitment: any

    if (Array.isArray(publicSignals)) {
      // 배열 형식: [root, pollId, nullifierHash, voteCommitment]
      ;[root, pollIdSignal, nullifierHash, voteCommitment] = publicSignals
    } else if (publicSignals && typeof publicSignals === 'object') {
      // 객체 형식: { root, pollId, nullifierHash, voteCommitment }
      root = publicSignals.root
      pollIdSignal = publicSignals.pollId
      nullifierHash = publicSignals.nullifierHash
      voteCommitment = publicSignals.voteCommitment
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'publicSignals 형식이 올바르지 않습니다 (array 또는 object)',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!root || !pollIdSignal || !nullifierHash || !voteCommitment) {
      return new Response(
        JSON.stringify({
          success: false,
          message:
            'publicSignals에 root, pollId, nullifierHash, voteCommitment가 모두 있어야 합니다',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const signalsArray = [root, pollIdSignal, nullifierHash, voteCommitment]

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
    // 3) ZKP 실제 검증
    // ---------------------------
    console.log('📌 ZKP 검증 시작:', signalsArray, proof)

    let isValid = false
    try {
      isValid = await verify(proof, signalsArray)
    } catch (e) {
      console.error('❌ verify() 실행 중 에러:', e)
      return new Response(
        JSON.stringify({
          success: false,
          message: 'ZKP 검증 중 내부 오류 발생',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log('📌 ZKP 검증 완료:', isValid)

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
