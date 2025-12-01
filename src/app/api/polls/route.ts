/**
 * 투표 관리 API
 * 
 * POST /api/polls - 투표 생성
 * GET /api/polls?creator=0x... - 생성자가 만든 투표 목록 조회
 * 
 * 관리자가 투표를 생성하고 조회하는 엔드포인트입니다.
 * 
 * 투표 생성:
 * 1. 요청 데이터 검증 (Zod 스키마)
 * 2. pollId 생성 (UUID v4)
 * 3. DB에 저장
 * 
 * 투표 목록 조회:
 * - creator 파라미터로 필터링 가능
 * - 없으면 전체 투표 목록 반환
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import Poll from '@/models/Poll';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// 요청 데이터 검증 스키마 (Zod)
// ============================================
const createPollSchema = z.object({
  creatorWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, '올바른 지갑 주소 형식이 아닙니다.'),
  title: z.string().min(1, '제목은 필수입니다.'),
  description: z.string().optional(),
  candidates: z
    .array(
      z.object({
        id: z.string().min(1, '후보 ID는 필수입니다.'),
        label: z.string().min(1, '후보 이름은 필수입니다.'),
      })
    )
    .min(1, '최소 1개 이상의 후보가 필요합니다.'),
  startTime: z.string().datetime().or(z.date()),
  endTime: z.string().datetime().or(z.date()),
  merkleRoot: z.string().optional(),
});

// 투표 생성
export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const body = await req.json();
    const validated = createPollSchema.parse(body);

    // pollId 생성
    const pollId = uuidv4();

    // 날짜 변환
    const startTime = typeof validated.startTime === 'string' ? new Date(validated.startTime) : validated.startTime;
    const endTime = typeof validated.endTime === 'string' ? new Date(validated.endTime) : validated.endTime;

    // 마감 시간 검증
    if (endTime <= startTime) {
      return NextResponse.json(
        { success: false, message: '마감 시간은 시작 시간보다 늦어야 합니다.' },
        { status: 400 }
      );
    }

    const poll = await Poll.create({
      pollId,
      creatorWallet: validated.creatorWallet,
      title: validated.title,
      description: validated.description,
      candidates: validated.candidates,
      startTime,
      endTime,
      merkleRoot: validated.merkleRoot,
    });

    return NextResponse.json(
      {
        success: true,
        message: '투표가 생성되었습니다.',
        data: poll,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Create Poll API Error:', error);

    if (error instanceof z.ZodError) {
      const firstMessage = error.issues[0]?.message ?? '유효성 검사에 실패했습니다.';
      return NextResponse.json({ success: false, message: firstMessage, details: error.issues }, { status: 400 });
    }

    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      return NextResponse.json({ success: false, message: '이미 존재하는 pollId입니다.' }, { status: 409 });
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.', details: errorMessage },
      { status: 500 }
    );
  }
}

// 투표 목록 조회 (생성자별)
export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const creator = searchParams.get('creator');

    if (creator) {
      // 특정 생성자의 투표 목록
      const polls = await Poll.find({ creatorWallet: creator })
        .sort({ createdAt: -1 })
        .lean();

      return NextResponse.json(
        {
          success: true,
          data: polls,
          count: polls.length,
        },
        { status: 200 }
      );
    }

    // 전체 목록 (최근 50개)
    const polls = await Poll.find().sort({ createdAt: -1 }).limit(50).lean();

    return NextResponse.json(
      {
        success: true,
        data: polls,
        count: polls.length,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('Get Polls API Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.', details: errorMessage },
      { status: 500 }
    );
  }
}

