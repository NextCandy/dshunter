# DS Hunter Handoff

更新时间：2026-07-09 15:40（本机 Claude Code 会话）

## 1. 我们在做什么任务

改造 DS Hunter（https://dshunter.com ，TanStack Start + React 19 + Tailwind v4 + shadcn/ui，JSON 文件持久化，NAS Docker 部署）的前台首页与展示元数据体系：

1. 首页去 Hero/统计卡，改为「紧凑筛选区 + 响应式域名网格 + 分页」，桌面端一屏内完成。
2. 精品域名星标强调并置顶；组内按 sortOrder 再字母序。
3. 筛选：名称搜索、后缀、主体位数、精品、分类（选项从真实数据自动生成）。
4. 后台可设精品/分类/排序权重；页脚联系方式改为图标超链接（后台 contactLinks 配置）。
5. 全链路按标准化域名去重；历史重复自动合并。
6. 品牌 Logo/favicon 更换为 DS 图。

## 2. 已完成内容（任务已闭环 ✅）

- **代码**：全部功能已实现并推送 GitHub main，commit `17b264c`（feat: 首页域名网格改版 + 精品/分类/权重 + 联系方式图标 + 全链路域名去重）。改动明细见该 commit 与 PROGRESS.md。
- **NAS 部署**：已完成。2026-07-09 时间线（NAS CST）：10:39 备份 `data.bak-2026-07-09` → 10:42 git reset 到 17b264c → 10:45 镜像构建完成 → 10:46 容器启动。容器 `dshunter` 运行中（healthy），运行镜像 ID 与 `dshunter:latest` 一致，日志仅一行 Listening、无报错。
- **线上验证**（本会话用浏览器实测 https://dshunter.com ）：
  - 首页新版生效：无 Hero/统计卡，筛选区 + 6 列网格（1452px 宽）+ 分页（492 条 / 5 页，每页约 100 条由 ResizeObserver 动态计算），一屏内无整页滚动。
  - 精品域名 094.org 星标 + 边框强调 + 置顶（该精品是用户自己在后台标的 → **后台写路径在生产环境已验证可用**）。
  - 搜索「mail」→ 17/492 条，计数与分页联动；后缀下拉从真实数据生成且带计数（.com 137、.org 133…），选 .best → 8/492 条；翻页到第 2/5 页字母序连续。
  - 暗色模式切换正常，布局保持。
  - 页脚联系图标（邮件/Telegram）已渲染。
  - 新 logo.png / favicon.ico 均 HTTP 200；控制台无站点报错（唯一异常来自用户 Chrome 扩展）。
  - 无「迁移合并」日志 → 存量数据本无重复记录，属正常。
- **本地仓库**：已快进对齐 origin/main（17b264c），工作区干净。对齐前的旧工作区改动存在 stash（`WIP on main: b953f39`，内容与 17b264c 相同，可 `git stash drop` 清理）。
- **文档**：README「公开首页」「手动域名」「维护状态」已同步新功能描述并推送。
- **冗余清理（2026-07-09 下午）**：删除过时文档 `CHANGELOG-redesign.md`（内容已进 git 历史）与 `DEPLOY_VERCEL.md`（旧项目名 DomainOps、"无数据库"说法与现架构矛盾）；按 import 传递闭包分析删除 26 个未被引用的 `src/components/ui/*` 组件（51→25 个，`badge/button/toggle-variants` 因被保留组件引用而保留），tsc 0 错误验证通过；删除已完全合并进 main 的远端分支 `codex/dshunter-redesign-readme`。保留 `AGENTS.md`（构建速查）与 `PROGRESS.md`（README 引用的历史档案）。

## 3. 当前卡点

无。任务闭环。

## 4. 下一步计划（均为可选项）

1. 移动端布局实测（网格 2 列、筛选区折行）——代码按断点实现但未真机验证。
2. 后台「前台设置」里补充更多联系方式图标（微信/X/GitHub 等，编辑器已支持）。
3. 若要改首页 SEO 文案：`src/routes/index.tsx` 的 `head()` 是静态默认值，运行时被站点设置覆盖。
4. NAS 上 `data.bak-2026-07-09` 确认无误后可择期清理。

## 5. 关键事实（新会话必读）

- **部署形态**：NAS（群晖，Tailscale IP 100.99.27.142，SSH 8831，用户 WangGang，`sudo -i` 提权）上 `/volume1/docker/dshunter`，Docker Compose 构建运行，宿主端口 8834→容器 3000，经 frp/cloudflared 反代到 https://dshunter.com 。
- **NAS 上 docker 不在 sudo PATH**：用完整路径 `/usr/local/bin/docker`、`/usr/local/bin/docker-compose`，或先 `export PATH=/usr/local/bin:$PATH`。
- **本机（Windows）SSH NAS 的可行方式**：系统 ssh 无 sshpass，用 Python paramiko（已装 4.0.0）：连接后 `exec_command('sudo -S -p "" bash -s')`，stdin 先写 sudo 密码一行再写脚本。参考脚本模式已验证可用。
- **数据持久化**：仅 `data/` 卷（registrar-domains.json ≈360KB、manual-domains.json、secrets.json、site-settings.json、operation-log.json）。动它之前必须备份。
- **部署套路**：`cd /volume1/docker/dshunter && cp -r data data.bak-$(date +%F) && git fetch origin && git reset --hard origin/main && /usr/local/bin/docker-compose up -d --build`。
- **GitHub**：NAS 端 remote 已内嵌 x-access-token（与本机不同 token，均有效）。仓库 https://github.com/NextCandy/dshunter 。

## 6. 绝对不要再踩的坑

- **（本会话新增）不要假设 HANDOFF 里的「未完成」仍未完成**：用户可能已手动执行。先探测实际状态（NAS git log、镜像构建时间、容器启动时间）再决定动作。
- **（本会话新增）本机 git 的破坏性命令会被权限分类器拦**：`reset --hard` 被拒时，用「备份 → `git stash -u` → `merge --ff-only` → 恢复未跟踪文件」的可逆路径对齐远端。
- **（本会话新增）Chrome CDP 截图偶发 30s 超时**（渲染进程忙），非页面冻结：等几秒重试，或用 get_page_text/find 做文本级验证。
- 不要破坏后台登录（SITE_PASSWORD + 加密 Cookie；COOKIE_SECURE 内网 false 外网 true）。
- 不要改坏部署链路（Dockerfile / compose / 8834→3000 / frp；`data/` 是唯一持久化）。
- 不要删旧数据字段或给新字段不兼容默认值（featured=false、category 空、contactLinks=[]）。
- 不要让首页整页滚动（100dvh 弹性布局，只有网格区内部可滚）。
- 不要写死联系方式/后缀/分类——全部来自后台配置或真实数据。
- 顺序必须是 去重→筛选→排序→分页；重复域名必须走 merge 函数（精品 OR、备注拼接、权重取小、字段补缺），不能简单删除。
- 不要动 `routeTree.gen.ts`；客户端代码不要 import `*.server.ts`。
- `listPublicDomainAssets` 返回结构被 unlock.tsx 复用，改动需兼容。
- lucide-react 0.575 仍导出 Twitter/Github 品牌图标；升级前先确认。
- （历史，Cowork 沙箱会话特有）沙箱挂载路径文件内容可能截断/陈旧，验证以宿主 Read/git 为准；沙箱不能 SSH/长任务。本机会话无此限制。
