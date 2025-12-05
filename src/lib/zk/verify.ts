// src/lib/zk/verify.ts
import { groth16 } from "snarkjs";
import fs from "fs";
import path from "path";

// verification_key.json 경로
const vKeyPath = path.join(process.cwd(), "src", "lib", "zk", "verification_key.json");

export async function verify(
  proof: any,
  publicSignalsArray: any[]
): Promise<boolean> {
  try {
    const vKey = JSON.parse(fs.readFileSync(vKeyPath, "utf8"));
    const result = await groth16.verify(vKey, publicSignalsArray, proof);
    return result === true;
  } catch (err) {
    console.error("ZKP verify error:", err);
    return false;
  }
}
