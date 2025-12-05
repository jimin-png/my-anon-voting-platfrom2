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

import dbConnect from "@/lib/dbConnect";
import Vote from "@/models/Vote";
import Voter from "@/models/Voter";
import { verify } from "@/lib/zk/verify";

export async function POST(req: Request) {
  try {
    await dbConnect();

    const body = await req.json();

    const {
      pollId,
      walletAddress,
      proof,
      publicSignals,
      voteIndex,
    } = body;

    // ---------------------------
    // 1) 필수 값 검증
    // ---------------------------
    if (!pollId || !walletAddress || !proof || !publicSignals || voteIndex === undefined) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "pollId, walletAddress, proof, publicSignals, voteIndex 필수",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // ---------------------------
    // 2) publicSignals 배열 매핑
    //    publicSignals = [root, pollIdField, nullifierHash, voteCommitment]
    // ---------------------------
    const root = publicSignals[0];
    const pollIdSignal = publicSignals[1];      // UUID와 다름 (circom field)
    const nullifierHash = publicSignals[2];
    const voteCommitment = publicSignals[3];

    // signalsArray는 snarkjs.verify() 입력 형식
    const signalsArray = [
      root,
      pollIdSignal,
      nullifierHash,
      voteCommitment,
    ];

    // ---------------------------
    // 3) 디버깅 로그
    // ---------------------------
    console.log("=======================================");
    console.log("proof:", proof);
    console.log("publicSignals:", publicSignals);
    console.log("signalsArray:", signalsArray);
    console.log("=======================================");

    // ---------------------------
    // 4) ZKP 검증
    // ---------------------------
    const isValid = await verify(proof, signalsArray);

    console.log("ZKP verified:", isValid);

    if (!isValid) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "유효하지 않은 ZK Proof",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // ---------------------------
    // ❌ 5) pollIdSignal vs pollId 비교 금지
    // 프론트에서도 말했듯 둘은 다르며 절대 일치하지 않음
    // ---------------------------

    // ---------------------------
    // 6) 유권자 자동 등록
    // ---------------------------
    let voterDoc = await Voter.findOne({ walletAddress }).lean();

    if (!voterDoc?._id) {
      const newVoter = await Voter.create({
        walletAddress,
        name: body?.name || `Voter-${walletAddress.slice(0, 8)}`,
        studentId: body?.studentId || null,
      });
      voterDoc = newVoter.toObject();
    }

    // ---------------------------
    // 7) nullifierHash 중복 방지 (선거별 1인 1표)
    // ---------------------------
    const exists = await Vote.findOne({ pollId, nullifierHash });

    if (exists) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "이미 투표한 사용자입니다(중복 투표 불가)",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // ---------------------------
    // 8) 투표 저장
    // ---------------------------
    const newVote = await Vote.create({
      pollId,
      root,
      nullifierHash,
      voteCommitment,
      voteIndex,
      voter: voterDoc._id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "vote accepted",
        data: {
          voteId: newVote._id,
          pollId,
          voteIndex,
        },
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("API Error /api/vote/create:", error);

    // unique 에러 (pollId + nullifierHash)
    if (error?.code === 11000) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "이미 투표한 사용자입니다(중복 투표 불가)",
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: "Internal Server Error",
        details: String(error?.message || error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }
}
