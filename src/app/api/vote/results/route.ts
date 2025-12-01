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

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Vote from '@/models/Vote';

interface VoteResult {
    candidate: string;
    count: number;
}

export async function GET(req: NextRequest) {
    try {
        await dbConnect();

        const { searchParams } = new URL(req.url);
        const pollId = searchParams.get('pollId');

        // ============================================
        // 1. 필터링 단계
        // ============================================
        // pollId가 있으면 해당 투표만, 없으면 전체
        const matchStage = pollId ? { $match: { pollId } } : { $match: {} };

        // ============================================
        // 2. 집계 파이프라인 (재투표 처리 포함)
        // ============================================
        // 재투표(업데이트)를 고려하여 최신 투표만 집계
        const aggregationPipeline = [
            matchStage,
            {
                // nullifierHash가 있으면 nullifierHash별, 없으면 voter별로 그룹화
                $group: {
                    _id: {
                        $cond: [
                            { $ifNull: ['$nullifierHash', false] },
                            '$nullifierHash',
                            { $toString: '$voter' } // nullifierHash가 없으면 voter ID 사용
                        ]
                    },
                    candidate: { $last: '$candidate' }, // 최신 투표의 candidate
                    pollId: { $first: '$pollId' },
                },
            },
            {
                // candidate별로 집계
                $group: {
                    _id: '$candidate',
                    count: { $sum: 1 },
                },
            },
            {
                $project: {
                    _id: 0,
                    candidate: '$_id',
                    count: 1,
                },
            },
            {
                $sort: { count: -1 as const },
            },
        ];

        const results = await Vote.aggregate<VoteResult>(aggregationPipeline);
        
        // 총 투표 수 계산 (nullifierHash 또는 voter별로 중복 제거)
        const uniqueVotes = await Vote.aggregate([
            matchStage,
            {
                $group: {
                    _id: {
                        $cond: [
                            { $ifNull: ['$nullifierHash', false] },
                            '$nullifierHash',
                            { $toString: '$voter' }
                        ]
                    },
                },
            },
        ]);
        const totalVotes = uniqueVotes.length;

        return NextResponse.json(
            {
                success: true,
                pollId: pollId || null,
                totalVotes,
                results,
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        console.error('Results API Error:', error);

        const errorMessage = error instanceof Error ? error.message : String(error);

        return NextResponse.json(
            {
                success: false,
                message: 'Internal Server Error during results aggregation.',
                details: errorMessage,
            },
            { status: 500 }
        );
    }
}