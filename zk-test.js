// zk-test.js
// Node 환경에서 ZK Proof를 단독 테스트하는 파일

import { verify } from "./src/lib/zk/verify.node.js";

// TODO: 프론트에서 실제 값 받아서 여기에 넣기
const proof = {
  // ... 프론트에서 받은 proof 전체 복붙
};

const publicSignals = {
  root: "",
  pollId: "",
  nullifierHash: "",
  voteCommitment: ""
};

// 배열 변환
const signalsArray = [
  publicSignals.root,
  publicSignals.pollId,
  publicSignals.nullifierHash,
  publicSignals.voteCommitment,
];

(async () => {
  console.log("Running ZK Proof Test...");
  const result = await verify(proof, signalsArray);
  console.log("verify result:", result);
})();
