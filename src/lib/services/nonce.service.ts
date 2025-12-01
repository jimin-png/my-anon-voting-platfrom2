/**
 * Nonce 관리 서비스
 * 
 * Relayer가 트랜잭션을 보낼 때 사용하는 Nonce를 관리합니다.
 * Nonce는 트랜잭션의 순서를 보장하는 중요한 값입니다.
 * 
 * 문제: 여러 트랜잭션을 동시에 보낼 때 Nonce가 중복되면 실패합니다.
 * 해결: 블록체인에서 조회한 Nonce와 서버 캐시의 Nonce를 비교하여
 *      더 큰 값을 사용하여 충돌을 방지합니다.
 */

import { ethers } from 'ethers';

// ============================================
// 환경 변수 및 초기화
// ============================================
// 주의: 이 파일은 모듈 로드 시점에 실행되므로,
// Jest 테스트에서는 환경 변수를 미리 설정해야 합니다.
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
if (!RELAYER_PRIVATE_KEY) {
    // 테스트 환경에서는 명시적 설정 필요
    if (process.env.NODE_ENV === 'test') {
        throw new Error("RELAYER_PRIVATE_KEY environment variable is not set. Please set it in your test setup.");
    }
    throw new Error("RELAYER_PRIVATE_KEY environment variable is not set.");
}

// Private Key로부터 Relayer 지갑 주소 추출
const relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY);
const RELAYER_ADDRESS = relayerWallet.address;

// Nonce 캐시 (메모리 기반)
// 키: 지갑 주소, 값: 다음에 사용할 Nonce
// 프로덕션에서는 Redis 사용 권장
const nonceCache = new Map<string, number>();

/**
 * 다음에 사용할 Nonce를 계산하여 반환합니다.
 * 
 * 동작 방식:
 * 1. 블록체인에서 현재 Nonce 조회 (pending 트랜잭션 포함)
 * 2. 서버 캐시에서 저장된 Nonce 조회
 * 3. 둘 중 더 큰 값을 사용 (충돌 방지)
 * 4. 캐시에 다음 Nonce(nextNonce + 1) 저장
 * 
 * @param provider Ethers.js Provider 객체 (블록체인 연결)
 * @returns 다음에 사용할 Nonce 값
 * 
 * @example
 * 블록체인 Nonce: 5, 캐시 Nonce: 7 → 반환: 7, 캐시 업데이트: 8
 * 블록체인 Nonce: 10, 캐시 Nonce: 7 → 반환: 10, 캐시 업데이트: 11
 */
export async function getNextNonce(provider: ethers.JsonRpcProvider): Promise<number> {
    // 1. 블록체인에서 현재 Nonce 조회
    // 'pending' 옵션: 아직 블록에 포함되지 않은 트랜잭션도 포함
    const networkNonce = await provider.getTransactionCount(RELAYER_ADDRESS, 'pending');

    // 2. 서버 캐시에서 Nonce 조회 (없으면 0)
    const cachedNonce = nonceCache.get(RELAYER_ADDRESS) || 0;

    // 3. 핵심 로직: Nonce 충돌 방지
    // 블록체인 Nonce와 캐시 Nonce 중 더 큰 값을 사용
    // 이유: 서버가 여러 트랜잭션을 빠르게 보낼 때 블록체인에 아직 반영되지 않았을 수 있음
    const nextNonce = Math.max(networkNonce, cachedNonce);

    // 4. 캐시 업데이트: 다음 트랜잭션을 위해 nextNonce + 1 저장
    nonceCache.set(RELAYER_ADDRESS, nextNonce + 1);

    console.log(`[Nonce Service] Using Nonce ${nextNonce}. Cached next nonce: ${nextNonce + 1}`);

    // 5. 현재 트랜잭션에 사용할 Nonce 반환
    return nextNonce;
}