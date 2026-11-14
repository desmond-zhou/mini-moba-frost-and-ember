// barks.js — what each cultivator says: when the ultimate goes off, on putting someone down, on falling, on breaking through.
export const BARKS = {
  warden: { ult: ['……镇。', '伏法。'], kill: ['……', '依律。'], die: ['……'], up: ['……嗯。'] },
  keeper: { ult: ['此门不开。', '五十年了，没人过得去。'], kill: ['擅闯者，留下。', '回去吧。'], die: ['门……还没关……'], up: ['还能再守五十年。'] },
  bloodlord: { ult: ['入我血海！', '都来，都来！'], kill: ['好血。', '再来一个。'], die: ['本座……还会回来。'], up: ['血，还不够。'] },
  berserker: { ult: ['吃老子一刀！', '北荒人不讲道理！'], kill: ['躺下的，别再起来。', '就这？'], die: ['他娘的……刀又崩了。'], up: ['嘿，身子骨又硬了点。'] },
  shade: { ult: ['借你魂魄一用。', '别回头。'], kill: ['下一个。', '红衣又深一分。'], die: ['这身红衣……够红了。'], up: ['没人看见。'] },
  archer: { ult: ['焚天。', '这把火，守了三百年。'], kill: ['火岛，没人能过。', '退。'], die: ['火……别灭。'], up: ['火更旺了。'] },
  ranger: { ult: ['万剑，听雪。', '雪落无声。'], kill: ['剑下不留名。', '承让。'], die: ['雪……停了。'], up: ['剑心又明一分。'] },
  gunner: { ult: ['符，管够！', '一叠全给你！'], kill: ['一发入魂。', '省了张符。'], die: ['符……用完了。'], up: ['该换张更大的弩了。'] },
  mage: { ult: ['星落，此局已定。', '命盘如此。'], kill: ['算到你了。', '卦象不虚。'], die: ['这一卦……没算到。'], up: ['又推演出一层。'] },
  cryo: { ult: ['雪原，封天。', '静。'], kill: ['冻着吧。', '寒意入骨了？'], die: ['寒意……散了。'], up: ['心如止水。'] },
  storm: { ult: ['天刑，落！', '刑印在此！'], kill: ['依律，当诛。', '罪证确凿。'], die: ['天刑台……不会罢休。'], up: ['雷意更纯了。'] },
  healer: { ult: ['扫了三十年地，也该动动了。', '都站近些。'], kill: ['哎，手滑了。', '老头子不是故意的。'], die: ['老了，老了……'], up: ['咦，怎么又突破了。'] },
  yanzhao: { ult: ['都别看。', '天黑了。'], kill: ['你没看见我。', '睡吧。'], die: ['好黑……这次是真的。'], up: ['看不见的，又多了些。'] },
  yuanshan: { ult: ['这一卦，大凶，是你们的。', '逆运。'], kill: ['命该如此。', '老头子替后辈清条路。'], die: ['门……会有人来开的……'], up: ['上卷，又翻过一页。'] },
  qingya: { ult: ['清，正。', '一剑。'], kill: ['问心无愧。', '承让。'], die: ['清白……已经还了。'], up: ['剑还是直的。'] },
  wenren: { ult: ['都烧起来！', '师父，你看！'], kill: ['判了。', '下一个，下一个！'], die: ['真气……收不住了……'], up: ['再快一点，再快一点。'] },
  linshuang: { ult: ['冰岛三百年的雪，都给你。', '冻住。'], kill: ['别动了。', '冷吗？'], die: ['沈焰……火别灭。'], up: ['雪更静了。'] },
  peiji: { ult: ['天刑台在此。', '跪下。'], kill: ['依律处置。', '带走。'], die: ['律……不可废……'], up: ['规矩，还得再立。'] },

};

// Team talk. Each cultivator has a manner of speaking; a line is looked up by event under that manner and falls back to `base`.
// {t} is a name (the one put down, the one to go for), {i} an insight, {w} why it was chosen.
export const TONE = { warden: 'silent', keeper: 'elder', peiji: 'stern', bloodlord: 'blood', berserker: 'rough', qingya: 'upright', shade: 'shadow', wenren: 'mad', archer: 'fiery', linshuang: 'cold', ranger: 'cool',
  gunner: 'proud', mage: 'scholar', cryo: 'cold', storm: 'stern', healer: 'elder', yanzhao: 'gentle', yuanshan: 'elder' };
export const VOICE = {
  base: { retreat: ['顶不住了，我先撤', '残了，撤一下', '先退，别跟'], rest: ['我回去歇口气', '回去养一下，马上来'], kill: ['{t}倒了', '拿下一个', '漂亮，继续压'], die: ['我没了，别硬打', '大意了', '等我重聚'],
    towerUp: ['塔掉了，继续压', '好，再推一座'], towerDown: ['塔丢了，稳一点', '别急，慢慢打回来'], obj: ['拿到了，趁现在推', '有加成了，一起上'], ackGather: ['收到，这就来', '来了', '马上到'], ackAttack: ['收到，打', '上', '跟你打'], ackRetreat: ['撤', '好，退'],
    far: ['太远了，过不去', '我这边走不开'], hurt: ['残血，去不了', '我血不够，你们先'], deadAck: ['我还没重聚，等我'], start: ['稳着打，别送', '这把好好打'], rally: ['来了！', '跟上，开打', '听你的'],
    ins: ['{w}，悟「{i}」', '「{i}」，成了——{w}'], focus: ['此子不可留！', '全宗门听令，镇杀{t}！', '先杀{t}，其余不论！', '{t}不死，此战难安。'], eStart: ['请吧。', '今日便分个高下。'] },
  silent: { retreat: ['……撤。', '……'], rest: ['……（转身回山）'], kill: ['……', '依律。'], die: ['……'], towerUp: ['……（点头）'], towerDown: ['……'], ackGather: ['……（点头）', '嗯。'], ackAttack: ['……（提尺）', '嗯。'], ackRetreat: ['……（退）'], far: ['……（摇头）'], hurt: ['……（摇头）'], start: ['……'], rally: ['……（跟上）', '嗯。'], ins: ['……「{i}」。'], focus: ['……{t}。伏法。'], eStart: ['……'] },
  stern: { retreat: ['暂退，此案未结', '退。回头再判'], kill: ['{t}，伏法', '判毕', '依律，下一个'], die: ['……此案，由后来人续'], towerUp: ['此处已清，继续', '拆得合规'], towerDown: ['失一处。记下了'], ackGather: ['准', '即到'], ackAttack: ['准，行刑', '动手'], ackRetreat: ['准，退'], far: ['鞭长莫及'], hurt: ['带伤，不宜出庭'], start: ['各司其职', '依律行事'], rally: ['准。', '听令。'], ins: ['{w}——判「{i}」'], focus: ['{t}罪无可赦，全宗镇杀！', '此子不可留。先判{t}。'], eStart: ['尔等可知罪？'] },
  rough: { retreat: ['不行了不行了，先溜', '他娘的，撤'], rest: ['回去喘口气，别催'], kill: ['{t}躺了，哈', '就这？下一个', '砍翻一个'], die: ['他娘的……大意了', '刀又崩了，等我'], towerUp: ['塔没了，接着砍', '痛快！'], towerDown: ['塔丢了？丢了再抢'], ackGather: ['来了来了', '等着'], ackAttack: ['砍他！', '早该上了'], ackRetreat: ['行，溜', '走走走'], far: ['太远，腿跑断了也到不了'], hurt: ['再上就真躺了'], start: ['少废话，开打', '北荒人不讲道理'], rally: ['早该这样！', '走，砍人'], ins: ['{w}，老子悟了个「{i}」'], focus: ['先剁了{t}！', '{t}那小子不能留，一块上！'], eStart: ['来，让老铁看看你们几斤几两。'] },
  cold: { retreat: ['退', '不值得，走'], kill: ['{t}，别动了', '一个', '冷吗'], die: ['……雪停了', '替我守着'], towerUp: ['塔倒了。下一座', '继续'], towerDown: ['丢了。别乱'], ackGather: ['来', '在路上'], ackAttack: ['开弓', '好'], ackRetreat: ['退'], far: ['够不着'], hurt: ['伤重，不去'], start: ['别急，慢慢来', '看准了再出手'], rally: ['来', '好'], ins: ['{w}。「{i}」'], focus: ['{t}，不可留', '都看着{t}。先冻住，再杀'], eStart: ['你们会冷的。'] },
  cool: { retreat: ['我先退一步', '伤了，回头再来'], kill: ['{t}，承让', '剑下一个', '雪落无声'], die: ['……剑还在', '替我看着师父的剑'], towerUp: ['塔落了，往前', '好'], towerDown: ['塔失了，稳住'], ackGather: ['这就到', '来了'], ackAttack: ['出剑', '好'], ackRetreat: ['退'], far: ['太远，剑气到不了'], hurt: ['带伤，去不得'], start: ['各自小心', '剑不轻出'], rally: ['来了', '随你出剑'], ins: ['{w}，悟「{i}」'], focus: ['{t}不可留，诸位随我出剑', '先斩{t}'], eStart: ['请赐教。'] },
  fiery: { retreat: ['火小了，先退', '回去添把柴'], kill: ['{t}，烧尽了', '火岛，没人能过', '下一个'], die: ['火……别灭', '替我看着火'], towerUp: ['烧塌了，接着烧', '好，火正旺'], towerDown: ['塔没了，火还在'], ackGather: ['这就来', '火跟着你'], ackAttack: ['烧！', '点了他'], ackRetreat: ['退，留着火种'], far: ['太远，火烧不过去'], hurt: ['火快灭了，去不了'], start: ['火已经点上了', '三百年都守了，不差这一仗'], rally: ['火往你那边烧', '来！'], ins: ['{w}——心火悟出「{i}」'], focus: ['{t}这把火，今天必须掐灭！', '全宗门，烧了{t}！'], eStart: ['过得了我这把火，再说别的。'] },
  elder: { retreat: ['老骨头顶不住了，先退', '慢着慢着，我回去缓缓'], rest: ['回去喝口茶，就来'], kill: ['{t}啊，回去再练练', '唉，何必呢', '倒下一个'], die: ['老了老了……你们小心', '不碍事，我歇一会儿'], towerUp: ['塔倒了，慢慢来，不急', '好，年轻人接着推'], towerDown: ['丢了一座，莫慌'], ackGather: ['来了来了，别催老人家', '这就到'], ackAttack: ['好，听你的', '那就动手吧'], ackRetreat: ['走，慢点走也是走'], far: ['太远喽，腿脚赶不上'], hurt: ['这把老骨头再去就散了'], start: ['都小心着点', '年轻人，别冲太快'], rally: ['好好好，跟着你', '老头子给你压阵'], ins: ['{w}，老头子也悟了点东西：「{i}」'], focus: ['{t}这孩子留不得了，一起上吧', '莫让{t}再长下去'], eStart: ['后生们，点到为止。'] },
  scholar: { retreat: ['这一步算错了，先退', '容我回去重算'], kill: ['{t}，在推演之内', '果然如此', '落子'], die: ['……漏算了一步', '等我，这局还没完'], towerUp: ['塔在第七步倒，没差', '下一处我也算好了'], towerDown: ['失一塔，局面仍可算'], ackGather: ['算到了，这就来', '来了'], ackAttack: ['时机正好，动手', '可'], ackRetreat: ['退是对的'], far: ['算过了，赶不到'], hurt: ['伤势不允许，抱歉'], start: ['星位已定，开局', '我算过了，能赢'], rally: ['正合我意', '来了'], ins: ['{w}，推演得「{i}」'], focus: ['{t}是此局变数，必须先除', '此子不可留——我算过了'], eStart: ['这一局，我算过了。'] },
  proud: { retreat: ['哼，暂且放他们一马', '符用完了，回去拿'], kill: ['{t}，一发入魂', '省了张符', '不堪一击'], die: ['……符，没带够', '岂有此理'], towerUp: ['塔？一叠符的事', '下一座'], towerDown: ['谁守的塔？'], ackGather: ['等着，本峰主这就到', '来了'], ackAttack: ['早该打了', '看我的'], ackRetreat: ['退就退，急什么'], far: ['太远，自己想办法'], hurt: ['带伤上阵，有失身份'], start: ['都跟紧了', '天元宗的人，不打没把握的仗'], rally: ['这才像话', '跟上'], ins: ['{w}——本峰主悟得「{i}」'], focus: ['{t}也配逞威风？给我轰了他！', '全宗门，先灭{t}！'], eStart: ['天元宗在此，尔等退是不退？'] },
  gentle: { retreat: ['我先退一下，抱歉', '伤了，回去缓缓'], kill: ['{t}……得罪了', '倒下一位', '对不住'], die: ['抱歉……没能撑住', '你们当心'], towerUp: ['塔落了，大家小心往前', '好'], towerDown: ['塔丢了，别慌，我在'], ackGather: ['好，这就来', '来了'], ackAttack: ['好，我替你们遮着', '嗯'], ackRetreat: ['退吧，我殿后'], far: ['太远了，赶不到，抱歉'], hurt: ['我伤着，去了反添乱'], start: ['大家当心', '我会看着你们的'], rally: ['来了，我替你遮着', '好'], ins: ['{w}，我悟了「{i}」'], focus: ['{t}不能再留了……大家一起', '请先拦下{t}'], eStart: ['得罪了。'] },
  blood: { retreat: ['这道菜烫嘴，先放放', '回去换副碗筷'], kill: ['{t}，好血', '再来一个', '开胃而已'], die: ['本座……还会回来', '席还没散'], towerUp: ['拆了，下一桌', '好，上菜'], towerDown: ['掀我桌子？有意思'], ackGather: ['来了，别动筷子', '这就到'], ackAttack: ['开席！', '好，上'], ackRetreat: ['撤席'], far: ['太远，这口吃不上'], hurt: ['血不够，先不去'], start: ['开席了', '今日见血方休'], rally: ['开席！', '本座亲自来'], ins: ['{w}——本座悟得「{i}」'], focus: ['{t}的血，本座要定了。都上！', '此子不可留，全宗分食！'], eStart: ['都来，都来。'] },
  shadow: { retreat: ['走了', '不恋战'], kill: ['{t}，没了', '下一个', '红衣又深一分'], die: ['……被看见了', '失手'], towerUp: ['塔没了', '走，下一处'], towerDown: ['丢了'], ackGather: ['在路上', '嗯'], ackAttack: ['我绕后', '动手'], ackRetreat: ['散'], far: ['远'], hurt: ['伤了，不露面'], start: ['别找我，我会找你们', '各走各的'], rally: ['我在暗处跟着', '嗯'], ins: ['{w}。「{i}」'], focus: ['{t}，我来取', '此子不可留。别让他看见我'], eStart: ['别回头。'] },
  mad: { retreat: ['气血乱了……退', '哈……先走'], kill: ['{t}，哈哈哈', '还有谁', '不够，不够'], die: ['……师父……', '哈，真疼'], towerUp: ['塌了，塌了好', '再拆'], towerDown: ['拆吧，都拆了才干净'], ackGather: ['来，来', '我闻着味儿了'], ackAttack: ['杀！', '早就等不及了'], ackRetreat: ['……行'], far: ['远，懒得去'], hurt: ['再走火就回不来了'], start: ['谁先死？', '别挡着我'], rally: ['哈，来了', '杀谁？'], ins: ['{w}……走火走出个「{i}」'], focus: ['{t}！我要{t}！', '此子不可留，哈哈，不可留！'], eStart: ['谁先来？'] },
  upright: { retreat: ['暂避锋芒', '留得青山在'], kill: ['{t}，承让', '得罪', '一剑而已'], die: ['……技不如人', '无妨，清者自清'], towerUp: ['塔已破，乘势而上', '好'], towerDown: ['失一塔，勿乱阵脚'], ackGather: ['即刻便到', '来了'], ackAttack: ['出剑', '义不容辞'], ackRetreat: ['当退则退'], far: ['路远，恕难赶到'], hurt: ['有伤在身，去亦无益'], start: ['行正道，出正剑', '诸位小心'], rally: ['义不容辞', '随你'], ins: ['{w}，悟得「{i}」'], focus: ['{t}锋芒太盛，当先除之', '此子不可留——诸位，合力'], eStart: ['各为其主，请。'] },
};
export const voice = (id, key, vars = {}) => { const L = (VOICE[TONE[id]] || {})[key] || VOICE.base[key]; if (!L) return null; return L[Math.floor(Math.random() * L.length)].replace(/\{(\w)\}/g, (m, k) => vars[k] ?? ''); };
