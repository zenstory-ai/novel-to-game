# BUILD_BRIEF · 金瓶梅·风月总账（二十日五院版）

## 2026-08 新国风视觉重塑增量

- `buildStage: production`，不改规则器、内容节点、存档字段、分级或二十日完成条件。
- 四十一张运行图片全部替换为原创二维新国风叙事 CG；运行键、懒加载、年龄门和 fail-closed 合同不变，旧棕黑资产与工笔样张不保留。
- 末级主题改为 `app/css/new-guofeng.css`，把年龄门、首屏、顶栏、决策页、五扇院门、夜谈、结果页与覆盖层统一到暖白／石青／朱砂／青绿／藕荷语法。
- 视觉基线锁定“完整晚明世界＋成熟理想化二维游戏人物”：不退回古画复刻，不做真人古装摄影、3D 剧照、现代棚拍或暗黑封面。
- 参考库图片不进入运行目录；Case 213／290／9／230 只提供古代游戏空间、角色卡识别、高明度色光和留白方法，具体裁决写入 `design/VISUAL_TARGETS.md`。
- 验证除既有模型检查外，增加 1280×800、1600×800 与 390×844 的首屏和关键流程截图、四十一张资源解码、旧图清零、无水平溢出与控制台错误检查。

`targetFinish: playable-prototype`

`buildStage: production`

`buildPath: custom`

## 目标

在现有零构建网页运行时上，把六日三线切片升级为可完整游玩的二十日五线版本。保护第一人称、日程经营、可拒绝成人关系、人物能力反哺经营和证据化 QA，不改做纯视觉小说或开放世界。

代码原生状态机是可执行改编模型：`data.js` 定义可选行动与内容节点，`engine.js` 独占资源、关系、知识、
承诺、事件与结局提交，DOM/CSS 只表现已裁决结果。`qa/playable-model.json` 仅是对照实现的测试 oracle；
`node qa/verify_playable_model.mjs` 必须证明两条正堂起手可区分、可确定性重放、长期回调载荷存在、未选
分支不污染、合法存档可重演且伪造状态拒读。该命令不逐日演出这些回调，也不替代真实浏览器的六项
完整 QA。这个既有候选早于内容与规则修订号拆分，故 `contentRevision`、`rulesRevision` 明记为
`NOT_AVAILABLE`；唯一可核的兼容边界是 `saveSchemaVersion: 67`，不得把它冒充另两种版本。固定验证
seed 为 42：主路径依次执行 `opening_open_ledger` 与三次开场后章推进，相邻反例改走
`opening_hear_five` 与同样三次推进；两路都应进入 `day`，但旗标、宅门值与院间关系必须不同，向任一路
注入另一条起手旗标都必须拒读。

## 必须实现

### 状态与日程

- MAX_DAY 为 20；四幕各五日；二十个唯一日 id、标题、压力与情报。
- 每日两套 seed 真相；同 seed 复现，不同 seed 改变征兆、正解与证据声口，不用隐藏 RNG 判成败。
- SAVE_VERSION 当前为 67；旧档拒读；openingAftermath、sceneBeat、nightConversation、nightCoda、routeAftermath、pairInterlude、favorReckoning、memoryReckoning、duskInvitationAftermath、personalAfterglowAftermath、personalFinale、allianceAssembly、allianceNight、sharedAfterglow、fateCoda、dayAftermath、jointActionBeat、portablePrecedent、morningSettlement、householdAftermath、crisisAftermath、councilAftermath、publicEvidence、publicAftermath、actAftermath、fivePrivatePrices 与 finalReckoningAftermath 必须严格记录开局五人三幅连续回应、个人册页、专属夜谈及其三幅回答后章、普通夜章、路线最终处置两幅、双院私议六拍、白日人情追账四拍、路线旧话追账四拍、主动邀约四拍、个人亲密余夜后章、个人终章问答、逐院问灯、有限同盟问答、五院余夜问答、命数三页、白日三幅后果、联院三幕、首次联办后的五屏院外援例、具名晨簿、娇儿跨幕交易、可恢复危机、院议裁决、第十五日三步证链、公开问责收尾、换幕后果、第十九日五封私价和终局外账的当前拍号、选择结果与前章立场；relations、visits、routeStances、publicOverrides、routeReopensOn 必须严格等于五名女主键集合，bonds 必须严格等于十组成对键。路线历史还必须逐拍重放：第 2／4／6／8 拍只能使用此前占优立场对应的分支，跳拍、旧固定选项或偷换另一条前史均拒读。
- 两种正堂起手都必须进入三幅群像后章，让五人分别拆解事实、物证和去路；两条路径写入不同的起始院间互信，第 1 日显示原则笺，第 5 日公议再拿这笔旧例追问。
- 第 1–4 日必须形成十二路可验证的跨日生活链，而非四张独立教程卡。第 1、2、3 日各从真实 `day_action` 与正确 `actor` 派生一件唯一纸物，翌日同时替换 `dayDef.pressure`、`dayAgenda.dilemma` 并显示来源卡；伪造经手人不得产生回响。第 4 日 household 还要把第三日灰袋／锁号／回结／货主花押带到娇儿面前，但不能挤掉本日四种交易准备，也不能提前交付具名底价。该链只从 history 重算，不增加存档字段。
- 第 1 日 `opening_choice` history 还必须由 `openingMemory` 派生两套长期原则。对象除三拍开场与第 5 日回声外，须提供第 15 日总览、两项 `PUBLIC_EVENTS[15]` 选择正文、第 20 日总览、三项 `FINAL_RECKONING` 选择正文与四拍 `final_aftermath` 回声。`opening_open_ledger` 维持缺口可见但不预填罪人、公开不取得整本私物；`opening_hear_five` 维持原话出处、证力、期限与拒绝。`currentPublicEvent`、`currentFinalReckoning` 与 `currentFinalReckoningAftermath` 只读注入对应文本并暴露来源提示；不得改变 choice ID、effects、证链等级、联盟成员、history schema 或 `SAVE_VERSION`。同一对象还须提供五类 `endingTexts`、五人 `epilogueTexts` 与命数末页 `fateText`；`determineEnding` 只追加当前结局族文本，`endingEpilogues` 只给每名女主追加本人一条，`currentFateCoda` 只在第三页追加固定命数下的最终回声并暴露来源。结局读档继续重建这些展示字段，不写入新的可协同篡改状态。
- 第 5 日公议必须从第 4 日真实 `night` history 读取拜访对象与停留方式，派生五种不同热食、院门、经手痕迹和受宠者后果；按钮、追问正文与三拍 `public_aftermath` 不得出现未替换占位符。正式妻妾名分与席序保持 immutable，一次先送只能成为有日期的偏爱与补工责任，不能重写为现代平席或永久轮宠。
- 第 5 日真实 `day_action` 与正确 `actor` 还必须派生 `DAY5_PUBLIC_PREPARATIONS`：五碗旧席单／三处分坐纸／春梅原话斜结／逐名补工单之一，与热饭记忆同时进入 `currentPublicEvent`、三项动态 `public_followup` 文本及 `public_aftermath` 三拍。所有 `{meal*}` 占位必须按真实昨夜对象填完；伪造经手人无回响，choice ID、effects、history schema 与 SAVE_VERSION 不变。
- 第 5 日 `banquet` history 还必须派生 `DAY5_PUBLIC_OPENINGS`，严格区分 `public_balance_1` 的逐手经办页与 `public_5_favor` 的具名自认页。动态 `public_followup` 要改写三项正文；已认责路线的 `follow_5_let_them_edit` 必须替换重复认责句，`follow_5_stop_rumor` 必须覆盖为 `exposure:-2, house:-6`，而未认责路线仍保留基础 `exposure:-7, house:-3`。该开场对象还要逐拍进入 `public_aftermath`、第 6 日 `act_transition`／`act_aftermath` 与第 7 日 `council`／`council_aftermath`；从 history 派生，不增加存档字段，不提升 `SAVE_VERSION`。
- 第 7 日院议落案后，`recordedNightLedger` 必须同时派生 `DAY5_PUBLIC_OPENING_LONG_ECHOES`。第 13 日 `dayDef.nightLedger` 与四个 `nightLedgerScope` 分别追加开场专属生活责任；第 18 日 `currentHouseholdEvent.nightLedger`、三项 `nightLedgerDisposition` 与 `currentHouseholdAftermath` 四拍分别追加交易边界。`public_balance_1` 追经办、工钱与未知手，`public_5_favor` 追家主已认成本但不扩成他人授权；全部从既有 banquet／council history 重算，不增加 history 字段或 `SAVE_VERSION`。
- 第 5–9 日必须保持同一条可读日常因果：先送热食 → 食盒油印进入韩道国假账 → 缺口碗与玳安／码头路线互证 → 四张催菜单逼出停灶 → 灶上劳动余物把旧箱带回桌前。第 6 日真实 `day_action` 与正确 `actor` 必须派生油印撕页、真账底单、串词窄纸或隔席空栏之一，同时改写第 7 日 `dayDef`、`dayAgenda` 与院议材料；它与第 5 日 `public_followup`、第 6 日 `act_transition` 的夜簿权限前史并列，不能互相覆盖。第 7 日真实 `day_action` 再派生盐泥红蜡、有限退帖、缺口碗原话或同锅饭绳结之一，同时改写第 8 日停灶压力与两难。第 8 日真实 `day_action` 继续派生补工封袋旧签、公牌注销簿退号、管事旧箱口误或守夜欠帖之一，同时改写第 9 日 `dayDef`、`dayAgenda` 与娇儿交易来源卡；它不能挤掉第 9 日当日验契准备，也不能生成原件、授权抄本或押名结论。伪造经手人不得产生回响。所有物件都只证明亲见的一段：春梅只承担真正催过的一回，玳安只认门外一程，车夫、烧火妇与旧抬箱人不替未知处补口供；金莲与雪娥的双院私议必须把原话、加词、命令、劳动分栏，不能把春梅写成恋爱角色，也不能让任何低位经手人替管事和家主吞下全部责任。该链从 history 重算，不增加存档字段。
- 第 9–12 日必须把“契据／口供／官面／货路”落回宅内可见之物。第 9 日旧契明确关联瓶儿过墙旧箱、沉香、胡椒与押名，但白日仍只准备；第 10 日从真实 `household_aftermath` 派生五院索引、限案封存、强拿归还、继续扣押四套 `deedEcho`，并为四类白日动作分别追加不同实物、传话人与边界，不得退回通用“已有旧契”。第 11 日官面压力表现为盐车不卸与灶上少盐，四种真实 `day_action` 分别留下“一瓮”收货回单、三日验盐帖、祝家私章原话蜡拓或分盐工签；第 12 日 `dayDef` 与 council 都要回读该物，再接空船、仿旧箱、沉香气、绳头与西厢旧麻。伪造经手人不产生回响；盐蜡、半帖、私章或缺签均只能锁住一段箱路，查到物从某院门前过不得自动等于该人物作恶。
- 第 13–20 日继续保持生活纵切，不得回到只有协议名的高潮。第 13 日从第 12 日院议派生米、药、灯油、回礼、跑腿鞋与三种垫付边界；同日真实 `day_action` 还须留下五张归还日签／同柜号四铺回单／“不催”货价尾注／分持齿口领取单之一。第 14 日 `dayDef` 与娇儿 household 读取该物，分别保留第五件未补、四笔垫付独立、重复抬价争议或五人逐项放行；伪造经手人无回响，本日四项用途与成交栏仍保持空签。第 15 日以短米、破鞋、添火工钱和五件原物问责，第 16 日以原票、脚店热饭和新草鞋拆分真债主／收钱喊话者／饥饿跟来者。第 17 日夜查须写油灯、同锅饭、草鞋与三名具名进柜者，并按真实 `day_action` 留下三张分存拓片／三名夜牌与饭筒／守柜人口误扇骨／饭碗错鞋之一；第 18 日 `dayDef` 与娇儿 household 都要回读该物，只允许验真有限一程，伪造经手人不得产生回响。第 18 日本日准备仍只摆银堆、车筹、两把空椅与路饭，不能被上一日实物替代；第 19 日五封价书逐件压总印、原话、货封、名帖与工簿；第 20 日先封三日粮药工钱、逐件还物、留退席路，再开外账。
- 第 1–19 日不能进入 ending；第二十日前共线入口隐藏，determineEnding 也要独立拒绝伪造的提前状态。
- 每名女主八段不重复路线，走完后院门显示完成并拒绝重复刷最后一段。
- 路线选择累计“共同承担／私下情分”；明确夜场至少需要两次共同承担，不能只看好感。
- 李娇儿在第 4、9、14、18 日有四次连续交易事件。九个初始价格选择每个都必须进入四拍后续：成交／拒买落地、两名五院见证人拆出隐含代价、娇儿提出两种票契结构、玩家作第二次处置并看见结果。十八个二次处置与四十五段过程／结果正文不得换名复用，逐拍可存读；后三次还要同时显示上一笔初选与二次落字。第 4 日白日只可算区间、备见证、听待核口风或列空白价栏，具名精确底价只由买下／拒绝报价产生；第 9 日白日只可隔掌验契、备候认人、找亲见者或排空封套，第一份授权抄本或原件转移只由抄契／强拿产生。第四日少付的十两是派生尾款，会改变第九日抄契成本、第十四日兑票净收益或第十八日封口成本。买断、具名分成、拒买欠账、强拿后归还／扣押必须进入不同终局交易总账，不能只改态度值；第 14／18 日继续按真实历史回读原件、抄本、收据及具名底价纸的位置。
- 断粮、证人翻供、宅中集体交钥匙三类可恢复危机不能用一次资源按钮带过。危机首屏必须先消费 `currentHouseCrisis` 的三份 `currentReply`：前端逐拍显示人物、本人原物、实际动作、答复与真实前史理由，并以 `advanceHouseCrisisReply` 落账；三答完成前不得渲染制度救法。三份答复落齐后只显示与 stand／amend／withdraw 边界相容的两院结构和兜底救法。九种初救随后都进入四拍危机章节：救法实际落地、受影响者追查隐含代价、另一院提出两项制度补救、玩家二次选择并看见结果。十八项制度选择与三十六段新增后续正文必须按危机和救法分别写作；逐拍可存读，第三拍以前不得提前回到日常循环。
- 二十日每次白日选择都进入 `day_aftermath` 三幅连续剧情：主办者执行、旁院回应、危局回手。不得再用一张结果浮层把三层正文合并；三幅都要可存读，最后一幅才转入当日特殊事件或黄昏。第三幅已经承担章节收束，翻到五院门时不得再重复弹出同一结果摘要、遮挡下一轮人物与后果预告；娇儿交易、院议和主动邀约等多拍章节遵守同一规则。
- 每日结转若真实产生用度短账或曝光见证费，次晨至多进入一次 `morning_settlement`《晨簿落名》。经手人必须由此前真实 `day_action` 派生，不读好感排名；五人分别收回总印与铜镇、原话纸与扇骨、私钥与货单、帖匣与回礼单、封火牌与工簿。玩家只能三选一：`accept_stop` 暂停对应行动并从下一夜减去 6 点停项日用或停止暗付 15 两封口银；`narrow_authorization` 只放行下一次指定行动，用后立即转为硬暂停；`publish_gap` 承担露 +6／声 -1，保留行动但每次再加露 +4，曝光费用公开后不再暗付封口银。三路都必须由本人指定的另一项白日行动生成带具体 `result` 的 `morning_settlement_restore` 才解除；走官面若被高曝光、耗损或无银锁住，只能办理不添官势、不收当日危局的具名恢复回执。曝光关系后果按真实经手人与院间互信分配，不得全员统一加妒；未恢复时不得叠加第二项限制。来源、物件、限制、恢复、选择、一次使用、具体恢复结果与恢复专用正文均须由 seed 与真实过程重放，协调偷换资源或字段拒读；结局与命数回读具体物件、恢复状态与实际复核结果。
- 前十八日每个危局除 seed 征兆正解外，还要有一条关系资本解：主办女人情分与相关院间互信达标，或已经立约／走深路线，才可拿她的名、货、口供、账或工先收口。关系解的按钮必须预告追账日；两日后进入独立 `favor_reckoning` 四拍章节，依次演出借力者开账、受影响者举证、玩家偿还／重谈／赖账、双院结果，四拍均可续读。第十九、二十日不得新增来不及回收的人情债。 `favorReckoningMemories(state, heroine)` 只读配对真实借力 `day_action` 与已结 `favor_reckoning`，返回 `{ event, day, sourceDay, heroine, observer, observerName, sourceAction, sourceLabel, sourceText, debtTitle, debtBody, heroineLine, observerLine, choice, choiceLabel, outcome }[]`；院门与一月笺必须消费完整数组，正文、routeNote 与列表逐笔显示债源、见证和结果，单数接口仅兼容返回末项。前十八日×三种裁决的五十四条路径全覆盖；第十九、二十日继续验证 `ready === false`。`fateHeroineMemories` 在 fixed fate 之后追加全部已结人情，返回完整 `favorReckonings` 与末项兼容 `favorReckoning`；人物分卷逐笔保留债源、见证、裁决和结果，并明确不改死生与去处。不得新增 state、history schema 或 SAVE_VERSION。
- 人物账必须有派生的“待兑现”页：列出尚未结清的人情账与路线旧话、原日、涉及两院、到期日和主题，今日到期／积压／冷门优先；结清后即时移除，赖账冷门改为显示重开日。该页只能从真实 history 与 routeReopensOn 派生，不能另存一份可能失真的 UI 状态。
- 五院门卡必须在进入前显示可推演后果：本次拜访序号、普通续章／人物关键章、会进场的旁院、当前互信与下一档距离、明早最高妒意来源、可走院约／共担／私情方向、未结旧话归期或冷门重开日。不得只显示好感和人物简介，也不得泄露尚未发生的具体剧情答案。
- 五桩联院差事各有三幕独立正文：两名参与者先后主导、互相指出方法边界，第三幕才合流并结算奖励；`joint_result` 在三幕结束前不得离场。
- 本局第一个 `joint_result` 三幕读完后必须进入且只进入一次 `portable_precedent`：可核物件与成年院外经手人登场、两名女主按真实院约／路线／双院历史分别作出 stand／narrow／withdraw、玩家在 honor_precedent／named_exception／inside_only 中裁决、最后执行三项具体动作。撤回必须优先，玩家不能替她们改答；结果不得改写 resolvedPressures、jointActions 或第 15 日证链。第 20 日、结局笺与命数页必须回读具体经手人、两份答复、裁决范围和契的去处。
- 第 7、12、17 日三场院议共九种裁决都必须进入 `council_aftermath`：先由提出者把规则说清，再由真正受影响的人试用或反驳，最后由另一名女主把口头规则改成可执行的钥匙、轮值、私账或拒绝权。每种裁决固定三拍且可逐拍存读，第三拍之前不得把规则直接视为无争议生效。
- 第 7 日院议必须从第 5 日 `public_followup` 与第 6 日 `act_transition` 的真实 history 派生：三种署名／撤回前史改变开场物件、三种互见办法写进正文，三个既有选择 ID 与基础 effects 保持不变，但形成三套选择正文和九套两拍后章。裁决留下的长期事实不另存可漂移 flag，而从第 7 日 `council` history 重算；第 13 日 `dayDef` 与真实 `day_action.executionText`、第 18 日 `currentHouseholdEvent` 都必须回读它。旧页卯初失效、本人签只处分本人范围、沉默不等于同意；不得把夜簿升级成第 10 日证物或用它推断忠诚、动机与物件去向。
- 第 5、10、15 日三场公开问责在群像册页与第二次裁决后仍不得立即散场。九种收尾都进入 `public_aftermath` 三拍：先演刚选中的公开行动，再由受影响者检查署名、证物、责任或撤回权，最后由另一院把真实承担写进共同记录。九条分支共二十七拍，逐拍可存读，第三拍后才进入黄昏。
- 第 10 日真实 `day_action` 与正确 `actor` 还必须派生 `DAY10_PUBLIC_PREPARATIONS`：四手时辰条／三家退席帖／五张单字窄纸／旧箱三物与本人钥匙之一进入 `currentPublicEvent`，再为三项 `public_followup` 选择各追加不复用的执行文本，并在 `public_aftermath` 三拍保留原物与边界。同日 `banquet` 历史还必须派生 `DAY10_PUBLIC_OPENINGS`：`public_balance_2` 保留五份本人原页，`public_10_hide` 只保留四份原页与火盆收讫条。该状态须进入第六份假本、三项 `public_followup`、`public_aftermath` 三拍、第 11 日换幕正文与 `act_aftermath` 三拍；缺页只能标为“已焚待证”，不得从记忆或后续假本重建。伪造经手人无回响；动态正文可变，choice ID、effects、history schema 与 SAVE_VERSION 不变。

- 第 10 日公开问责的第二选择必须成为第 11 日换幕的真实输入：批注留存、放饵出门、当众烧毁分别派生封线未动的原卷／无批注旧诬指投门纸、空油布／回流痕迹、具名有限记词三套现场。三套各提供三项不复用做法、不同资源／关系结算和两拍专属后章；烧毁路线禁止再次出现晾干原件、夹层纸或纸脚，放饵路线禁止把原件写回宅中，留存路线禁止外人无缘无故知道密封后的五院批注。第 11 日历史须写入第 10 日来源并拒绝偷换或倒置。 换幕同时从第 10 日 `banquet` 历史重算原页完整／缺页状态；它与第六份假本的批注／放饵／烧毁去处并列，不得互相覆盖。第 12 日院议的正文、按钮、结算和后两拍继续读取第 10、11 日实际材料，九种组合分别改变原卷开封、热路线追查或记词撤回的真实权限。
- `day10To12EvidenceContext` 只有在真实第 10 日 `banquet`、`public_followup` 与第 11 日 `act_transition` history 同时存在时才返回材料。它把 `DAY10_PUBLIC_OPENINGS` 的 Day12 正文、三选正文与三拍后章注入院议，使“五份各归本人的原页”或“四份原页加第一张火盆收讫条”始终与第六份假本材料并列；第 13 日 `dayDef.councilEcho.materialText` 继续携带这一原证状态。动态正文不得改 choice ID、基础 effects、history schema 或 SAVE_VERSION。
- 第 15 日群像册页关闭后必须先进入 `public_evidence`，不能直接跳唯一主签，也不能把白日已经递出的首证清空重选。真实 `day_action` 与正确 `actor` 分别把米斗工簿、名帖门簿、四版口供、两本流水预置为 `publicEvidence.selected[0]`；界面明确显示来源行动、经手人、原物和证据边界，玩家只从余下三份中再递第二、第三证。没有第 15 日单人行动的联院路线仍可从空链起步。每一步显示能证明什么以及玳安、韩道国或应伯爵怎样反问，顺序派生闭合／留缝／断裂；完整次序和结果写入 `public_evidence_chain` 历史，记录链首必须与有效白日行动一致，并由第 16 日复案、第 17 日硬证据／院议、第 20 日外账与所有结局正文回读。首证的专属回声还须进入唯一主签与 `public_aftermath` 三拍，不允许主签倒写第一证或收走原经手人的物。公审开场的 `banquet` 历史也必须参与重算：`public_balance_3` 保持原始证链等级；`public_15_scapegoat` 保留原始 score 与 step strength，但把 raw complete 的有效结果降为 rebuttable，并使用留缝效果与旗标。该开场的专属正文须进入举证、主签、三拍归档和第 16 日复案；存档若把先押开场与 clean complete 结果拼接必须拒读。重复证物、伪造结果、伪造经手人、错置首证或跳过证链的存档拒读；沿用既有 `selected` 与 history 重算，不增加存档字段、不提升 SAVE_VERSION。
- 第 16 日真实 `day_action` 与正确 `actor` 必须继续派生“庚七寄页”票脚、里正雇钱／灯油回单、柜坊夜值饭筒或真票编号铜钱之一，同时改写第 17 日 `dayDef`、`dayAgenda` 与院议来源卡。该物与第 16 日 `external_rebuttal` 结果并列，不能互相覆盖；它只能接出一段寄页、付款、送饭或存柜入口，不得替夜查取得旧债本，不得让院议收走债主原票、里正与送饭人的停问权或持票人的原物。伪造经手人不得产生回响；该链从 history 重算，不增加存档字段。
- 第 14／18 日白日行动只生成可核准备，不得提前完成随后娇儿交易。第 12 日 council history 派生银票能否触及公钥、私箱、粮银与工簿；第 17 日 council history 派生娇儿可答、主持可做、各院可互证的范围。所有 household 与 aftermath 文案和禁用项从真实历史重建；`council_17_each_door` 必须锁住 `jiaoer_18_share_long`，并在第 20 日继续锁住凭空恢复的两钥总索引。
- 第 18 日六种 `household_aftermath` 还必须派生第 19／20 日只读的 `jiaoerEcho`：只封逃路保留作证权与两枚换车木筹；银货两清保留“不购忠心”收据；单案分成保留结案日；长期一成只增加验真责任、不取得代答权；独立证人席具名热饭、车费和守门工钱；彻底断路承认西厢不再验票或指路。五封私价的总览、协议、五次答复、外部反招、联盟结果与第二十日总账及其四拍后章必须持续显示对应差异；echo 由真实历史重建，不改变 SAVE_VERSION 或新增可篡改字段。
- 第 19 日白日后必须进入 `five_private_prices` 九屏章节：五价总览、答复协议、五人逐一自主作答、保权与联盟结果。五人回答只从真实院约、路线占优、公开越界、双院事件与互信派生；协议不得改答案，关系数值不得单独触发忠诚式全拒。两条历史分别记录协议／派生答复与第十六日旧路／保权／真实联盟，读档重演必须拒绝偷换任一 answer、mode、right 或成员。第 20 日三种外账读取接价缺口、协议、保权与 full／limited／failed；只有 full 可进入五院共同余夜，limited 只开放实际成员的有限同盟。
- 同一九屏必须从正确 `actor` 的第 19 日真实 `day_action` 只读派生 `dayPreparation`，且每屏持续显示：`ledger` 为五件原物各归本人、不得并成总代表物；`office` 为五道只验纸脚／线结／封泥而不互读正文的验真环；`listen` 为改页权／先刊权／钥匙／递送路／劳动者姓名五种真价；`banquet` 为已逐名先付的车脚、封套、灯油、守门工钱与夜饭。每套必须含总览、协议、五人专属答复、外部反招和结算文本；不得增加 effects、改写自主答复或写入 `fivePrivatePrices` schema。伪造第 19 日经手人只移除该回声，不得破坏合法九屏或挤掉第 18 日 `jiaoerEcho`。
- 第 20 日终局外账还必须从正确 `actor` 的当日 `day_action` 只读派生另一套 `dayPreparation`，并贯穿主裁决与 `final_aftermath` 四拍：`ledger` 的三日粮／药钱／守夜工钱／证人车费封包排除在可清余数外；`office` 的五张原物归还验缺单把保管、证据效力与重新放行分开；`listen` 的五张校勘签逐封保期限、“不知”、只限本人、只交副页与不连坐；`banquet` 的六席、饭签、车费袋与退路把在场、进食、出证、签收、离席分栏。不得改变三条主路、六项二次裁决、联盟成员、五封保权或娇儿权限；不新增 `finalReckoningAftermath` 字段。伪造经手人只移除该层，合法外账继续成立。
- `limited` 的 Day19 结果只是 2–4 名互证候选。第 20 日终局外账后必须先进入 `alliance_assembly` 的 N+2 屏《逐院问灯》：共同邀请、N 份本人答复、真实落席总结。玩家不能删名、排序或改答；答复只从邀请前真实院约、破裂、具名 `pair_interlude`／`joint_action`／`route_aftermath`／`day_action` 与实际终局主裁决、二次保权重演为 join／amend／withdraw，负 bond 不能凭空变成冲突。amend 必须由本人当场改完条款并立即生效，不能留给玩家补办。join 与 amend 全部成为成员，允许 2、3、4 人；少于两人无惩罚返回院门且不得重试。候选、来源事件、Day20 裁决、答复、当前拍与成员均严格校验，四人同意改成三人、注入候选或偷换回答必须拒读。
- 第 6、11、16 日三次换幕的九种选择都进入 `act_aftermath`：先承认刚选办法的真实代价，再由另一院拿证物或自身边界验证，最后把下一幕会执行的交叉核验、隐私问签、诱饵撤回、共同支出或拒绝换名办法写清。第 6、11 日固定三拍；第 16 日在现实检验后追加“三口复案”第二次选择与结果，共四屏。复案必须按第 15 日闭链／留缝／断链给出三套不同事件，每套各有分段作答、有限证词、街面短札三种不复用结果；断链选择不得产生闭链结果。`actAftermath.resolution` 与 `external_rebuttal` 历史严格记录事件、原证链、第一次换幕选择、第二次选择和三名具名外部人物；`externalEffectAudit` 只保存第二选择前后的资源／关系快照并核对即时效果，读档时再从 seed 与真实 history 重演整条决策链，重建后续资源／关系，因此合法范围内单改数值、附加自签 delta，或协调偷换选择、旗标和院间信任都必须拒读。第 16 日若读取到先押韩道国的开场，三口复案还须显示该 opening 的程序污染，并明确分开押前／押后口供；不能只因有效结果已是 rebuttable 便退回通用留缝文案。第 17 日院议与第 20 日外账只可从真实 `day_action` 回读守柜人口误、换锁工单、三份封痕或失手，不得以通用 `resolvedPressures` 虚构证物。
- `DAY15_PUBLIC_OPENINGS` 还必须为第 16 日复案四类落法、`COUNCIL_EVENTS[17]` 三项选择、`council_aftermath` 三拍和 `final_aftermath` 四拍提供两套长期正文。`withDay15PublicOpeningRebuttalChoice` 从真实第 15 日 `banquet` history 重算动态按钮：留白路线持续空罪名格，错押路线分别执行具名撤押、解除整案羁押、公开更正或重开并撤押。`recordedExternalRebuttal` 必须返回同一 opening，供第 17 日问话规则把押前／押后／撤押后口供分栏；第 20 日接管再把证物效力与错误归罪责任分栏。沿用现有 `banquet`、`external_rebuttal`、`council` 与 `final_reckoning` history，不新增持久化字段，不改变既有 effects 或 SAVE_VERSION。
- `DAY5_PUBLIC_OPENINGS`、`DAY10_PUBLIC_OPENINGS` 与 `DAY15_PUBLIC_OPENINGS` 的六个对象各自提供唯一 `endingText` 与 `fateText`。`publicAccountabilityMemory(state)` 只从三个既有 `banquet` 记录按第 5／10／15 日返回 `{ day, choice, label, endingText, fateText }`；第 5 日文本仍经过真实热饭记忆填充。`determineEnding` 在既有第一日起手回响之后追加三条 `endingText` 并暴露只读副本，`currentFateCoda` 只在末页追加三条 `fateText` 并暴露只读副本。缺少某日合法历史时只省略该行；不得新增 state 字段、改动 effects、history schema 或 `SAVE_VERSION`。

### 五人关系

成年白名单：吴月娘、潘金莲、李瓶儿、孟玉楼、孙雪娥。每人提供 adult=true、关系状态、院门、八段路线、前奏、关系终段、夜谈／停止文案、独立拒绝条件和理解型结果。

五人的前奏与关系终段各自必须是三拍连续场景，共十页、三十拍不复用正文：先说明边界，再在靠近后重新确认，最后由本人主动决定是否继续。每拍可独立存读，镜头按拍号渐进变化；三拍走完先进入人物专属余夜初答，再进入三拍余夜后章。十个后章必须各有独立事后问题、两项可实行的二次决定、二十段不同结果与二十条次晨回响，最终一拍之后才可天亮。
二十项余夜二次决定还必须各自产生一条长期亲密约定。它由历史派生，不另造可篡改状态；更晚再次进门时，人物面板必须显示这条旧约；只有它仍是最新关系事实时，路线第一拍才显示并引用，五封结局后日谈也必须交代它后来怎样被继续执行。不能只在次晨回响一次便消失。 每项结构必须保留 `{ heroine, tier, day, id, label, hint, title, outcome, morning, future }`；院门与一月笺独立卡显示落字结果、次晨执行与一月生活。`fateHeroineMemories` 在 fixed fate 后按前奏／留宿并列全部真实约定，命数末页人物分卷逐项保留，声明亲密不改变死生且后来命数不撤销同意边界。二十项单约与五人双约累计覆盖；不改 state、history schema 或 SAVE_VERSION。

未走成五院、有限同盟或个人终章时，不得一键弹出权谋／失稳结局。买静、复制唯一、权谋代价与一般关系崩盘各自进入破局清算：三拍人物冲突、一拍最后取舍、五条人物回应，读完后才落结局。最后取舍不能把坏局翻成圆满，只决定真账、钥匙与退路、人情工钱或公开证据链中哪一项得以保留，并进入结局正文与结局总账。
- 破局清算的五条回应还必须各自调用 `collapseFinaleHeroineMemory`，按真实 history 从晨簿、亲密后约、偏宠对峙、六类关系事实与最后路线选择中择取本人最新一项，返回 choice／choiceLabel／choiceHint、kind、day、label、text 与 conclusion。选择最后取舍时复用 `collapseFinale.beat` 从 0 开始，`collapse_finale_result` 按五名女主固定顺序走五屏；每屏提供当前 heroine／line／memory、此前 previous 与完整 memories，逐屏可存读，第五屏以后才能进入 ending。即时五人回应、ending.collapseResult、一月笺 collapseMemory 和 `fateHeroineMemories` 必须消费同一结构；四类破局八种取舍×五人共四十条绑定均须覆盖。该层只读既有历史，不改破局 choices／effects、结局家族、history schema、state 字段或 SAVE_VERSION。

五院共同余夜后的次晨三选同样不得直接结局。六盏早茶、各回五门、五约分钥三种安排各自显示五条白日回应，并把见光早茶、午前共同账或三处互校的长期制度写进结局正文；玩家读完回应后才结页。

- 五院共守的六种余夜答与三种次晨答不得只依赖 `SHARED_*_RESPONSES` 静态声口。实现只读 `sharedAfterglowMemberReasons`：第一拍逐人取最近一条本人参与的 `joint_action`，第二拍重演本人院约、`route_break`／修回和全部亲密后约，第三拍重演本人院约与 `visit_choice` 路线史；实现 `sharedDawnMemberReasons`，逐人重述前三拍准确 choice／response 后再核验次晨 choice。`recordedSharedFinaleHeroineMemories` 必须仅从既有三条 `shared_afterglow` 与一条 `shared_dawn` history 重建五人四拍，并由即时结果、balanced ending、一月笺、fixed fate 共用；不新增 state 字段，不改 effects、结局条件、history schema 或 SAVE_VERSION。

五条院约：order、truth、safety、grace、hearth。五桩联院差事全部完成才满足共线；现有三桩保留，新增月娘×玉楼、金莲×雪娥。

十组院间关系必须改变联办可用性与非均匀吃醋反应。每组第一次达线时播放独立的六拍双院私议：左侧人物提出条件、右侧人物反驳、两人共同追问；玩家作答后，当事两院共同执行一次，再由第三院检验外溢后果，最后由当事两院吸收异议并落字。前三拍逐拍可存读且第三拍之前不得暴露选择；三十种选择后章、六十段执行／见证正文与三十份落约记忆不得复用，自主结盟、有限交换、偏宠竞争必须产生相反的院间结果，并在后续拜访／路线章回显。`pairInterludeMemories(state, heroine)` 必须从全部 `pair_interlude` history 重建 `{ day, event, pair, choice, label, title, memory, partner, partnerName, witness, witnessName }[]`；院门与 `endingEpilogues` 消费完整数组，一月笺正文、routeNote 与列表逐组保留伙伴、见证和准确落字。`latestPairInterludeMemory` 仅返回该类末项，供统一路线戏眼选择器比较。`pairInterludeLedger(state)` 再按 pair 去重并补全 left／right 名称；`currentFateCoda` 只在第三页暴露该数组，`fateCodaFinalSections` 在 institution 卷追加独立“双院落约”条目，三十种结果都须点名当事两院、选择、见证与原落字，并声明不扩成全宅授权、不改变 fixed fate。不得新增 state、history schema 或 SAVE_VERSION。证据板必须显示来源、可信度与过期日，走官面只消耗玩家亲手选中的一条。

每次个人路线选择后必须有“本人回应 → 旁院接话 → 玩家公开／直谈／私藏 → 本院执行 → 旁院后续 → 余夜”的连续段落；五人×四幕×三种处置共六十个后续章、一百二十段正文，标题和正文不得复用，每幅可独立续读。处理方式至少两日后再由原人物与见证者追账。关系成熟后，五名女主各会主动发起一次独立黄昏邀约，玩家可赴约、公开说清或诚实拒绝，不能只把五人做成被动院门按钮。

`ROUTE_AFTERMATH_STAKES[heroine][act - 1][public|direct|private]` 必须为 `{ label, text, resources }`，五人×四幕×三种处置共六十项且 label／text 不复用；同幕三种 `resources` 不得相同，并至少有一项 `silver >= 0`。`routeAftermathOptions` 在既有公开／直谈／私藏关系预告之后追加动作名与统一资源摘要，用 `cannotAfford`／`costLockedText` 原子锁住缺银项。`resolveRouteAftermath` 先执行稳定关系结算，再执行 `stake.resources`，把动作名、正文和资源摘要写入 log；`currentRouteAftermath` 在两幅结果中暴露只读 `resolutionStake`。`activeObligations` 与 `currentMemoryReckoning` 只从既有 `route_aftermath` history 的 heroine、day、choice 推回 act 与 `sourceStake`，人物账和两日后四拍都显示同一原物与成本。不得新增 `routeAftermath`／`memoryReckoning` 持久化字段、改变 history schema 或提升 `SAVE_VERSION`；回放继续用原 choice 派生同一结算。

`ROUTE_AFTERMATH_STAKE_RETURNS[heroine][act - 1][public|direct|private]` 必须为 `{ returnText, observerText, question, results:{ keep, rewrite, deny } }`。六十条 `returnText`、六十条 `observerText`、六十条 `question` 与一百八十条结果正文分别唯一，并与同索引的 `ROUTE_AFTERMATH_STAKES` 原物严格对应；固定 `AFTERMATH_OBSERVERS[heroine][act - 1]` 的五名见证人各承接十二条。`currentMemoryReckoning` 首拍追加 `returnText`、第二拍改用 `observerText`、第三拍追加 `question`，已结清第四拍追加所选 `results`；`activeObligations` 和三项 `memoryReckoningOptions` 同时显示 `question`，`resolveMemoryReckoning` 把通用关系结算与章节结果合成当前正文及 log。持久化的 `resolution.text` 仍保存既有通用选择文本，章节内容只由 heroine、sourceDay、sourceChoice、promise 与 resolution.choice 重演；不得新增 state／history 键或提升 `SAVE_VERSION`。`routeReckoningMemories(state, heroine)` 必须按 history 顺序配对全部 `route_aftermath` 与已结 `memory_reckoning`，逐笔派生原日／落定日、真实 observer、source choice、stake、事故、质询、问题、裁决标签和所选结果；`latestRouteReckoningMemory` 仅保留为返回数组末项的兼容接口。院门、`endingEpilogues` 与 `fateHeroineMemories` 消费完整数组；五封一月笺的正文、routeNote、逐笔旧话卡以及命数末页对应人物分卷都须点名全部结果，缺任一来源时只跳过该无效配对，不另存长期记忆字段。

五次主动邀约的接受／见光／拒绝共十五种首次回答都必须进入四拍后续：邀约者接住回答、旁院追问横向代价、邀约者提出两项具体安排、玩家二次决定并看见结果。三十个二次决定与六十段新增追问／结果正文不得换名复用；赴约只有第四拍之后才真正进门，见光与拒绝也要先处理钥匙、记录、退路、回礼或劳动后果再回岔口。 `duskInvitationMemory(state, heroine)` 从同日 `dusk_invitation` 与已结 `dusk_invitation_aftermath` 派生 `{ day, event, heroine, witness, witnessName, approach, approachLabel, invitationTitle, invitationBody, heroineLine, witnessLine, approachResult, witnessQuestionTitle, witnessQuestion, heroineQuestionTitle, heroineQuestion, choice, choiceLabel, choiceHint, title, outcome }`；院门和一月笺正文、routeNote、结构化卡全部显示。三十条逐项覆盖，缺二次结果返回 null；`fateHeroineMemories` 在 fixed fate 后追加同一结构化记忆，人物分卷保留完整开约原话、初答、见证、二次安排与结果，并声明赴约／拒绝不改变死生或去处。不改 history schema、state 或 SAVE_VERSION。

所有普通拜访选择都必须连续显示三幅剧情：刚选出的具体动作与人物原话、本院对代价的回应、旁院带着自身利益介入；不得只显示通用结果卡。玩家再选公开、直谈或私藏以后，还要连续显示本院执行与旁院后续两幅；第二幅保留第一幅短摘，两幅走完才出现余夜决定。每名女主第 3、6 次进门再各触发一场不复用的四段人物关键章，共十场、四十段可见剧情。关键章读取路线立场，另一院必须进入现场，最后仍由玩家决定公开、直谈或私藏；每名女主配一张安全中局转折 CG。跨日追账必须显示当初的具体选择名称与人物原话。

五条个人路线的第 2、4、6、8 拍必须真正按此前累计立场分叉。共担占优与私情占优使用不同的两项现场选择，每组仍包含继续深化与主动改道，五人合计八十个历史敏感选择且正文不得复用。进门页显示“前 N 次选择把本章带到这里”、当前占优方向与两类计数；门卡把普通续章改标为历史分支章。第八拍形成十种可读路线结果：五院轮签／公私双簿、真话每日可问／扇落即停、四锁分存／退路仍通、人情具名／空席可留、烟火轮值／停灶由她。

路线中的越界与修复必须按真实拜访顺序重演。`broken_*`／`pinger_exposed` 只证明旧越界发生过，不得因旗标永久存在而否定后来具名的 `*_branch_repaired`；修复后应恢复明确夜场与公开共同口径，后来再次越界则重新锁住。存档与运行时都不得只比较两枚布尔旗标而丢掉先后。

连续两夜拜访同一院必须触发一次三人次晨对峙：被冷落者持具体物件发难、昨夜被选择者亲口回应、发难者把问题交还玩家，三幅说完才出现公开承认／两院互问／继续偏宠三种表态。表态后必须再显示一幅专属结果，完整写出两院怎样接住这次站队，允许中途存读，再进入旧话追账或白日。五名女主各有独立发难正文和被偏爱回应；表态必须分别读取并改变妒意、院间信任、专情倾向、曝光与宅中秩序，不能退化为通用加减分弹窗。 `rivalryMorningMemories(state, heroine)` 必须从已结 `morning/rivalry` history 返回完整数组，每项结构为 `{ day, event, actor, actorName, visited, visitedName, role, other, otherName, title, context, opening, visitedReply, crossfire, choice, choiceLabel, outcome }`。院门按发难者／昨夜被选择者视角逐场显示原话、对方、裁决和结果；`endingEpilogues` 同时把完整数组写入正文、路线账与结构化一月笺。覆盖五名发难者×四名旁院×三种裁决共六十条单路，以及每人累计参与四场不覆盖；不新增 state、history schema 或 SAVE_VERSION。 `latestRivalryMorningMemory` 供 `currentRouteAftermath` 取得该类最近候选；若它在全部关系事实中最新，再按 challenger／visited 分别把 opening／visitedReply、对方、choiceLabel 与 outcome 拼入下一次路线首拍；前端路线记忆卡显示相同视角。六十条裁决须覆盖双方共一百二十个续章视角。 路线连续性选择器必须在 `intimacy|ordinary_night|night_conversation|pair_interlude|dusk_invitation|rivalry` 六类有效候选中，以对应真实 history 的最后位置选唯一 `{ kind, day, label, title, text }`；首拍正文与前端 `data-route-continuity` 卡只渲染这一项，不同时堆叠其余旧摘要。三十种主动邀约都须在独立候选路径中保留本人原话、初答、见证、二次安排与结果；混合历史还须证明后来事件替换当前戏眼，而完整院门／一月档案不丢。 `personalFinaleRivalryReason(history, heroine)` 必须让个人专情终章中的未被选择者只从最近一场真实对峙形成具名理由：challenger 使用 opening，visited 使用 visitedReply，并同时保留 day、otherName、title、choiceLabel 与 outcome。该理由插在最终 outcome 解释之前，不改 `personalFinaleDepartureOutcome`；有对峙为五条理由，无对峙仍为四条。六十种裁决须覆盖双方一百二十种理由视角，并至少由一条真实二十日专情路径证明界面消费该理由。`personalFinaleArrangementsFromHistory` 必须以数组保留同一人的前奏约与留宿约；`personalFinaleIntimacyReason` 在一个理由栏逐项回读 day、label 与 hint。裁决只在全部约定 lane 均与 procedure lane 反向时因该层拒绝；混合 lane 必须改约，不能由最新一项覆盖较早约。覆盖五人×四种双约组合×两类程序共四十路，并由真实专情流程逐项核对界面理由。`personalFinaleRouteReason` 必须让主导 route lane 点名最近一项同向 `visit_choice` 的 day、label、text；平票时共同／私门各列最近一项，无有效路线时明确无依据。覆盖五人八十项基础选择与八十项历史分支共一百六十项，并由真实终章核对 reasons[1]；不新增 state、history schema 或 SAVE_VERSION。

普通夜谈按人物路线进度解锁：每完成第 2、4、6、8 次路线选择，下一次“把茶喝完”进入该女主对应的专属夜谈。每章连续显示人物开口、真正问题与三种立场选择，共五人二十章、一百二十段不复用问答正文。明说、听她定界、门内私情的六十种回答都必须再进入三幅后章：原回答落地、当夜试用、次晨落实；新增的一百二十段当夜／次晨正文标题和正文均不得复用。三幅都显示 1/3—3/3 进度，第二、三幅保留原回答与已读短摘，第三幅以前不得结转次晨；每一幅均可严格存读。第二至第四章另有四十五条人物专属前史回声，必须读取上一章真实立场；连续同一路径与改换路径产生不同的可见标题与关系代价。`NIGHT_CONVERSATION_MORNINGS` 必须是 `heroine -> [chapter 1..4] -> { honest, listen, private }` 的五×四×三结构，共六十条唯一正文；`buildMorning` 只能以已写入 `night_conversation` history 的 `heroine`、`chapter - 1`、`mode` 取值，不能退回人物×态度十五条通用映射。每条至少点明本章物件、执行人、可查范围或继续有效的拒绝；六十条都须通过真实选择、三幅后章与晨间 notes 路径覆盖。该扩写不新增 state 字段、history 字段或 SAVE_VERSION。未到专属章节门槛时，“把茶喝完”与“替她拢好衣襟”也必须按人物×四幕×态度进入四十种独立普通夜章；每章连续演出选择落地、她检验这份停留／停手、明日具体后果三幅，三幅都可续读，不能用一句通用结果直接天亮。第二、三幅在当前正文之前保留已读标题与两行短摘，形成同一章的连续阅读记录，不得用新卡覆盖前文。每章另有一条不复述原句的独立次晨执行画面；`ordinaryNightMemories(state, heroine)` 从全部真实 `night_coda` history 派生不同 event 的生活簿，重复 event 合并 `firstDay`、末次 `day`、`days` 与 `count`，并按最近发生顺序排列。再次进门和人物结局笺消费完整数组，结局正文与路线账逐项保留 closing／morning；`latestOrdinaryNightMemory` 只返回该类末项供统一路线戏眼选择器比较，不能代替完整档案。不新增 state、history schema 或 SAVE_VERSION。

`NIGHT_CONVERSATION_FUTURES` 与次晨表保持相同五×四×三键形，共六十条唯一的一月生活正文。`nightConversationMemories(state, heroine)` 只能从真实 `night_conversation` history 逐章派生标题、物件、选择、立场、次晨与长期结果，`latestNightConversationMemory` 只取最近一项；不另存可漂移记忆字段。院门显示最近一项，`currentRouteAftermath` 只在该结果是全部关系事实中最新时把它接进首拍与记忆卡，`endingEpilogues` 将全部已走章节作为结构化 `nightConversations` 返回，并只把最近结果接入正文。前端一月笺逐条显示已走章节，不补未走章节。六十条数据、最近路线接线与五人四章结局清单须有回归；仍不改变 state、history schema 或 SAVE_VERSION。

`NIGHT_CONVERSATION_OBSERVERS` 必须按 `heroine -> [chapter 1..4] -> { observer, reactions:{ honest, listen, private } }` 保存二十个受影响者与六十条唯一回应。observer 必须属于五名女主且不同于本章主角；全表每人恰好作为旁院四次。选择时从该表只读派生：honest 对旁院情 +2、妒 -2、两院 bond +3；listen 对旁院情 +1、妒 -2、bond +3；private 对指定旁院妒 +4、bond -2，其余三院妒 +1，若连续两章 private 再对指定旁院妒 +2、bond -1。`derivedBonds(history)` 必须重演相同增减。`currentNightConversation` 在第三幅返回 observerReaction，`buildMorning` 同时写入本人执行与旁院接话，长期 memory 保存 observer／observerName／observerLine，路线与一月笺继续显示。不得新增存档字段或提升 SAVE_VERSION。

`NIGHT_CONVERSATION_STAKES` 必须按 `heroine -> [chapter 1..4] -> { honest, listen, private }` 保存六十项唯一 `{ label, text, resources }`。每章三项 `resources` 必须不同，仅使用 `silver|power|repute|exposure|strain|house` 的非零整数变化，并且至少留一项不要求付银的可选做法。`nightConversationOptions` 要把章节动作名与完整资源预告附在原有立场预告后；银钱不足时以该项实际成本禁用且 `chooseNightConversation` 再次原子拒绝。成功选择依次结算稳定立场资源、章节专属资源与连续／改道资源；不得用银钱下限吞掉未足额成本。`currentNightConversation.resolution.stake`、日志、`buildMorning`、`nightConversationMemories`、`currentRouteAftermath` 与 `endingEpilogues` 均从同一表和既有 `night_conversation` history 派生动作名、正文与资源说明。六十条真实路径必须核对按键预告、精确资源合计、缺银锁、次晨、路线和一月笺；不新增 state、history schema 或 SAVE_VERSION。

夜谈历史必须再派生五人各自的关系条款：每人三种、合计十五种唯一 ID、标题、摘要和后日谈正文；主导立场按累计次数计算，同票取最近一次。人物账显示进度和当前条款，终局展示五人的条款总表，人物后日谈追加该条款的独立生活回收。零章不编造条款，一章标为形成中，两章以上才标为稳定；该字段只从历史派生，不另存一份可篡改状态。

### 公开事件与终夜

- 第 5 日五杯家宴，写 public_vow_1。
- 第 10 日荷亭对证，写 public_vow_2。
- 第 15 日正堂问责，写 public_vow_3。
- 三场各用独立选项、场景与群像，不复用同一席面文本。
- 第 20 日正确共线：共同办事场景 → 三段余夜选择 → 五人成人群像 → 次晨选择 → balanced。
- 三段五院余夜每次选择后必须先进入五人逐一回应画面；六种安排共三十条人物回应，最后一答也先听完五人再解锁成人群像。未凑齐五院而进入 2–4 人有限同盟时，同样按“提问→在场者逐一回应”走满三轮；六种联盟回答为五名潜在成员各备一条专属反应，运行时只显示《逐院问灯》真实成员。
- 有限同盟每拍回应还必须由 `allianceNightMemberReasons` 按成员分流：第一拍消费 `allianceAssemblyReasons` 的本人答复／Day20 保权／横向事实，第二拍消费本人院约、破裂／修回与全部亲密后约，第三拍消费真实成员、退出原物与非候选院门。`recordedAllianceNightMemberMemories` 从三条真实 `alliance_night` history 重建每名成员的 beat／choice／response／reasons；ending.allianceMemberMemories、一月笺 allianceMemory 与 `fateHeroineMemories` 必须一致。六选覆盖所有成员组合，只读派生，不改 choices、effects、members、history schema、state 或 SAVE_VERSION。
- 第三拍回应后必须打开 `inner_court_alliance` 四屏群像，再由关闭场景生成结局。`ALLIANCE_NIGHT_TABLEAUS` 为六种安排各提供五名潜在成员的独立实物动作，运行时只抽取真实 2–4 人；`ALLIANCE_NIGHT_COMBINATIONS` 覆盖八种三问组合并给出唯一标题、开场与结局回声。总览须区分真实成员、本人撤回并带走原物者、从未进入候选者；三拍须依次显示成员动作与下一拍限制。`recordedAllianceNightTableau` 只读 history 校验顺序、成员与选择，ending、一月笺和 fixed fate 消费同一动作，不改 effects、成员算法、state 字段、history schema 或 SAVE_VERSION。
- 第 20 日白日外债结算不得在“证链压账／付清本金／五院接管”三选一后直接散场。三条策略各自进入四拍终局外账：执行初选、债主用私话／含混收据／唯一保管人反咬、五人提出两种可执行结构、玩家作出第二次裁决并看见完整结果。六个二次裁决和十二段正文不得换名复用；四拍均可中途存读，结果落下后才进入黄昏。
- 第 20 日个人线：最终夜明确选择一人且她完成至少六拍、院约、情与明确亲密门槛后，进入该人物独有的三问三答终章；每次“明账／私门”作答后必须先停留在人物独立回应画面，回收此前亲密余夜形成的长期约定，再进入下一问。五人共三十种回答各有不复用的现场反应，第三答也不能跳过回应直接结局；六屏走完才生成三种专情制度与人物专属正文。
- 共线另需至少 16/20 日危局真正收口、五份个人路线凭信，以及五人各自至少一次由她主动邀请的亲密前奏。
- 买静、许五个唯一、重复或伪造联院 id 均不能冒充成功。

### 视觉与内容

- 十六个唯一场景、唯一资产键与唯一文件：五人各两页，三页公开群像，有限同盟一页，五院终夜两页。
- 标题与五扇门直接呈现五名女主；孟玉楼、孙雪娥不再以宅中短线样式出现。
- 新增孟玉楼／孙雪娥前奏与关系终段、两张新联院图、五人标题、三张公开群像、五人共同办事与余夜群像。
- 五条个人终章各使用一张安全独立 CG，画面直接呈现该人物的核心边界与其他四院善后；不得复用门卡近景。五张终章图到第四幕才闲时预取，不挤占年龄门后的首轮资源加载。
- 五张中局关键章图只在实际走到第 3／6 次进门时按需加载；不得在年龄门后一次性下载。
- 成人图允许肩背、腿部、松衣和纱帐遮挡等轻度裸露；不显示乳头、生殖器或性行为。
- 所有关键资产加载失败时发布模式显示 fatal，不静默回退。
- 年龄门前只请求 cover 与 compound 两张图，启动图像合计低于 1 MiB（不把 HTML、CSS 与 JS 列入这项图像预算）；确认前 adult asset requests 必须为 0，之后再按安全层与成人层分批加载。

### 界面

- 390×844、768×1024、1024×768、1280×800 与 1920×1080 不得水平溢出；所有 enabled 控件位于视口内。
- 常驻 HUD 只保留日数、幕名与一条必要急报；无急报时不显示“今日无急报”。六项定性资源、五人关系、院间信任、最近账页和宅中人收入玩家主动打开的“宅门账册”。选择、回应和过场等主游玩面板不得出现内部滚动条；只有玩家主动展开的前情／证据局部页与账册、场景册、后日谈、命数档案等明确参考页允许纵向滚动。
- 白日默认态只显示一段当前事实与四个动作；不渲染假院门导航、两难复述、旁观者状态句或选项数值。展开旧事后四个动作仍可见。夜间路线让说话者拥有清晰主图，旁听者仅以无框低亮小像留场；推进按钮不得使用真正决策的朱红实底。主屏正文、引文和按钮说明字号不得低于 11.5 像素，单个决策屏四边闭合框不超过四个。
- 选择结果必须以可见回应条展示，但不锁背景、不抢焦点、不要求纯确认按键。
- 场景册十六页；成人页仅年龄确认后可见。
- 账簿日数字支持一至二十，不出现 undefined 或六日硬编码。

## 内容质量门

- 每日数据唯一；没有复制压力或空白情报。
- 每个路线节点两项选择、至少一项无条件、按钮不超过十个汉字。
- 五人声口可由目标、证据观、称呼和动作区分，不靠口头禅。
- 重要证据在界面显示来源与过期日，并在有效期内由玩家主动读取／消费；亲密和偏爱次晨有物件或公开行动回响。
- 多人场景至少两名女性直接回应另一名女性。
- 个人路线选择不能用一条结果文案收束；即时连续段落、延迟追账与主动邀约都要读取前史并产生可见后果。
- 专属夜谈不能选择后直接天亮；问题与回答以后，必须继续演出即时回应、当夜试用、次晨落实三幅后章，第二、三幅保留此前阅读脉络，五人的物件、议题和声口不能换名复用。
- 后续夜谈不能只根据章节号换文案；必须引用前一章的具体立场，存档若伪造或跳过 previousMode 应拒读。
- 一院结局不能按数值直接弹出；五人的三拍终章必须分别处理她本人、核心边界与另外四院善后。
- 四院善后第一条理由必须调用 `personalFinaleBoundaryReason`，逐人点名真实院约、未立的具体院约、人物越界选择或宅门共破值，以及其后的具名修回。`fivePriceBreakStatus` 同时服务自主裁决与文案：`route_break` 后紧随的同日边界 `visit_choice` 是触发源，不得被算作修回；只接受之后的本人拜访／院约、公开／直谈后约、兑现／重谈追账。未修破裂强制拒绝，修回后再次越界重新按最新破裂拒绝。该轮只读既有 history，不新增字段或提高 SAVE_VERSION。
- 没有亲密后约时，四院善后第三条理由必须调用 `personalFinaleRelationshipReason`，按真实 history 择新回读普通夜章、专属夜谈、主动邀约、双院落约、已结人情或已结旧话；每类点名日期、选择、见证／伙伴、物件与结果。无六类事件时回读首末有效路线选择，完全空白时明确无依据。不得恢复“来往很多／不是初次进门”通句，不改变自主 outcome，不新增持久状态或提高 SAVE_VERSION。
- 四院善后最后一条理由必须调用 `personalFinaleOutcomeReason`，用 procedure label／summary／focus、本人 outcome 标签与 `PERSONAL_FINALE_DEPARTURES` 的唯一 response title 组成；120 种人物结论不得复用三句通用话术，也不得在理由区重复整段 response line。该层只读既有数据，不改变 outcome、history 或 SAVE_VERSION。
- 四院善后读完后必须由 personalFinaleDepartureDetails 从真实第三答历史重建完整的人物、结果、程序、答复与理由。专情结局总账、未被选择者一月笺与 fateHeroineMemories 共用该结构；前端一月笺逐项渲染程序、权利焦点、本人答复与全部理由，命数在固定去处后原样承接。被选一院不得生成善后记录；不新增持久字段，不改变结果或 SAVE_VERSION。
- 被选择者自己的三拍回应必须由 `personalFinaleSelectedReasons` 分别读取三组真实依据：第一拍使用 `personalFinaleRelationshipReason` 的最近关系事实／路线跨度；第二拍使用 `personalFinaleBoundaryReason` 与对齐当前选择的全部亲密后约；第三拍使用 `personalFinaleRouteReason`、本人最近偏宠对峙的被选择者视角和 `personalFinaleSelectedProcedureReason` 的程序／委托边界。前端每拍逐项渲染“她为何接住这一答”；五人×三拍×两选共三十种回答都须覆盖。只读既有 history，不改 choice effects、四院 outcome、history schema、state 或 SAVE_VERSION。
- 五院共同夜选择后不得用一屏静态群像直接宣告同灯。实现 `sharedNightAccordReasons` 与 `recordedSharedNightAccord`，逐人连接第 19 日私价目标、本人回答原话与结果，第 20 日主裁决、二次裁决及实际保权状态，再连接本人院约、`COALITION_PROOF_META` 实绩和不可代答的边界对象。《五约同守一灯》固定演出总约＋五人逐印六屏；balanced 结局保存五份结构，一月笺各取本人一份，`fateHeroineMemories` 在 fixed fate 后追加同一结构。空状态、非 full、缺两步外账、缺院约／实绩或未选择 `shared_five_roles` 时返回空数组；不新增持久字段，不提高 SAVE_VERSION。
- 五院三拍回应后不得回到固定 `inner_court_afterglow.body`。`SHARED_AFTERGLOW_TABLEAUS` 覆盖六种选择，每种提供一套动作正文、下一拍限制与五名人物独立动作，三十条人物动作不得复用；`SHARED_AFTERGLOW_COMBINATIONS` 严格覆盖八个三拍 key，八个标题与 lead 均唯一。`recordedSharedAfterglowTableau` 从既有 `shared_afterglow` history 只读生成 `{ key, choices, title, lead, endingText, beats }`；群像场景显示总览和三拍共四屏，balanced ending 保存同一结构并追加准确组合回声。不得新增图片、选项、effects、state、history schema 或 SAVE_VERSION。
- 永久场景册不得只把动态终章记成 scene id。实现只读 `endingSceneArchives(state)`，从 ending 快照生成 `inner_court_accord`、`inner_court_afterglow`、`inner_court_alliance` 的精确可序列化档案；结局归档持久化这些档案并把三拍组合、真实成员与契据答复纳入 variant key。重看页按档案显示逐页依据、具名动作与非成员边界，同一 scene 有多个真实版本时可切换；旧归档无档案时保留静态 fallback。回放不得改 state、history、路线、结局或 SAVE_VERSION。
- 结局归档还须保存 `endingAfterstoryArchive(state)` 的五封一月笺与宅门末页。每封沿用 ending.epilogues 的完整正文、routeNote 与当前 UI 实际消费的结构化账目，只删除 `ordinaryNight`／`pairMemory`／`favorReckoning`／`routeReckoning` 等数组末项兼容副本；重开后从结局卡直接打开同一套六页后日谈并可逐封翻阅。`.epilogue-copy` 必须有明确的纵向边界，长内容只在 `.epilogue-scroll` 内滚动，打开时 scrollTop 为 0，页眉页脚始终留在书页内。结局归档 JSON 上限 2,400,000 字符，优先保留由新到旧的完整条目；不得写入游戏 state 或提高 SAVE_VERSION。
- 实现只读 `endingFateArchive(state)`：仅当命数已合法完成两次选择并进入末页时，封存两项选择元数据和三页精确投影，包括执行章、3×3 组合与六卷末页。结局归档以 `fates[]` 保存同一 ending key 下最多九个 `first+second` 版本并去重；未完成的新一轮命数不得抹掉已有完整版本。结局卡为一月笺与命数提供分开的重读入口；命数重读可翻三页、切换版本，只消费封存正文，不从新周目重算。它与一月笺共用 2,400,000 字符上限，不改 state、history schema 或 SAVE_VERSION。
- 二十日关系结局不能冒充原著终点。结局后“命数三页”固定发生官哥儿夭折、瓶儿病故、西门庆第 79 回死亡与后续家业散去；
  数值不能逆转死亡，两次玩家取舍只改变照护具名、私契、遗物、证物与制度残留，并读取本局结局与五院约形成不同末页。
- `FATE_CODA.pages[0..1]` 的六个 option 必须同时保留末页短 `echo`，并提供唯一 `resultTitle`／`result` 作为选择后的执行章。`currentFateCoda(state)` 只由既有 `fateCoda.choices` 派生 `{ choice, title, body }` 的 `result`，不写入 state；前端落定卡显示 `result`，翻到第三页后仍只把 `echo` 接入长期回声。六段必须分别落实公开窄账、医药私契、五份具名签、旧契点物、劳动倒查和缺角分存，不能新增死亡分支、重新处分原交易或提高 SAVE_VERSION。
- `FATE_CODA.choiceCombinations` 严格以第一页三个 option id 为第一层、第二页三个 option id 为第二层，覆盖九个 `{ title, text }` 且标题与正文全部唯一。第二页已有 choice 时，`currentFateCoda` 立即派生只读 `combination:{ title, text }`，落定卡在本页 `result` 后显示；没有第二次选择时必须为 null。第三页 `choices` 卷仍先列两个被选 option 的短 `echo`，再派生一条 `label: 两页合看` 的组合项。两处只读取既有 `fateCoda.choices`，不写入 state。九条必须区分可查经手与物权、私契与工资证词、本人签名与多数表决、分存核验与阅览权限，不得改变 fixed fate、原交易、effects、history schema 或 SAVE_VERSION。
- `FATE_CODA.finalSections` 固定提供 `relationship`／`heroines`／`jiaoer`／`choices`／`institution`／`accountability` 六组卷名。第三页 `currentFateCoda` 返回原著固定散局 `lead` 与只读 `finalSections[]`；每卷含 `id`、`kicker`、`title` 和 `{ label, title, text }[]`，无内容的可选卷省略。旧 `body` 继续按相同次序包含全部文本以维持引擎调用合同，前端只显示一次 `lead`，再逐卷渲染，不能把合成长段重复显示。分卷完全从 ending、两次 choice 与既有 history 派生，不新增持久状态或提高 SAVE_VERSION。
- `FATE_CODA.heroineEchoes` 必须严格覆盖五名女主 × `balanced`／`alliance`／`exclusive`／`outside`／`personal` 五种关系位置，二十五段全部唯一且每段保留本人 fixed fate。`fateHeroineMemories(state)` 复用结局笺的位置判定，只从已重建的 ending、真实 alliance／exclusive heroine 与关系值生成 `{ heroine, name, variant, title, text, routeReckonings, routeReckoning }`；若 `routeReckoningMemories` 非空，`text` 必须先完整保留 fixed fate，再按历史顺序追加全部原日、落定日、原物、裁决方式、见证人与准确结果，并明确责任档案不改死生。单数 `routeReckoning` 只兼容返回末项。`currentFateCoda` 仅在第三页追加并暴露只读副本。不得写入 state、改变结局判定或暗示关系分支／旧话裁决造成或撤销守寡、死亡、改嫁与被拐卖。
- `DAY19_JIAOER_ECHOES` 的六个第 18 日 aftermath 对象各自提供唯一 `fateText`，并明确保留第 80 回卷财归院。`jiaoerFateMemory(state)` 复用 `day19JiaoerMemory` 与 `jiaoerLedger` 的合法 history 检查，返回最终 choice、aftermath、标签、物件、文本及只读账目摘要；`currentFateCoda` 只在第三页追加并暴露。不得新增 state 字段、改动娇儿交易结算或用命数重开已结旧款、扩大契约期限、洗白卷财或否定此前证言。
- 不命中已知 AI 模板腔；不复制内网或原著正文。
- 主观吸引力不由自动化下结论。

## 运行

在 build/app 目录执行：

python3 -m http.server 5173 --bind 127.0.0.1

打开 http://127.0.0.1:5173/?seed=42。

## 发布前外部验证

重型账本测试、浏览器驱动与逐屏截图不得随 example 交付。发布前把 `build/app` 映射到仓库外临时工作区，由外部验证器完成：

1. 数据／引擎确定性合同与二十日可达性；
2. 正常速度、全键盘的二十日五人路径；
3. 第 1–19 日不提前结束，第 20 日完成五院共线并换 seed 重开；
4. 390×844、768×1024、1024×768、1280×800、1920×1080 五个视口；
5. 年龄门分层加载、素材解码、modal 焦点与 console／page／network／HTTP 零错误。

外部验证通过后，只把 `qa/verification.json` 与 `qa/evidence/run.json` 的压缩结果回写 example；原始 harness、输入全集和截图留在临时目录。仓库级门禁仍执行：

```bash
python3 scripts/validate_repo.py
python3 -m unittest discover -s tests -v
```

## 限制

测试运行时为本地 Chromium 五个响应式视口；其他浏览器和主观文案吸引力不在确定性证明范围。
