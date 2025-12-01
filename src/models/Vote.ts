/**
 * 투표 모델
 * 
 * 사용자가 제출한 투표 정보를 저장합니다.
 * 
 * 주요 필드:
 * - pollId: 어떤 투표에 참여했는지
 * - voter: 누가 투표했는지 (Voter 모델 참조)
 * - candidate: 어떤 후보를 선택했는지
 * - nullifierHash: ZKP에서 생성한 고유 식별자 (중복 방지용)
 * - txHash: 블록체인 트랜잭션 해시
 * 
 * 중복 방지:
 * - UNIQUE 인덱스: (pollId, nullifierHash) 조합은 유일해야 함
 * - 같은 pollId에서 같은 nullifierHash로 재투표 시 업데이트 처리
 * - 다른 pollId에서 같은 nullifierHash 사용은 허용 (선거별 1인 1표)
 */

import mongoose, { Schema, models, Model, Types } from 'mongoose';

/**
 * 투표 인터페이스
 */
export interface IVote {
  pollId: string; // 투표 ID (어떤 투표에 참여했는지)
  voter: Types.ObjectId; // 유권자 ID (Voter 모델 참조)
  candidate: string; // 선택한 후보 ID
  timestamp?: Date; // 투표 시간
  txHash?: string; // 블록체인 트랜잭션 해시
  nullifierHash?: string; // ZKP nullifier 해시 (중복 방지용)
}

/**
 * 투표 스키마 정의
 */
const VoteSchema = new Schema<IVote>({
  pollId: { type: String, required: true, index: true }, // 투표 ID (인덱스)
  voter: { type: Schema.Types.ObjectId, ref: 'Voter', required: true }, // 유권자 참조
  candidate: { type: String, required: true }, // 후보 ID
  timestamp: { type: Date, default: Date.now }, // 투표 시간 (기본값: 현재 시간)
  txHash: { type: String }, // 트랜잭션 해시 (선택)
  nullifierHash: { type: String, index: true }, // nullifier 해시 (인덱스, 선택)
});

/**
 * 복합 유니크 인덱스
 * 
 * (pollId, nullifierHash) 조합은 유일해야 함
 * - 같은 pollId에서 같은 nullifierHash로 재투표 시 중복 차단
 * - sparse: true → nullifierHash가 없는 경우 인덱스에서 제외 (기존 투표 호환)
 * 
 * 예시:
 * - pollId: "poll-1", nullifierHash: "0xabc" → ✅ 허용
 * - pollId: "poll-1", nullifierHash: "0xabc" → ❌ 중복 (409 오류)
 * - pollId: "poll-2", nullifierHash: "0xabc" → ✅ 허용 (다른 투표)
 */
VoteSchema.index({ pollId: 1, nullifierHash: 1 }, { unique: true, sparse: true });

const Vote: Model<IVote> =
  (models.Vote as Model<IVote>) || mongoose.model<IVote>('Vote', VoteSchema);
export default Vote;
