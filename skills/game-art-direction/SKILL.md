---
name: game-art-direction
description: "Direct game art and creative vision. Turn GAME_DESIGN into a production-level ART_DIRECTION defining a recognizable visual style, camera and composition, world and character grammar, functional colour/light/material, HUD feedback, motion and transition specs, audio direction, and a signature moment for every screen and mode. Use for what should the game look like, set the art direction, define the visual style. 游戏美术与创意方向。把 GAME_DESIGN 转成策划级 ART_DIRECTION，定义可辨识视觉风格、镜头构图、世界与角色语法、功能性色光材质、界面反馈、运动与转场规格、声音方向和每个界面/模式的签名游戏时刻。用于判断游戏应该长什么样、制定游戏美术方向等需求。"
---
# 游戏美术与创意方向

定义玩家最终看见、听见和读懂的体验；资产怎样生产、使用什么渲染库、模型或供应商由构建阶段决定。

读取 [art-direction-method.md](references/art-direction-method.md)。必须已有 `GAME_DESIGN.md` 与
`PRODUCT_BRIEF.md`；视觉服务玩法，不能用漂亮参考图重写游戏。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。

继承目标平台、视口/朝向、画风、内容尺度、`targetFinish` 与 `experienceProfile`。视觉参考只借
声明的构图、材质、色光或信息原则，不复制他作角色、地图、界面和资产。原作文化与目标市场分别
研究，不用流行刻板符号替代原作身份。

## 设计

1. 定义 3–5 个能否决错误方案的视觉原则和反向原则；
2. 为玩家、目标、威胁、奖励和地标建立镜头、焦点、轮廓、尺度与密度语法；
3. 让颜色、光、材质和运动编码真实状态，并提供非颜色冗余与低动效表达；
4. 定义首屏焦点、HUD 信息层级、输入反馈、结果分级、失败与结果状态；
5. 为环境、角色、交互物和关键道具定义共享世界语法与各自识别锚点；
6. 定义目标语言的字体覆盖、阅读顺序、文本密度与文化符号边界；
7. 为每个实际交互界面或模式描述一个招牌时刻，说明玩家动作、压力、焦点、前后节拍和界面；
8. 定义声音世界、功能反馈层级和音乐边界；语音只在确有独特价值时选择，并始终保留字幕/静音路径。

`narrative-led` 或 `hybrid` 的叙事层还要说明人物距离、朝向、遮挡和姿态如何表现关系变化；对白区
怎样保证阅读、历史回看、跳过与加速；隐藏关系或立场优先通过称呼、站位、可选行动和场景可达性
表达，不默认做成数字面板。

动态媒体只规定体验角色、触发状态、镜头两端必须接续的事实和静帧/低动效 fallback；生成资产只
规定风格、身份、构图和状态连续性。生产台账、调用、格式、缓存与接入属于构建阶段。

不要写着色器、拓扑、贴图规格、接口、文件格式教程或供应商参数。

## 输出

生成 `design/ART_DIRECTION.md`，包含：

- `targetFinish` 与视觉原则；
- 镜头/构图、世界/角色/道具语法、功能性色光材质；
- HUD、反馈、运动/转场、语言/文化与声音方向；
- 各界面/模式的招牌时刻；
- 必需与可降级资产，以及原创/授权边界和仍未确定的视觉风险。

只有 `targetFinish`、用户用途或高风险视觉问题确实需要时，才追加 `design/VISUAL_TARGETS.md` 与少量
持久目标图；文字方向本身不因缺图片工具而失效。采用语音或动态媒体时只在 ART_DIRECTION 中补方向
条目，不建立生产级空表。

交付前确认：玩家一眼能找到当前动作与压力；招牌时刻在实际界面而非概念海报中成立；方向覆盖核心
循环、失败和结果；构建无需重新发明风格或反馈，但仍保有实现自由。
