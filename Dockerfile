# -----------------------------------------------------------------------------
# 1단계: 빌드 (Build Stage)
# -----------------------------------------------------------------------------
FROM node:18-alpine AS builder

WORKDIR /app

# 빌드 시 필요한 환경 변수 정의
ARG RELAYER_PRIVATE_KEY
ENV RELAYER_PRIVATE_KEY=${RELAYER_PRIVATE_KEY}

# 패키지 설치
COPY package.json package-lock.json ./
RUN npm install

# 소스 복사
COPY . .

# Next.js 빌드 (standalone 모드 생성)
RUN npm run build

# -----------------------------------------------------------------------------
# 2단계: 실행 (Runner Stage)
# -----------------------------------------------------------------------------
FROM node:18-alpine AS runner

ENV NODE_ENV="production"
ENV PORT="3000"

WORKDIR /app

# 최소한의 파일만 복사
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# non-root 사용자 생성
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

EXPOSE 3000

# 서버 실행
CMD ["node", "server.js"]
