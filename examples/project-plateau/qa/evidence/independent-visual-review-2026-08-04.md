# Project Plateau 独立视觉发布复审

- 日期：2026-08-04
- 审查员：`/root/plateau_visual_release_review`（只读独立审查）
- 实现或证据生成参与：无
- `sourceSha256`：`578d03cbfbcbe66ac192ac1bcb808d3e215b14d1d6759d63d2b3012bbc22ee6f`
- `manifestSha256`：`1c30ba33aec7d5a48cb1aa7a7b3570b2460806eab5d6a282ba66a140ce56475d`
- 裁决：**PASS**
- Blocker：0
- Major：0
- Minor：3

## 发布结论

发布兼容的 `build/evidence/visual-upgrade/generated/manifest.json` 已由同一审查员补充核验并 PASS；其双视口 title/family/dive、contact sheet、连续 watch→bank→dive→pull-up 视频及四个阶段样本的文件哈希全部匹配。

最新证据解除上一轮两个失败项：`manifest.json` 的检查全部为 `true`；PLATE 1 足迹的三趾凹陷、接触阴影与湿土明暗可直接辨认；翼龙 `attack-00/01/02` 均完整入镜，头胸轴持续沿视线方向逼近，背腹方向稳定，尺寸与地表影连续增大，不再出现中间帧侧翻或顶部裁切。批准本轮视觉候选达到 `playable-prototype` 发布门。

## 复核证据

- `build/evidence/visual-targets/manifest.json`
- `build/evidence/visual-targets/contact-sheet-targets.jpg`
- `build/evidence/visual-targets/contact-sheet-motion.jpg`
- `build/evidence/visual-targets/contact-sheet-plates.jpg`
- `build/evidence/visual-targets/frames/vt04-attack-defense.jpg`
- `build/evidence/visual-targets/frames/motion-pterodactyl-attack-00.jpg`
- `build/evidence/visual-targets/frames/motion-pterodactyl-attack-01.jpg`
- `build/evidence/visual-targets/frames/motion-pterodactyl-attack-02.jpg`

## 关键检查

- 六个视觉目标、双视口、四张原始底片、两种生物轨道图与四组动作序列均存在。
- PLATE 1 的三趾形、凹陷轮廓与湿土接触阴影可直接辨认，细节来自真实足迹而非无关噪声。
- 翼龙攻击：主体完整；头胸与运动方向一致；00→01→02 连续逼近；投影阴影同步推进。
- 重复亮叶未回归；树木与动物无新增悬浮；相机双手握持与朝向保持正确。
- 150% 文本与 `1280×720` 最小视口未见新增重叠。
- 记录性能：`1440×900` 为 `59.9 / 39.3 FPS`（median / 1% low），`1280×720` 为 `59.9 / 37.7 FPS`；零控制台错误与外部运行时请求。

## Minor

1. 正面翼龙足部与腹部暗部在缩略尺度下略密。
2. 攻击采样翼拍较克制，但独立 wingbeat 序列已清楚证明双翼变化。
3. PLATE 1 足迹采用自然土色，主要依靠形状与凹陷阴影读取。

这些问题不影响威胁方向、攻击轨迹、目标识别或发布级可操作性。
