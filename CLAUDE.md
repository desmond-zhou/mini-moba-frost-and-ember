# 霜烬之争 — 接手说明

单文件修仙迷你 MOBA。three.js + Yuka + 全程序化生成（没有任何图片、模型、音频文件）。当前 **v1.2.0-alpha.3**。

先读这份，再读 `docs/进度.md`（现状、下一步、踩过的坑）。其余文档按需：`docs/三路策划.md`、`docs/库选型.md`、`docs/打位演算.md`、`README.md`。

## 在哪

| | |
|---|---|
| 本地 | `/Users/desmondzhou/Claude Code/Mini-Server/mini-moba` |
| 仓库 | 私有，`github.com/desmond-zhou/frostember`，主干 `main`，每个可玩版本一个标签 |
| 线上 | https://claude.ai/artifact/GzCkDyMnCr18U1iCeTCpiC （"任何有链接的人可见"，发布即生效） |
| 小说设定 | 《天衍》正史设定：https://claude.ai/artifact/NAtLbe59n8C8Et26Lqj9Vy （Claude Docs，project id `ab713e6f-35c7-4aea-aa3f-cb2d0b065ae0`） |

## 作者定下的规矩

- 用中文回复。作者很忙：自己测、自己查、自己拿主意，不要事事问；拿了主意要说清楚替他定了什么。
- **定期发布**：做完一块就打包、测、发布到上面那个链接、提交并推送。
- **一路的共用数值不动**（`HEROES` 里的基础数值和招式）。一路的电脑自 v1.2.0-alpha.3 起也按角色定位打团（作者要求），因此一路有了自己的修正表 `MODES.single.heroTune`；要调一路平衡只动这张表。改共用代码后必须跑一路回归。
- **三路的数值单独调**，但**招式机制两个模式共用，不改**。
- 适合用库的地方用库；文件大小不是硬约束，流畅才是。
- 文案用修仙用语（见下表），人物和世界观取材自《天衍》。作者提过另一套"有寂静帝的"设定，一直没找到，等他提供。
- 不要把每个决定同步到记忆、日历或别的助理，除非他要求。
- 提交信息末尾加 `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`。提交用的是 GitHub 免打扰邮箱，不要写入作者的真实邮箱。
- 标题界面有作者署名和微信号，是他要求加的，别删。

## 每次改完的流程

```bash
npm run dev                       # http://localhost:5179 ，ES modules 不打包，改完刷新
# 改代码……
node test.mjs "auto=mage&bot=1&dyn=0&mode=tri" shot.png 200 1440 810     # 冒烟 + 截图；mode=single 测一路
for i in 0 1 2; do node batch.mjs 30 $((i*6)) 1500 mirror single > runs/x_s$i.jsonl & done; wait
for i in 0 1 2; do node batch.mjs 12 $((i*6)) 2700 mirror tri    > runs/x_t$i.jsonl & done; wait
node analyze.mjs runs/x_s?.jsonl  # 一路应为：平均 15–16 分钟，一边倒 8%–15%，无报错
node analyze.mjs runs/x_t?.jsonl  # 三路应为：平均 17–20 分钟，十八人胜率 40%–62%，无报错
node build.mjs                    # dist/frostember.html（双击即玩）和 dist/artifact.html（发布用）
BASE="file://$PWD/dist/frostember.html" node test.mjs "auto=mage&bot=1&dyn=0&mode=tri" shot.png 200   # 测打包产物
# 发布：用 Artifact 工具，file_path = dist/artifact.html，url = 上面的线上链接
# 版本号三处一起改：index.html 的 .ver、package.json、README.md；然后 commit、tag、push
```

- 测试脚本需要本机的 Google Chrome。无头浏览器里动画帧被限速，用 `__moba.sim(秒)` 推进；慢动作、镜头推近这类效果测不到。
- 一局对局模拟只要几秒，平衡问题一律用批量对打说话。每格样本少于 30 局时，差 10 个百分点以内都当噪声。
- 运行名不要只靠大小写区分（文件系统不分大小写）。`rm` 带通配符会被拦，测试产物已在 `.gitignore` 里，不用清。
- 调试句柄：`window.__moba = { G, R, fx, start(hero, diff, mode, seat), input, audio, sim(sec) }`。
- 网址参数：`mode=single|tri`、`auto=<修士id>`、`seat=0..4`、`bot=1`、`diff=easy|normal|hard|mirror`、`dyn=0`、`q=low|medium|high`、`touch=1`。

## 代码地图

| 文件 | 内容 |
|---|---|
| `src/config.js` | 一切数据：`MODES`（两个模式的地图、车道、河、营地、草丛、山脊、`tune`、`heroTune`）、`HEROES`（18 人）、`SEATS` / `SEAT_FIT` / `SEAT_BIAS`、`ITEMS`、`RANK`、`REALM`、共用调参表 `T`、`setMode()` |
| `src/game.js` | 规则：单位、战斗、招式、被动、兵线、灵塔、邪祟、经济、草丛与迷雾、归宗、信号、寻路、电脑 |
| `src/world.js` | 地面着色器（按当前模式生成）、地形查询、树石草、草丛、宗门地界、山脊；`W.dispose()` 供换模式重建 |
| `src/render.js` `src/mat.js` | 后处理链与画质档位 / 共用材质 |
| `src/heroes.js` `src/models.js` | 人物外形（`OUTFIT`）与骨架 / 弟子、灵塔、阵眼 |
| `src/vfx.js` `src/fx.js` | 招式观感 / 粒子、贴花、血条、顿帧、慢动作 |
| `src/audio.js` | 全合成：配乐、分层音效、定位、环境声 |
| `src/icons.js` `src/portraits.js` `src/barks.js` | 图标 / 头像 / 台词 |
| `src/ui.js` `src/input.js` `src/main.js` | HUD 与各界面 / 键鼠触屏 / 启动、换模式、主循环 |
| `batch.mjs` `analyze.mjs` `seats.mjs` | 批量对打 / 汇总 / 位置演算 |

### 几个必须知道的抽象

- **模式**：`setMode(id)` 原地替换 `MAP`、`LANES`、`CAMPS`、`BRUSH`、`RIDGES`、`TOWERS`、`T`，所有模块拿到的引用不变；换模式后世界要重建（`main.js` 的 `start()` 里做了）。
- **车道**：一条从霜方阵眼到烬方阵眼的路径，用沿途距离 `s` 度量，霜方朝 `s` 增大的方向走。接口 `L.at(s, 侧移)`、`L.proj(x, z)`、`L.dist`、`L.tan`、`L.s0 / L.s1`。一路是公式车道（`s` 就是 `x`，数值和老版本逐位相同），三路是折线路径。**写电脑逻辑用 `s`，不要用世界坐标的 x。**
- **着色器是字符串模板**：地面、风化、树叶的 GLSL 按当前模式生成。写死的地图尺寸一律换成 `MAP` / `POS` / `biomeGLSL()`，材质缓存键要带 `MODE.id`。
- **可见性**：`e.hid` 表示"对方看不见我"。草丛和迷雾都只改这一个标记，所有选目标的地方都认它。
- **打团按定位**（两个模式都有）：`role = SEAT_FIT[id][0]`。镇关在同门到齐时先上；中军、养剑挑残血的打，被近战贴身且掉血后边打边退，不站到己方近战前面；护法在三路跟着养剑位；巡山挑脆皮和残血，混战里等别人先手（最多等两秒）。代码在 `botThink` 的「the fight itself」。
- **电脑**：`botThink` 里先是必须做的（撤退、信号、集结 / 回防、围剿目标、回去买东西），再是可选的。三路的可选项由 Yuka `Think` 仲裁（`makeBrain`），一路仍是定时触发的老逻辑。
- **新增修士要动的地方**：`HEROES`、`HERO_ORDER`、`SEAT_FIT`（config）；`OUTFIT`（heroes.js）；`SPEC`（portraits.js）；`BARKS`；被动若有新机制在 `game.js` 的 `strike` / `damage` / `kill` / `recalc` 里按 id 加；`batch.mjs` 和 `seats.mjs` 里的名单。招式尽量复用现有的 `kind`、`vfx`、`icon`。

## 用语表

| 通用 | 游戏里 |
|---|---|
| 英雄 / 小兵 / 野怪 | 修士 / 弟子 / 邪祟 |
| 生命 / 法力 / 经验 / 技能点 | 气血 / 灵力 / 修为 / 感悟 |
| 技能 / 冷却 / 眩晕 / 护盾 | 招式 / 调息 / 定身 / 罡气 |
| 暴击 / 移速 | 会心 / 身法 |
| 击杀 / 死亡 / 助攻 | 镇压 / 陨落 / 合力 |
| 回城 / 商店 / 金币 / 复活 / 泉水 | 归宗 / 万宝阁 / 灵石 / 重聚 / 护山大阵 |
| 防御塔 / 主水晶 | 灵塔 / 阵眼 |
| 等级 1–12 | 筑基、金丹、元婴各分初期、中期、后期、巅峰，后面带数字 |
| 上单 / 中单 / 射手 / 辅助 / 打野 | 镇关 / 中军 / 养剑 / 护法 / 巡山 |
| 首杀 / 双杀 / 三杀 / 团灭 / 终结 | 开锋 / 一气双镇 / 三花聚顶 / 满门尽陨 / 斩道 |
| 连杀 3–7 | 锋芒毕露、气贯长虹、道心通明、万法不侵、一人镇一宗 |

"减速、普攻、吸血、攻速、攻击力、术法强度"保留原词。

## 没做完的，和作者还没回话的

见 `docs/进度.md` 的"接下来"。最要紧的三件：

1. 作者对新音效、慢动作力度、红方宗门亮度、三路节奏的反馈一直没有。
2. 三路集结后的团战没有站位。
3. 手机真机没测过。
