# 백엔드 B (API) - 팀별 전달 사항

현재 코드베이스 기준으로 각 팀에게 전달해야 할 정보입니다.

## ⚠️ WBS 요구사항 반영 완료

**자동 유권자 등록**: QR 찍고 메타마스크 연결 시 자동으로 유효한 투표권자 인정

- `/api/vote/create`에서 유권자가 없으면 자동 등록
- `name`, `studentId`는 선택사항 (없으면 기본값 사용)
- ZKP Proof 검증은 블록체인 컨트랙트에서 처리 (merkleRoot 검증 포함)

---

## 🎯 프론트엔드 A (UI/UX, 정은수)

### 필요한 API 엔드포인트

#### 1. 투표 목록 조회

```http
GET /api/polls?creator=0x1234567890123456789012345678901234567890
```

**응답 형식**:

```json
{
  "success": true,
  "data": [
    {
      "pollId": "uuid-v4",
      "creatorWallet": "0x...",
      "title": "투표 제목",
      "description": "설명",
      "candidates": [
        { "id": "candidate-1", "label": "후보 1" },
        { "id": "candidate-2", "label": "후보 2" }
      ],
      "startTime": "2024-10-20T00:00:00.000Z",
      "endTime": "2024-10-27T23:59:59.000Z",
      "createdAt": "2024-10-20T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

#### 2. 투표 상세 조회

```http
GET /api/polls/:pollId
```

**응답 형식**: 위와 동일 (전체 정보)

#### 3. 투표 공개 정보 조회 (참여자용)

```http
GET /api/polls/:pollId/public
```

**응답 형식**:

```json
{
  "success": true,
  "data": {
    "pollId": "uuid-v4",
    "title": "투표 제목",
    "description": "설명",
    "candidates": [
      { "id": "candidate-1", "label": "후보 1" },
      { "id": "candidate-2", "label": "후보 2" }
    ],
    "startTime": "2024-10-20T00:00:00.000Z",
    "endTime": "2024-10-27T23:59:59.000Z",
    "isActive": true,
    "status": "active" // "active" | "upcoming" | "ended"
  }
}
```

**주의**: `creatorWallet`, `merkleRoot` 등 민감한 정보는 제외됩니다.

#### 4. 투표 결과 집계 (차트용)

```http
GET /api/polls/:pollId/results
```

**응답 형식**:

```json
{
  "success": true,
  "data": {
    "pollId": "uuid-v4",
    "title": "투표 제목",
    "totalVotes": 10,
    "results": [
      { "candidate": "candidate-1", "count": 6 },
      { "candidate": "candidate-2", "count": 4 }
    ],
    "timestamp": "2024-10-20T12:00:00.000Z"
  }
}
```

**중요**: `totalVotes`는 재투표를 제외한 고유 투표자 수입니다.

### 에러 처리

| HTTP 상태 코드          | 의미                | UI 처리 방법                        |
| ----------------------- | ------------------- | ----------------------------------- |
| `400 Bad Request`       | 요청 검증 실패      | 폼 필드에 에러 메시지 표시          |
| `404 Not Found`         | 투표를 찾을 수 없음 | "투표를 찾을 수 없습니다" 메시지    |
| `409 Conflict`          | 중복 투표           | UI에 중복 배지 표시                 |
| `429 Too Many Requests` | RateLimit 초과      | "잠시 후 다시 시도해 주세요" 메시지 |

**에러 응답 형식**:

```json
{
  "success": false,
  "message": "에러 메시지",
  "details": "상세 정보 (선택)"
}
```

### 환경 변수

```env
API_URL=http://localhost:3000  # 개발 환경
```

---

## 🎯 프론트엔드 B (Web3, 안지영)

### 필요한 API 엔드포인트

#### 1. Relayer API (가스 대납)

```http
POST /api/relay
Content-Type: application/json
```

**요청 형식**:

```json
{
  "to": "0x1234567890123456789012345678901234567890", // 컨트랙트 주소
  "data": "0x1234...", // 인코딩된 함수 호출 데이터
  "pollId": "uuid-v4",
  "chainId": 11155111, // Sepolia 테스트넷
  "deadline": 1697824800 // Unix 타임스탬프 (초 단위)
}
```

**응답 형식 (성공)**:

```json
{
  "success": true,
  "txHash": "0x...",
  "nonce": 1
}
```

**응답 형식 (실패)**:

```json
{
  "success": false,
  "error": "에러 메시지",
  "details": "상세 정보"
}
```

**에러 케이스**:

- `400 Bad Request`: deadline 만료, 요청 검증 실패
- `500 Internal Server Error`: 트랜잭션 전송 실패 (최대 2회 재시도 후 실패)

**중요 사항**:

- `deadline`은 현재 시간보다 미래여야 합니다 (Unix 타임스탬프, 초 단위)
- 실패 시 자동으로 최대 2회 재시도합니다
- 응답은 즉시 반환되며, 컨펌 추적은 백그라운드에서 진행됩니다

#### 2. 투표 제출 API

```http
POST /api/vote/create
Content-Type: application/json
```

**요청 형식**:

```json
{
  "pollId": "uuid-v4",
  "walletAddress": "0x1234567890123456789012345678901234567890",
  "candidate": "candidate-1",
  "nullifierHash": "0x...", // ZKP에서 생성한 nullifier 해시
  "txHash": "0x..." // 선택 (블록체인 트랜잭션 해시)
}
```

**응답 형식 (신규 투표)**:

```json
{
  "success": true,
  "message": "투표 기록 완료",
  "data": {
    "_id": "...",
    "pollId": "uuid-v4",
    "voter": "...",
    "candidate": "candidate-1"
  },
  "isUpdate": false
}
```

**응답 형식 (재투표)**:

```json
{
  "success": true,
  "message": "투표가 업데이트되었습니다.",
  "data": {
    "_id": "...",
    "pollId": "uuid-v4",
    "voter": "...",
    "candidate": "candidate-1"
  },
  "isUpdate": true
}
```

**에러 케이스**:

- `400 Bad Request`: 필수 필드 누락 (pollId, walletAddress, candidate)
- `409 Conflict`: 중복 투표 (같은 pollId + nullifierHash 조합)

**주의**: `404 Not Found` (등록되지 않은 유권자)는 더 이상 발생하지 않습니다. 유권자가 없으면 자동으로 등록됩니다.

**중요 사항** (WBS 일치):

- **자동 등록**: 유권자가 없으면 자동으로 등록됩니다 (QR 찍고 메타마스크 연결 = 자동 유권자)
- `name`, `studentId`는 선택사항입니다 (없으면 기본값 사용)
- ZKP Proof 검증은 블록체인 컨트랙트에서 처리됩니다 (merkleRoot 검증 포함)
- `nullifierHash`가 없으면 기존 방식으로 중복 체크합니다 (voter ID 기준)

### 체인 ID

```javascript
const CHAIN_ID = 11155111 // Sepolia 테스트넷
```

### 통합 순서

1. **MetaMask 연결**

   - 사용자 지갑 연결
   - 체인 ID 확인 (11155111)

2. **ZKP에서 Proof 생성**

   - ZKP A 팀에서 제공하는 Proof 생성 함수 호출
   - `nullifierHash` 추출

3. **블록체인 B에서 함수 인코딩**

   - 컨트랙트 함수 호출 데이터 인코딩
   - `data` 필드 생성

4. **Relayer API 호출**

   - `POST /api/relay` 호출
   - `to`: 컨트랙트 주소
   - `data`: 인코딩된 함수 호출
   - `deadline`: 현재 시간 + 1시간 (Unix 타임스탬프)

5. **투표 제출 API 호출**
   - `POST /api/vote/create` 호출
   - `txHash`: Relayer에서 받은 트랜잭션 해시

---

## 🎯 백엔드 A (DB, 김다예)

### Poll 컬렉션 스키마

```typescript
interface IPoll {
  pollId: string // 고유 투표 ID (UUID v4)
  creatorWallet: string // 생성자 지갑 주소
  title: string // 투표 제목
  description?: string // 설명 (선택)
  candidates: Array<{
    // 후보 목록
    id: string
    label: string
  }>
  startTime: Date // 시작 시간
  endTime: Date // 마감 시간
  merkleRoot?: string // Merkle Root (선택)
  createdAt: Date
  updatedAt: Date
}
```

### Vote 컬렉션 스키마

```typescript
interface IVote {
  pollId: string // 투표 ID
  voter: ObjectId // 유권자 ID (Voter 모델 참조)
  candidate: string // 선택한 후보 ID
  timestamp?: Date // 투표 시간
  txHash?: string // 블록체인 트랜잭션 해시 (선택)
  nullifierHash?: string // ZKP nullifier 해시 (선택, 중복 방지용)
}
```

### 필수 인덱스

```javascript
// Poll 컬렉션
PollSchema.index({ pollId: 1 }, { unique: true }) // pollId 유니크 인덱스
PollSchema.index({ creatorWallet: 1, createdAt: -1 }) // 생성자별 조회 최적화
PollSchema.index({ endTime: 1 }) // 마감 시간 조회 최적화

// Vote 컬렉션
VoteSchema.index({ pollId: 1 }) // pollId 인덱스
VoteSchema.index({ nullifierHash: 1 }) // nullifierHash 인덱스
VoteSchema.index(
  { pollId: 1, nullifierHash: 1 },
  { unique: true, sparse: true }
) // ⭐ 중요!
```

**중요**: `Vote(pollId, nullifierHash)` 복합 유니크 인덱스는 **반드시** 필요합니다.

- `sparse: true`: nullifierHash가 없는 경우 인덱스에서 제외 (기존 투표 호환)
- 같은 `pollId` + `nullifierHash` 조합은 중복 차단
- 다른 `pollId`에서 같은 `nullifierHash` 사용은 허용 (선거별 1인 1표)

### 중복 처리 정책

- 같은 `pollId` + `nullifierHash` 조합: 중복으로 인식, 재투표 시 업데이트 처리
- 다른 `pollId`에서 같은 `nullifierHash` 사용: 허용 (선거별 1인 1표)

---

## 🎯 블록체인 B (Solidity, 신지영)

### Relayer API 연동

**컨트랙트 주소 전달**:

- `POST /api/relay`의 `to` 필드에 컨트랙트 주소를 전달하세요
- 예: `"to": "0x1234567890123456789012345678901234567890"`

**함수 호출 데이터 인코딩**:

- 컨트랙트 함수 호출을 인코딩하여 `data` 필드에 전달
- 예: `"data": "0x1234..."`

**체인 ID**:

- Sepolia 테스트넷: `11155111`

**Deadline 검증**:

- `deadline`은 Unix 타임스탬프 (초 단위)로 전달
- 현재 시간보다 미래여야 합니다
- 만료된 deadline은 400 오류 반환

### 이벤트 동기화

**이벤트 동기화 API**:

```http
POST /api/event/sync
Content-Type: application/json
```

**요청 형식**:

```json
{
  "eventId": "event-id",
  "requestId": "request-id"
}
```

**이벤트 스펙**:

- 이벤트 이름: `VoteCast`
- 이벤트 파라미터:
  - `pollId` (uint256 또는 bytes32)
  - `nullifierHash` (bytes32)
  - `candidate` (string 또는 bytes32)
  - `isUpdate` (bool) - 재투표 여부

**동기화 흐름**:

1. 블록체인에서 이벤트 발생
2. `POST /api/event/sync` 호출
3. 백엔드에서 이벤트 상태를 PENDING으로 저장
4. 백그라운드에서 컨펌 횟수 추적 (컨펌 2회 달성 시 FINALIZED)

---

## 🎯 ZKP A (홍정현)

### nullifierHash 형식

**형식**: `0x`로 시작하는 16진수 문자열

**예시**:

```
0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

**길이**: 66자 (0x + 64자 16진수)

### 중복 처리 정책

**같은 pollId에서**:

- 같은 `nullifierHash` 사용 시 중복으로 인식
- 재투표 시 업데이트 처리 (200 OK, `isUpdate: true`)

**다른 pollId에서**:

- 같은 `nullifierHash` 사용은 허용
- 선거별 1인 1표 정책 (pollId별로 독립적)

### 사용 위치

1. **투표 제출 API** (`POST /api/vote/create`)

   - 요청 필드: `nullifierHash`
   - 중복 체크에 사용

2. **결과 집계** (`GET /api/polls/:pollId/results`)
   - `nullifierHash`별로 그룹화하여 최신 투표만 집계
   - 재투표 제외 집계에 사용

---

## 📦 압축파일로 전달 시 로컬 테스트 방법

### 1. 압축 해제

```bash
unzip backend-b-api.zip
cd backend-b-api
```

### 2. 환경 변수 설정

`.env` 파일 생성:

```env
# 필수
DB_URI=mongodb+srv://username:password@cluster.mongodb.net/database

# Relayer (선택)
RELAYER_PRIVATE_KEY=0x...
INFURA_URL=https://sepolia.infura.io/v3/YOUR_KEY
CHAIN_ID=11155111
```

### 3. 의존성 설치

```bash
npm install
```

### 4. 서버 실행

```bash
npm run dev
```

서버가 `http://localhost:3000`에서 실행됩니다.

### 5. Health Check 확인

```bash
curl http://localhost:3000/api/health
```

**예상 응답**: `{"ok":true,"db":"connected"}`

### 6. 모든 API 테스트

```bash
npm run test:all-apis
```

**결과**: 13개 API가 모두 정상 동작하는지 확인

### 7. 추가 테스트 (선택)

```bash
npm run smoke          # 5케이스 스모크 테스트
npm run test:e2e       # 20회 연속 E2E 테스트
```

### 주의사항

- **MongoDB 연결 필수**: `.env`에 `DB_URI`가 없으면 대부분의 API가 동작하지 않습니다
- **Relayer는 선택사항**: 환경 변수가 없어도 다른 API는 테스트 가능합니다
- **Node.js 버전**: >= 18.0.0 필요

---

**최종 업데이트**: 2024-10-XX
