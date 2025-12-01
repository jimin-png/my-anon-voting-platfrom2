/**
 * 블록체인 서비스
 * 
 * 블록체인과 통신하여 트랜잭션 정보를 조회합니다.
 */

import { ethers } from 'ethers';

// ============================================
// 환경 변수
// ============================================
const INFURA_URL = process.env.INFURA_URL || process.env.RPC_URL;

/**
 * 트랜잭션의 컨펌 횟수를 조회합니다.
 * 
 * 컨펌 횟수 = 현재 블록 번호 - 트랜잭션이 포함된 블록 번호 + 1
 * 
 * 예시:
 * - 트랜잭션이 블록 100에 포함됨
 * - 현재 블록이 101이면 → 컨펌 2회
 * - 현재 블록이 100이면 → 컨펌 1회
 * 
 * @param txHash 조회할 트랜잭션 해시
 * @returns 컨펌 횟수
 *   - null: 트랜잭션을 찾을 수 없음 (아직 블록에 포함되지 않음)
 *   - 0: 트랜잭션이 블록에 포함되었지만 아직 컨펌 없음
 *   - 1 이상: 컨펌 횟수
 * 
 * @throws RPC URL이 설정되지 않은 경우
 */
export async function getConfirmations(txHash: string): Promise<number | null> {
  if (!INFURA_URL) {
    console.error('INFURA_URL or RPC_URL is not set');
    throw new Error('RPC URL is not configured');
  }

  try {
    const provider = new ethers.JsonRpcProvider(INFURA_URL);
    
    // 1. 트랜잭션 영수증 조회
    // 영수증이 있으면 트랜잭션이 블록에 포함된 것
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) return null; // 트랜잭션을 찾을 수 없음
    if (!receipt.blockNumber) return 0; // 블록 번호가 없음 (이론적으로 발생하지 않음)
    
    // 2. 현재 블록 번호 조회
    const currentBlock = await provider.getBlockNumber();
    
    // 3. 컨펌 횟수 계산
    // 컨펌 = 현재 블록 - 트랜잭션 블록 + 1
    return Math.max(0, currentBlock - Number(receipt.blockNumber) + 1);
  } catch (err) {
    console.error('getConfirmations err', err);
    throw err;
  }
}
