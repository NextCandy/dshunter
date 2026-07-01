# syntax=docker/dockerfile:1.7

# ---------- Builder ----------
FROM oven/bun:1.1 AS builder
WORKDIR /app

# 安装依赖（利用缓存层）
COPY package.json bun.lockb* bunfig.toml* ./
RUN bun install --frozen-lockfile || bun install

# 拷贝源代码
COPY . .

# 使用 nitro 的 node-server preset 产出可在容器中运行的 Node 服务
ENV NITRO_PRESET=node-server
RUN bun run build

# ---------- Runtime ----------
# node:20-alpine 同时支持 linux/amd64 和 linux/arm64，覆盖常见 NAS 架构
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV TZ=Asia/Shanghai

# 安装 tzdata 以支持时区设置（alpine 默认不含）
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/${TZ} /etc/localtime && \
    echo "${TZ}" > /etc/timezone

# 只拷贝构建产物，并以非 root 用户运行
COPY --from=builder --chown=node:node /app/.output ./.output

USER node

EXPOSE 3000

# 健康检查：nitro node-server 监听 3000，未解锁时 / 会 302 跳 /unlock
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/ || exit 1

# nitro node-server 产物入口
CMD ["node", ".output/server/index.mjs"]
