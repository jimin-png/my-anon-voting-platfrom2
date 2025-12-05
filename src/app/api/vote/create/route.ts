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

import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Vote from "@/models/Vote";
import Voter from "@/models/Voter";
import { verify } from "@/lib/zk/verify"; // groth16.verify 래퍼 함수

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();

    const { pollId, walletAddress, proof, publicSignals, voteIndex } = body;

    // ============================================
    // 1. 필수 입력값 검증
    // ============================================
    if (!pollId || !walletAddress || !proof || !publicSignals || voteIndex === undefined) {
      return NextResponse.json(
        { success: false, message: "pollId, walletAddress, proof, publicSignals, voteIndex 필수" },
        { status: 400 }
      );
    }

    const { root, pollId: pollIdSignal, nullifierHash, voteCommitment } = publicSignals;

    // ============================================
    // 2. Proof 검증
    // ============================================
    const isValidProof = await verify(proof, publicSignals);
    if (!isValidProof) {
      return NextResponse.json(
        { success: false, message: "유효하지 않은 ZK Proof" },
        { status: 400 }
      );
    }

    // ============================================
    // 3. publicSignals.pollId === 요청 pollId 확인
    // ============================================
    if (pollIdSignal !== pollId) {
      return NextResponse.json(
        { success: false, message: "publicSignals.pollId 불일치" },
        { status: 400 }
      );
    }


    // ============================================
    // 4. walletAddress 기반 유권자 자동 등록 (WBS 요구사항 유지)
    // ============================================
    let voterDoc = await Voter.findOne({ walletAddress }).lean();

    if (!voterDoc?._id) {
      const newVoter = await Voter.create({
        walletAddress,
        name: body?.name || `Voter-${walletAddress.slice(0, 8)}`,
        studentId: body?.studentId || null,
      });
      voterDoc = newVoter.toObject();
    }


    // ============================================
    // 5. NullifierHash 중복 체크 (재투표 방지)
    // ============================================
    const exists = await Vote.findOne({ pollId, nullifierHash });
    if (exists) {
      return NextResponse.json(
        { success: false, message: "이미 해당 투표에 참여하였습니다. (nullifierHash 중복)" },
        { status: 409 }
      );
    }

    // ============================================
    // 6. 투표 저장 (평문 candidate 제거)
    // ============================================
    const newVote = await Vote.create({
      pollId,
      root,
      nullifierHash,
      voteCommitment,
      voteIndex,
      voter: voterDoc._id,
    });

    return NextResponse.json(
      {
        success: true,
        message: "투표가 성공적으로 제출되었습니다.",
        data: {
          voteId: newVote._id,
          pollId,
          voteIndex,
        },
      },
      { status: 201 }
    );

  } catch (err) {
    console.error("Vote Create API Error:", err);
    return NextResponse.json(
      { success: false, message: "Server Error", detail: String(err) },
      { status: 500 }
    );
  }
}
