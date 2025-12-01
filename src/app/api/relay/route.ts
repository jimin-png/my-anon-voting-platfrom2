/**
 * Relayer API
 * 
 * 사용자 대신 가스를 지불하여 트랜잭션을 전송합니다.
 * 
 * 동작 방식:
 * 1. 요청 데이터 검증 (Zod)
 * 2. Nonce 자동 관리 (중복 방지)
 * 3. 트랜잭션 전송 (최대 2회 재시도)
 * 4. 컨펌 추적 (비동기, 응답은 즉시 반환)
 * 
 * 왜 Relayer가 필요한가?
 * - 사용자가 가스비를 지불하지 않아도 됨
 * - 투표 참여 장벽을 낮춤
 */

import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { z } from 'zod';
import { getNextNonce } from '@/lib/services/nonce.service';
import { trackTransactionConfirmation } from '@/lib/services/confirmation.service';

// ============================================
// 환경 변수
// ============================================
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY!;
const INFURA_URL = process.env.INFURA_URL!;

// ============================================
// 재시도 설정
// ============================================
// 7주차 요구사항: 실패 시 최대 2회 재시도
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000; // 재시도 간 대기 시간 (1초)

// ============================================
// 요청 데이터 검증 스키마 (Zod)
// ============================================
const relaySchema = z.object({
    // 컨트랙트 주소 (0x로 시작하는 16진수 문자열)
    to: z.string({ message: "to 필드는 0x로 시작해야 합니다." }).startsWith("0x"),
    
    // 인코딩된 함수 호출 데이터 (0x로 시작하는 16진수 문자열)
    data: z.string({ message: "data 필드는 0x로 시작해야 합니다." }).startsWith("0x"),

    // 투표 ID (필수)
    pollId: z.string({ message: "pollId는 필수입니다." }).min(1, { message: "pollId는 비어있을 수 없습니다." }),

    // 체인 ID (양의 정수, 예: 11155111 = Sepolia)
    chainId: z.number({ message: "chainId는 필수입니다." }).int().positive({ message: "chainId는 유효한 숫자여야 합니다." }),

    // 트랜잭션 만료 시간 (Unix 타임스탬프)
    deadline: z.number({ message: "deadline은 필수입니다." }).int().positive({ message: "deadline은 유효한 숫자여야 합니다." }),
});

/**
 * Relayer API 엔드포인트
 * 
 * POST /api/relay
 * 
 * 요청 예시:
 * {
 *   "to": "0x...",
 *   "data": "0x...",
 *   "pollId": "test-poll",
 *   "chainId": 11155111,
 *   "deadline": 1234567890
 * }
 */
export async function POST(req: NextRequest) {
    // ============================================
    // 1. 환경 변수 확인
    // ============================================
    if (!INFURA_URL || !RELAYER_PRIVATE_KEY) {
        console.error("Configuration Error: Relayer secrets missing.");
        return NextResponse.json({ message: "서버 설정 오류: 필수 환경 변수 누락." }, { status: 500 });
    }

    try {
        // ============================================
        // 2. 요청 데이터 검증
        // ============================================
        const body = await req.json();
        const validated = relaySchema.parse(body); // Zod로 검증

        // ============================================
        // 2-1. Deadline 검증 (만료 시간 확인)
        // ============================================
        // deadline은 Unix 타임스탬프로, 현재 시간보다 미래여야 함
        const now = Math.floor(Date.now() / 1000); // 현재 시간 (초 단위)
        if (validated.deadline <= now) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Transaction deadline has expired.",
                    details: `Deadline: ${validated.deadline}, Current: ${now}`,
                },
                { status: 400 }
            );
        }

        // ============================================
        // 3. 블록체인 연결 설정
        // ============================================
        const provider = new ethers.JsonRpcProvider(INFURA_URL);
        const relayer = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

        // ============================================
        // 4. 재시도 로직 (최대 2회 재시도)
        // ============================================
        // 네트워크 지연이나 가스 추정 실패 등 일시적 오류에 대응
        let lastError: unknown = null;
        let tx: ethers.TransactionResponse | null = null;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                // 4-1. Nonce 확보 (트랜잭션 순서 보장, 중복 방지)
                const nonce = await getNextNonce(provider);

                // 4-2. 트랜잭션 전송
                tx = await relayer.sendTransaction({
                    to: validated.to,           // 컨트랙트 주소
                    data: validated.data,        // 인코딩된 함수 호출
                    nonce,                       // 트랜잭션 순서
                    chainId: validated.chainId, // 체인 ID
                    gasLimit: 300000,            // 가스 한도 (넉넉하게 설정)
                    maxFeePerGas: ethers.parseUnits("3", "gwei"),      // 최대 가스비
                    maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"), // 우선순위 가스비
                });

                console.log(`[Relayer] Transaction sent successfully on attempt ${attempt + 1}/${MAX_RETRIES + 1}. TxHash: ${tx.hash}`);
                break; // ✅ 성공 시 루프 종료
            } catch (error: unknown) {
                lastError = error;
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`[Relayer] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, errorMessage);

                // 마지막 시도가 아니면 1초 대기 후 재시도
                if (attempt < MAX_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                    continue;
                }
            }
        }

        // ============================================
        // 5. 모든 시도 실패 처리
        // ============================================
        if (!tx) {
            const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
            console.error(`[Relayer] All ${MAX_RETRIES + 1} attempts failed`);
            return NextResponse.json(
                {
                    success: false,
                    error: "Relay transaction failed after retries.",
                    details: errorMessage,
                    attempts: MAX_RETRIES + 1,
                },
                { status: 500 }
            );
        }

        // ============================================
        // 6. 트랜잭션 컨펌 추적 (비동기)
        // ============================================
        // 응답은 즉시 반환하고, 백그라운드에서 컨펌 추적
        trackTransactionConfirmation(tx.hash, validated.pollId, tx.nonce).catch(err => {
            console.error(`[Relayer] Failed to track transaction ${tx.hash}:`, err);
        });

        // ============================================
        // 7. 성공 응답 반환
        // ============================================
        return NextResponse.json({
            success: true,
            txHash: tx.hash,  // 트랜잭션 해시 (Etherscan에서 확인 가능)
            nonce: tx.nonce,  // 사용된 Nonce
        }, { status: 200 });
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Relayer API Error:", errorMessage);

        // ============================================
        // 8. 에러 처리
        // ============================================
        // Zod 검증 오류
        if (err instanceof z.ZodError) {
            return NextResponse.json(
                { success: false, error: "Validation Failed", details: err.issues },
                { status: 400 }
            );
        }

        // 기타 오류
        return NextResponse.json(
            { success: false, error: "Relay transaction failed.", details: errorMessage },
            { status: 500 }
        );
    }
}