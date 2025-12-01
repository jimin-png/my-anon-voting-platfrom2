// models/User.ts (Backend A의 실제 코드가 들어와야 함)

import mongoose from 'mongoose';

// 임시 스키마 정의 (실제 코드로 반드시 교체해야 함)
const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    publicKey: { type: String, required: true },
});

// Next.js 환경에 맞게 export
export default mongoose.models.User || mongoose.model('User', userSchema);