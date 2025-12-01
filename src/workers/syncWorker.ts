/**
 * 이벤트 동기화 워커
 * 
 * 백그라운드에서 블록체인 이벤트를 DB에 동기화합니다.
 * 
 * 동작 방식:
 * 1. 주기적으로 PENDING 상태 이벤트 조회
 * 2. 블록체인에서 트랜잭션 컨펌 횟수 확인
 * 3. 컨펌 2회 달성 시 FINALIZED로 변경
 * 4. 실패 시 지수 백오프로 재시도
 * 
 * 왜 필요한가?
 * - Relayer가 트랜잭션을 보낸 후 컨펌을 기다려야 함
 * - 블록체인은 비동기이므로 주기적으로 확인 필요
 */

import dbConnect from '@/lib/dbConnect';
import EventModel, { IEvent } from '@/models/Event';
import { getConfirmations } from '@/lib/services/blockchain.service';
import { calcBackoff } from '@/lib/backoff';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// 환경 변수 기반 설정
// ============================================
const REQUIRED_CONFIRMATIONS = parseInt(process.env.CONFIRMATIONS_REQUIRED || '2', 10); // 목표 컨펌 횟수
const BACKOFF_BASE_MS = parseInt(process.env.BACKOFF_BASE_MS || '1000', 10); // 백오프 기본 시간 (1초)
const BACKOFF_MAX_MS = parseInt(process.env.BACKOFF_MAX_MS || '60000', 10); // 백오프 최대 시간 (60초)
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '5000', 10); // 폴링 간격 (5초)

/**
 * PENDING 상태 이벤트 처리 함수
 * 
 * 주기적으로 호출되어 다음을 수행합니다:
 * 1. 재시도 시간이 된 이벤트 조회
 * 2. 블록체인에서 컨펌 횟수 확인
 * 3. 목표 컨펌 횟수 달성 시 FINALIZED로 변경
 * 4. 실패 시 다음 재시도 시간 계산
 */
async function processPending() {
  await dbConnect(); // DB 연결 확인

  const now = new Date();

  // ============================================
  // 1. 처리할 이벤트 조회
  // ============================================
  // 다음 재시도 시간이 되었거나 처음 시도하는 이벤트만 가져옴
  const pending = await EventModel.find({
    status: 'PENDING',
    $or: [
      { nextRetryAt: { $exists: false } }, // 첫 시도 (nextRetryAt 없음)
      { nextRetryAt: { $lte: now } }       // 재시도 시간 도래
    ]
  }).limit(50).exec(); // 한 번에 최대 50개만 처리

  // ============================================
  // 2. 각 이벤트 처리
  // ============================================
  for (const ev of pending) {
    const requestId = ev.requestId; // 로그 추적용 ID

    try {
      // 2-1. 블록체인에서 컨펌 횟수 조회
      const confirmations = await getConfirmations(ev.txHash);

      // 트랜잭션이 아직 블록체인에 알려지지 않음
      if (confirmations === null) {
        throw new Error("TX_NOT_YET_KNOWN");
      }

      // 2-2. 컨펌 횟수 업데이트
      ev.confirmations = confirmations;

      if (confirmations >= REQUIRED_CONFIRMATIONS) {
        // ✅ 목표 컨펌 횟수 달성 → 최종 성공
        ev.status = 'FINALIZED';
        ev.nextRetryAt = undefined; // 더 이상 재시도 불필요
        console.log(`[${requestId}] FINALIZED (conf=${confirmations}) tx=${ev.txHash}`);
      } else {
        // ⏳ 컨펌 횟수 부족 → 다음 재시도 시간 계산
        ev.attempts += 1;
        const delay = calcBackoff(ev.attempts, BACKOFF_BASE_MS, BACKOFF_MAX_MS);
        ev.nextRetryAt = new Date(Date.now() + delay);
        console.log(`[${requestId}] Only ${confirmations} confirmations — retry in ${delay}ms`);
      }

      await ev.save(); // 변경 사항 저장

    } catch (err: unknown) {
      // ❌ 오류 발생 → 재시도 시간 계산
      ev.attempts = (ev.attempts || 0) + 1;
      const delay = calcBackoff(ev.attempts, BACKOFF_BASE_MS, BACKOFF_MAX_MS);
      ev.nextRetryAt = new Date(Date.now() + delay);

      await ev.save(); // 재시도 시간 저장

      const errorMessage = (err instanceof Error && err.message === "TX_NOT_YET_KNOWN")
        ? `TX not yet known — retry in ${delay}ms`
        : `Error while processing tx ${ev.txHash}`;

      console.error(`[${requestId}] ${errorMessage}`, err);
    }
  }
}

/**
 * 워커 실행 루프 시작
 * 
 * 주기적으로 processPending()을 호출하여 이벤트를 처리합니다.
 * Next.js 앱 시작 시 호출해야 합니다.
 */
export async function runWorkerLoop() {
  console.log(`SyncWorker starting with polling interval: ${POLL_INTERVAL}ms...`);
  await dbConnect(); // 초기 DB 연결 확인

  // 즉시 한 번 실행 후, 주기적으로 반복 실행
  processPending();
  setInterval(processPending, POLL_INTERVAL);
}

/**
 * 이벤트를 큐에 추가
 * 
 * Relayer가 트랜잭션을 보낸 후 이 함수를 호출하여
 * 이벤트를 DB에 등록하고 워커가 처리하도록 합니다.
 * 
 * @param txHash 트랜잭션 해시
 * @param eventName 이벤트 이름 (예: "VoteCast")
 * @param payload 이벤트 데이터
 * @returns 생성된 이벤트 객체
 */
export async function enqueueEvent(txHash: string, eventName: string, payload: Record<string, unknown>) {
  await dbConnect(); // DB 연결 확인
  
  const requestId = uuidv4(); // 고유 요청 ID 생성
  
  // 이벤트를 DB에 저장 (PENDING 상태로 시작)
  const ev = await EventModel.create({
    requestId,
    txHash,
    eventName,
    payload,
    status: 'PENDING',
    attempts: 0,
    confirmations: 0
  });
  
  console.log(`[${requestId}] Enqueued tx ${txHash}`);
  return ev;
}