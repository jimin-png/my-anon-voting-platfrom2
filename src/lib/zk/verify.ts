import { groth16 } from "snarkjs";

// JSON을 직접 import → Webpack 번들에 포함됨
import vKey from "./verification_key.json";

export async function verify(
  proof: any,
  publicSignalsArray: any[]
): Promise<boolean> {
  try {
    const result = await groth16.verify(vKey as any, publicSignalsArray, proof);
    return result === true;
  } catch (err) {
    console.error("ZKP verify error:", err);
    return false;
  }
}
