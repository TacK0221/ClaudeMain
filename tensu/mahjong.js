/* 麻雀 点数計算ドリル: 牌姿の生成と点数計算
 * 牌の番号: 0-8 萬子1-9 / 9-17 筒子1-9 / 18-26 索子1-9 / 27-30 東南西北 / 31-33 白發中
 * 赤5は 34(5萬) 35(5筒) 36(5索)。計算するときは norm() で普通の5に直す
 * ブラウザでは window.Mahjong、Node では module.exports で使う */
(function (global) {
'use strict';

// ルール（ここを書き換えると全体に反映される）
const RULES = {
  kuitan: true,          // 喰いタンあり
  aka: true,             // 赤ドラ（各色1枚ずつ）
  kiriage: true,         // 切り上げ満貫（4翻30符・3翻60符は満貫）
  kazoe: true,           // 数え役満（13翻以上）
  doubleWindPairFu: 4,   // 連風牌の雀頭（天鳳・雀魂と同じ4符。2符にするルールもある）
};

const RED = { 34: 4, 35: 13, 36: 22 };
const norm = t => (t >= 34 ? RED[t] : t);
const isRed = t => t >= 34;
const isHonor = t => t >= 27;
const isTerminal = t => t < 27 && (t % 9 === 0 || t % 9 === 8);
const isYaochu = t => isHonor(t) || isTerminal(t);
const isDragon = t => t >= 31;
const isWind = t => t >= 27 && t <= 30;
const suitOf = t => Math.floor(t / 9); // 3 = 字牌
const numOf = t => t % 9 + 1;
const GREEN = new Set([19, 20, 21, 23, 25, 32]); // 2348 6 索 + 發

const HONOR_NAMES = ['東', '南', '西', '北', '白', '發', '中'];
const SUIT_NAMES = ['萬', '筒', '索'];
const WAIT_NAMES = { ryanmen: '両面', kanchan: '嵌張', penchan: '辺張', tanki: '単騎', shanpon: 'シャンポン' };

function tileName(t) {
  const red = isRed(t);
  t = norm(t);
  if (isHonor(t)) return HONOR_NAMES[t - 27];
  return (red ? '赤' : '') + numOf(t) + SUIT_NAMES[suitOf(t)];
}

function doraFromIndicator(ind) {
  ind = norm(ind);
  if (ind < 27) return suitOf(ind) * 9 + (ind % 9 + 1) % 9;
  if (ind <= 30) return 27 + (ind - 27 + 1) % 4;
  return 31 + (ind - 31 + 1) % 3;
}

/* ---------------- 点数計算 ---------------- */

// 雀頭1つ＋面子（順子・刻子）への分け方をすべて列挙する
function decompose(counts) {
  const res = [];
  const c = counts.slice();
  const groups = [];
  function extract(i, pair) {
    while (i < 34 && c[i] === 0) i++;
    if (i === 34) { res.push({ pair, groups: groups.slice() }); return; }
    if (c[i] >= 3) {
      c[i] -= 3; groups.push({ type: 'koutsu', tile: i });
      extract(i, pair);
      groups.pop(); c[i] += 3;
    }
    if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--; c[i + 1]--; c[i + 2]--; groups.push({ type: 'shuntsu', tile: i });
      extract(i, pair);
      groups.pop(); c[i]++; c[i + 1]++; c[i + 2]++;
    }
  }
  for (let p = 0; p < 34; p++) {
    if (c[p] >= 2) { c[p] -= 2; extract(0, p); c[p] += 2; }
  }
  return res;
}

function ceil100(x) { return Math.ceil(x / 100) * 100; }

function basePoints(han, fu, yakumanMult) {
  if (yakumanMult) return 8000 * yakumanMult;
  if (han >= 13 && RULES.kazoe) return 8000;
  if (han >= 11) return 6000;
  if (han >= 8) return 4000;
  if (han >= 6) return 3000;
  if (han >= 5) return 2000;
  const b = fu * Math.pow(2, han + 2);
  if (b >= 2000) return 2000;
  if (RULES.kiriage && b >= 1920) return 2000;
  return b;
}

function rankOf(han, fu, yakumanMult) {
  if (yakumanMult) return { cls: 'yakuman', label: yakumanMult > 1 ? `${yakumanMult}倍役満` : '役満' };
  if (han >= 13 && RULES.kazoe) return { cls: 'yakuman', label: '数え役満' };
  if (han >= 11) return { cls: 'sanbaiman', label: '三倍満' };
  if (han >= 8) return { cls: 'baiman', label: '倍満' };
  if (han >= 6) return { cls: 'haneman', label: '跳満' };
  if (basePoints(han, fu, 0) === 2000) return { cls: 'mangan', label: '満貫' };
  return { cls: 'low', label: '' };
}

function payments(base, oya, tsumo) {
  if (!tsumo) return { ron: ceil100(base * (oya ? 6 : 4)) };
  if (oya) { const all = ceil100(base * 2); return { all, total: all * 3 }; }
  const ko = ceil100(base), oyaPay = ceil100(base * 2);
  return { ko, oya: oyaPay, total: ko * 2 + oyaPay };
}

function situationYaku(s, menzen) {
  const y = [];
  if (s.riichi === 2) y.push({ name: 'ダブル立直', han: 2 });
  else if (s.riichi) y.push({ name: '立直', han: 1 });
  if (s.ippatsu) y.push({ name: '一発', han: 1 });
  if (menzen && s.tsumo) y.push({ name: '門前清自摸和', han: 1 });
  if (s.rinshan) y.push({ name: '嶺上開花', han: 1 });
  if (s.chankan) y.push({ name: '槍槓', han: 1 });
  if (s.haitei) y.push({ name: '海底摸月', han: 1 });
  if (s.houtei) y.push({ name: '河底撈魚', han: 1 });
  return y;
}

// 一色系（混一色・清一色）。字牌だけ・数牌が2色以上なら null
function flushYaku(tiles, menzen) {
  const suits = new Set(tiles.filter(t => !isHonor(t)).map(suitOf));
  if (suits.size !== 1) return null;
  if (tiles.some(isHonor)) return { name: '混一色', han: menzen ? 3 : 2 };
  return { name: '清一色', han: menzen ? 6 : 5 };
}

function windLabel(t, s) {
  const parts = [];
  if (t === s.roundWind) parts.push('場風');
  if (t === s.seatWind) parts.push('自風');
  return parts;
}

function pairFu(t, s) {
  if (isDragon(t)) return 2;
  const w = windLabel(t, s).length;
  if (w === 2) return RULES.doubleWindPairFu;
  return w ? 2 : 0;
}

// 普通の形（4面子1雀頭）を、和了牌をどの面子で取ったか（opt）まで決めて評価する
function evalNormal(d, opt, ctx) {
  const { s, menzen, meldGroups, win } = ctx;
  const groups = d.groups.map((g, i) => ({
    type: g.type, tile: g.tile, meld: false,
    // ロンでシャンポン待ちの刻子を完成させた場合は明刻あつかい
    concealed: !(g.type === 'koutsu' && !s.tsumo && i === opt.idx),
  })).concat(meldGroups);
  const wait = opt.wait;
  const pair = d.pair;
  const tiles = ctx.tiles14; // 正規化済み（槓子の4枚目を含む全牌）
  const yaku = [];
  const yakuman = [];

  const kous = groups.filter(g => g.type !== 'shuntsu');
  const shuns = groups.filter(g => g.type === 'shuntsu');
  const groupTiles = g => (g.type === 'shuntsu' ? [g.tile, g.tile + 1, g.tile + 2] : [g.tile]);
  const anko = kous.filter(g => g.concealed).length;
  const kans = groups.filter(g => g.type === 'kantsu').length;

  // 役満
  if (anko === 4) yakuman.push({ name: '四暗刻', mult: 1 });
  const dragonKou = kous.filter(g => isDragon(g.tile)).length;
  if (dragonKou === 3) yakuman.push({ name: '大三元', mult: 1 });
  if (tiles.every(isHonor)) yakuman.push({ name: '字一色', mult: 1 });
  if (tiles.every(t => GREEN.has(t))) yakuman.push({ name: '緑一色', mult: 1 });
  if (tiles.every(isTerminal)) yakuman.push({ name: '清老頭', mult: 1 });
  const windKou = kous.filter(g => isWind(g.tile)).length;
  if (windKou === 4) yakuman.push({ name: '大四喜', mult: 1 });
  else if (windKou === 3 && isWind(pair)) yakuman.push({ name: '小四喜', mult: 1 });
  if (kans === 4) yakuman.push({ name: '四槓子', mult: 1 });
  if (menzen && kans === 0 && !tiles.some(isHonor) && new Set(tiles.map(suitOf)).size === 1) {
    const c = new Array(9).fill(0);
    for (const t of tiles) c[t % 9]++;
    if (c[0] >= 3 && c[8] >= 3 && c.every(n => n >= 1)) yakuman.push({ name: '九蓮宝燈', mult: 1 });
  }

  const pinfu = menzen && shuns.length === 4 && pairFu(pair, s) === 0 && wait === 'ryanmen';

  if (!yakuman.length) {
    yaku.push(...situationYaku(s, menzen));
    if (pinfu) yaku.push({ name: '平和', han: 1 });
    if (tiles.every(t => !isYaochu(t)) && (menzen || RULES.kuitan)) yaku.push({ name: '断么九', han: 1 });

    if (menzen) {
      const sc = {};
      for (const g of shuns) sc[g.tile] = (sc[g.tile] || 0) + 1;
      let peiko = 0;
      for (const k in sc) peiko += Math.floor(sc[k] / 2);
      if (peiko >= 2) yaku.push({ name: '二盃口', han: 3 });
      else if (peiko === 1) yaku.push({ name: '一盃口', han: 1 });
    }

    for (const g of kous) {
      if (isDragon(g.tile)) yaku.push({ name: `役牌 ${HONOR_NAMES[g.tile - 27]}`, han: 1 });
      if (g.tile === s.roundWind) yaku.push({ name: `場風 ${HONOR_NAMES[g.tile - 27]}`, han: 1 });
      if (g.tile === s.seatWind) yaku.push({ name: `自風 ${HONOR_NAMES[g.tile - 27]}`, han: 1 });
    }

    for (let n = 0; n < 7; n++) {
      if ([0, 9, 18].every(b => shuns.some(g => g.tile === b + n))) { yaku.push({ name: '三色同順', han: menzen ? 2 : 1 }); break; }
    }
    for (const b of [0, 9, 18]) {
      if ([0, 3, 6].every(o => shuns.some(g => g.tile === b + o))) { yaku.push({ name: '一気通貫', han: menzen ? 2 : 1 }); break; }
    }

    const allYaochuGroups = groups.every(g => groupTiles(g).some(isYaochu)) && isYaochu(pair);
    const honroutou = tiles.every(isYaochu);
    if (allYaochuGroups && shuns.length > 0) {
      if (tiles.some(isHonor)) yaku.push({ name: '混全帯么九', han: menzen ? 2 : 1 });
      else yaku.push({ name: '純全帯么九', han: menzen ? 3 : 2 });
    }
    if (kous.length === 4) yaku.push({ name: '対々和', han: 2 });
    if (anko === 3) yaku.push({ name: '三暗刻', han: 2 });
    for (let n = 0; n < 9; n++) {
      if ([0, 9, 18].every(b => kous.some(g => g.tile === b + n))) { yaku.push({ name: '三色同刻', han: 2 }); break; }
    }
    if (kans === 3) yaku.push({ name: '三槓子', han: 2 });
    if (dragonKou === 2 && isDragon(pair)) yaku.push({ name: '小三元', han: 2 });
    if (honroutou) yaku.push({ name: '混老頭', han: 2 });
    const fl = flushYaku(tiles, menzen);
    if (fl) yaku.push(fl);
  }

  // 符
  const fuDetail = [];
  let fu;
  if (pinfu && s.tsumo) {
    fu = 20;
    fuDetail.push({ label: '平和ツモは20符固定', fu: 20 });
  } else {
    fuDetail.push({ label: '副底', fu: 20 });
    if (menzen && !s.tsumo) fuDetail.push({ label: '門前ロン', fu: 10 });
    if (s.tsumo) fuDetail.push({ label: 'ツモ', fu: 2 });
    for (const g of kous) {
      let f = 2;
      if (isYaochu(g.tile)) f *= 2;
      if (g.concealed) f *= 2;
      if (g.type === 'kantsu') f *= 4;
      const kind = g.type === 'kantsu' ? (g.concealed ? '暗槓' : '明槓') : (g.concealed ? '暗刻' : '明刻');
      fuDetail.push({ label: `${kind} ${tileName(g.tile)}${isYaochu(g.tile) ? '（么九牌）' : ''}`, fu: f });
    }
    const pf = pairFu(pair, s);
    if (pf) {
      const why = isDragon(pair) ? '役牌' : windLabel(pair, s).join('・');
      fuDetail.push({ label: `雀頭 ${tileName(pair)}（${why}）`, fu: pf });
    }
    if (wait === 'kanchan' || wait === 'penchan' || wait === 'tanki') {
      fuDetail.push({ label: `${WAIT_NAMES[wait]}待ち`, fu: 2 });
    }
    const raw = fuDetail.reduce((a, x) => a + x.fu, 0);
    fu = Math.ceil(raw / 10) * 10;
    if (fu === 20 && !menzen) {
      fu = 30;
      fuDetail.push({ label: '副露して20符のときは30符にする', fu: 0 });
    }
    fuDetail.raw = raw;
  }

  return { yaku, yakuman, fu, fuDetail, wait, form: 'normal', pair, groups };
}

function evalChiitoi(ctx) {
  const { s, tiles14: tiles } = ctx;
  const yaku = [], yakuman = [];
  if (tiles.every(isHonor)) yakuman.push({ name: '字一色', mult: 1 });
  else {
    yaku.push(...situationYaku(s, true));
    yaku.push({ name: '七対子', han: 2 });
    if (tiles.every(t => !isYaochu(t))) yaku.push({ name: '断么九', han: 1 });
    if (tiles.every(isYaochu)) yaku.push({ name: '混老頭', han: 2 });
    const fl = flushYaku(tiles, true);
    if (fl) yaku.push(fl);
  }
  return { yaku, yakuman, fu: 25, fuDetail: [{ label: '七対子は25符固定', fu: 25 }], wait: 'tanki', form: 'chiitoi' };
}

function evalKokushi(ctx) {
  const yaku = [];
  return { yaku, yakuman: [{ name: '国士無双', mult: 1 }], fu: 0, fuDetail: [], wait: 'tanki', form: 'kokushi' };
}

/* hand = {
 *   closed: [13枚], winTile, melds: [{type:'chi'|'pon'|'minkan'|'ankan', tiles:[...], from}],
 *   sit: { roundWind, seatWind, tsumo, riichi(0/1/2), ippatsu, haitei, houtei, rinshan, chankan, dora:[表示牌], ura:[表示牌] }
 * }
 * 和了していない・役が無いときは null */
function score(hand) {
  const s = hand.sit;
  const oya = s.seatWind === 27;
  const closed14 = hand.closed.concat([hand.winTile]);
  const counts = new Array(34).fill(0);
  for (const t of closed14) counts[norm(t)]++;
  const win = norm(hand.winTile);
  const menzen = hand.melds.every(m => m.type === 'ankan');
  const meldGroups = hand.melds.map(m => ({
    type: m.type === 'chi' ? 'shuntsu' : (m.type === 'pon' ? 'koutsu' : 'kantsu'),
    tile: Math.min(...m.tiles.map(norm)),
    concealed: m.type === 'ankan', meld: true,
  }));
  const allTiles = closed14.concat(...hand.melds.map(m => m.tiles));
  const tiles14 = closed14.map(norm).concat(...hand.melds.map(m => m.tiles.slice(0, 3).map(norm)));
  const ctx = { s, menzen, meldGroups, win, tiles14 };

  const cands = [];
  if (hand.melds.length === 0) {
    const yao = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
    if (yao.every(t => counts[t] >= 1) && yao.reduce((a, t) => a + counts[t], 0) === 14) cands.push(evalKokushi(ctx));
    if (counts.filter(n => n === 2).length === 7) cands.push(evalChiitoi(ctx));
  }
  for (const d of decompose(counts)) {
    if (d.groups.length + hand.melds.length !== 4) continue;
    if (d.pair === win) cands.push(evalNormal(d, { idx: -1, wait: 'tanki' }, ctx));
    d.groups.forEach((g, i) => {
      if (g.type === 'koutsu' && g.tile === win) cands.push(evalNormal(d, { idx: i, wait: 'shanpon' }, ctx));
      if (g.type === 'shuntsu' && win >= g.tile && win <= g.tile + 2) {
        const pos = win - g.tile, n = numOf(g.tile);
        let w;
        if (pos === 1) w = 'kanchan';
        else if (pos === 0) w = n === 7 ? 'penchan' : 'ryanmen';
        else w = n === 1 ? 'penchan' : 'ryanmen';
        cands.push(evalNormal(d, { idx: i, wait: w }, ctx));
      }
    });
  }

  // ドラ（役が無いと数えない）
  const countDora = inds => inds.reduce((a, ind) => {
    const d = doraFromIndicator(ind);
    return a + allTiles.filter(t => norm(t) === d).length;
  }, 0);
  const dora = countDora(s.dora || []);
  const ura = s.riichi ? countDora(s.ura || []) : 0;
  const aka = RULES.aka ? allTiles.filter(isRed).length : 0;

  let best = null;
  for (const c of cands) {
    const ym = c.yakuman.reduce((a, y) => a + y.mult, 0);
    let han = c.yaku.reduce((a, y) => a + y.han, 0);
    if (!ym && han === 0) continue;
    const yaku = c.yaku.slice();
    if (!ym) {
      if (dora) yaku.push({ name: 'ドラ', han: dora, dora: true });
      if (aka) yaku.push({ name: '赤ドラ', han: aka, dora: true });
      if (ura) yaku.push({ name: '裏ドラ', han: ura, dora: true });
      han += dora + aka + ura;
    }
    const base = basePoints(han, c.fu, ym);
    const pay = payments(base, oya, s.tsumo);
    const total = pay.ron || pay.total;
    const r = Object.assign({}, c, { yaku, han, base, pay, total, oya, yakumanMult: ym }, rankOf(han, c.fu, ym));
    if (!best || r.total > best.total || (r.total === best.total && (r.han > best.han || (r.han === best.han && r.fu > best.fu)))) best = r;
  }
  if (best) best.tags = tagsOf(hand, best);
  return best;
}

// 苦手モードで使う分類（符の要素ごと）
function tagsOf(hand, r) {
  const s = hand.sit;
  const t = new Set();
  t.add(r.oya ? '親' : '子');
  t.add(s.tsumo ? 'ツモ' : 'ロン');
  if (hand.melds.some(m => m.type !== 'ankan')) t.add('副露');
  t.add(`${r.fu}符`);
  if (r.han >= 5) t.add('5翻以上');
  else if (r.cls === 'mangan') t.add('満貫になる符');
  if (r.form === 'chiitoi') t.add('七対子');
  if (r.form === 'normal') {
    if (r.fu === 20) t.add('平和ツモ');
    for (const g of r.groups) {
      if (g.type === 'shuntsu') continue;
      t.add(g.type === 'kantsu' ? '槓子' : (g.concealed ? '暗刻' : '明刻'));
      if (isYaochu(g.tile)) t.add('么九牌の刻子');
    }
    const pf = pairFu(r.pair, s);
    if (pf) t.add(windLabel(r.pair, s).length === 2 ? '連風牌の雀頭' : '役牌の雀頭');
    if (r.wait === 'kanchan' || r.wait === 'penchan' || r.wait === 'tanki') t.add('嵌張・辺張・単騎');
    if (r.wait === 'shanpon' && !s.tsumo) t.add('シャンポンのロン');
    if (r.fuDetail.raw === 20 && r.fu === 30) t.add('副露の30符');
  }
  return [...t];
}

const CLASS_LABEL = { low: '満貫未満', mangan: '満貫', haneman: '跳満', baiman: '倍満', sanbaiman: '三倍満', yakuman: '役満' };

/* ---------------- 牌姿の生成 ---------------- */

let rand = Math.random;
const randInt = n => Math.floor(rand() * n);
const pick = arr => arr[randInt(arr.length)];
function pickWeighted(obj) {
  const keys = Object.keys(obj);
  let r = rand() * keys.reduce((a, k) => a + obj[k], 0);
  for (const k of keys) { r -= obj[k]; if (r < 0) return k; }
  return keys[keys.length - 1];
}

/* 出題の重み。天鳳などの和了統計を目安にした値（厳密な統計値ではない）
 * 符の練習が目的なので、9割は4翻以下（符で点数が変わる手）、1割は5翻以上（満貫・跳満など）を出す */
const MAX_HAN = 4;
const HIGH_RATE = 0.1;
const PRACTICAL = {
  // 和了時の状態: 立直4割・副露3.5割・黙聴2.5割
  style: { riichi: 40, open: 35, dama: 25 },
  tsumo: { riichi: 0.45, open: 0.32, dama: 0.35 },
  chiitoi: 0.04,
  closedThemes: { free: 48, pinfu: 22, tanyao: 14, iipeikou: 5, yakuhai: 5, honitsu: 2, ittsu: 1.5, sanshoku: 1.5, chanta: 1, sanankou: 0.7 },
  openThemes: { yakuhai: 46, tanyao: 32, honitsu: 10, toitoi: 6, ittsu: 2, sanshoku: 2, chanta: 1.5, shousangen: 0.5 },
  calls: { 1: 40, 2: 35, 3: 20, 4: 5 },
  kan: 0.05,
  doraBias: 0.3,     // ドラを手の内に残している確率（ランダムだとドラが少なすぎるため）
  ippatsu: 0.09, doubleRiichi: 0.01, lastTile: 0.02, rinshan: 0.3,
  roundWind: { 27: 60, 28: 40 },
  kouRate: 0.2,      // 普通の面子が刻子になる確率
  honorKouRate: 0.25, // 刻子が字牌になる確率
  // 待ちの重み（実戦は両面が6割前後）
  wait: { ryanmen: 4.5, penchan: 2, kanchan: 1.6, shanpon: 5, tanki: 1 },
};

let K = PRACTICAL; // 生成中の設定（面子の選び方で使う）
let SEAT = null;   // 'oya' | 'ko' | null（どちらも）

const SHUN_STARTS = []; for (const b of [0, 9, 18]) for (let n = 0; n < 7; n++) SHUN_STARTS.push(b + n);
const ALL_TILES = Array.from({ length: 34 }, (_, i) => i);
const NUM_TILES = ALL_TILES.filter(t => t < 27);
const HONORS = [27, 28, 29, 30, 31, 32, 33];

// 面子を選ぶ部品。filter に合う中から選ぶ
const shun = (f = () => true) => () => ({ type: 'shuntsu', tile: pick(SHUN_STARTS.filter(f)) });
const kou = (f = () => true) => () => ({ type: 'koutsu', tile: pick(ALL_TILES.filter(f)) });
const numKou = f => kou(t => t < 27 && (!f || f(t)));
// 普通の面子: 実戦モードでは8割が順子。刻子の何割が字牌かも設定で決める
const freeGroup = () => (rand() >= K.kouRate ? shun()() : (rand() >= K.honorKouRate ? numKou()() : kou(isHonor)()));
const freePair = () => (rand() < 0.78 ? pick(NUM_TILES) : pick(HONORS));
const inSuit = (s, f) => t => suitOf(t) === s && (!f || f(t));

function themeSpec(name, ctx) {
  const yakuhaiTiles = [31, 32, 33, ctx.roundWind, ctx.seatWind];
  const nonYakuhaiPair = () => { let p; do p = freePair(); while (pairFu(p, ctx) !== 0); return p; };
  const S = randInt(3);
  const suitGroup = (honorRate) => () => (rand() < honorRate ? kou(isHonor)() : (rand() < 0.72 ? shun(inSuit(S))() : kou(inSuit(S))()));
  const chantaShun = shun(t => numOf(t) === 1 || numOf(t) === 7);
  switch (name) {
    case 'free': return { groups: [freeGroup, freeGroup, freeGroup, freeGroup], pair: freePair };
    case 'pinfu': return { groups: [shun(), shun(), shun(), shun()], pair: nonYakuhaiPair, ryanmen: true };
    case 'tanyao': {
      const g = () => (rand() < 0.82 ? shun(t => numOf(t) >= 2 && numOf(t) <= 6)() : numKou(t => !isTerminal(t))());
      return { groups: [g, g, g, g], pair: () => pick(NUM_TILES.filter(t => !isTerminal(t))) };
    }
    case 'iipeikou': {
      const st = pick(SHUN_STARTS);
      const same = () => ({ type: 'shuntsu', tile: st });
      return { groups: [same, same, freeGroup, rand() < 0.7 ? shun() : freeGroup], pair: freePair };
    }
    case 'ryanpeikou': {
      const a = pick(SHUN_STARTS), b = pick(SHUN_STARTS);
      return { groups: [() => ({ type: 'shuntsu', tile: a }), () => ({ type: 'shuntsu', tile: a }), () => ({ type: 'shuntsu', tile: b }), () => ({ type: 'shuntsu', tile: b })], pair: freePair };
    }
    case 'yakuhai': {
      const y = pick(yakuhaiTiles);
      return { groups: [() => ({ type: 'koutsu', tile: y }), freeGroup, freeGroup, freeGroup], pair: freePair, callFirst: true };
    }
    case 'shousangen': {
      const ds = [31, 32, 33].sort(() => rand() - 0.5);
      return { groups: [() => ({ type: 'koutsu', tile: ds[0] }), () => ({ type: 'koutsu', tile: ds[1] }), freeGroup, freeGroup], pair: () => ds[2], callFirst: true };
    }
    case 'honitsu': {
      const hr = 0.3;
      return { groups: [() => (rand() < 0.6 ? kou(t => yakuhaiTiles.includes(t))() : kou(isHonor)()), suitGroup(hr), suitGroup(0.1), suitGroup(0.05)], pair: () => (rand() < 0.3 ? pick(HONORS) : pick(NUM_TILES.filter(inSuit(S)))), callFirst: true };
    }
    case 'chinitsu': return { groups: [suitGroup(0), suitGroup(0), suitGroup(0), suitGroup(0)], pair: () => pick(NUM_TILES.filter(inSuit(S))) };
    case 'toitoi': {
      const k = () => (rand() < 0.35 ? kou(isHonor)() : numKou()());
      return { groups: [k, k, k, k], pair: freePair };
    }
    case 'sanankou': return { groups: [kou(), numKou(), numKou(), shun()], pair: freePair, concealedKou: true };
    case 'sanshokudoukou': {
      const n = randInt(9);
      return { groups: [0, 9, 18].map(b => () => ({ type: 'koutsu', tile: b + n })).concat([freeGroup]), pair: freePair };
    }
    case 'chanta': {
      const g = () => (rand() < 0.7 ? chantaShun() : kou(isYaochu)());
      return { groups: [chantaShun, g, g, g], pair: () => pick(ALL_TILES.filter(isYaochu)) };
    }
    case 'honroutou': {
      const g = kou(isYaochu);
      return { groups: [g, g, g, g], pair: () => pick(ALL_TILES.filter(isYaochu)) };
    }
    case 'ittsu': return { groups: [0, 3, 6].map(o => () => ({ type: 'shuntsu', tile: S * 9 + o })).concat([freeGroup]), pair: freePair };
    case 'sanshoku': {
      const n = randInt(7);
      return { groups: [0, 9, 18].map(b => () => ({ type: 'shuntsu', tile: b + n })).concat([freeGroup]), pair: freePair };
    }
    default: throw new Error('unknown theme ' + name);
  }
}

// 面子の部品から4面子1雀頭を作る。同じ牌が5枚以上になったら作り直す
function buildGroups(spec) {
  for (let tries = 0; tries < 60; tries++) {
    const used = new Array(34).fill(0);
    const groups = [];
    let ok = true;
    const add = (g) => {
      const ts = g.type === 'shuntsu' ? [g.tile, g.tile + 1, g.tile + 2] : [g.tile, g.tile, g.tile];
      for (const t of ts) used[t]++;
      if (ts.some(t => used[t] > 4)) ok = false;
    };
    for (const f of spec.groups) { const g = f(); groups.push(g); add(g); if (!ok) break; }
    if (!ok) continue;
    const pair = spec.pair();
    used[pair] += 2;
    if (used[pair] > 4) continue;
    return { groups, pair, used };
  }
  return null;
}

const groupTileList = g => (g.type === 'shuntsu' ? [g.tile, g.tile + 1, g.tile + 2] : (g.type === 'kantsu' ? [g.tile, g.tile, g.tile, g.tile] : [g.tile, g.tile, g.tile]));

function makeSituation(cfg, style) {
  const roundWind = +pickWeighted(cfg.roundWind);
  // 親(東家)・子(南西北家)の指定があればそれに合わせる
  const seatWind = SEAT === 'oya' ? 27 : SEAT === 'ko' ? 28 + randInt(3) : 27 + randInt(4);
  const tsumo = rand() < cfg.tsumo[style];
  const s = { roundWind, seatWind, tsumo, riichi: 0, ippatsu: false, haitei: false, houtei: false, rinshan: false, chankan: false, dora: [], ura: [] };
  if (style === 'riichi') {
    s.riichi = rand() < cfg.doubleRiichi ? 2 : 1;
    s.ippatsu = rand() < cfg.ippatsu;
  }
  if (rand() < cfg.lastTile) { if (tsumo) s.haitei = true; else s.houtei = true; }
  return s;
}

function genNormal(cfg) {
  const style = pickWeighted(cfg.style);
  const s = makeSituation(cfg, style);
  const theme = pickWeighted(style === 'open' ? cfg.openThemes : cfg.closedThemes);
  const spec = themeSpec(theme, s);
  const built = buildGroups(spec);
  if (!built) return null;
  const { groups, pair, used } = built;

  // 鳴く面子を決める
  const calledIdx = new Set();
  if (style === 'open') {
    let k = +pickWeighted(cfg.calls);
    const order = groups.map((_, i) => i).sort(() => rand() - 0.5);
    if (spec.callFirst && rand() < 0.8) { order.splice(order.indexOf(0), 1); order.unshift(0); }
    for (const i of order) { if (calledIdx.size >= k) break; calledIdx.add(i); }
  }

  // 槓子
  if (!spec.concealedKou || style !== 'open') {
    const kanCands = groups.map((g, i) => i).filter(i => groups[i].type === 'koutsu' && used[groups[i].tile] === 3);
    if (kanCands.length && rand() < cfg.kan) {
      const i = pick(kanCands);
      groups[i] = { type: 'kantsu', tile: groups[i].tile };
      used[groups[i].tile] = 4;
    }
  }

  // 和了牌を決める（待ちの形ごとの重みは設定から）
  const W = cfg.wait;
  const opts = [];
  groups.forEach((g, i) => {
    if (calledIdx.has(i) || g.type === 'kantsu') return;
    if (g.type === 'shuntsu') {
      const n = numOf(g.tile);
      opts.push({ i, tile: g.tile, w: n === 7 ? W.penchan : W.ryanmen, ryanmen: n !== 7 });
      opts.push({ i, tile: g.tile + 1, w: W.kanchan });
      opts.push({ i, tile: g.tile + 2, w: n === 1 ? W.penchan : W.ryanmen, ryanmen: n !== 1 });
    } else if (!(spec.concealedKou && !s.tsumo)) {
      opts.push({ i, tile: g.tile, w: W.shanpon });
    }
  });
  opts.push({ i: -1, tile: pair, w: spec.concealedKou && !s.tsumo ? 10 : W.tanki });
  const usable = spec.ryanmen ? opts.filter(o => o.ryanmen) : opts;
  if (!usable.length) return null;
  const wsum = usable.reduce((a, o) => a + o.w, 0);
  let r = rand() * wsum, chosen = usable[usable.length - 1];
  for (const o of usable) { r -= o.w; if (r < 0) { chosen = o; break; } }

  // 手牌と副露を組み立てる
  const closed = [];
  const melds = [];
  groups.forEach((g, i) => {
    const ts = groupTileList(g);
    if (calledIdx.has(i)) {
      const type = g.type === 'shuntsu' ? 'chi' : (g.type === 'kantsu' ? 'minkan' : 'pon');
      // チーは上家からなので左、ポン・明槓は誰からか
      melds.push({ type, tiles: ts, from: type === 'chi' ? 0 : randInt(3), calledTile: type === 'chi' ? pick(ts) : g.tile });
    } else if (g.type === 'kantsu') {
      melds.push({ type: 'ankan', tiles: ts, from: -1 });
    } else closed.push(...ts);
  });
  closed.push(pair, pair);
  closed.splice(closed.indexOf(chosen.tile), 1);
  const hasKan = melds.some(m => m.type === 'minkan' || m.type === 'ankan');
  if (hasKan && s.tsumo && rand() < cfg.rinshan) { s.rinshan = true; s.haitei = false; }

  const hand = { closed, winTile: chosen.tile, melds, sit: s, theme, style };
  applyAka(hand);
  applyDora(hand, cfg);
  hand.closed.sort((a, b) => norm(a) - norm(b) || a - b);
  return hand;
}

function genChiitoi(cfg, style) {
  const s = makeSituation(cfg, style === 'open' ? 'dama' : style);
  const pairs = new Set();
  const flush = rand() < 0.15 ? randInt(3) : -1;
  while (pairs.size < 7) {
    const t = flush >= 0 && rand() < 0.75 ? flush * 9 + randInt(9) : (rand() < 0.8 ? pick(NUM_TILES) : pick(HONORS));
    pairs.add(t);
  }
  const ps = [...pairs];
  const winPair = pick(ps);
  const closed = [];
  for (const p of ps) closed.push(p, p);
  closed.splice(closed.indexOf(winPair), 1);
  const hand = { closed, winTile: winPair, melds: [], sit: s, theme: 'chiitoi', style };
  applyAka(hand);
  applyDora(hand, cfg);
  hand.closed.sort((a, b) => norm(a) - norm(b) || a - b);
  return hand;
}

// 手の中の5を、4枚中1枚の確率で赤にする
function applyAka(hand) {
  if (!RULES.aka) return;
  for (let su = 0; su < 3; su++) {
    const five = su * 9 + 4;
    const spots = [];
    hand.closed.forEach((t, i) => { if (t === five) spots.push(['c', i]); });
    if (hand.winTile === five) spots.push(['w', 0]);
    hand.melds.forEach((m, mi) => m.tiles.forEach((t, i) => { if (t === five) spots.push(['m', mi, i]); }));
    if (!spots.length || rand() >= spots.length / 4) continue;
    const sp = pick(spots), red = 34 + su;
    if (sp[0] === 'c') hand.closed[sp[1]] = red;
    else if (sp[0] === 'w') hand.winTile = red;
    else {
      hand.melds[sp[1]].tiles[sp[2]] = red;
      if (hand.melds[sp[1]].calledTile === five && rand() < 0.5) hand.melds[sp[1]].calledTile = red;
    }
  }
}

// ドラ表示牌。槓1回ごとに1枚増える。裏ドラは立直したときだけ
function applyDora(hand, cfg) {
  const s = hand.sit;
  const all = hand.closed.concat([hand.winTile], ...hand.melds.map(m => m.tiles)).map(norm);
  const used = new Array(34).fill(0);
  for (const t of all) used[t]++;
  const n = 1 + hand.melds.filter(m => m.type === 'minkan' || m.type === 'ankan').length;
  const bias = cfg.doraBias;
  const drawFree = () => {
    const pool = [];
    for (let t = 0; t < 34; t++) for (let k = used[t]; k < 4; k++) pool.push(t);
    const t = pick(pool);
    used[t]++;
    return t;
  };
  for (let i = 0; i < n; i++) {
    let ind = null;
    if (rand() < bias) {
      const inHand = [...new Set(all)];
      const cands = ALL_TILES.filter(t => used[t] < 4 && inHand.includes(doraFromIndicator(t)));
      if (cands.length) { ind = pick(cands); used[ind]++; }
    }
    s.dora.push(ind === null ? drawFree() : ind);
  }
  if (s.riichi) for (let i = 0; i < n; i++) s.ura.push(drawFree());
}

/* 問題を1つ作る。役満は出さない
 * seat: 'oya' | 'ko' で親・子を固定（省略するとどちらも出る） */
function generate(seat) {
  const cfg = PRACTICAL;
  K = cfg;
  SEAT = seat || null;
  const high = rand() < HIGH_RATE;
  for (let i = 0; i < 3000; i++) {
    const hand = rand() < cfg.chiitoi ? genChiitoi(cfg, pickWeighted(cfg.style)) : genNormal(cfg);
    if (!hand) continue;
    const result = score(hand);
    if (!result || result.yakumanMult) continue;
    if (high ? result.han <= MAX_HAN : result.han > MAX_HAN) continue;
    return { hand, result };
  }
  return generate(seat);
}

/* 4択の選択肢。正解と、よくある間違い方をした点数3つを返す
 * 間違い方: 符を10符ずらす・翻を1つずらす・切り上げ満貫を忘れる・ロンで親子を取り違える・符を20符ずらす */
function payKey(p) { return p.ron ? `r${p.ron}` : p.all ? `a${p.all}` : `k${p.ko}/${p.oya}`; }
function choices(result, sit) {
  const r = result;
  const pay = (han, fu, oya, noKiriage) => {
    let base = basePoints(han, fu, 0);
    if (noKiriage && han <= 4) base = Math.min(fu * Math.pow(2, han + 2), 2000);
    return payments(base, oya, sit.tsumo);
  };
  const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = randInt(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const fuOk = f => f >= 20 && f <= 110;
  // 近い間違いほど前に置く（同じグループの中は毎回順番を変える）
  const near = [];
  for (const d of [-10, 10]) if (fuOk(r.fu + d)) near.push({ pay: pay(r.han, r.fu + d, r.oya), why: `${r.fu + d}符で計算した点数` });
  if (r.form === 'chiitoi') near.push({ pay: pay(r.han, 30, r.oya), why: '30符で計算した点数' });
  if (r.cls === 'mangan' && r.fu * Math.pow(2, r.han + 2) < 2000) near.push({ pay: pay(r.han, r.fu, r.oya, true), why: '切り上げ満貫を忘れた点数' });
  const mid = [];
  for (const d of [-1, 1]) if (r.han + d >= 1) mid.push({ pay: pay(r.han + d, r.fu, r.oya), why: `${r.han + d}翻で計算した点数` });
  if (!sit.tsumo) mid.push({ pay: pay(r.han, r.fu, !r.oya), why: `${r.oya ? '子' : '親'}として計算した点数` });
  const far = [];
  for (const d of [-20, 20, 30]) if (fuOk(r.fu + d)) far.push({ pay: pay(r.han, r.fu + d, r.oya), why: `${r.fu + d}符で計算した点数` });
  far.push({ pay: pay(r.han + 1, r.fu + 10, r.oya), why: '翻も符も多く数えた点数' });
  // 満貫になる手は符をずらしても同じ点数になりやすいので、翻を大きくずらした点数も候補にする
  for (const d of [-2, 2]) if (r.han + d >= 1) far.push({ pay: pay(r.han + d, r.fu, r.oya), why: `${r.han + d}翻で計算した点数` });
  for (const df of [-10, 10]) if (r.han > 1 && fuOk(r.fu + df)) far.push({ pay: pay(r.han - 1, r.fu + df, r.oya), why: `${r.han - 1}翻${r.fu + df}符で計算した点数` });
  const seen = new Set([payKey(r.pay)]);
  const wrong = [];
  for (const c of shuffle(near).concat(shuffle(mid), shuffle(far))) {
    const k = payKey(c.pay);
    if (seen.has(k)) continue;
    seen.add(k);
    wrong.push(c);
    if (wrong.length === 3) break;
  }
  // まだ3つにならないとき（満貫以上など）は、翻を下げていろいろな符で計算した点数で埋める
  for (let h = r.han - 1; h >= 1 && wrong.length < 3; h--) {
    for (const f of [r.fu, 30, 40, 50, 20, 60, 70]) {
      if (wrong.length >= 3) break;
      const c = { pay: pay(h, f, r.oya), why: `${h}翻${f}符で計算した点数` };
      const k = payKey(c.pay);
      if (!seen.has(k)) { seen.add(k); wrong.push(c); }
    }
  }
  return shuffle([{ pay: r.pay, correct: true }].concat(wrong));
}

const api = {
  RULES, WAIT_NAMES, PRACTICAL, MAX_HAN, HIGH_RATE,
  norm, isRed, isHonor, suitOf, numOf, tileName, doraFromIndicator,
  decompose, score, generate, basePoints, payments, choices,
  setRandom(f) { rand = f; },
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else global.Mahjong = api;
})(typeof window !== 'undefined' ? window : globalThis);
