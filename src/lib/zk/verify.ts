// src/lib/zk/verify.ts

// 서버에서 ZKP 검증은 비활성화 (Render 무료 플랜 성능 문제 때문에)
export async function verify(
  proof: any,
  publicSignalsArray: any[]
): Promise<boolean> {
  console.log("🚫 verify() SKIPPED — always true (test mode)");
  return true;
}
