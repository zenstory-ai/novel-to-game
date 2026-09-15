# Agent Note: 示例站点从仓库根目录、只在 push main 时按路径过滤部署到 Vercel

Status: implemented

## Problem

三个示例各有一个公开可玩的 Vercel 站点。手工在每个 app 目录跑 `vercel --prod`，意味着 main 上的构建与线上版本随时可能不一致；把部署放进 CI 又要处理 token 暴露与 Vercel 项目"Root Directory"设置的叠加——2026-08 的一次部署因为路径被追加两遍，在上传前就失败。

## Decision

`.github/workflows/deploy.yml` 只在 `push` 到 `main` 时触发，never 在 `pull_request` 上触发，因此 fork PR 拿不到 `VERCEL_TOKEN`；`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID` 不是秘密，直接写在工作流里。

- 用 `dorny/paths-filter` 按 `examples/<name>/build/app/**` 判断哪个示例变了，只部署变了的那个；工作流文件自身的改动触发全部三个重新部署。
- 每个 job 在仓库根目录执行 `vercel deploy --prod --yes`，never 设置 `working-directory`：Vercel 项目已在项目设置里拥有各自的 Root Directory，在 app 目录里再跑会让 CLI 把同一段路径追加第二次。`tests/test_validate_repo.py` 的 `test_vercel_deploy_never_re_enters_the_project_root_directory` 断言工作流中不出现 `working-directory:`，且每个带 `build/app` 的示例都有对应路径过滤。
- Vercel CLI 版本固定为 `vercel@56.4.0`；并发组按 ref 排队、不取消进行中的部署。

来源：1db32e6、14af4b2、212f7e2、13dc7c6 (#42)

## Alternatives considered

- **在 `pull_request` 上也部署预览** — 最强理由：评审能直接试玩候选。否决原因：fork PR 的工作流会拿到 token，仓库公开后风险不可接受（1db32e6）。
- **每个 job 用 `working-directory` 进入 app 目录（2026-07-22 至 08-26 的做法）** — 最强理由：与本地手工 `vercel --prod` 的习惯一致。否决原因：与 Vercel 项目侧的 Root Directory 叠加，部署在上传前失败；改为根目录执行并用测试锁住（#42）。
- **继续手工部署** — 首版的实际状态，问题是线上与 main 脱节，1db32e6 即为关闭这个缺口而加。

## Consequences

- 收益：main 上 `build/app` 的每次变更自动上线，改一个示例不会重发另外两个。
- 代价：token 仍是账号级 CLI token，1db32e6 建议换成项目级，仓库历史里未见完成记录；新增示例要同时加路径过滤、job 与 Vercel 项目 ID，测试只能发现漏掉的路径过滤，发现不了漏掉的 job。
