# 霜烬之争

单文件修仙迷你 MOBA。three.js + Yuka（电脑的寻路、决策仲裁和记忆）+ 全程序化生成：没有任何图片、模型或音频文件，贴图、人物、图标、头像、音乐、音效都是代码在加载时画出来、合成出来的。打包后是一个约 900 KB 的 HTML。

当前版本 **v1.2.0-alpha.14**。十八位修士，两个模式，开局选择：

- **一路 · 速战**：3v3，约 14 分钟。没有归宗，只在出山前和陨落时补货。两个目标（血海残魂、镇渊傀），11 分钟后出渊主残念。
- **三路 · 宗门大战**：王者式地图，5v5，战争迷雾，山脊与寻路，三个河道目标，约 20 分钟。电脑按位置分工：清野抓人、护送、游走、集结推进、回防、回应信号、队内喊话。

两个模式共用全部招式机制和基础数值；地图、一小张调参表和一张单人修正表各有一份（同一个人在两个模式里的倍率相差不超过 0.08）。

## 运行

```bash
npm install
npm run dev        # 开发：http://localhost:5179 （ES modules + importmap，不打包，改完刷新）
npm run build      # 发布：dist/frostember.html（双击即玩）和 dist/artifact.html（发布用片段）
```

## 测试

需要本机装有 Google Chrome（脚本用 puppeteer-core 驱动无头 Chrome），先 `npm run dev` 起服务。

| 命令 | 作用 |
|---|---|
| `node test.mjs "<query>" out.png <模拟秒数> [宽] [高] ["<js>"] [等待ms]` | 冒烟测试 + 截图，打印对局状态和报错。`BASE=file://…/dist/frostember.html` 可测打包产物 |
| `node batch.mjs <局数> <偏移> <最长秒数> [难度] [模式]` | 批量电脑对打，每局一行 JSON。默认难度 `mirror`（双方数值完全对称），一局约 2 秒 |
| `node analyze.mjs runs/*.jsonl` | 汇总：各修士胜率 / KDA / 每分钟伤害，一边倒与势均力敌的比例，对局时长 |
| `node batch.mjs <局数> <偏移> <秒> mirror tri <位置0-4>` 加 `node seats.mjs runs/seat*.jsonl` | 位置演算：把被跟踪的修士固定在某个位置，比较各人在各位置的表现 |
| `node tune.mjs "<一路结果>" "<三路结果>" [--write]` | 按各人胜率给两张单人修正表提出修改（逗号分隔可合并多批；噪声内不动；`--write` 写回 `src/config.js`）。每人至少 250 局再用 |
| `node mech.mjs` | 把目标定在原地，逐个放新招式，打印位置、气血、状态的变化，确认机制生效 |
| `node pace.mjs [模式] [局数] [分钟]` | 每分钟的平均等级和装备数，用来看升级节奏 |
| `node prof.mjs [模式] [秒]` | 模拟耗时分布（哪几个函数最花时间） |
| `node gapcheck.mjs` | 检查两张单人修正表：倍率在 0.90–1.15、同一项两个模式相差不超过 0.08 |
| `node audiotest.mjs` | 逐个播放所有音效，报告峰值和 RMS，用来对齐音量、抓报错 |
| `node perf.mjs "<query>"` | 渲染各环节的帧耗时 |

网址参数：`mode=single|tri` 选模式，`auto=<修士id>` 跳过选人，`bot=1` 让电脑代打自己，`diff=easy|normal|hard|mirror`，`dyn=0` 关闭动态分辨率，`q=low|medium|high`，`touch=1` 强制触屏布局。调试句柄 `window.__moba = { G, R, fx, start, input, audio, sim(秒) }`。

## 结构

| 文件 | 内容 |
|---|---|
| `src/config.js` | 两个模式的地图与调参表、十八位修士的数值与招式、位置表、法器、境界 |
| `src/game.js` | 规则：单位、战斗、招式、被动、兵线、灵塔、邪祟、经济、草丛与迷雾、归宗、信号、寻路（Yuka 图搜索）、电脑（Yuka 意愿仲裁与记忆） |
| `src/vfx.js` / `src/fx.js` | 招式的观感 / 粒子、贴花、光、血条、顿帧与慢动作 |
| `src/render.js` | 画质档位、后处理链（GTAO、体积雾、Bloom、调色与水墨描边）、动态分辨率 |
| `src/world.js` / `src/mat.js` | 地形、天空、树石草、草丛 / 共用材质与着色器片段 |
| `src/heroes.js` / `src/models.js` | 带骨架的人物 / 弟子、灵塔、阵眼 |
| `src/icons.js` / `src/portraits.js` | canvas 画的招式与法器图标 / 头像 |
| `src/audio.js` | Web Audio 合成：生成式配乐、分层音效、HRTF 定位、环境声 |
| `src/barks.js` | 人物台词 |
| `src/ui.js` / `src/input.js` / `src/main.js` | HUD、万宝阁、计分板、菜单 / 键鼠与触屏 / 启动与主循环 |

接手先读 `CLAUDE.md`（规矩、流程、代码地图、用语表）。文档：`docs/进度.md`（现状与下一步）、`docs/三路策划.md`、`docs/库选型.md`、`docs/打位演算.md`。

人物与世界观取材自作者的修仙小说设定。

## 版权

© 2026 Desmond Zhou 周易。版权所有，保留一切权利。微信：desmondzhou
