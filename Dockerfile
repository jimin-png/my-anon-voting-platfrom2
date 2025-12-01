# ---------------------
# 1. Builder 단계
# ---------------------
FROM node:18-alpine AS builder
WORKDIR /app

# 의존성 설치
COPY package.json package-lock.json ./
RUN npm install

# 소스 복사
COPY . .

# 환경 변수 빌드용 ARG
ARG NEXTAUTH_SECRET
ARG CONTRACT_ADDRESS_VOTING
ARG DB_URI
ARG RELAYER_PRIVATE_KEY

# 빌드
RUN npm run build

# ---------------------
# 2. Runner 단계
# ---------------------
FROM node:18-alpine AS runner
WORKDIR /app

# 빌드 결과와 의존성 복사
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# public 폴더 복사 제거 (이 줄 삭제)
# COPY --from=builder /app/public ./public

# 런타임 환경 변수 설정
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV CONTRACT_ADDRESS_VOTING=$CONTRACT_ADDRESS_VOTING
ENV DB_URI=$DB_URI
ENV RELAYER_PRIVATE_KEY=$RELAYER_PRIVATE_KEY

# 앱 실행
CMD ["npm", "start"]
