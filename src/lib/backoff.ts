/**
 * 지수 백오프 계산 함수
 * 
 * 재시도 시 대기 시간을 점진적으로 증가시켜 서버 부하를 줄입니다.
 * 
 * @param attempt 재시도 횟수 (1부터 시작)
 * @param baseMs 기본 대기 시간 (밀리초, 기본값: 1000ms = 1초)
 * @param maxMs 최대 대기 시간 (밀리초, 기본값: 60000ms = 60초)
 * @returns 계산된 대기 시간 (밀리초)
 * 
 * @example
 * calcBackoff(1) = 1초 + 랜덤(0~0.2초) ≈ 1~1.2초
 * calcBackoff(2) = 2초 + 랜덤(0~0.4초) ≈ 2~2.4초
 * calcBackoff(3) = 4초 + 랜덤(0~0.8초) ≈ 4~4.8초
 * calcBackoff(4) = 8초 + 랜덤(0~1.6초) ≈ 8~9.6초
 * ...
 */
export function calcBackoff(attempt: number, baseMs = 1000, maxMs = 60000) {
  // 지수 백오프: baseMs * 2^attempt (최대 maxMs까지)
  // 예: 1초 * 2^1 = 2초, 1초 * 2^2 = 4초, 1초 * 2^3 = 8초...
  const exp = Math.min(maxMs, baseMs * Math.pow(2, attempt));
  
  // Jitter 추가: 동시 재시도를 방지하기 위해 랜덤 지연 추가
  // exp의 20% 범위 내에서 랜덤하게 추가
  const jitter = Math.floor(Math.random() * (exp * 0.2));
  
  return exp + jitter;
}
