/* 牌の絵柄（SVG）。一般的な牌のデザインに合わせる
 *   萬子: 漢数字＋赤い「萬」 / 筒子: 丸の並び / 索子: 竹の棒（1索は鳥） / 字牌: 文字（白は枠）
 * 牌番号は mahjong.js と同じ（0-8 萬・9-17 筒・18-26 索・27-33 字牌、34-36 赤5）
 * 色は CSS の --tb（青）--tg（緑）--tr（赤）--tk（墨）を使う */
(function (global) {
'use strict';

// 何度も使う部品。<use> で色（currentColor）だけ変えて並べる
const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
<symbol id="tf-dot" viewBox="-10 -10 20 20"><circle r="9.4" fill="currentColor"/><circle r="6.3" fill="none" stroke="#fff" stroke-width="1.7"/><circle r="2.7" fill="#fff"/><circle r="1.3" fill="currentColor"/></symbol>
<symbol id="tf-stick" viewBox="0 0 6 14" preserveAspectRatio="none"><rect x=".4" y=".2" width="5.2" height="13.6" rx="2.2" fill="currentColor"/><path d="M3 1.6V5.9M3 8.1V12.4" stroke="#fff" stroke-width=".9" stroke-linecap="round" opacity=".55"/><path d="M.9 7H5.1" stroke="#fff" stroke-width=".8" opacity=".75"/></symbol>
</defs></svg>`;

const KANJI = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const B = 'tb', G = 'tg', R = 'tr';

// 筒子: [x, y, 色] と丸の半径
const PIN = {
  2: [6.4, [[15, 11, G], [15, 29, B]]],
  3: [5.8, [[8, 9, B], [15, 20, R], [22, 31, G]]],
  4: [6.0, [[9, 11, B], [21, 11, G], [9, 29, G], [21, 29, B]]],
  5: [5.4, [[8, 8.5, B], [22, 8.5, G], [15, 20, R], [8, 31.5, G], [22, 31.5, B]]],
  6: [4.9, [[9, 7.5, G], [21, 7.5, G], [9, 21, R], [21, 21, R], [9, 32.5, R], [21, 32.5, R]]],
  7: [4.3, [[7, 6, G], [15, 10, G], [23, 14, G], [9.5, 23.5, R], [20.5, 23.5, R], [9.5, 33.5, R], [20.5, 33.5, R]]],
  8: [4.3, [9, 21].flatMap(x => [6.8, 15.6, 24.4, 33.2].map(y => [x, y, B]))],
  9: [4.3, [[9, B], [20, R], [31, G]].flatMap(([y, c]) => [6.5, 15, 23.5].map(x => [x, y, c]))],
};

// 索子: [x, y, 色, 傾き] と棒の幅・高さ（x, y は棒の中心）
const SOU = {
  2: [6.6, 14, [[15, 10.5, G], [15, 29.5, G]]],
  3: [6.6, 14, [[15, 10.5, G], [9, 29.5, G], [21, 29.5, G]]],
  4: [6.6, 14, [[9, 10.5, G], [21, 10.5, G], [9, 29.5, G], [21, 29.5, G]]],
  5: [6, 12.5, [[7, 9, G], [23, 9, G], [15, 20, R], [7, 31, G], [23, 31, G]]],
  6: [6, 14, [7, 15, 23].flatMap(x => [[x, 10.5, G], [x, 29.5, G]])],
  7: [5.8, 11.6, [[15, 6.5, R]].concat([7, 15, 23].flatMap(x => [[x, 20, G], [x, 33, G]]))],
  // 8索は上が「八」の字、下が逆向き
  8: [4.8, 14, [[4.4, 10.5, G, 0], [11.6, 10.5, G, 22], [18.4, 10.5, G, -22], [25.6, 10.5, G, 0],
    [4.4, 29.5, G, 0], [11.6, 29.5, G, -22], [18.4, 29.5, G, 22], [25.6, 29.5, G, 0]]],
  9: [5.8, 11.6, [7, 20, 33].flatMap(y => [7, 15, 23].map((x, i) => [x, y, i === 1 ? R : G]))],
};

const BIRD = `<g>
<path d="M7 31c3-9 3.5-16 9-19.5 3.6-2.3 7.6-.9 8 2.6.5 3.8-2.5 6.4-4.6 8.6-3.2 3.4-6.8 6.5-12.4 8.3z" class="fg"/>
<path d="M11 27c2.6-3.4 4.6-7.6 8.2-10.6" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>
<path d="M14 22c2.2-1 4.4-2.8 5.8-4.6" fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".55"/>
<circle cx="21" cy="11.5" r="3.6" class="fr"/><circle cx="21.9" cy="10.8" r=".9" fill="#fff"/>
<path d="M24.3 11.2l3.4.9-3.2 1.3z" class="fk"/>
<path d="M19.5 8.2l-1.2-3.4M21 7.9l.2-3.6M22.5 8.3l1.6-3.1" stroke="var(--tr)" stroke-width="1" stroke-linecap="round"/>
<path d="M8 30.5l-5 6.5M9.5 31.2l-2.8 7.4M11.3 31.2l-.6 7.6" stroke="var(--tb)" stroke-width="1.7" stroke-linecap="round"/>
<path d="M15.5 27.5l-.8 4.5M18 26l.6 4.4" stroke="var(--tr)" stroke-width="1" stroke-linecap="round"/>
</g>`;

const PIN1 = `<circle cx="15" cy="20" r="12.5" class="fg"/><circle cx="15" cy="20" r="10" fill="#fff"/>
<circle cx="15" cy="20" r="8.6" class="fb"/><circle cx="15" cy="20" r="6.2" fill="#fff"/>
<circle cx="15" cy="20" r="4.8" class="fr"/><circle cx="15" cy="20" r="1.8" fill="#fff"/>
${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<circle cx="${(15 + 11.25 * Math.cos(a * Math.PI / 180)).toFixed(2)}" cy="${(20 + 11.25 * Math.sin(a * Math.PI / 180)).toFixed(2)}" r=".7" class="fr"/>`).join('')}`;

function face(t, red) {
  let body;
  if (t >= 27) {
    const ch = '東南西北白發中'[t - 27];
    if (t === 31) body = '<rect x="6" y="7" width="18" height="26" rx="1.5" fill="none" stroke="var(--tb)" stroke-width="2.2"/><rect x="9" y="10" width="12" height="20" rx="1" fill="none" stroke="var(--tb)" stroke-width=".8"/>';
    else body = `<text x="15" y="29" text-anchor="middle" font-size="24" class="tx ${t === 32 ? 'fg' : t === 33 ? 'fr' : 'fk'}">${ch}</text>`;
  } else {
    const suit = Math.floor(t / 9), n = t % 9 + 1;
    if (suit === 0) {
      body = `<text x="15" y="17" text-anchor="middle" font-size="16" class="tx ${red ? 'fr' : 'fk'}">${KANJI[n - 1]}</text>`
        + `<text x="15" y="36.5" text-anchor="middle" font-size="16" class="tx fr">萬</text>`;
    } else if (suit === 1) {
      if (n === 1) body = PIN1;
      else {
        const [r, dots] = PIN[n];
        body = dots.map(([x, y, c]) => `<use href="#tf-dot" x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" class="${red ? R : c}"/>`).join('');
      }
    } else {
      if (n === 1) body = BIRD;
      else {
        const [w, h, sticks] = SOU[n];
        body = sticks.map(([x, y, c, rot]) => {
          const tr = rot ? ` transform="rotate(${rot} ${x} ${y})"` : '';
          return `<use href="#tf-stick" x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" class="${red ? R : c}"${tr}/>`;
        }).join('');
      }
    }
  }
  return `<svg class="face" viewBox="0 0 30 40" aria-hidden="true" focusable="false">${body}</svg>`;
}

global.TileFace = { DEFS, face };
})(typeof window !== 'undefined' ? window : globalThis);
