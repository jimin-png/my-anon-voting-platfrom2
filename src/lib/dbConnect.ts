import mongoose, { Mongoose } from 'mongoose';

// 🚨 디버깅용 환경 변수 확인
console.log(
  "ENV CHECK: NEXTAUTH_SECRET length:",
  process.env.NEXTAUTH_SECRET ? process.env.NEXTAUTH_SECRET.length : "UNDEFINED"
);
console.log(
  "ENV CHECK: CONTRACT_ADDRESS_VOTING:",
  process.env.CONTRACT_ADDRESS_VOTING ? "RECEIVED" : "UNDEFINED"
);

// 1. DB_URI 환경 변수 읽기
const DB_URI: string = process.env.DB_URI || "";
if (!DB_URI) {
  throw new Error(
    "Please define the DB_URI environment variable in your environment settings."
  );
}

// 2. 글로벌 캐싱 변수 정의
interface Cached {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

interface GlobalWithMongoose {
  mongoose?: Cached;
}

const globalForMongoose = global as GlobalWithMongoose;

let cached: Cached = globalForMongoose.mongoose || { conn: null, promise: null };
if (!globalForMongoose.mongoose) {
  globalForMongoose.mongoose = cached;
}

// 3. DB 연결 함수
export default async function dbConnect(): Promise<Mongoose> {

  // ⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇ 추가된 부분 (테스트 환경에서 캐싱 제거)
  if (process.env.NODE_ENV === "test") {
    cached.conn = null;
    cached.promise = null;
  }
  // ⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆ 여기만 새로 추가됨

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(DB_URI, {
      bufferCommands: false,
    });
  }

  try {
    cached.conn = await cached.promise;
    console.log("✅ MongoDB connected successfully");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    console.error(
      "🔍 DB_URI (sanitized):",
      DB_URI.replace(/\/\/.*@/, "//<credentials>@")
    );
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}
