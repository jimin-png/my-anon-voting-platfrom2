import mongoose, { Schema, Model, models } from 'mongoose';

export interface IVoter {
  name?: string; // 선택값 (WBS: QR 찍고 메타마스크 연결 시 자동 등록)
  walletAddress: string; // 고유 식별자: 지갑 주소
  studentId?: string | null; // 선택값
  hasVoted?: boolean;
}

const VoterSchema = new Schema<IVoter>(
  {
    name: { type: String }, // 선택값으로 변경 (WBS 일치)
    walletAddress: { type: String, required: true, unique: true, index: true },
    studentId: { type: String },
    hasVoted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 핫리로드 대비: 기존 모델 재사용
export const Voter: Model<IVoter> =
  (models.Voter as Model<IVoter>) ||
  mongoose.model<IVoter>('Voter', VoterSchema);
export default Voter;
