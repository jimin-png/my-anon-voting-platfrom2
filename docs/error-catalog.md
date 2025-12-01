# 에러 코드 카탈로그

백엔드 B (API)에서 사용하는 표준화된 에러 코드 목록입니다.

## 📋 개요

모든 API는 일관된 에러 응답 형식을 사용합니다:

```json
{
  "success": false,
  "message": "에러 메시지",
  "details": "상세 정보 (선택)",
  "requestId": "고유 요청 ID (선택)"
}
```

## 🔢 HTTP 상태 코드

### 200 OK
**성공 응답**

```json
{
  "success": true,
  "data": { ... }
}
```

### 201 Created
**리소스 생성 성공**

```json
{
  "success": true,
  "message": "투표가 생성되었습니다.",
  "data": { ... }
}
```

### 400 Bad Request
**요청 데이터 검증 실패**

**원인:**
- 필수 필드 누락
- 잘못된 데이터 형식
- Zod 스키마 검증 실패

**예시:**
```json
{
  "success": false,
  "message": "pollId는 필수입니다.",
  "details": [
    {
      "path": ["pollId"],
      "message": "pollId는 필수입니다."
    }
  ]
}
```

**발생 위치:**
- `POST /api/polls` - 투표 생성 시 필수 필드 누락
- `POST /api/relay` - Zod 검증 실패
- `POST /api/vote/create` - 필수 필드 누락

### 404 Not Found
**리소스를 찾을 수 없음**

**원인:**
- 존재하지 않는 pollId
- 등록되지 않은 유권자

**예시:**
```json
{
  "success": false,
  "message": "투표를 찾을 수 없습니다."
}
```

**발생 위치:**
- `GET /api/polls/:pollId` - 존재하지 않는 pollId
- `GET /api/polls/:pollId/public` - 존재하지 않는 pollId
- `GET /api/polls/:pollId/results` - 존재하지 않는 pollId
- `POST /api/vote/create` - 등록되지 않은 유권자

### 409 Conflict
**중복 또는 충돌**

**원인:**
- 중복 투표 시도
- 이미 존재하는 pollId
- MongoDB 중복 키 오류 (code: 11000)

**예시:**
```json
{
  "success": false,
  "message": "이미 투표하였습니다."
}
```

**발생 위치:**
- `POST /api/vote/create` - 중복 투표 시도
- `POST /api/polls` - 이미 존재하는 pollId
- `POST /api/user/register` - 이미 등록된 지갑 주소

**중복 투표 처리:**
- 같은 `pollId` + `nullifierHash` 조합은 중복으로 인식
- 재투표는 업데이트로 처리 (200 OK 반환, `isUpdate: true`)

### 429 Too Many Requests
**RateLimit 초과**

**원인:**
- IP당 15분 동안 100회 이상 요청

**예시:**
```json
{
  "success": false,
  "message": "요청 속도가 너무 빠릅니다. 잠시 후 다시 시도해 주세요.",
  "requestId": "xxx-xxx-xxx"
}
```

**응답 헤더:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1234567890
```

**발생 위치:**
- 모든 `/api/*` 경로 (middleware.ts에서 처리)

### 500 Internal Server Error
**서버 내부 오류**

**원인:**
- DB 연결 실패
- 예상치 못한 오류
- 블록체인 RPC 오류

**예시:**
```json
{
  "success": false,
  "message": "서버 오류가 발생했습니다.",
  "details": "MongoDB connection error"
}
```

**발생 위치:**
- 모든 API 엔드포인트

### 503 Service Unavailable
**일시적 서비스 불가**

**원인:**
- 이벤트 동기화 실패
- 블록체인 RPC 지연

**예시:**
```json
{
  "success": false,
  "message": "Internal server error. Please retry after 50 seconds.",
  "error_type": "TRANSIENT_FAILURE",
  "details": "RPC connection timeout"
}
```

**응답 헤더:**
```
Retry-After: 50
```

**발생 위치:**
- `POST /api/event/sync` - 이벤트 동기화 실패

## 🔍 에러 코드별 상세 설명

### Zod 검증 오류 (400)

**발생 시나리오:**
1. 필수 필드 누락
2. 잘못된 데이터 형식
3. 정규식 검증 실패

**예시:**
```typescript
// 잘못된 지갑 주소 형식
{
  "creatorWallet": "0x123"  // ❌ 40자리 16진수가 아님
}

// 응답
{
  "success": false,
  "message": "올바른 지갑 주소 형식이 아닙니다.",
  "details": [
    {
      "path": ["creatorWallet"],
      "message": "올바른 지갑 주소 형식이 아닙니다.",
      "code": "invalid_string"
    }
  ]
}
```

### 중복 투표 오류 (409)

**발생 시나리오:**
1. 같은 `pollId` + `nullifierHash` 조합으로 재투표
2. MongoDB UNIQUE 인덱스 위반

**처리 방식:**
- **재투표 (업데이트)**: 같은 `pollId` + `nullifierHash` 조합이면 기존 투표 업데이트 (200 OK)
- **중복 차단**: UNIQUE 인덱스 위반 시 409 반환

**예시:**
```typescript
// 첫 번째 투표
POST /api/vote/create
{
  "pollId": "poll-1",
  "nullifierHash": "0xabc...",
  "candidate": "candidate-1"
}
// → 201 Created

// 같은 nullifierHash로 재투표
POST /api/vote/create
{
  "pollId": "poll-1",
  "nullifierHash": "0xabc...",  // 같은 조합
  "candidate": "candidate-2"
}
// → 200 OK, isUpdate: true (업데이트)
```

### RateLimit 오류 (429)

**설정:**
- 최대 요청 수: 100회 (기본값)
- 시간 윈도우: 15분 (900,000ms)
- IP 기반 추적

**해결 방법:**
- `X-RateLimit-Reset` 헤더에 표시된 시간까지 대기
- 또는 `RATE_LIMIT_MAX` 환경 변수로 제한 증가

## 📝 에러 처리 가이드

### 프론트엔드에서 처리하는 방법

```typescript
try {
  const response = await fetch('/api/polls', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    switch (response.status) {
      case 400:
        // 검증 오류
        console.error('검증 실패:', result.message);
        break;
      case 409:
        // 중복 오류
        console.error('중복:', result.message);
        break;
      case 429:
        // RateLimit 오류
        const resetTime = response.headers.get('X-RateLimit-Reset');
        console.error('요청 제한:', resetTime);
        break;
      default:
        // 기타 오류
        console.error('서버 오류:', result.message);
    }
  }
} catch (error) {
  console.error('네트워크 오류:', error);
}
```

## 🔗 관련 문서

- [README.md](../README.md) - 전체 프로젝트 문서
- [API 문서](./api-docs.md) - API 엔드포인트 상세 설명

## 📅 변경 이력

- **2024-10-XX**: 초기 버전 작성
- **2024-10-XX**: 409 중복 처리 로직 추가
- **2024-10-XX**: RateLimit (429) 추가

