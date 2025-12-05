import { groth16 } from "snarkjs";
import fs from "fs";
import path from "path";

export async function verify(proof, publicSignals) {
  try {
    const vKeyPath = path.join(
      process.cwd(),
      "src",
      "lib",
      "zk",
      "verification_key.json"
    );

    const vKey = JSON.parse(fs.readFileSync(vKeyPath, "utf8"));
    const result = await groth16.verify(vKey, publicSignals, proof);
    return result === true;
  } catch (err) {
    console.error("ZKP verify error:", err);
    return false;
  }
}
