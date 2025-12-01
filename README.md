# 백엔드 B (API) - 익명 투표 플랫폼

블록체인 기반 익명 투표 플랫폼의 백엔드 API 서버입니다.

---

## 📖 이 프로젝트는 무엇인가요?

**관리자**가 투표를 만들고, **참여자**가 익명으로 투표하며, **결과**를 집계하는 시스템입니다.

### 주요 기능

- ✅ 투표 관리 (생성, 조회, 결과 집계)
- ✅ 익명 투표 (ZKP 기반, 선택값 비공개)
- ✅ Relayer (가스 대납, 사용자 가스비 0원)
- ✅ 이벤트 동기화 (블록체인 → DB)
- ✅ Health Check & Metrics

### 왜 블록체인을 사용하나요?

- **투명성**: 모든 투표가 블록체인에 기록되어 누구나 검증 가능
- **익명성**: ZKP(영지식 증명)로 선택값은 비공개, 유효성만 증명
- **무결성**: 결과를 조작할 수 없음

---

## 🚀 빠른 시작

### 1. 환경 설정

```bash
# 의존성 설치
npm install

# 환경 변수 설정 (.env 파일 생성)
DB_URI=mongodb+srv://...
```

### 2. 서버 실행

```bash
npm run dev
```

서버가 `http://localhost:3000`에서 실행됩니다.

### 3. 동작 확인

```bash
# 다른 터미널에서
curl http://localhost:3000/api/health
# 예상 응답: {"ok":true,"db":"connected"}
```

---

## ✅ 최종 점검 (모든 기능 동작 확인)

### 빠른 확인 (1분)

```bash
# 서버 실행 (터미널 1)
npm run dev

# 모든 API 테스트 (터미널 2)
npm run test:all-apis
```

**결과**: 13개 API가 모두 정상 동작하는지 확인 ✅

### 상세 테스트

```bash
npm run smoke          # 5케이스 스모크 테스트
npm run test:e2e       # 20회 연속 E2E 테스트
npm run test:100       # 100건 집계 테스트
```

**상세 가이드**: `docs/TESTING.md` 참고

---

## 🔌 주요 API

### 투표 관리

- `POST /api/polls` - 투표 생성
- `GET /api/polls?creator=0x...` - 내 투표 목록
- `GET /api/polls/:pollId` - 투표 상세
- `GET /api/polls/:pollId/public` - 공개 정보 (참여자용)
- `GET /api/polls/:pollId/results` - 결과 집계

### 투표 제출

- `POST /api/vote/create` - 투표 제출
- `POST /api/relay` - Relayer (가스 대납)

### 모니터링

- `GET /api/health` - Health check
- `GET /api/metrics` - Prometheus 형식 메트릭

**전체 API 문서**: `docs/HANDOFF.md` 참고

---

## 🔧 환경 변수

### 필수

```env
DB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
```

### Relayer (선택)

```env
RELAYER_PRIVATE_KEY=0x...
INFURA_URL=https://sepolia.infura.io/v3/YOUR_KEY
CHAIN_ID=11155111
```

**어디서 구하나요?**

- **DB_URI**: [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) 무료 계정
- **INFURA_URL**: [Infura](https://infura.io/) 무료 API 키
- **RELAYER_PRIVATE_KEY**: MetaMask 새 지갑 생성 후 Private Key

---

## 📁 프로젝트 구조

```
src/
├── app/api/          # API 엔드포인트
├── lib/services/     # 핵심 서비스 (블록체인, DB, Nonce)
├── middleware.ts     # 전역 미들웨어 (CORS, RateLimit, RequestID)
└── models/          # DB 모델

docs/
├── INTEGRATION.md   # 통합 가이드 (팀별 전달 사항 + API 상세)
├── TESTING.md       # 테스트 가이드
└── error-catalog.md # 에러 코드 카탈로그
```

---

## 📚 문서

- **`docs/HANDOFF.md`** - 팀별 전달 사항 (다른 팀에게 전달할 내용)
- **`docs/TESTING.md`** - 테스트 가이드 및 최종 점검 방법
- **`docs/error-catalog.md`** - 에러 코드 카탈로그

---

## 🐛 문제 해결

### DB 연결 오류

`.env` 파일의 `DB_URI` 확인

### Relayer 오류

`.env` 파일의 `RELAYER_PRIVATE_KEY`와 `INFURA_URL` 확인

### Jest 실행 오류

```bash
npm install --save-dev jest @types/jest jest-environment-node
```

---

## ✅ 구현 완료 상태

**5주차**: CORS, RateLimit, Zod 검증, 에러코드 표준화 ✅

**6주차**: 이벤트 동기화(컨펌 2회), 재시도 백오프, RequestID, /health /metrics ✅

**7주차**: Relayer(재시도 2회), 관리자 API, 집계 개선(100건 테스트 통과) ✅

**8주차**: RequestID 상호추적, WSL 환경 지원, 분산 환경 테스트 ✅

**핵심 기능 구현률: 100%** ✅

---

**백엔드 B (API) - 모든 작업 완료! 🎉**
