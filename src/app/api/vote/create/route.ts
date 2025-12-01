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

import dbConnect from '@/lib/dbConnect';
import Vote from '@/models/Vote';
import Voter from '@/models/Voter';

export async function POST(req: Request) {
  try {
    await dbConnect();

    const body = await req.json();

    // ============================================
    // 1. 필수 필드 검증
    // ============================================
    // pollId: 투표 ID (어떤 투표에 참여하는지)
    // walletAddress: 지갑 주소 (누가 투표하는지)
    // candidate: 선택한 후보 (어떤 후보를 선택했는지)
    // nullifierHash: ZKP에서 생성한 고유 식별자 (중복 방지용)
    const pollId = body?.pollId as string | undefined;
    const walletAddress = body?.walletAddress as string | undefined;
    const candidate = body?.candidate as string | undefined;
    const nullifierHash = body?.nullifierHash as string | undefined;

    if (!pollId || !walletAddress || !candidate) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'pollId, walletAddress, candidate 필수',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1) 유권자 조회 또는 자동 등록 (WBS: QR 찍고 메타마스크 연결 = 자동 유권자)
    let voterDoc = await Voter.findOne({ walletAddress }).lean();
    
    if (!voterDoc?._id) {
      // 유권자가 없으면 자동 등록
      // WBS 요구사항: QR 찍고 메타마스크 연결 시 자동으로 유효한 투표권자 인정
      // ZKP Proof 검증은 블록체인 컨트랙트에서 처리되므로, 여기서는 자동 등록만 수행
      const newVoter = await Voter.create({
        walletAddress,
        name: body?.name || `Voter-${walletAddress.slice(0, 8)}`, // name이 없으면 기본값 사용
        studentId: body?.studentId || null, // 선택값
      });
      
      voterDoc = newVoter.toObject();
      console.log(`[Auto Register] New voter registered: ${walletAddress}`);
    }
    
    // 2) 중복 투표 방지 (pollId + nullifierHash 조합 확인)
    if (nullifierHash) {
      const existingVote = await Vote.findOne({ pollId, nullifierHash });
      if (existingVote) {
        // 재투표인 경우 업데이트
        existingVote.candidate = candidate;
        existingVote.txHash = body?.txHash;
        await existingVote.save();
        
        return new Response(
          JSON.stringify({
            success: true,
            message: '투표가 업데이트되었습니다.',
            data: { _id: existingVote._id, pollId, voter: voterDoc._id, candidate },
            isUpdate: true,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // nullifierHash가 없으면 기존 방식으로 중복 체크
      const already = await Vote.exists({ pollId, voter: voterDoc._id });
      if (already) {
        return new Response(
          JSON.stringify({ success: false, message: '이미 투표하였습니다.' }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // 3) 투표 저장
    const newVote = await Vote.create({
      pollId,
      voter: voterDoc._id,
      candidate,
      nullifierHash,
      txHash: body?.txHash,
    });

    // (선택) 유권자 상태 플래그 업데이트
    // await Voter.updateOne({ _id: voterDoc._id }, { $set: { hasVoted: true } });

      return new Response(
        JSON.stringify({
          success: true,
          message: '투표 기록 완료',
          data: { _id: newVote._id, pollId, voter: voterDoc._id, candidate },
          isUpdate: false,
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      return new Response(
        JSON.stringify({ success: false, message: '이미 투표하였습니다.' }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }
      );
    }
    console.error('API Error /api/vote/create:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, message: 'Internal Server Error', details: errorMessage }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }
}
