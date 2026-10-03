# Agent Note: Native production single producer

Status: implemented

## Problem

既有只读回执补齐了部署后观察，但此前平台授权未定，Vercel Git 与 Actions CLI 两条生产路径仍并存。前序决定见 `2026-10-03-production-readiness-receipt.md`。

## Decision

在组织创建人明确批准生产门禁与合入后，保留三个公开示例既有 Vercel Git 集成作为唯一生产者。通过 Vercel 官方设置页面为每个项目配置 Production 环境的 `repository` 与 `ClawHub inventory validation / distribute` 两项 GitHub 检查，刷新页面回读后删除重复的 `deploy.yml`。只读观察回执保持原契约，不获取部署凭据，仍不冒充平台设置或生产域名字节绑定的证明。

## Alternatives considered

- 保留 Actions CLI 与 Git 两条路径：修改最少，但两个生产者竞态继续存在，且 CLI 发布可能绕开原生门禁。
- 改为 Actions 主导部署：可以把门禁集中到 CI，但会替换已经批准保留的原生 Git 责任边界，引入额外凭据与生产命令，因此不采用。

## Consequences

仓库工作流不再需要 Vercel 部署 Token。平台门禁约束生产域名推广，不阻止构建本身；配置回读与一次实际部署的门禁生效证明分开记录。未发生新构建时保留既有线上版本，不为证明门禁强制重新部署。本轮不创建 tag、不修改版本、不发布 npm 或 ClawHub。

## Verification

修改前仓库守卫与 14 项 unittest 通过；新增单一生产者回归先在旧 `deploy.yml` 上失败，再删除该工作流并运行全部仓库检查。平台三个项目的 Git 集成、仓库、main 分支、项目根目录均保留，两个 Production 检查保存后刷新回读确认；工作流通过 actionlint。实际新部署的 check/promotion 状态须单独观察，不以配置回读冒充。
