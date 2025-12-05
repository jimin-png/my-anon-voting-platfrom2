// src/lib/zk/verify.ts

// @ts-ignore
import { groth16 } from "snarkjs";
import fs from "fs";
import path from "path";

// verification_key.json 파일 위치 필요
const vKeyPath = path.join(process.cwd(), "zk", "verification_key.json");

export async function verify(proof: any, publicSignals: any): Promise<boolean> {
  try {
    const vKey = JSON.parse(fs.readFileSync(vKeyPath, "utf8"));
    const result = await groth16.verify(vKey, publicSignals, proof);
    return result === true;
  } catch (err) {
    console.error("ZKP verify error:", err);
    return false;
  }
}
