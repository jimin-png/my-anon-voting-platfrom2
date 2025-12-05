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


import mongoose, { Schema, models, Model, Types } from "mongoose";

export interface IVote {
  pollId: string;
  root: string;
  nullifierHash: string;
  voteCommitment: string;
  voteIndex: number;
  voter?: Types.ObjectId; // optional
  createdAt?: Date;
}

const VoteSchema = new Schema<IVote>(
  {
    pollId: { type: String, required: true, index: true },

    // ZKP 필드
    root: { type: String, required: true },
    nullifierHash: { type: String, required: true },
    voteCommitment: { type: String, required: true },

    // 집계용 index (정수)
    voteIndex: { type: Number, required: true },

    // optional
    voter: { type: Schema.Types.ObjectId, ref: "Voter" },
  },
  { timestamps: true }
);

// pollId + nullifierHash = 선거별 1인 1표
VoteSchema.index({ pollId: 1, nullifierHash: 1 }, { unique: true });

const Vote: Model<IVote> =
  models.Vote || mongoose.model<IVote>("Vote", VoteSchema);

export default Vote;
