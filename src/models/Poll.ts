// src/models/Poll.ts
import mongoose, { Schema, Model, models, Model as MongooseModel, Types } from 'mongoose';

export interface IPoll {
  pollId: string; // 고유 투표 ID
  creatorWallet: string; // 생성자 지갑 주소
  title: string; // 투표 제목
  description?: string; // 설명
  candidates: Array<{ id: string; label: string }>; // 후보 목록
  startTime: Date; // 시작 시간
  endTime: Date; // 마감 시간
  merkleRoot?: string; // Merkle Root (선택)
  createdAt: Date;
  updatedAt: Date;
}

const PollSchema = new Schema<IPoll>(
  {
    pollId: { type: String, required: true, unique: true, index: true },
    creatorWallet: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String },
    candidates: [
      {
        id: { type: String, required: true },
        label: { type: String, required: true },
      },
    ],
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    merkleRoot: { type: String },
  },
  { timestamps: true }
);

// 인덱스 추가
PollSchema.index({ creatorWallet: 1, createdAt: -1 });
PollSchema.index({ endTime: 1 });

const Poll: MongooseModel<IPoll> =
  (models.Poll as MongooseModel<IPoll>) || mongoose.model<IPoll>('Poll', PollSchema);

export default Poll;

