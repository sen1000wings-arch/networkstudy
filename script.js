'use strict';

/* ============================================================
   誤り検出符号を学ぼう — script.js
   3つの独立したモジュール（パリティ／チェックサム／CRC）＋
   タブ切り替え＋まとめクイズ で構成。
   ============================================================ */

/* ---------- 共通ユーティリティ ---------- */

function el(tag, opts = {}) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text !== undefined) node.textContent = opts.text;
  if (opts.attrs) {
    Object.entries(opts.attrs).forEach(([k, v]) => node.setAttribute(k, v));
  }
  return node;
}

function randomBits(length) {
  return Array.from({ length }, () => (Math.random() < 0.5 ? 0 : 1));
}

function countOnes(bits) {
  return bits.reduce((sum, b) => sum + b, 0);
}

/* ============================================================
   タブナビゲーション
   ============================================================ */

function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const sections = document.querySelectorAll('[data-section]');

  function goTo(name) {
    tabButtons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.tab === name);
    });
    sections.forEach((sec) => {
      sec.classList.toggle('is-active', sec.id === name);
    });
    document.querySelector('.site-header').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => goTo(btn.dataset.tab));
  });

  document.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () => goTo(btn.dataset.goto));
  });

  window.appGoTo = goTo;
}

/* ============================================================
   はじめに：ノイズ演出だけの簡易デモ
   ============================================================ */

function initIntro() {
  const senderEl = document.getElementById('introSenderBits');
  const receiverEl = document.getElementById('introReceiverBits');
  const btn = document.getElementById('introNoiseBtn');

  let bits = randomBits(6);

  function render() {
    senderEl.innerHTML = '';
    receiverEl.innerHTML = '';
    bits.forEach((b, i) => {
      const s = el('div', { className: 'bit', text: String(b), attrs: { 'data-value': b } });
      senderEl.appendChild(s);
      const r = el('div', { className: 'bit', text: String(b), attrs: { 'data-value': b } });
      receiverEl.appendChild(r);
    });
  }

  btn.addEventListener('click', () => {
    const receiverBits = document.querySelectorAll('#introReceiverBits .bit');
    const idx = Math.floor(Math.random() * bits.length);
    const flippedValue = bits[idx] ^ 1;
    receiverBits[idx].textContent = String(flippedValue);
    receiverBits[idx].dataset.value = String(flippedValue);
    receiverBits[idx].classList.add('is-flipped');
  });

  render();
}

/* ============================================================
   1. パリティチェック
   ============================================================ */

function initParity() {
  const DATA_LEN = 7;
  let dataBits = randomBits(DATA_LEN);
  let mode = 'even'; // 'even' | 'odd'
  let receivedBits = null; // 8ビット（データ+パリティ）を受信側で操作する

  const dataBitsEl = document.getElementById('parityDataBits');
  const codewordEl = document.getElementById('parityCodeword');
  const explainEl = document.getElementById('parityExplain');
  const receivedEl = document.getElementById('parityReceivedBits');
  const resultEl = document.getElementById('parityResult');
  const modeButtons = document.querySelectorAll('[data-parity-mode]');

  function computeParityBit(bits) {
    const ones = countOnes(bits);
    if (mode === 'even') {
      return ones % 2 === 0 ? 0 : 1;
    }
    return ones % 2 === 0 ? 1 : 0;
  }

  function codeword() {
    return dataBits.concat([computeParityBit(dataBits)]);
  }

  function resetTransmission() {
    receivedBits = codeword().slice();
    renderReceived();
    renderResult(null);
  }

  function renderDataBits() {
    dataBitsEl.innerHTML = '';
    dataBits.forEach((b, i) => {
      const btn = el('button', {
        className: 'bit',
        text: String(b),
        attrs: { type: 'button', 'data-value': b, 'aria-label': `ビット${i + 1}: ${b}` },
      });
      btn.addEventListener('click', () => {
        dataBits[i] = dataBits[i] ? 0 : 1;
        renderDataBits();
        renderCodeword();
        resetTransmission();
      });
      dataBitsEl.appendChild(btn);
    });
  }

  function renderCodeword() {
    codewordEl.innerHTML = '';
    const cw = codeword();
    cw.forEach((b, i) => {
      const isParity = i === cw.length - 1;
      const cls = 'bit' + (isParity ? ' is-parity' : '');
      const node = el('div', { className: cls, text: String(b), attrs: { 'data-value': b } });
      codewordEl.appendChild(node);
    });
    const ones = countOnes(dataBits);
    const modeLabel = mode === 'even' ? '偶数' : '奇数';
    explainEl.textContent =
      `データの1の個数 = ${ones} → パリティビットを ${cw[cw.length - 1]} にすると、全体の1の個数は ${countOnes(cw)}（${modeLabel}）になります。`;
  }

  function renderReceived() {
    receivedEl.innerHTML = '';
    receivedBits.forEach((b, i) => {
      const btn = el('button', {
        className: 'bit',
        text: String(b),
        attrs: { type: 'button', 'data-value': b, 'aria-label': `受信ビット${i + 1}: ${b}` },
      });
      const originalValue = codeword()[i];
      if (b !== originalValue) btn.classList.add('is-flipped');
      btn.addEventListener('click', () => {
        receivedBits[i] = receivedBits[i] ? 0 : 1;
        renderReceived();
        judge();
      });
      receivedEl.appendChild(btn);
    });
  }

  function renderResult(state) {
    const icon = resultEl.querySelector('.result-banner__icon');
    const text = resultEl.querySelector('.result-banner__text');
    if (state === null) {
      resultEl.dataset.state = 'neutral';
      icon.textContent = '–';
      text.textContent = '受信データのビットをクリックすると、判定結果がここに表示されます。';
      return;
    }
    const original = codeword();
    const flippedCount = receivedBits.filter((b, i) => b !== original[i]).length;

    if (flippedCount === 0) {
      resultEl.dataset.state = 'ok';
      icon.textContent = '✓';
      text.textContent = '誤りなし：受信データはそのまま届いています。';
      return;
    }

    const ones = countOnes(receivedBits);
    const parityOk = mode === 'even' ? ones % 2 === 0 : ones % 2 === 1;

    if (!parityOk) {
      resultEl.dataset.state = 'error-detected';
      icon.textContent = '!';
      text.textContent = `誤りを検出しました（実際に反転したビット数：${flippedCount}）。パリティの偶奇が合いません。`;
    } else {
      resultEl.dataset.state = 'missed';
      icon.textContent = '?';
      text.textContent = `誤りを見逃しました（実際に反転したビット数：${flippedCount}）。1の個数の偶奇はたまたま元と一致しています。`;
    }
  }

  function judge() {
    renderResult('judge');
  }

  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.parityMode;
      modeButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
      renderCodeword();
      resetTransmission();
    });
  });

  document.getElementById('parityReset').addEventListener('click', () => {
    dataBits = randomBits(DATA_LEN);
    renderDataBits();
    renderCodeword();
    resetTransmission();
  });

  document.getElementById('parityFlipTwo').addEventListener('click', () => {
    if (receivedBits.length < 2) return;
    const indices = [...receivedBits.keys()];
    const i1 = indices[Math.floor(Math.random() * indices.length)];
    let i2 = indices[Math.floor(Math.random() * indices.length)];
    while (i2 === i1) i2 = indices[Math.floor(Math.random() * indices.length)];
    receivedBits[i1] ^= 1;
    receivedBits[i2] ^= 1;
    renderReceived();
    judge();
  });

  renderDataBits();
  renderCodeword();
  resetTransmission();
}

/* ============================================================
   2. 水平垂直パリティ（2次元パリティ）
   ============================================================ */

function initHVParity() {
  const SIZE = 4;

  let dataMatrix = randomMatrix(SIZE);
  let receivedGrid = null;

  const dataGridEl = document.getElementById('hvDataGrid');
  const codewordGridEl = document.getElementById('hvCodewordGrid');
  const receivedGridEl = document.getElementById('hvReceivedGrid');
  const resultEl = document.getElementById('hvResult');

  function randomMatrix(n) {
    return Array.from({ length: n }, () => randomBits(n));
  }

  // データ行列から (n+1)×(n+1) の送信用グリッドを作る。
  // 末尾の列＝各行の偶数パリティ、末尾の行＝各列の偶数パリティ、
  // 右下の角＝末尾の行（＝各列パリティ）自身の偶数パリティ。
  function computeGrid(matrix) {
    const n = matrix.length;
    const grid = Array.from({ length: n + 1 }, () => new Array(n + 1).fill(0));
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) grid[r][c] = matrix[r][c];
    }
    for (let r = 0; r < n; r++) {
      const ones = grid[r].slice(0, n).reduce((a, b) => a + b, 0);
      grid[r][n] = ones % 2 === 0 ? 0 : 1;
    }
    for (let c = 0; c <= n; c++) {
      let ones = 0;
      for (let r = 0; r < n; r++) ones += grid[r][c];
      grid[n][c] = ones % 2 === 0 ? 0 : 1;
    }
    return grid;
  }

  function codewordGrid() {
    return computeGrid(dataMatrix);
  }

  // 受け取ったグリッドについて、各行・各列の偶数パリティが崩れていないか調べる。
  function checkGrid(grid) {
    const n = SIZE;
    const badRows = [];
    const badCols = [];
    for (let r = 0; r <= n; r++) {
      const ones = grid[r].reduce((a, b) => a + b, 0);
      if (ones % 2 !== 0) badRows.push(r);
    }
    for (let c = 0; c <= n; c++) {
      let ones = 0;
      for (let r = 0; r <= n; r++) ones += grid[r][c];
      if (ones % 2 !== 0) badCols.push(c);
    }
    return { badRows, badCols };
  }

  function renderDataGrid() {
    const n = SIZE;
    dataGridEl.innerHTML = '';
    dataGridEl.style.gridTemplateColumns = `repeat(${n}, auto)`;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const v = dataMatrix[r][c];
        const btn = el('button', {
          className: 'bit',
          text: String(v),
          attrs: { type: 'button', 'data-value': v, 'aria-label': `${r + 1}行${c + 1}列: ${v}` },
        });
        btn.addEventListener('click', () => {
          dataMatrix[r][c] = dataMatrix[r][c] ? 0 : 1;
          renderDataGrid();
          renderCodewordGrid();
          resetTransmission();
        });
        dataGridEl.appendChild(btn);
      }
    }
  }

  function renderCodewordGrid() {
    const n = SIZE;
    const grid = codewordGrid();
    codewordGridEl.innerHTML = '';
    codewordGridEl.style.gridTemplateColumns = `repeat(${n + 1}, auto)`;
    for (let r = 0; r <= n; r++) {
      for (let c = 0; c <= n; c++) {
        const isParityCell = r === n || c === n;
        const cls = 'bit' + (isParityCell ? ' is-parity' : '');
        codewordGridEl.appendChild(
          el('div', { className: cls, text: String(grid[r][c]), attrs: { 'data-value': grid[r][c] } })
        );
      }
    }
  }

  function resetTransmission() {
    receivedGrid = codewordGrid().map((row) => row.slice());
    renderReceivedGrid();
    renderResult(null);
  }

  function renderReceivedGrid() {
    const n = SIZE;
    const original = codewordGrid();
    const { badRows, badCols } = checkGrid(receivedGrid);
    const located = badRows.length === 1 && badCols.length === 1 ? { r: badRows[0], c: badCols[0] } : null;

    receivedGridEl.innerHTML = '';
    receivedGridEl.style.gridTemplateColumns = `repeat(${n + 2}, auto)`;

    for (let r = 0; r <= n; r++) {
      for (let c = 0; c <= n; c++) {
        const isParityCell = r === n || c === n;
        const isLocated = located && located.r === r && located.c === c;
        const v = receivedGrid[r][c];
        const cls = ['bit'];
        if (isParityCell) cls.push('is-parity');
        if (v !== original[r][c]) cls.push('is-flipped');
        if (isLocated) cls.push('is-located');
        const btn = el('button', {
          className: cls.join(' '),
          text: String(v),
          attrs: { type: 'button', 'data-value': v, 'aria-label': `受信 ${r + 1}行${c + 1}列: ${v}` },
        });
        btn.addEventListener('click', () => {
          receivedGrid[r][c] = receivedGrid[r][c] ? 0 : 1;
          renderReceivedGrid();
          judge();
        });
        receivedGridEl.appendChild(btn);
      }
      const rowBad = badRows.includes(r);
      receivedGridEl.appendChild(
        el('div', { className: 'bit matrix-status ' + (rowBad ? 'is-bad' : 'is-ok'), text: rowBad ? '✗' : '✓' })
      );
    }
    for (let c = 0; c <= n; c++) {
      const colBad = badCols.includes(c);
      receivedGridEl.appendChild(
        el('div', { className: 'bit matrix-status ' + (colBad ? 'is-bad' : 'is-ok'), text: colBad ? '✗' : '✓' })
      );
    }
    receivedGridEl.appendChild(el('div', { className: 'bit matrix-blank' }));
  }

  function judge() {
    renderResult('judge');
  }

  function renderResult(state) {
    const icon = resultEl.querySelector('.result-banner__icon');
    const text = resultEl.querySelector('.result-banner__text');

    if (state === null) {
      resultEl.dataset.state = 'neutral';
      icon.textContent = '–';
      text.textContent = '受信データのビットをクリックすると、判定結果がここに表示されます。';
      return;
    }

    const original = codewordGrid();
    let flippedCount = 0;
    for (let r = 0; r <= SIZE; r++) {
      for (let c = 0; c <= SIZE; c++) {
        if (receivedGrid[r][c] !== original[r][c]) flippedCount++;
      }
    }

    if (flippedCount === 0) {
      resultEl.dataset.state = 'ok';
      icon.textContent = '✓';
      text.textContent = '誤りなし：受信データはそのまま届いています。';
      return;
    }

    const { badRows, badCols } = checkGrid(receivedGrid);

    if (badRows.length === 0 && badCols.length === 0) {
      resultEl.dataset.state = 'missed';
      icon.textContent = '?';
      text.textContent = `誤りを見逃しました（実際に反転したビット数：${flippedCount}）。すべての行・列のパリティがたまたま一致してしまっています。`;
      return;
    }

    if (badRows.length === 1 && badCols.length === 1) {
      resultEl.dataset.state = 'error-detected';
      icon.textContent = '!';
      text.textContent = `誤りを検出し、位置まで特定できました：${badRows[0] + 1}行目 × ${badCols[0] + 1}列目のビットです（オレンジ色のマス）。もう一度クリックすれば訂正できます。`;
      return;
    }

    resultEl.dataset.state = 'error-detected';
    icon.textContent = '!';
    text.textContent = `誤りを検出しました（反転したビット数：${flippedCount}）。ただし複数の行・列で不一致が起きているため、どのビットが誤りかまでは特定できません。`;
  }

  document.getElementById('hvReset').addEventListener('click', () => {
    dataMatrix = randomMatrix(SIZE);
    renderDataGrid();
    renderCodewordGrid();
    resetTransmission();
  });

  document.getElementById('hvRectangleDemo').addEventListener('click', () => {
    const pick2 = () => {
      const pool = [0, 1, 2, 3];
      const i1 = Math.floor(Math.random() * pool.length);
      const v1 = pool.splice(i1, 1)[0];
      const i2 = Math.floor(Math.random() * pool.length);
      const v2 = pool.splice(i2, 1)[0];
      return [v1, v2];
    };
    const [r1, r2] = pick2();
    const [c1, c2] = pick2();
    [[r1, c1], [r1, c2], [r2, c1], [r2, c2]].forEach(([r, c]) => {
      receivedGrid[r][c] ^= 1;
    });
    renderReceivedGrid();
    judge();
  });

  renderDataGrid();
  renderCodewordGrid();
  resetTransmission();
}

/* ============================================================
   3. チェックサム
   ============================================================ */

function initChecksum() {
  const BLOCK_COUNT = 4;
  let blocks = Array.from({ length: BLOCK_COUNT }, () => Math.floor(Math.random() * 200) + 10);
  let receivedBlocks = null;
  let receivedChecksum = null;

  const blocksEl = document.getElementById('checksumBlocks');
  const calcSumEl = document.getElementById('checksumCalcSum');
  const calcValueEl = document.getElementById('checksumCalcValue');
  const sendBlocksEl = document.getElementById('checksumSendBlocks');
  const receivedBlocksEl = document.getElementById('checksumReceivedBlocks');
  const verifySumEl = document.getElementById('checksumVerifySum');
  const resultEl = document.getElementById('checksumResult');

  function computeChecksum(bs) {
    const sum = bs.reduce((a, b) => a + b, 0) % 256;
    return sum === 0 ? 0 : 256 - sum;
  }

  function resetTransmission() {
    receivedBlocks = blocks.slice();
    receivedChecksum = computeChecksum(blocks);
    renderReceived();
    renderResult(null);
  }

  function renderBlocks() {
    blocksEl.innerHTML = '';
    blocks.forEach((v, i) => {
      const btn = el('button', { className: 'block', attrs: { type: 'button' } });
      btn.innerHTML = '';
      btn.appendChild(document.createTextNode(String(v)));
      btn.appendChild(el('small', { text: `ブロック${i + 1}` }));
      btn.addEventListener('click', () => {
        blocks[i] = (blocks[i] + 37) % 256; // クリックのたびに規則的に変化させ編集を体験させる
        renderBlocks();
        renderCalc();
        resetTransmission();
      });
      blocksEl.appendChild(btn);
    });
  }

  function renderCalc() {
    const sum = blocks.reduce((a, b) => a + b, 0);
    const mod = sum % 256;
    const checksum = computeChecksum(blocks);
    calcSumEl.textContent = `合計 = ${blocks.join(' + ')} = ${sum}　（256で割った余り：${mod}）`;
    calcValueEl.textContent = `チェックサム = 256 − ${mod} = ${checksum}（0〜255の範囲に収める）`;

    sendBlocksEl.innerHTML = '';
    blocks.forEach((v, i) => {
      const b = el('div', { className: 'block' });
      b.appendChild(document.createTextNode(String(v)));
      b.appendChild(el('small', { text: `ブロック${i + 1}` }));
      sendBlocksEl.appendChild(b);
    });
    const cs = el('div', { className: 'block is-checksum' });
    cs.appendChild(document.createTextNode(String(checksum)));
    cs.appendChild(el('small', { text: 'チェックサム' }));
    sendBlocksEl.appendChild(cs);
  }

  function renderReceived() {
    receivedBlocksEl.innerHTML = '';
    receivedBlocks.forEach((v, i) => {
      const btn = el('button', { className: 'block', attrs: { type: 'button' } });
      btn.appendChild(document.createTextNode(String(v)));
      btn.appendChild(el('small', { text: `ブロック${i + 1}` }));
      if (v !== blocks[i]) btn.classList.add('is-flipped');
      btn.addEventListener('click', () => {
        receivedBlocks[i] = (receivedBlocks[i] + 1) % 256; // 通信ノイズ：1だけ増やす
        renderReceived();
        judge();
      });
      receivedBlocksEl.appendChild(btn);
    });
    const cs = el('div', { className: 'block is-checksum', text: String(receivedChecksum) });
    cs.appendChild(el('small', { text: 'チェックサム' }));
    receivedBlocksEl.appendChild(cs);
  }

  function renderResult(state) {
    const icon = resultEl.querySelector('.result-banner__icon');
    const text = resultEl.querySelector('.result-banner__text');
    const total = receivedBlocks.reduce((a, b) => a + b, 0) + receivedChecksum;
    verifySumEl.textContent = `検証：ブロックの合計 + チェックサム = ${total} → 256で割った余り = ${total % 256}`;

    if (state === null) {
      resultEl.dataset.state = 'neutral';
      icon.textContent = '–';
      text.textContent = '受信ブロックの数値をクリックすると、判定結果がここに表示されます。';
      return;
    }

    const changed = receivedBlocks.some((v, i) => v !== blocks[i]);
    if (!changed) {
      resultEl.dataset.state = 'ok';
      icon.textContent = '✓';
      text.textContent = '誤りなし：受信データはそのまま届いています。';
      return;
    }

    if (total % 256 === 0) {
      resultEl.dataset.state = 'missed';
      icon.textContent = '?';
      text.textContent = '誤りを見逃しました。データは変化していますが、合計値のつじつまが偶然合ってしまっています。';
    } else {
      resultEl.dataset.state = 'error-detected';
      icon.textContent = '!';
      text.textContent = '誤りを検出しました。合計値が256の倍数になりません。';
    }
  }

  function judge() {
    renderResult('judge');
  }

  document.getElementById('checksumReset').addEventListener('click', () => {
    blocks = Array.from({ length: BLOCK_COUNT }, () => Math.floor(Math.random() * 200) + 10);
    renderBlocks();
    renderCalc();
    resetTransmission();
  });

  document.getElementById('checksumCancelDemo').addEventListener('click', () => {
    if (blocks[0] >= 254) blocks[0] = 200;
    if (blocks[1] <= 1) blocks[1] = 50;
    receivedBlocks = blocks.slice();
    receivedBlocks[0] = (receivedBlocks[0] + 1) % 256;
    receivedBlocks[1] = (receivedBlocks[1] - 1 + 256) % 256;
    renderReceived();
    judge();
  });

  renderBlocks();
  renderCalc();
  resetTransmission();
}

/* ============================================================
   4. CRC（巡回冗長検査）
   ============================================================ */

const CRC_GENERATORS = [
  { label: '1011（3次）', bits: [1, 0, 1, 1] },
  { label: '1101（3次）', bits: [1, 1, 0, 1] },
  { label: '10011（4次・CRC-4類似）', bits: [1, 0, 0, 1, 1] },
  { label: '11001（4次）', bits: [1, 1, 0, 0, 1] },
];

function crcDivide(inputBits, generator) {
  const bits = inputBits.slice();
  const gLen = generator.length;
  const steps = [];
  for (let i = 0; i <= bits.length - gLen; i++) {
    const leading = bits[i];
    const windowBefore = bits.slice(i, i + gLen);
    if (leading === 1) {
      for (let j = 0; j < gLen; j++) {
        bits[i + j] = bits[i + j] ^ generator[j];
      }
    }
    steps.push({
      index: i,
      leading,
      windowBefore,
      windowAfter: bits.slice(i, i + gLen),
      fullState: bits.slice(),
    });
  }
  const remainder = bits.slice(bits.length - (gLen - 1));
  return { steps, remainder };
}

function initCrc() {
  const DATA_LEN = 8;
  let dataBits = randomBits(DATA_LEN);
  let generator = CRC_GENERATORS[0];
  let receivedBits = null;

  const dataBitsEl = document.getElementById('crcDataBits');
  const genGroupEl = document.getElementById('crcGeneratorGroup');
  const stepsEl = document.getElementById('crcSteps');
  const toggleBtn = document.getElementById('crcToggleSteps');
  const codewordEl = document.getElementById('crcCodeword');
  const remainderNoteEl = document.getElementById('crcRemainderNote');
  const receivedEl = document.getElementById('crcReceivedBits');
  const resultEl = document.getElementById('crcResult');

  function paddedData() {
    return dataBits.concat(new Array(generator.bits.length - 1).fill(0));
  }

  function encodeResult() {
    return crcDivide(paddedData(), generator.bits);
  }

  function codeword() {
    return dataBits.concat(encodeResult().remainder);
  }

  function renderGenerators() {
    genGroupEl.innerHTML = '';
    CRC_GENERATORS.forEach((g) => {
      const btn = el('button', {
        className: 'segmented__btn' + (g === generator ? ' is-active' : ''),
        text: g.label,
        attrs: { type: 'button' },
      });
      btn.addEventListener('click', () => {
        generator = g;
        renderGenerators();
        renderAll();
      });
      genGroupEl.appendChild(btn);
    });
  }

  function renderDataBits() {
    dataBitsEl.innerHTML = '';
    dataBits.forEach((b, i) => {
      const btn = el('button', {
        className: 'bit',
        text: String(b),
        attrs: { type: 'button', 'data-value': b, 'aria-label': `ビット${i + 1}: ${b}` },
      });
      btn.addEventListener('click', () => {
        dataBits[i] = dataBits[i] ? 0 : 1;
        renderAll();
      });
      dataBitsEl.appendChild(btn);
    });
  }

  function bitsToSpans(bits, options = {}) {
    const wrap = el('span', { className: 'crc-step-line__bits' });
    bits.forEach((b, i) => {
      const s = el('span', { text: String(b) });
      if (options.windowStart !== undefined && i >= options.windowStart && i < options.windowStart + options.windowLen) {
        s.classList.add('win');
      } else {
        s.classList.add('dim');
      }
      wrap.appendChild(s);
    });
    return wrap;
  }

  function renderSteps() {
    const { steps, remainder } = encodeResult();
    stepsEl.innerHTML = '';

    const introLine = el('div', { className: 'crc-step-line' });
    introLine.appendChild(el('span', { className: 'crc-step-line__label', text: '割られる数' }));
    introLine.appendChild(bitsToSpans(paddedData(), {}));
    stepsEl.appendChild(introLine);

    const genLine = el('div', { className: 'crc-step-line' });
    genLine.appendChild(el('span', { className: 'crc-step-line__label', text: '生成多項式' }));
    const genSpan = el('span', { className: 'crc-step-line__bits' });
    generator.bits.forEach((b) => {
      const s = el('span', { text: String(b), className: 'gen' });
      genSpan.appendChild(s);
    });
    genLine.appendChild(genSpan);
    stepsEl.appendChild(genLine);

    steps.forEach((step, idx) => {
      const line = el('div', { className: 'crc-step-line' });
      const label = step.leading === 1 ? `手順${idx + 1}：XORする` : `手順${idx + 1}：そのまま`;
      line.appendChild(el('span', { className: 'crc-step-line__label', text: label }));
      line.appendChild(bitsToSpans(step.fullState, { windowStart: step.index, windowLen: generator.bits.length }));
      stepsEl.appendChild(line);
    });

    const remLine = el('div', { className: 'crc-remainder-line' });
    remLine.textContent = `余り（CRC符号）= ${remainder.join('')}`;
    stepsEl.appendChild(remLine);
  }

  function renderCodeword() {
    codewordEl.innerHTML = '';
    const cw = codeword();
    const remLen = generator.bits.length - 1;
    cw.forEach((b, i) => {
      const isCrcPart = i >= cw.length - remLen;
      const cls = 'bit' + (isCrcPart ? ' is-parity' : '');
      codewordEl.appendChild(el('div', { className: cls, text: String(b), attrs: { 'data-value': b } }));
    });
    remainderNoteEl.textContent = `データ ${dataBits.join('')} の末尾に CRC符号 ${encodeResult().remainder.join('')} を付け加えて送信します（Pのマークがついたビット）。`;
  }

  function resetTransmission() {
    receivedBits = codeword().slice();
    renderReceived();
    renderResult(null);
  }

  function renderReceived() {
    receivedEl.innerHTML = '';
    const original = codeword();
    receivedBits.forEach((b, i) => {
      const btn = el('button', {
        className: 'bit',
        text: String(b),
        attrs: { type: 'button', 'data-value': b, 'aria-label': `受信ビット${i + 1}: ${b}` },
      });
      if (b !== original[i]) btn.classList.add('is-flipped');
      btn.addEventListener('click', () => {
        receivedBits[i] = receivedBits[i] ? 0 : 1;
        renderReceived();
        judge();
      });
      receivedEl.appendChild(btn);
    });
  }

  function renderResult(state) {
    const icon = resultEl.querySelector('.result-banner__icon');
    const text = resultEl.querySelector('.result-banner__text');

    if (state === null) {
      resultEl.dataset.state = 'neutral';
      icon.textContent = '–';
      text.textContent = '受信データのビットをクリックすると、判定結果がここに表示されます。';
      return;
    }

    const original = codeword();
    const flippedCount = receivedBits.filter((b, i) => b !== original[i]).length;
    const { remainder } = crcDivide(receivedBits, generator.bits);
    const remainderIsZero = remainder.every((b) => b === 0);

    if (flippedCount === 0) {
      resultEl.dataset.state = 'ok';
      icon.textContent = '✓';
      text.textContent = `誤りなし：受信コードワードを生成多項式で割った余りは ${remainder.join('')} です。`;
      return;
    }

    if (!remainderIsZero) {
      resultEl.dataset.state = 'error-detected';
      icon.textContent = '!';
      text.textContent = `誤りを検出しました（反転したビット数：${flippedCount}）。割った余りが ${remainder.join('')} となり、0になりません。`;
    } else {
      resultEl.dataset.state = 'missed';
      icon.textContent = '?';
      text.textContent = `誤りを見逃しました（反転したビット数：${flippedCount}）。偶然にも割った余りが0になっています。CRCでも100%は防げません。`;
    }
  }

  function judge() {
    renderResult('judge');
  }

  function renderAll() {
    renderDataBits();
    renderSteps();
    renderCodeword();
    resetTransmission();
  }

  toggleBtn.addEventListener('click', () => {
    const isHidden = stepsEl.hasAttribute('hidden');
    if (isHidden) {
      stepsEl.removeAttribute('hidden');
      toggleBtn.setAttribute('aria-expanded', 'true');
      toggleBtn.textContent = '計算過程（XOR割り算）を隠す ▴';
    } else {
      stepsEl.setAttribute('hidden', '');
      toggleBtn.setAttribute('aria-expanded', 'false');
      toggleBtn.textContent = '計算過程（XOR割り算）を表示する ▾';
    }
  });

  document.getElementById('crcReset').addEventListener('click', () => {
    dataBits = randomBits(DATA_LEN);
    renderAll();
  });

  renderGenerators();
  renderAll();
}

/* ============================================================
   まとめクイズ
   ============================================================ */

const QUIZ_QUESTIONS = [
  {
    q: 'パリティチェックで「偶数パリティ」を使う場合、パリティビットを含めた全体のビット列の1の個数はどうなりますか。',
    options: ['必ず偶数になる', '必ず奇数になる', 'データによって変わる', '常に0になる'],
    correct: 0,
    explain: '偶数パリティでは、パリティビットを調整して1の個数の合計が必ず偶数になるようにします。',
  },
  {
    q: 'パリティチェックが見逃してしまう可能性が高い誤りはどれですか。',
    options: [
      '1ビットだけが反転する誤り',
      '3ビットが同時に反転する誤り',
      '2ビットが同時に反転する誤り',
      '誤りはどんな場合でも見逃さない',
    ],
    correct: 2,
    explain: '偶数個のビットが反転すると1の個数の偶奇は元通りになるため、パリティチェックでは検出できません。',
  },
  {
    q: '水平垂直パリティ（2次元パリティ）が、単純なパリティチェックより優れている点はどれですか。',
    options: [
      '1ビットの誤りであれば、その場所を特定して訂正できる場合がある',
      '計算がまったく不要になる',
      'どんな誤りでも100%検出できる',
      '送るデータの量を減らせる',
    ],
    correct: 0,
    explain: '行と列の両方でパリティを調べることで、不一致になった行と列の交点から誤りビットの位置を特定できる場合があります。',
  },
  {
    q: '水平垂直パリティが誤りを完全に見逃してしまうのはどのような場合ですか。',
    options: [
      '1ビットだけが反転した場合',
      '表の中の長方形の4つの角にあたる4ビットが同時に反転した場合',
      '誤りが1つも起きなかった場合',
      '水平垂直パリティは絶対に見逃さない',
    ],
    correct: 1,
    explain: '長方形の4隅が同時に反転すると、関係する各行・各列でちょうど2ビットずつ変化するため、すべての行・列のパリティチェックが一致してしまい見逃します。',
  },
  {
    q: 'チェックサムの基本的な考え方として正しいものはどれですか。',
    options: [
      'データを暗号化して送る',
      'データのブロックを合計し、その値の整合性を検証する',
      '生成多項式で割り算をする',
      '1ビットだけを検査する',
    ],
    correct: 1,
    explain: 'チェックサムはデータをブロックに分けて合計し、合計値のつじつまが合うかどうかで誤りを検出します。',
  },
  {
    q: 'チェックサムが誤りを見逃してしまうのはどのような場合ですか。',
    options: [
      'すべてのブロックが変化しない場合',
      '1つのブロックの値が大きく変化した場合',
      '複数のブロックの増減が打ち消し合い、合計値が変わらない場合',
      'チェックサムは絶対に見逃さない',
    ],
    correct: 2,
    explain: '合計値さえ一致すれば検査を通過してしまうため、増減が打ち消し合うような誤りのパターンには弱いという特徴があります。',
  },
  {
    q: 'CRC（巡回冗長検査）で使われている演算はどれですか。',
    options: ['通常の足し算', 'XOR（排他的論理和）を使った割り算', '掛け算', '平方根の計算'],
    correct: 1,
    explain: 'CRCはデータを2進数とみなし、XORを使った割り算の余りを検査用のビットとして利用します。',
  },
  {
    q: '受信側がCRCで誤りを検出する方法として正しいものはどれですか。',
    options: [
      '受信したコードワードを生成多項式で割り、余りが0でなければ誤りと判断する',
      '受信データの合計を求めて偶奇を調べる',
      'データの長さが変わっていないか調べるだけ',
      '受信データをそのまま信じて何もしない',
    ],
    correct: 0,
    explain: '受信したコードワード（データ＋CRC符号）を同じ生成多項式で割り、余りが0であれば誤りなしと判断します。',
  },
  {
    q: '一般的に、実際の通信（Ethernetや無線LANなど）でもっとも広く使われている誤り検出方式はどれですか。',
    options: ['パリティチェックのみ', 'チェックサムのみ', 'CRC（巡回冗長検査）', 'どれも使われていない'],
    correct: 2,
    explain: 'CRCは連続した誤り（バースト誤り）にも強く、検出できる誤りの範囲が広いため、実際の通信で広く採用されています。',
  },
];

function initQuiz() {
  const formEl = document.getElementById('quizForm');
  const submitBtn = document.getElementById('quizSubmit');
  const retryBtn = document.getElementById('quizRetry');
  const scoreEl = document.getElementById('quizScore');

  function render() {
    formEl.innerHTML = '';
    QUIZ_QUESTIONS.forEach((item, qi) => {
      const wrap = el('div', { className: 'quiz-item', attrs: { 'data-q': qi } });
      wrap.appendChild(el('p', { className: 'quiz-item__q', text: `第${qi + 1}問　${item.q}` }));
      const optsWrap = el('div', { className: 'quiz-item__options' });
      item.options.forEach((optText, oi) => {
        const label = el('label', { className: 'quiz-option' });
        const input = el('input', { attrs: { type: 'radio', name: `q${qi}`, value: oi } });
        label.appendChild(input);
        label.appendChild(document.createTextNode(optText));
        optsWrap.appendChild(label);
      });
      wrap.appendChild(optsWrap);
      const explain = el('p', { className: 'quiz-item__explain', text: `正解：${item.options[item.correct]}。${item.explain}` });
      wrap.appendChild(explain);
      formEl.appendChild(wrap);
    });
  }

  function grade() {
    let score = 0;
    const items = formEl.querySelectorAll('.quiz-item');
    let unanswered = 0;

    items.forEach((itemEl, qi) => {
      const selected = itemEl.querySelector(`input[name="q${qi}"]:checked`);
      itemEl.classList.add('is-graded');
      itemEl.classList.remove('is-correct', 'is-incorrect');
      if (!selected) {
        unanswered++;
        return;
      }
      const value = Number(selected.value);
      if (value === QUIZ_QUESTIONS[qi].correct) {
        itemEl.classList.add('is-correct');
        score++;
      } else {
        itemEl.classList.add('is-incorrect');
      }
    });

    scoreEl.hidden = false;
    const icon = scoreEl.querySelector('.result-banner__icon');
    const text = scoreEl.querySelector('.result-banner__text');

    if (unanswered > 0) {
      scoreEl.dataset.state = 'missed';
      icon.textContent = '?';
      text.textContent = `未回答の問題が${unanswered}問あります。すべての問題に答えてから採点してください（回答済みの問題のみ採点しています）。`;
    } else if (score === QUIZ_QUESTIONS.length) {
      scoreEl.dataset.state = 'ok';
      icon.textContent = '✓';
      text.textContent = `全問正解です！（${score} / ${QUIZ_QUESTIONS.length}）3つの誤り検出符号の考え方をしっかり理解できています。`;
    } else {
      scoreEl.dataset.state = 'error-detected';
      icon.textContent = '!';
      text.textContent = `${score} / ${QUIZ_QUESTIONS.length} 問正解でした。間違えた問題は解説を読んで、該当セクションを見直してみましょう。`;
    }

    submitBtn.hidden = true;
    retryBtn.hidden = false;
  }

  submitBtn.addEventListener('click', grade);
  retryBtn.addEventListener('click', () => {
    render();
    scoreEl.hidden = true;
    submitBtn.hidden = false;
    retryBtn.hidden = true;
  });

  render();
}

/* ============================================================
   初期化
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initIntro();
  initParity();
  initHVParity();
  initChecksum();
  initCrc();
  initQuiz();
});
