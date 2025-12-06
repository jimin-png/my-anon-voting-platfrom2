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

import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Vote from "@/models/Vote";

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const body = await req.json();
    const { pollId, walletAddress, voteIndex, nullifierHash } = body;

    // ⭐ 서버는 검증하지 않음 — ZKP 검증은 스마트컨트랙트가 처리함.

    // ⭐ 같은 pollId 안에서만 중복 체크해야 함
    const existing = await Vote.findOne({ pollId, nullifierHash });
    const isUpdate = existing ? true : false;

    if (isUpdate) {
      // 재투표 → 기존 투표 업데이트
      await Vote.updateOne(
        { pollId, nullifierHash },
        { voteIndex, updatedAt: new Date() }
      );

      return NextResponse.json(
        {
          success: true,
          isUpdate: true,
          message: "Vote updated (re-vote applied)."
        },
        { status: 200 }
      );
    }

    // 최초 투표
    await Vote.create({
      pollId,
      walletAddress,
      voteIndex,
      nullifierHash,
      createdAt: new Date()
    });

    return NextResponse.json(
      { success: true, isUpdate: false, message: "Vote saved (on-chain verified)." },
      { status: 200 }
    );

  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { success: false, message: "서버 오류" },
      { status: 500 }
    );
  }
}
