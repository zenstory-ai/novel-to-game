# Agent Note: Source-bound production readiness receipt

Status: implemented

## Problem

三个公开示例同时存在 Vercel Git 集成和 Actions CLI 部署路径；公开部署成功不证明生产域名切换受 CI 门禁控制。未经平台设置回读和授权，不应自动切换部署责任。

## Decision

补充只读、main 手动触发的部署观察回执，把精确 main CI、最新三个 GitHub/Vercel 部署记录和公开站点可达性关联到同一 source SHA。它明确记录 `providerGate: NOT_VERIFIED`，不获得部署凭据、不调用部署命令，也不冒充发布前门禁。原部署生产者暂不修改；选择 Vercel 原生门禁后仍须另行验证平台配置。

## Alternatives considered

- 立即禁用 Actions 并依赖 Vercel Git：消除重复生产者最直接；但尚未确认原生门禁配置，会把已存在的生产链路改为未经证明的新约束。
- 只看站点 HTTP 200：无需平台凭据、检查便宜；但旧版本也会返回成功，因此必须关联最新部署 SHA，且仍不声称域名字节绑定已验证。

## Consequences

回执是部署后观察，不阻止已有生产部署。GitHub 部署记录只能证明报告的 source SHA，不能独立证明自定义域名正服务该版本。平台授权与配置回读之前，CD 对齐仍未完成。

## Verification

离线回归覆盖最新部署/状态选择、不回退旧成功与不声称门禁/域名源绑定。工作流通过 actionlint，仓库守卫和全部 unittest 作为提交证据。平台设置、部署命令和版本均未变更。
