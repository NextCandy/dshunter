# DomainHunter — 群晖 DS923+ 部署指南

本仓库已附带 `Dockerfile` 与 `docker-compose.yml`，可在 Synology DS923+（DSM 7.2+，Container Manager）一键部署。

> ⚠️ 说明：本仓库当前的代码仍依赖 Supabase（Lovable Cloud）作为认证与数据库后端，本次提交只完成了 **部署骨架（阶段 A）**。要在群晖上脱离 Lovable Cloud 完全自托管运行，还需要完成阶段 B（serverFn 迁移）与阶段 C（移除 Supabase 集成）。继续推进时会在同一仓库追加提交。
>
> 当前 docker-compose 已经能够：
> - 本地起一个 PostgreSQL 16 并自动执行 `db/init/*.sql` 建表；
> - 构建并运行前端容器（端口 3000）；
> - 通过 `.env` 注入所有运行时配置。

---

## 1. 准备群晖

1. DSM → **套件中心** 安装 **Container Manager**。
2. **控制面板 → 终端机和 SNMP** 启用 SSH（部署完后建议关闭）。
3. 用 SSH 登录 NAS：
   ```bash
   ssh <admin>@<NAS_LAN_IP>
   sudo -i
   ```
4. 选择一个目录存放项目，例如：
   ```bash
   mkdir -p /volume1/docker/domainhunter
   cd /volume1/docker/domainhunter
   ```

## 2. 获取代码

```bash
git clone https://github.com/<your-account>/<your-repo>.git .
```

或在 PC 上克隆后通过 File Station 上传到该目录。

## 3. 配置环境变量

```bash
cp .env.example .env
vi .env       # 修改 POSTGRES_PASSWORD / JWT_SECRET / AI_* 等
```

生成随机密钥的命令：

```bash
openssl rand -base64 24     # POSTGRES_PASSWORD
openssl rand -hex 32        # JWT_SECRET
```

## 4. 启动

```bash
docker compose up -d --build
docker compose logs -f app
```

首次启动会：
- 创建 `./data/pg`（Postgres 持久化数据，**记得纳入 NAS 备份**）；
- 执行 `db/init/01_schema.sql` 初始化所有业务表；
- 启动应用，监听 `0.0.0.0:3000`。

访问 `http://<NAS_LAN_IP>:3000` 即可。

## 5. 反向代理 + HTTPS（推荐）

DSM **控制面板 → 登录入口 → 高级 → 反向代理服务器 → 新增**：

| 字段 | 来源 | 目标 |
| --- | --- | --- |
| 协议 | HTTPS | HTTP |
| 主机名 | `dh.your-domain.com` | `localhost` |
| 端口 | `443` | `3000` |

在 **控制面板 → 安全性 → 证书** 申请 Let's Encrypt 证书并绑定该反代条目，即可通过 HTTPS 访问。

记得回到 `.env` 把 `APP_ORIGIN` 改为 `https://dh.your-domain.com` 并 `docker compose up -d` 重启。

## 6. 备份与升级

```bash
# 升级（拉取最新代码后）
docker compose pull && docker compose up -d --build

# 备份数据库
docker compose exec postgres pg_dump -U domainhunter domainhunter > backup-$(date +%F).sql

# 备份持久卷（关停后整体打包）
docker compose down
tar czf domainhunter-data-$(date +%F).tgz data/
docker compose up -d
```

## 7. 注册商域名同步持久化升级

本版本新增注册商域名资产持久化：点击“同步注册商域名”后，后端会从注册商 API 拉取域名并写入 PostgreSQL 的 `registrar_domains` / `registrar_sync_jobs`，页面刷新、重新登录、容器重启后仍从数据库读取。`localStorage` 仅作为前端偏好或临时缓存，不能作为同步结果的唯一存储。

升级前先做只读检查和备份：

```bash
cd /volume1/docker/domainhunter
BAK_DIR=.bak-$(date +%Y%m%d-%H%M%S)
mkdir -p "$BAK_DIR"
cp docker-compose.nas.yml .env "$BAK_DIR"/ 2>/dev/null || true
docker compose -f docker-compose.nas.yml ps
docker compose -f docker-compose.nas.yml exec -T postgres sh -lc 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$BAK_DIR"/domainhunter.sql
```

对已有数据库执行迁移：

```bash
docker compose -f docker-compose.nas.yml exec -T postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < db/migrations/20260702_registrar_domains.sql
docker compose -f docker-compose.nas.yml up -d --build
docker compose -f docker-compose.nas.yml logs --tail=120 app
```

如果使用环境变量保存注册商凭据，只在 NAS 的 `.env` 中填写实际值；仓库只保留变量名示例：

```bash
SPACESHIP_API_KEY=
SPACESHIP_API_SECRET=
PORKBUN_API_KEY=
PORKBUN_SECRET_API_KEY=
GODADDY_API_KEY=
GODADDY_API_SECRET=
```

需要验证的关键点：

- 登录管理员账号，进入“注册商资产”，确认注册商连接状态。
- 点击“同步注册商域名”，确认同步按钮在执行中不可重复点击。
- 查询 `GET /api/registrar-domains` 和 `GET /api/registrar-sync-jobs`，确认列表与同步记录返回正常。
- 刷新页面、退出再登录、执行 `docker compose -f docker-compose.nas.yml restart app` 后，确认域名仍存在且没有重复记录。
- 再次同步同一注册商，确认已有域名更新 `last_seen_at` / `last_synced_at`，不会插入重复域名；注册商不再返回的域名会标记为缺失，不会直接删除。

回滚时不要删除 `data/pg`、镜像或卷；优先回退代码并保留数据库备份：

```bash
docker compose -f docker-compose.nas.yml down
git checkout <previous-commit>
docker compose -f docker-compose.nas.yml up -d --build
```

## 8. 常见问题

- **5432 已被占用**：编辑 `docker-compose.yml`，注释掉 `postgres.ports` 整段（容器之间通过内部网络通信即可）。
- **应用启动失败 / Supabase 报错**：当前阶段代码仍调用 Lovable Cloud。要彻底脱离，请等待阶段 B/C 提交，或继续使用 Lovable 在线预览验证功能。
- **AI 灵感生成不可用**：在 `.env` 填 `AI_BASE_URL` + `AI_API_KEY` + `AI_MODEL`（任何 OpenAI 兼容服务，含本地 Ollama）。
