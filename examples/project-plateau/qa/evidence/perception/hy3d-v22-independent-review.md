# HY3D v22 独立视觉复审

**结论：PASS — 100/100**

## 评审独立性与证据绑定

- Reviewer：`visual_v17_review` 独立视觉评审代理；未参与 v22 的实现，也未修改评审对象或证据。
- Source fingerprint：`fd54a90417a22797c4f45cba4c33166a7499c0bc6204c15fe2b27304c36d5758`
- Manifest SHA256：`7edac6544c12db08a0dd2054051cc0f55b14d55efbfb8ed8cbec272c20850c91`
- 两个哈希分别与 `hy3d-creatures-v22/manifest.json` 的 `source.sha256` 和
  `hy3d-creatures-v22/manifest.sha256` 一致；评审只使用该绑定目录中的像素证据。
- 量表为非补偿式：八个类别必须各自满分，且 VT01–VT06 必须全部通过，才可宣称
  `100/100`。

## 八类评分

| 类别 | 得分 | 判定 | 像素证据与理由 |
|---|---:|---|---|
| 生物解剖与身份 | **25/25** | PASS | `frames/orbit-iguanodon-000.jpg`、`frames/orbit-iguanodon-090.jpg`、`contact-sheet-orbits.jpg`：禽龙拇指刺在侧视及前斜视可辨；翼龙头冠、喙、翼膜和四向轮廓稳定。 |
| 生物材质 | **10/10** | PASS | `contact-sheet-orbits.jpg`：皮肤条纹、面部细节、翼膜透光及暖冷受光一致；与加强后的环境局部色面形成统一的写实化低多边形语法。 |
| 环境 | **15/15** | PASS | `frames/plate-1-brook-track.jpg`、`frames/plate-2-basalt-scale.jpg`、`contact-sheet-orbits.jpg`：溪岸、水纹、岸石、不同长度和分叉的漂木成立；树蕨冠幅、树干倾角和根部组合已打散；玄武岩增加橙色断面、孔洞、裂边和碎石。 |
| 光照与氛围 | **15/15** | PASS | `frames/plate-2-basalt-scale.jpg`、`frames/vt04-attack-defense.jpg`：云带有明暗变化，远山、林线和家庭存在递进空气透视；玄武岩阴影面具有青冷反射光，暖色断面与暗面分离清楚。 |
| 镜头与构图 | **15/15** | PASS | `contact-sheet-targets.jpg`：VT01–VT06 主体层级明确；家庭保持第一视觉中心；翼龙、标题、摄影器材及重要 UI 均处于有效安全区。 |
| 动作与行为 | **10/10** | PASS | `frames/motion-young-play-00.jpg` 至 `02.jpg`：右侧幼龙从低髋蓄力、换支撑脚到抬身/落地；前景幼龙同步出现髋部升降、头部下压及尾部反向抬升。`contact-sheet-motion.jpg` 同时证明拉枝和翼龙攻击连续性。 |
| 工具与 UI | **5/5** | PASS | `frames/vt02-track-examined.jpg`、`frames/vt06-minimum-150-text-reduced-motion.jpg`：象牙提示牌通过细绳和支架附着于相机；相框、记录板、提示牌材质与排版语法统一。 |
| 运行时与无障碍视觉 | **5/5** | PASS | `frames/vt06-minimum-150-text-reduced-motion.jpg`、`frames/vt06-minimum-field-1280x720.jpg`：150% 文本可读，关键控件无重叠；两只翼龙和主体均未裁切。 |

## v21 四项 blocker 复测

1. **漂木、树蕨、玄武岩材质层级：已解除。** 漂木出现明暗面、粗细及分叉差异；树蕨有冠幅和色阶变化；玄武岩具有暖色破面、孔洞、裂边与冷暗面。
2. **树蕨与漂木重复感：已解除。** 近中远景可见不同树干高度、倾角、冠层规模及漂木组合，未形成明显复制阵列。
3. **云层、空气透视、玄武岩冷色反射：已解除。** 云带对比、远山雾化、林线衰减及玄武岩青冷阴影面均在目标帧中直接可见。
4. **幼龙重量转移：已解除。** 三帧可辨识髋部升降、支撑脚切换、头尾反向配重及落地姿态，不再只是局部平移。

## 视觉目标

| 目标 | 结果 |
|---|---|
| VT01 | **PASS** |
| VT02 | **PASS** |
| VT03 | **PASS** |
| VT04 | **PASS** |
| VT05 | **PASS** |
| VT06 | **PASS** |

**剩余 blocking defects：无。**

**非补偿式结论：** 八个类别均达到各自满分门槛，VT01–VT06 全部通过；v22 达到严格
`100/100`，未使用跨类别分数补偿。
