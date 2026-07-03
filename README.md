# DS Hunter

DS Hunter 是一个单用户域名资产与 DNS 运维控制台。它将分散在 Cloudflare、Spaceship、Dynadot、Porkbun、Namecheap、阿里云、腾讯云、西部数码等平台的域名统一拉取、筛选、绑定到 Cloudflare，并支持 DNS 记录批量增删、备份、差异对比与恢复。

技术栈：TanStack Start v1、React 19、TailwindCSS v4、shadcn/ui、Node 20。默认以 Docker 方式部署，适合群晖、Portainer、unRAID 和轻量服务器。

## 主要功能

- 公开首页 `/`：展示域名资产清单、总域名数、覆盖注册商数、搜索与 DNS 状态。
- 后台工作台 `/dashboard`：查看来源配置、Cloudflare Zone、工作集和最近同步。
- 域名管理 `/domains`：从注册商与 Cloudflare 拉取域名，合并去重，保存为工作集。
- 批量绑定 `/bind`：为选中域名创建 Cloudflare Zone，可选自动更新注册商 NS。
- 解析记录 `/records`：单域名 DNS 管理、CSV/模板批量添加、批量删除前二次确认。
- 备份恢复 `/backup`：导出 JSON/CSV，和线上记录做差异对比，按策略恢复。
- 设置 `/settings`：保存加密 API 凭证、测试连接状态、切换主题。
- 登录 `/unlock`：共享密码网关，凭证只在服务端读取，不下发到浏览器。

## 本地开发

```bash
bun install
bun run dev
```

开发服务默认由 Vite 启动。生产构建：

```bash
bun run typecheck
bun run build
```

## Docker 部署

```bash
cp .env.example .env
echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env
docker compose up -d --build
```

访问 `http://<host>:3000` 后进入公开首页；后台入口为 `/unlock`。

## 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `SESSION_SECRET` | 是 | 至少 32 字节，用于加密会话 Cookie |
| `SITE_PASSWORD` | 是 | `/unlock` 使用的后台密码 |
| `CLOUDFLARE_API_TOKEN` | 建议 | Cloudflare Zone / DNS 操作 Token |
| `TZ` | 否 | 默认 `Asia/Shanghai`，用于 SSR/CSR 日期格式一致 |
| `COOKIE_SECURE` | 否 | 默认 `true`；内网 HTTP 测试可设为 `false` |
| `HOST_PORT` | 否 | docker compose 宿主机端口，默认 `3000` |
| `SPACESHIP_API_KEY` / `SPACESHIP_API_SECRET` | 否 | Spaceship API 凭证 |
| `DYNADOT_API_KEY` | 否 | Dynadot API 凭证 |
| `PORKBUN_API_KEY` / `PORKBUN_SECRET_API_KEY` | 否 | Porkbun API 凭证 |
| `NAMECHEAP_API_USER` / `NAMECHEAP_API_KEY` / `NAMECHEAP_CLIENT_IP` | 否 | Namecheap API 凭证 |
| `ALIYUN_ACCESS_KEY_ID` / `ALIYUN_ACCESS_KEY_SECRET` | 否 | 阿里云域名 API 凭证 |
| `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY` | 否 | 腾讯云域名 API 凭证 |
| `WEST_USERNAME` / `WEST_API_PASSWORD` | 否 | 西部数码 API 凭证 |

也可以在后台 `/settings` 直接保存凭证。凭证会通过 AES-256-GCM 加密保存到服务端数据文件，页面只显示“已连接 / 未配置”。

## GitHub Actions

仓库内置 `.github/workflows/docker.yml`。推送到 `main` 或 `v*` tag 后，会构建 `linux/amd64` 与 `linux/arm64` 镜像，并发布到：

```bash
ghcr.io/nextcandy/dnshunter:latest
ghcr.io/nextcandy/dnshunter:<tag>
```

## 安全建议

- 生产环境只通过 HTTPS 暴露服务。
- `SITE_PASSWORD` 使用 16 位以上强口令。
- 注册商和 Cloudflare Token 使用最小权限。
- 定期在 `/backup` 导出 JSON 快照，便于回滚。

## 常见问题

| 现象 | 处理 |
| --- | --- |
| 解锁后又回到登录页 | 检查 `SESSION_SECRET`、`COOKIE_SECURE` 与 HTTPS 设置 |
| Cloudflare 返回 403 | 检查 Token 是否具备 Zone 与 DNS 权限 |
| Namecheap API 拒绝 | 将服务器出口 IP 加入 Namecheap 白名单 |
| 页面日期不一致 | 确认容器 `TZ` 与服务器配置，默认使用 `Asia/Shanghai` |

## License

MIT
