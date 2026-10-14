// 点数計算のテスト: node tensu/test.js
'use strict';
const M = require('./mahjong.js');

// "123m456p789s11z" 形式（z: 1東 2南 3西 4北 5白 6發 7中、0 は赤5）
function parse(str) {
  const out = [];
  let buf = [];
  for (const ch of str) {
    if (/[0-9]/.test(ch)) buf.push(+ch);
    else {
      const base = { m: 0, p: 9, s: 18, z: 27 }[ch];
      for (const n of buf) out.push(n === 0 ? 34 + base / 9 : base + n - 1);
      buf = [];
    }
  }
  return out;
}
const E = 27, S = 28, W = 29, N = 30;
function hand(closed, win, sit = {}, melds = []) {
  return {
    closed: parse(closed), winTile: parse(win)[0],
    melds: melds.map(([type, t]) => ({ type, tiles: parse(t) })),
    sit: Object.assign({ roundWind: E, seatWind: S, tsumo: false, riichi: 0, dora: [], ura: [] }, sit),
  };
}

let fail = 0, pass = 0;
function check(name, h, expect) {
  const r = M.score(h);
  const got = r ? { han: r.han, fu: r.fu, ...r.pay, yaku: r.yaku.map(y => y.name).concat(r.yakuman.map(y => y.name)) } : null;
  const errs = [];
  if (expect === null) { if (got) errs.push('役なしのはず'); }
  else if (!got) errs.push('和了になっていない');
  else {
    for (const k of ['han', 'fu', 'ron', 'ko', 'oya', 'all']) if (k in expect && expect[k] !== got[k]) errs.push(`${k}: 期待 ${expect[k]} / 実際 ${got[k]}`);
    for (const y of expect.yaku || []) if (!got.yaku.includes(y)) errs.push(`役 ${y} が無い`);
    for (const y of expect.noYaku || []) if (got.yaku.includes(y)) errs.push(`役 ${y} が付いている`);
  }
  if (errs.length) { fail++; console.log('NG', name, errs.join(' / '), JSON.stringify(got)); }
  else pass++;
}

// 平和ツモ 子 立直: 3翻20符 700-1300
check('立直平和ツモ', hand('23m456m789p345s99s', '1m', { tsumo: true, riichi: 1 }), { han: 3, fu: 20, ko: 700, oya: 1300, yaku: ['立直', '平和', '門前清自摸和'] });
// 立直平和ロン 子 2翻30符 2000
check('立直平和ロン', hand('23m456m789p345s99s', '4m', { riichi: 1 }), { han: 2, fu: 30, ron: 2000 });
// 七対子ロン 子 25符2翻 1600
check('七対子ロン', hand('1133m2255p88s116z', '6z'), { han: 2, fu: 25, ron: 1600, yaku: ['七対子'] });
// 同じ牌4枚は七対子にならない
check('4枚使い', hand('1133m2255p88s111z', '1z'), null);
// 親 立直平和ロン 2900
check('親 立直平和', hand('234m567m22p789s34s', '5s', { seatWind: E, riichi: 1 }), { han: 2, fu: 30, ron: 2900, yaku: ['立直', '平和'] });
check('親 タンヤオ平和', hand('234m567m22p678s34s', '5s', { seatWind: E }), { han: 2, fu: 30, ron: 2900, yaku: ['断么九', '平和'] });
// 切り上げ満貫: 子ツモ 4翻30符 2000-4000（立直ツモ タンヤオ ドラ1、嵌張待ち）
check('切り上げ満貫ツモ', hand('234m66m345p678s46s', '5s', { tsumo: true, riichi: 1, dora: parse('1m') }), { han: 4, fu: 30, ko: 2000, oya: 4000 });
// 中ポン 単騎ロン 子 1翻30符 1000
check('中のみ', hand('234m789s5s', '5s', {}, [['pon', '777z'], ['chi', '123p']]), { han: 1, fu: 30, ron: 1000 });
check('喰いタン', hand('234m567p5s678s', '5s', {}, [['chi', '345p']]), { han: 1, fu: 30, ron: 1000, yaku: ['断么九'] });
// 嵌張 立直のみ 40符 1300
check('嵌張立直', hand('123m456m789p13s99s', '2s', { riichi: 1 }), { han: 1, fu: 40, ron: 1300 });
// 四暗刻ツモ 子 8000-16000
check('四暗刻', hand('111m555p999s777z2z', '2z', { tsumo: true }), { ko: 8000, oya: 16000, yaku: ['四暗刻'] });
// シャンポンロンは四暗刻にならない（三暗刻・対々・中）
check('四暗刻崩れ', hand('111m555p999s22z77z', '7z'), { han: 5, fu: 60, ron: 8000, yaku: ['対々和', '三暗刻', '役牌 中'], noYaku: ['四暗刻'] });
// 国士無双 親ロン 48000
check('国士', hand('19m19p19s1234567z', '1m', { seatWind: E }), { ron: 48000, yaku: ['国士無双'] });
// 二盃口は七対子より優先
check('二盃口', hand('223344m556677p8s', '8s', { riichi: 1 }), { han: 5, fu: 40, ron: 8000, yaku: ['二盃口', '断么九'], noYaku: ['七対子', '一盃口'] });
// 3翻60符は切り上げ満貫（暗槓2萬16符・暗刻9索8符・嵌張2符）
check('3翻60符', hand('999s345p68m11p', '7m', { riichi: 1, ippatsu: true, dora: parse('2p') }, [['ankan', '2222m']]), { han: 3, fu: 60, ron: 8000 });
check('九蓮宝燈', hand('1112345678999m', '5m', { riichi: 1, tsumo: true }), { yaku: ['九蓮宝燈'] });
// 清一色 二盃口 平和 立直ツモ ドラ2 = 14翻で数え役満（7萬は単騎より両面に取る）
check('数え役満', hand('1122334455667m', '7m', { riichi: 1, tsumo: true, dora: parse('6m') }), { han: 14, ko: 8000, oya: 16000, yaku: ['二盃口', '清一色', '平和'] });
// 連風牌の雀頭 4符: 東場の東家、嵌張ロン、立直 → 20+10+4+2=36→40符 親2000
check('連風牌', hand('123m456p79s678s11z', '8s', { seatWind: E, riichi: 1 }), { han: 1, fu: 40, ron: 2000 });
// 赤ドラ: 立直平和タンヤオ赤 4翻30符 → 切り上げ満貫
check('赤ドラ', hand('234m067p22s678s34s', '5s', { riichi: 1 }), { han: 4, fu: 30, ron: 8000, yaku: ['赤ドラ', '平和'] });
// 役なし
check('役なし', hand('234m567p789s1s', '1s', {}, [['chi', '123p']]), null);
// ドラだけでは和了できない
check('ドラのみ', hand('234m567p789s1s', '1s', { dora: parse('9s') }, [['chi', '123p']]), null);
// 一気通貫 喰い下がり
check('一通喰い', hand('123456m2p789s', '2p', {}, [['chi', '789m']]), { han: 1, fu: 30, yaku: ['一気通貫'] });
// 混一色・対々和・中（副露）
check('ホンイツトイトイ', hand('111m999m2m', '2m', {}, [['pon', '777z'], ['pon', '333m']]), { han: 5, yaku: ['混一色', '対々和', '役牌 中'] });
// ダブ東ポン 親 2翻30符 2900
check('ダブ東', hand('234m567p789s5p', '5p', { seatWind: E }, [['pon', '111z']]), { han: 2, fu: 30, ron: 2900, yaku: ['場風 東', '自風 東'] });
// 3455m に 5m: 単騎（40符1翻）と両面（平和で30符2翻）に取れる → 高い方
check('待ちの取り方', hand('3455m234p678s789s', '5m', { riichi: 1 }), { han: 2, fu: 30, ron: 2000, yaku: ['平和'] });
// 副露して20符 → 30符
check('喰い平和形', hand('234m56p55s', '7p', {}, [['chi', '234s'], ['chi', '678s']]), { han: 1, fu: 30, ron: 1000, yaku: ['断么九'] });
check('大三元', hand('555z666z777z123m4p', '4p'), { ron: 32000, yaku: ['大三元'] });
check('緑一色', hand('234s234s666s888s6z', '6z'), { ron: 32000, yaku: ['緑一色'] });
check('小四喜', hand('111z222z333z44z99m', '9m', { tsumo: true }), { yaku: ['小四喜'] });
check('平和ツモ親', hand('23m456m789p345s99s', '4m', { tsumo: true, seatWind: E }), { han: 2, fu: 20, all: 700 });
// 中の明槓16符＋ツモ2符＋単騎2符 = 40符
check('槓子', hand('234m567p9s', '9s', { tsumo: true }, [['minkan', '7777z'], ['chi', '678s']]), { han: 1, fu: 40, ko: 400, oya: 700 });

console.log(`点数計算: ${pass} 件OK / ${fail} 件NG`);

// 生成した問題がすべて和了形で、役があり、4翻以下
for (const mode of ['practical', 'fu']) {
  const n = 3000;
  const fu = {}, style = {}, tags = {};
  let bad = 0, tsumo = 0;
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const p = M.generate(mode);
    if (!p || !p.result) { bad++; continue; }
    const counts = new Array(34).fill(0);
    for (const t of p.hand.closed.concat([p.hand.winTile], ...p.hand.melds.map(m => m.tiles), p.hand.sit.dora, p.hand.sit.ura)) counts[M.norm(t)]++;
    if (counts.some(c => c > 4) || p.hand.closed.length + 1 + p.hand.melds.length * 3 !== 14) { bad++; console.log('牌の枚数がおかしい', JSON.stringify(p.hand)); }
    if (p.result.han > 4 || p.result.yakumanMult) { bad++; console.log('5翻以上', p.result.han); }
    const ch = M.choices(p.result, p.hand.sit);
    const keys = new Set(ch.map(c => JSON.stringify(c.pay)));
    if (ch.length !== 4 || keys.size !== 4 || ch.filter(c => c.correct).length !== 1) { bad++; console.log('4択がおかしい', JSON.stringify(ch)); }
    const k = p.result.fu >= 100 ? '100+' : p.result.fu;
    fu[k] = (fu[k] || 0) + 1;
    style[p.hand.style] = (style[p.hand.style] || 0) + 1;
    for (const tg of p.result.tags) tags[tg] = (tags[tg] || 0) + 1;
    if (p.hand.sit.tsumo) tsumo++;
  }
  const pct = o => Object.entries(o).sort((a, b) => (parseInt(a[0]) || 0) - (parseInt(b[0]) || 0)).map(([k, v]) => `${k} ${(v / n * 100).toFixed(1)}%`).join(', ');
  console.log(`[${mode}] ${n}問 ${Date.now() - t0}ms  不正 ${bad}`);
  console.log('  符:', pct(fu));
  console.log('  状態:', pct(style), ` ツモ ${(tsumo / n * 100).toFixed(1)}%`);
  console.log('  分類:', Object.entries(tags).filter(([k]) => !/符$|^[親子]$|^ツモ$|^ロン$/.test(k)).map(([k, v]) => `${k} ${(v / n * 100).toFixed(0)}%`).join(', '));
  if (bad) fail++;
}
process.exit(fail ? 1 : 0);
