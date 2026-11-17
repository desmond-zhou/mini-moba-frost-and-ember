# 霜烬之争 — 接手说明

单文件修仙迷你 MOBA。three.js + Yuka + 全程序化生成（没有任何图片、模型、音频文件）。当前 **v3.0.0-alpha.2**（V3：联机对战，单机照旧）。V2 单机最终版存档在标签 `v2-single-final` / 分支 `v2-single`。

先读这份，再读 `docs/进度.md`（现状、下一步、踩过的坑）。其余文档按需：`docs/联机与发行笔记.md`（帧同步的理由、房主自己开服、版号、ICP）、`docs/三路策划.md`、`docs/库选型.md`、`docs/打位演算.md`、`README.md`。

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
- **招式和基础数值两个模式共用**（`HEROES`）。作者在 2026-11-14 要求去掉雷同招式，为此重做了十三个人的部分招式（见 `docs/进度.md` 的"招式去雷同"）；以后再改招式要作者开口，改完两个模式都要重跑平衡。新招式不要和同定位的人撞型。
- **平衡只动两张单人修正表**：`MODES.single.heroTune` 和 `MODES.tri.heroTune`（乘在气血 `hp`、攻击 `ad`、术法 `ap`、招式威力 `pow` 上）。作者的要求（2026-11-14）：**同一个人两个模式的倍率不能差太多**。现行口径：每个倍率在 0.90–1.15 之间，同一项两个模式相差不超过 0.08。用 `tune.mjs` 算，不要手拍。改共用代码后两个模式都要跑回归。
- 适合用库的地方用库；文件大小不是硬约束，流畅才是。
- 文案用修仙用语（见下表），人物和世界观取材自《天衍》。作者提过另一套"有寂静帝的"设定，一直没找到，等他提供。
- 不要把每个决定同步到记忆、日历或别的助理，除非他要求。
- 提交信息末尾加 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`（以当前对话系统提示给的署名为准）。提交用的是 GitHub 免打扰邮箱，不要写入作者的真实邮箱。
- 标题界面有作者署名和微信号，是他要求加的，别删。

## 每次改完的流程

```bash
npm run dev                       # http://localhost:5179 ，ES modules 不打包，改完刷新
# 改代码……
node test.mjs "auto=mage&bot=1&dyn=0&mode=tri" shot.png 200 1440 810     # 冒烟 + 截图；mode=single 测一路
for i in 0 1 2; do node batch.mjs 30 $((i*6)) 1500 mirror single > runs/x_s$i.jsonl & done; wait
for i in 0 1 2; do node batch.mjs 12 $((i*6)) 2700 mirror tri    > runs/x_t$i.jsonl & done; wait
node analyze.mjs runs/x_s?.jsonl  # 一路应为：平均 14–15 分钟，一边倒 15%–18%，无报错
node analyze.mjs runs/x_t?.jsonl  # 三路应为：平均 19–20 分钟，无报错
node mech.mjs                     # 逐个验证新机制（折返、拽自己、群体拘拿、隐身、易伤区……）是否生效
node pace.mjs tri 3 24            # 节奏：每分钟的平均等级。三路约 3 分钟到 4 级、16 分钟满级；一路约 2 分半到 4 级
# 调平衡（要大样本，见下）：node tune.mjs "runs/a_s*.jsonl,runs/b_s*.jsonl" "runs/a_t*.jsonl" [--write]
node build.mjs                    # dist/frostember.html（双击即玩）和 dist/artifact.html（发布用）
BASE="file://$PWD/dist/frostember.html" node test.mjs "auto=mage&bot=1&dyn=0&mode=tri" shot.png 200   # 测打包产物
# 发布：用 Artifact 工具，file_path = dist/artifact.html，url = 上面的线上链接
# 版本号三处一起改：index.html 的 .ver、package.json、README.md；然后 commit、tag、push
```

- 测试脚本需要本机的 Google Chrome。无头浏览器里动画帧被限速，用 `__moba.sim(秒)` 推进；慢动作、镜头推近这类效果测不到。
- 一局对局模拟只要几秒，平衡问题一律用批量对打说话。**每人少于 250 局的胜率不要信**：同一套数值、每人 70 局左右的四批里，孙伯分别是 29%、29%、50%、40%。一路 432 局（8 进程 × 54）约 2 分钟，三路 204 局（6 进程 × 34）约 4.5 分钟，每人各得 130 / 100 局，要合并两三批再下结论。
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
| `src/audio.js` `src/sfx.js` `src/skillsound.js` | 混音、定位、播放 / 用 Tone.js 设计和渲染全部音色 / 每招的声音和每人的签名声 |
| `src/icons.js` `src/portraits.js` `src/barks.js` | 图标 / 头像 / 台词 |
| `src/ui.js` `src/input.js` `src/main.js` | HUD 与各界面 / 键鼠触屏 / 启动、换模式、主循环 |
| `batch.mjs` `analyze.mjs` `seats.mjs` `tune.mjs` | 批量对打 / 汇总 / 位置演算 / 按胜率算两张单人修正表（噪声内不动、守住两个模式的差距上限） |
| `app.mjs` `frameprof.mjs` | 打成本地 Mac 应用（Chrome 应用模式）/ 整帧 CPU 剖析和每帧绘制调用数 |
| `builds.mjs` | 出装演算汇总：每人每种第一件法宝的胜率（配合 `HERO=` `BUILD=` 环境变量跑 batch） |
| `mech.mjs` `pace.mjs` `prof.mjs` `gapcheck.mjs` | 单招机制的定点检查 / 各模式的升级节奏 / 模拟耗时分布 / 两张修正表是否守规矩（改表后必跑） |

### 几个必须知道的抽象

- **模式**：`setMode(id)` 原地替换 `MAP`、`LANES`、`CAMPS`、`BRUSH`、`RIDGES`、`TOWERS`、`T`，所有模块拿到的引用不变；换模式后世界要重建（`main.js` 的 `start()` 里做了）。
- **车道**：一条从霜方阵眼到烬方阵眼的路径，用沿途距离 `s` 度量，霜方朝 `s` 增大的方向走。接口 `L.at(s, 侧移)`、`L.proj(x, z)`、`L.dist`、`L.tan`、`L.s0 / L.s1`。一路是公式车道（`s` 就是 `x`，数值和老版本逐位相同），三路是折线路径。**写电脑逻辑用 `s`，不要用世界坐标的 x。**
- **着色器是字符串模板**：地面、风化、树叶的 GLSL 按当前模式生成。写死的地图尺寸一律换成 `MAP` / `POS` / `biomeGLSL()`，材质缓存键要带 `MODE.id`。
- **可见性**：`e.hid` 表示"对方看不见我"。草丛和迷雾都只改这一个标记，所有选目标的地方都认它。
- **打团按定位**（两个模式都有）：`role = SEAT_FIT[id][0]`。镇关在同门到齐时先上；中军、养剑挑残血的打，被近战贴身且掉血后边打边退，不站到己方近战前面；护法在三路跟着养剑位；巡山挑脆皮和残血，混战里等别人先手（最多等两秒）。代码在 `botThink` 的「the fight itself」。
- **电脑**：`botThink` 里先是必须做的（撤退、信号、集结 / 回防、围剿目标、回去买东西），再是可选的。三路的可选项由 Yuka `Think` 仲裁（`makeBrain`），一路仍是定时触发的老逻辑。
- **一路也有的三路功能**（v1.2.0-alpha.4）：第二个目标镇渊傀、11 分钟后的渊主残念、宗门石栏和山门柱是实体并走寻路图（`MODE.solid`）、"某某不见了" 和 "对面人多" 的喊话。迷雾、位置、打野位、分路集结仍只在三路。**一路没有归宗**（`noRecall`，作者要求）：只有出山前和陨落时能买东西。
- **招式是 `kind` 加参数**，区分度主要靠参数：`proj` 有 `pierce`（贯穿）、`splash`、`pull: true`（拽人）/ `'self'`（拽自己过去）、`back`（飞到头折返）、`exec`（斩杀加成）、`heroOnly`（穿过弟子只打修士）、`big`；`haste` 有 `rng` / `adK`（架势：加射程和攻击）、`dr`、`aoe`（分给附近同门）、`veil`（隐身，靠 `e.veilT` 和 `e.hid`）、`b`（附带回复）；`nova` 有 `pull`（把周围的人拘到身前）、`hpR`（给自己罡气）；`strike` 有 `exec` / `stun`；`dash` 有 `exec` / `reset`；`zone` 有 `vuln`（易伤）。电脑怎么用每种招式在 `botThink` 末尾的 `switch (s.kind)`。
- **新增修士要动的地方**：`HEROES`、`HERO_ORDER`、`SEAT_FIT`（config）；`OUTFIT`（heroes.js）；`SPEC`（portraits.js）；`BARKS`；被动若有新机制在 `game.js` 的 `strike` / `damage` / `kill` / `recalc` 里按 id 加；`batch.mjs` 和 `seats.mjs` 里的名单。招式尽量复用现有的 `kind`、`vfx`、`icon`。

## 联机（V3）

做法是**帧同步**（王者荣耀那种）：每台机器都跑整局，服务器只转发操作。研究文档推荐的是服务器权威，V3 改用帧同步的理由：画面、声音、界面一行不用重写，单机和联机走同一套代码，服务器只是个很小的转发器；代价是要保证每台机器算出完全相同的结果，以及迷雾对改客户端的人不设防（朋友之间玩够用，公开运营再换服务器权威）。研究文档：https://claude.ai/artifact/AuhGvDd3REp4KSwtDo7nwh

- **服务器** `server/server.mjs`（Node + `ws`，端口 8790）：发页面（`dist/frostember.html`）、开房、选人、开战时补电脑、发种子和阵容，然后每 50 毫秒发一个 "turn"（这段时间所有人的操作）。断线的人由电脑接管（`bot` 指令），回来时把整局的操作记录发给他，几秒追上。每 2 秒各机器报一次对局指纹（`G.hash()`），不一致写日志 `DESYNC`。
- **客户端** `src/net.js`：连服务器、按到达的节奏一回合一回合地走（每回合 3 步，每步 1/60 秒），手里留两回合防抖，落后了就加速追。房间界面就是标题界面（`ui.showRoom`），入口是「联机对战」按钮。
- **对局的步子** `G.step(dt)`（固定 1/60 秒）和**画面** `G.draw(dt, time, alpha)` 分开了；单机也一样，主循环按固定步长走、画面在两步之间插值。
- **玩家的一切操作都是指令** `{c: …}`（move / amove / atk / dir / stop / recall / sig / rally / cast / buy / learn / ins / bot），由 `G.exec(h, q)` 执行；单机当场执行，联机发给服务器、随回合回来再执行。单位用 id 传。
- `h.isPlayer` 现在的意思是「真人在操控」（联机时可能有好几个，托管时为 false）；「这台机器自己的人」是 `G.player`，判断用 `me(h)`。

**写 `G.step` 里会走到的代码时必须守的规矩**（否则各机器结果不同，对局会分叉）：
1. 决定事情的模块（game、config、util、world）用 `import { DMath as Math } from './dmath.js'`：sin / cos / atan2 / hypot 是用加减乘除重写的，`Math.random` 是这局的种子。不要用 `**`（各浏览器取整不同），用乘法或 `sq()`。
2. 只为了好看的随机（火花、台词挑哪句）用 `vis()`，不要用 `Math.random`。
3. 不要在会改对局的代码里读这台机器才有的东西：`G.player`、`me()`、`near()`、`G.focus`、`canSee(G.player, …)`、画质、`G.autoPlay` 以外的网址参数。这些只能用来决定"这台机器看见、听见什么"。
4. 改完跑 `node dettest.mjs tri 1500` 和 `node dettest.mjs single 1200`：两台视角、画质、相机都不同的机器，各跑一整局，每 30 秒的指纹必须一致。再跑 `node nettest.mjs tri 45 runs/net`（要先起服务器）：真走一遍房间、开战、断线重连。

```bash
node server/server.mjs                        # 本机服务器 :8790（开发时 http://localhost:5179 的页面会自动连它）
node dettest.mjs tri 1500                     # 确定性：两台视角不同的机器结果是否一致
node nettest.mjs tri 45 runs/net              # 两个无头玩家走一遍房间、对局、断线重连；TOEND=1 打到结束再回房间
node uishot.mjs <目录>                         # 标题和联机框在手机竖屏、横屏、电脑上的截图
```

**服务器不自动启动**（作者 2026-11-16 的要求）：`serverapp.mjs`（`npm run app` 会一起做）生成 `dist/霜烬之争服务器.app`，作者双击才启动，终端窗口显示地址和日志，关窗口即停。它自带打包好的服务器和一份游戏页面，任何装了 Node.js 的 Mac 都能跑。不要加 launchd 之类的常驻。作者的设备都在 Tailscale 里，服务器开着时用 `http://des-mac-mini:8790/` 打开即可联机。对公网开放（`tailscale funnel`）要作者同意。

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
