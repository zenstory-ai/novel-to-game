# HY3D v23 独立视觉复审

**结论：PASS — 100/100**

## 评审独立性与证据绑定

- Reviewer：`visual_v17_review` 独立视觉评审代理；未参与 v23 的实现，也未修改评审对象或证据。
- Source fingerprint：`1d883375e0f5a07919df4948f569334b7d42ee191f21fbbbd306203ad66f2b1c`
- Manifest SHA256：`bb46775a878a397b093778cf4272aa8ae7b284e8214ce9d0420a7f415eb34d6a`
- 两个哈希分别与 `hy3d-creatures-v23/manifest.json` 的 `source.sha256` 和
  `hy3d-creatures-v23/manifest.sha256` 一致；本次判断只使用该绑定目录中的像素证据。
- 量表为非补偿式：八个类别必须各自满分，且 VT01–VT06 必须全部通过，才可宣称
  `100/100`。

## 八类评分

| 类别 | 得分 | 判定 | 像素证据与理由 |
|---|---:|---|---|
| 生物解剖与身份 | **25/25** | PASS | `frames/orbit-iguanodon-000.jpg`、`frames/orbit-iguanodon-090.jpg`、`contact-sheet-orbits.jpg`：禽龙拇指刺、体型和面部身份稳定；翼龙头冠、喙、翼膜及轮廓完整。 |
| 生物材质 | **10/10** | PASS | `contact-sheet-orbits.jpg`：皮肤条纹、翼膜、明暗转折及环境色反射保持完整表现。 |
| 环境 | **15/15** | PASS | `frames/plate-1-brook-track.jpg`、`frames/plate-2-basalt-scale.jpg`：溪岸、漂木、树蕨、岸石及玄武岩破面层级均保留，无视觉回退。 |
| 光照与氛围 | **15/15** | PASS | `frames/vt04-attack-defense.jpg`、`frames/plate-2-basalt-scale.jpg`：云层对比、远景空气透视、薄雾和玄武岩冷色阴影面成立。 |
| 镜头与构图 | **15/15** | PASS | `frames/vt02-track-examined.jpg`、`contact-sheet-targets.jpg`：等待字幕及 field note 清除后的 VT02 目标帧干净，足迹处于明确的前景视觉区域，未被提示牌或摄影器材遮挡。 |
| 动作与行为 | **10/10** | PASS | `frames/motion-young-play-00.jpg` 至 `02.jpg`、`contact-sheet-motion.jpg`：幼体髋部升降、支撑脚切换和头尾配重清晰；拉枝与翼龙攻击序列无退化。 |
| 工具与 UI | **5/5** | PASS | `frames/vt02-first-controllable-track.jpg`：声音字幕、足迹交互提示和相机附签同时显示时仍有明确层级；`frames/vt02-track-examined.jpg` 证明临时信息会自然清除，不污染目标构图。 |
| 运行时与无障碍视觉 | **5/5** | PASS | `frames/vt02-first-controllable-track.jpg` 中声音字幕可见；`frames/vt06-minimum-field-1280x720.jpg` 中字幕、控制提示与相机附签无重叠或裁切；`frames/vt06-minimum-150-text-reduced-motion.jpg` 在 150% 下仍可读。 |

## 字幕回归专项结论

- **字幕恢复：PASS。** `frames/vt02-first-controllable-track.jpg` 明确显示溪流及昆虫声音字幕。
- **VT02 构图：PASS。** `frames/vt02-track-examined.jpg` 截图时字幕和临时 field note 已自然清除；足迹完整、对比充分、无遮挡。
- **最低视口 UI：PASS。** `frames/vt06-minimum-field-1280x720.jpg` 中字幕、控制栏和相机附签分别占据右下、左下及中下区域，安全边距充分。
- **150% 文本：PASS。** `frames/vt06-minimum-150-text-reduced-motion.jpg` 未见关键文本重叠或截断。

## 视觉目标

| 目标 | 结果 |
|---|---|
| VT01 | **PASS** |
| VT02 | **PASS** |
| VT03 | **PASS** |
| VT04 | **PASS** |
| VT05 | **PASS** |
| VT06 | **PASS** |

**剩余 blocker：无。**

**非补偿式结论：** 八个类别均达到各自满分门槛，VT01–VT06 全部通过；字幕无障碍修复未造成
VT02、最低视口或其他视觉目标回归，v23 达到严格 `100/100`。
