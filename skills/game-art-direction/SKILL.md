---
name: game-art-direction
description: "Direct game art and creative vision. Turn GAME_DESIGN into ART_DIRECTION defining a recognizable visual identity, functional visual and audio feedback, and key in-game moments. Use for what should the game look like, set the art direction, define the visual style. 游戏美术与创意方向。把 GAME_DESIGN 转成 ART_DIRECTION，定义可辨识的视觉风格、服务玩法的视听反馈和关键游戏时刻。用于判断游戏应该长什么样、制定游戏美术方向等需求。"
---
# 游戏美术与创意方向

定义玩家在游戏里看见、听见和读懂的视听体验（不写着色器代码、模型拓扑、贴图参数、API 接口或供应商配置）；输入必须包含 `GAME_DESIGN.md` 与 `PRODUCT_BRIEF.md`，视觉表现服务于玩法决策，不得为了迁就参考图而改写玩法规则。读取 [art-direction-method.md](references/art-direction-method.md)。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。

直接继承目标平台、视口与屏幕朝向、画风、`targetFinish`、内容尺度与 `experienceProfile`。视觉参考只借鉴已声明的构图、材质、色光或信息层级，不得照搬他作的角色、地图、界面与美术资产；原著文化背景与目标发行市场分开考证，不用泛化的流行刻板符号替代原著自身的时代与文化气质。

## 输出与设计规范

生成 `design/ART_DIRECTION.md`，包含：

1. **`targetFinish` 与核心视觉原则**：确立能明确区分“符合本作”与“偏离本作”的审美准绳；
2. **镜头构图与视觉语言**：为主角、目标点、威胁、奖励和场景地标建立清晰的机位、焦点、剪影轮廓、体型比例、疏密规则及标志性识别特征；
3. **服务玩法的色光、材质与动效**：准确传达已由规则裁决的游戏状态，并提供不依赖颜色的图形提示、低动效替代方案与充足对比度；
4. **HUD 布局与操作反馈**：明确首屏重心、信息层级、即时反馈、失败提示与结算画面，规定目标语言的字体覆盖、阅读动线、单屏字数上限与文化符号边界（叙事及混合项目还需说明人物站位距离、朝向与姿态如何外化人物关系，以及对话框如何兼顾阅读、回看、跳过与快进）；
5. **关键游戏时刻**：围绕核心循环或视觉风险最高的场次，写清玩家操作、局势压力、画面焦点及操作前后的画面变化（按参考文档条件决定是否产出 `design/VISUAL_TARGETS.md` 及目标样张）；
6. **声音方向**：设定声音风格、功能音效层级和配乐边界；仅在确有独特体验价值时启用角色配音，全程保证纯字幕与静音模式下可正常游玩；
7. **资产清单与视觉风险**：区分必需资产与可降级资产、原创与授权边界，以及尚待验证的视觉风险。

交付前在目标视口尺寸下核查：关键游戏时刻是否在真实的带 UI 游戏画面中成立（不拿概念宣传海报顶替），且美术规范已完整覆盖核心循环、失败与结局。
