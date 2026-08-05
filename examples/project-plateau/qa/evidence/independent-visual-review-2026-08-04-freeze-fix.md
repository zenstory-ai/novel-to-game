# Project Plateau 视觉冻结修复独立增量复审

- 日期：2026-08-04
- 审查员：`/root/final_arch_review`（独立、只读 Architect）
- 实现或证据生成参与：无；未修改任何文件
- Reviewed HEAD：`b933827751f18adb2bbf9a83d6e8604a4eca8266`
- App fingerprint：`a22e12e210d86d1c8e256eac70bf303825deb603824a0acef997d1ca06d25d22`
- Visual manifest SHA256：`6d4f1a16bcb6eecc8e3a5607ddb00e016eb73327186047a9d60d4f6a05a0882e`
- 裁决：**PASS**
- Blocker：0
- Major：0
- Minor：0

## 发布结论

冻结路径只在带 QA 权限的 authored-time freeze 下向世界运行时传入零增量，已经消除举起相机期间翼龙位置、缩放与攻击阶段继续漂移的问题；普通交互仍使用真实帧增量，连续运动没有被误冻结。本次 manifest 的 source fingerprint 与现场计算一致，15/15 个资源哈希匹配。

## 冻结边界

- `build/app/src/main.js` 仅在 `visualTimeFrozen` 时向 `worldRuntime` 传入 `0`；默认交互路径继续传入 `deltaSeconds`。
- `visualTimeFrozen` 默认关闭，只能通过带 QA 权限检查的测试 API 设置。
- `build/app/test/qa_controller.py` 通过真实右键输入举起相机，并要求位置漂移与缩放差都小于 `0.002`，同时攻击阶段保持不变。
- Playwright 在进入场景前等待 family、pterodactyl、camera 与 rifle 四类 HY3D 资产完成加载；该等待只改变测试同步，不改变生产加载路径。

## 视觉与动作复核

- 1440×900 与 1280×720 下的 6 张 still 主体、HY3D 模型、构图和威胁状态完整稳定。
- Contact sheet 六格对应正确，无加载中替身、缺失模型或跨尺寸姿态突变。
- 连续 WEBM 仍完整呈现 watch → bank → dive → pull-up → 闭合回程，正常运动没有停顿或周期跳变。
- Motion WEBM SHA256：`1a90c1c21005ca63e0f885abaf865ccc99f2ca171a349f0274d4f492bfa1cb7b`
- Manifest 无控制台错误。

## 复核证据

- `build/evidence/visual-upgrade/generated/manifest.json`
- `build/evidence/visual-upgrade/generated/contact-sheet-supported-viewports.jpg`
- `build/evidence/visual-upgrade/generated/motion/watch-bank-dive-pull-up.webm`
- `qa/verification.json`

## 独立验证

- `npm test`：117/117 PASS
