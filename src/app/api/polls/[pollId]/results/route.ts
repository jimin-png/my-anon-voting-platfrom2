// src/app/api/polls/[pollId]/results/route.ts

import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Poll from "@/models/Poll";
import Vote from "@/models/Vote";
import crypto from "crypto";

// UUID → ZKP field 값으로 변환 (프론트와 동일한 함수)
function uuidToField(uuid: string): string {
  const hash = crypto.createHash("sha256").update(uuid).digest("hex");

  // Babyjub / BN254 Field prime
  const FIELD = BigInt(
    "21888242871839275222246405745257275088548364400416034343698204186575808495617"
  );

  return (BigInt("0x" + hash) % FIELD).toString();
}

export async function GET(
  req: NextRequest,
  { params }: { params: { pollId: string } }
) {
  try {
    await dbConnect();

    const { pollId } = params; // UUID

    // 1) Poll document 찾기 (UUID 저장되어 있음)
    const poll = await Poll.findOne({ pollId }).lean();
    if (!poll) {
      return NextResponse.json(
        { success: false, message: "투표를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 2) UUID → pollIdSignal로 변환
    const pollIdSignal = uuidToField(pollId);

    // 3) 최신 투표만 집계 (nullifierHash 기준 최신 voteIndex)
    const aggregated = await Vote.aggregate([
      { $match: { pollId: pollIdSignal } }, // <-- 핵심: field 값으로 매칭

      {
        $group: {
          _id: "$nullifierHash",         // 같은 유저의 재투표 → 하나로 묶임
          voteIndex: { $last: "$voteIndex" } // 최신 투표만 반영
        }
      },
      {
        $group: {
          _id: "$voteIndex",
          votes: { $sum: 1 }
        }
      }
    ]);

    // 후보 label 매핑 준비
    const resultsMap: Record<
      string,
      { candidate: string; label: string; votes: number }
    > = {};

    poll.candidates.forEach((c: any) => {
      resultsMap[c.id] = {
        candidate: c.id,
        label: c.label,
        votes: 0,
      };
    });

    // 4) 실제 집계 데이터 반영
    aggregated.forEach((item) => {
      const id = String(item._id);
      if (resultsMap[id]) {
        resultsMap[id].votes = item.votes;
      }
    });

    // 결과 정렬 (득표수 DESC)
    const results = Object.values(resultsMap).sort(
      (a, b) => b.votes - a.votes
    );

    // 5) 최종 응답
    return NextResponse.json(
      {
        success: true,
        data: {
          pollId,
          title: poll.title,
          results,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get Poll Results API Error:", error);
    return NextResponse.json(
      { success: false, message: "서버 오류" },
      { status: 500 }
    );
  }
}
