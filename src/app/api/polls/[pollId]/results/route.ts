// src/app/api/polls/[pollId]/results/route.ts
import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/dbConnect"
import Poll from "@/models/Poll"
import Vote from "@/models/Vote"

export async function GET(
  req: NextRequest,
  { params }: { params: { pollId: string } }
) {
  try {
    await dbConnect()

    const { pollId } = params // UUID

    // Poll 찾기
    const poll = await Poll.findOne({ pollId }).lean()
    if (!poll) {
      return NextResponse.json(
        { success: false, message: "투표를 찾을 수 없습니다." },
        { status: 404 }
      )
    }

    // 최신 투표 집계
    const aggregated = await Vote.aggregate([
      { $match: { pollId } },   // ⭐ UUID로 조회해야 DB와 매칭됨

      {
        $group: {
          _id: "$nullifierHash",
          voteIndex: { $last: "$voteIndex" },
        },
      },
      {
        $group: {
          _id: "$voteIndex",
          votes: { $sum: 1 },
        },
      },
    ])

    // label 매핑
    const resultsMap: Record<
      string,
      { candidate: string; label: string; votes: number }
    > = {}

    poll.candidates.forEach((c: any) => {
      resultsMap[c.id] = {
        candidate: c.id,
        label: c.label,
        votes: 0,
      }
    })

    aggregated.forEach((item) => {
      const id = String(item._id)
      if (resultsMap[id]) {
        resultsMap[id].votes = item.votes
      }
    })

    const results = Object.values(resultsMap).sort((a, b) => b.votes - a.votes)

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
    )
  } catch (error) {
    console.error("Get Poll Results API Error:", error)
    return NextResponse.json(
      { success: false, message: "서버 오류" },
      { status: 500 }
    )
  }
}
