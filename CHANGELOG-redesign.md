# DS Hunter redesign changelog

## 修复项

- 修复主题初始化顺序：在 `__root.tsx` 的 `<head>` 内联执行主题脚本，hydration 前设置 `.dark`。
- 将工作集 store 改为 `useSyncExternalStore`，server snapshot 使用冻结空数组稳定引用。
- 新增 `formatDate / formatDateTime`，默认按 `Asia/Shanghai` 格式化，减少 SSR/CSR 日期差异。
- 补齐 `bun run typecheck` 脚本。
- 登录页加入错误 Alert、登录中禁用重复提交、加载图标和大写锁提示。
- 价值统计在未接入真实 `renewalPrice` 时显示 `--`，不再展示错误的 0 与假增量。
- `/bind`、`/records`、`/backup` 使用统一空态组件。
- `/records` 批量删除确认改为明确提示“将删除 N 条记录，此操作不可撤销”。

## 美化项

- 全局接入自托管 Inter 与 Noto Sans SC，字体链统一为 `"Inter","Noto Sans SC","PingFang SC","Microsoft YaHei",system-ui,sans-serif`。
- 将主强调色统一为 teal，并调整深色主题、卡片边框、玻璃质感与轻量内阴影。
- 新增公开首页 `/`：hero、资产统计、搜索防抖、注册商 Avatar fallback、DNS 状态徽标与 OG meta。
- 后台从 `/` 移至 `/dashboard`，新增顶栏、居中 tabs、通知 Popover、帮助和账户入口。
- `<768px` 侧栏改为顶部按钮触发的 Sheet。
- 设置页加入连接状态徽标、测试连接按钮、密钥眼睛切换和“已保存不再下发”提示。
- 解析记录 Type badge 增加 A / AAAA / CNAME / MX / TXT / NS / SRV / CAA 配色。
- 备份页恢复策略改为 RadioGroup 卡片，差异内容改为 `<pre>` 展示。

## 遗留 TODO

- 续费预警需要后端同步真实到期日与 `renewalPrice` 后，才能计算真实 30 天待续费和估算价值。
- 通知 Popover 当前只能从工作集域名聚合解析风险，后续应接入 DNS Check 结果与续费数据。
- 表格列拖拽宽度仍可继续增强为完整 column resize 体验。

## 如何回滚

1. 使用 Git 回滚本次提交，或恢复到发布前 tag。
2. 重新运行 `bun install`，确保依赖与 `bun.lock` 对齐。
3. 执行 `bun run typecheck` 与 `bun run build`。
4. Docker 部署时重新构建镜像并重启容器。
