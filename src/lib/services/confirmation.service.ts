/**
 * 트랜잭션 컨펌 추적 서비스
 * 
 * Relayer가 보낸 트랜잭션이 블록체인에 확정될 때까지 추적합니다.
 * 컨펌 2회가 완료되면 성공으로 처리합니다.
 * 
 * 왜 컨펌 2회인가?
 * - 블록체인은 포크(분기)가 발생할 수 있음
 * - 1회 컨펌: 아직 취소될 수 있음
 * - 2회 컨펌: 안전하게 확정됨 (일반적으로 충분)
 */

import { ethers } from 'ethers';

// ============================================
// 설정
// ============================================
const INFURA_URL = process.env.INFURA_URL;
const CONFIRMATION_COUNT = 2; // 목표: 최소 2회 컨펌

/**
 * 밀리초만큼 대기하는 헬퍼 함수
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 트랜잭션의 컨펌 횟수를 추적하고 목표 횟수에 도달할 때까지 대기합니다.
 * 
 * 동작 방식:
 * 1. 트랜잭션 영수증(receipt) 조회
 * 2. 현재 블록 번호와 트랜잭션이 포함된 블록 번호 비교
 * 3. 컨펌 횟수 = 현재 블록 - 트랜잭션 블록 + 1
 * 4. 목표 컨펌 횟수(2회)에 도달하면 성공
 * 5. 도달하지 못하면 지수 백오프로 재시도
 * 
 * @param txHash 전송된 트랜잭션 해시
 * @param pollId 관련 투표 ID (로깅용)
 * @param nonce 사용된 Nonce 값 (로깅용)
 * 
 * @example
 * 트랜잭션이 블록 100에 포함됨, 현재 블록 101 → 컨펌 2회 → 성공
 * 트랜잭션이 블록 100에 포함됨, 현재 블록 100 → 컨펌 1회 → 재시도
 */
export async function trackTransactionConfirmation(
    txHash: string,
    pollId: string,
    nonce: number
) {
    console.log(`[Confirmation Tracker] Tx ${txHash} tracking started. Poll ID: ${pollId}, Nonce: ${nonce}`);

    if (!INFURA_URL) {
        console.error("INFURA_URL is not set. Cannot track transaction.");
        return;
    }

    const provider = new ethers.JsonRpcProvider(INFURA_URL);
    const MAX_ATTEMPTS = 10; // 최대 재시도 횟수
    let attempt = 0;

    // 재시도 루프
    while (attempt < MAX_ATTEMPTS) {
        attempt++;
        // 지수 백오프: 2초, 4초, 8초, 16초...
        let delay = Math.pow(2, attempt) * 1000;

        try {
            // 1. 트랜잭션 영수증 조회
            // 영수증이 있으면 트랜잭션이 블록에 포함된 것
            const receipt = await provider.getTransactionReceipt(txHash);

            if (receipt && receipt.blockNumber) {
                // 2. 컨펌 횟수 계산
                // 컨펌 = 현재 블록 - 트랜잭션 블록 + 1
                // 예: 트랜잭션이 블록 100에 있고 현재 블록이 101이면 컨펌 2회
                const currentBlock = await provider.getBlockNumber();
                const confirmations = currentBlock - receipt.blockNumber + 1;

                if (confirmations >= CONFIRMATION_COUNT) {
                    // ✅ 목표 컨펌 횟수 달성 → 성공
                    console.log(`[Confirmation Success] Tx ${txHash} confirmed with ${confirmations} blocks.`);
                    return; // 함수 종료 (성공)
                } else {
                    // ⏳ 컨펌 횟수 부족 → 재시도
                    console.log(`[Confirmation Pending] Tx ${txHash} has ${confirmations}/${CONFIRMATION_COUNT} confirmations. Retrying in ${delay}ms.`);
                }
            } else {
                // ⏳ 트랜잭션이 아직 블록에 포함되지 않음 → 재시도
                console.log(`[Confirmation Pending] Tx ${txHash} is still pending. Retrying in ${delay}ms.`);
            }

        } catch (error) {
            // ❌ 오류 발생 → 재시도
            console.error(`[Confirmation Error] Tx ${txHash} attempt ${attempt} failed:`, error);
        }

        // 마지막 시도가 아니면 대기 후 재시도
        if (attempt < MAX_ATTEMPTS) {
            await sleep(delay);
        }
    }

    // ❌ 최대 재시도 횟수 초과 → 실패
    console.error(`[Confirmation Failure] Tx ${txHash} failed after ${MAX_ATTEMPTS} attempts. Requires manual investigation.`);
}