// ═══════════════════════════════════════════════════════════════
//
//  HL//TRACKER — app.js
//  All JavaScript for the portfolio tracker.
//
//  File structure:
//    1. API Configuration       — the URL and fetch function
//    2. Format Helpers          — number/date formatting utilities
//    3. DOM Helpers             — show/hide/class shortcuts
//    4. Loading Screen          — progress steps UI
//    5. Main Fetch Function     — lookupWallet() — runs on FETCH click
//    6. Render Function         — renderDashboard() — builds the UI from data
//    7. Event Listeners         — wires up buttons and keyboard
//
// ═══════════════════════════════════════════════════════════════


// ── 1. API CONFIGURATION ─────────────────────────────────────
//
//  THIS IS WHERE THE API IS CALLED.
//
//  Hyperliquid exposes one public POST endpoint for all data.
//  No API key required — it's fully open.
//
//  How every request works:
//    - Method:  POST
//    - URL:     https://api.hyperliquid.xyz/info
//    - Body:    JSON with a "type" field (tells the API what you want)
//    - Returns: JSON with the requested data
//
//  Full API reference:
//  https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint
//
const HL_API_URL = 'https://api.hyperliquid.xyz/info';

/**
 * callHyperliquidAPI
 * ------------------
 * The single function that talks to the Hyperliquid API.
 * Every data request in this app goes through here.
 *
 * @param {Object} requestBody  - Plain JS object matching the API schema
 * @returns {Promise<Object>}   - Parsed JSON response
 *
 * Example usage:
 *   const data = await callHyperliquidAPI({ type: 'allMids' });
 */
async function callHyperliquidAPI(requestBody) {
  const response = await fetch(HL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'  // tell the server we're sending JSON
    },
    body: JSON.stringify(requestBody)     // convert JS object → JSON string
  });

  if (!response.ok) {
    throw new Error('API responded with status ' + response.status);
  }

  return response.json();                 // parse the JSON response body
}


// ── 2. FORMAT HELPERS ─────────────────────────────────────────

/**
 * fmt — format a number to N decimal places
 * @param {*} n          - the number (or string number from API)
 * @param {number} dec   - decimal places (default 2)
 */
function fmt(n, dec = 2) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toFixed(dec);
}

/**
 * fmtUSD — format a number as a USD string with K/M suffix
 */
function fmtUSD(n) {
  if (n === null || n === undefined) return '—';
  const abs = Math.abs(Number(n));
  if (abs >= 1_000_000) return '$' + fmt(abs / 1_000_000, 2) + 'M';
  if (abs >= 1_000)     return '$' + fmt(abs / 1_000, 2) + 'K';
  return '$' + fmt(abs, 2);
}

/**
 * fmtSigned — format a number with an explicit + or - sign
 */
function fmtSigned(n) {
  if (n === null || n === undefined) return '—';
  const v = Number(n);
  return (v >= 0 ? '+' : '') + fmt(v, 2);
}

/**
 * timeAgo — convert a Unix millisecond timestamp to "Xm ago" string
 */
function timeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  if (diff < 60_000)     return Math.floor(diff / 1_000)     + 's ago';
  if (diff < 3_600_000)  return Math.floor(diff / 60_000)    + 'm ago';
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + 'h ago';
  return Math.floor(diff / 86_400_000) + 'd ago';
}


// ── 3. DOM HELPERS ────────────────────────────────────────────

function showEl(id)          { document.getElementById(id).style.display = 'block'; }
function hideEl(id)          { document.getElementById(id).style.display = 'none'; }
function addCls(id, cls)     { document.getElementById(id).classList.add(cls); }
function removeCls(id, cls)  { document.getElementById(id).classList.remove(cls); }
function setText(id, text)   { document.getElementById(id).textContent = text; }
function setHTML(id, html)   { document.getElementById(id).innerHTML = html; }


// ── 4. LOADING SCREEN ─────────────────────────────────────────

const LOAD_STEPS = [
  'connecting to hyperliquid api...',
  'fetching account state...',
  'loading perp positions...',
  'loading spot balances...',
  'fetching trade history...',
  'fetching funding payments...',
  'rendering dashboard...'
];

/**
 * setLoadStep — updates the loading screen progress bar and step list
 * @param {number} stepIndex      - which step is currently active (0-based)
 * @param {number} progressPercent- fill width for the progress bar (0-100)
 */
function setLoadStep(stepIndex, progressPercent) {
  const html = LOAD_STEPS.map((label, i) => {
    const cls    = i < stepIndex ? 'done' : i === stepIndex ? 'active' : '';
    const prefix = i < stepIndex ? '✓ ' : '';
    return `<div class="loading-step mono ${cls}">${prefix}${label}</div>`;
  }).join('');

  setHTML('loadSteps', html);
  document.getElementById('loadBar').style.width = progressPercent + '%';
}


// ── 5. MAIN FETCH FUNCTION ────────────────────────────────────

/**
 * resetView — go back to the search screen
 */
function resetView() {
  removeCls('dashboard',    'visible');
  removeCls('loadingState', 'visible');
  removeCls('errorState',   'visible');
  showEl('heroSection');
  document.getElementById('addressInput').value = '';
  removeCls('bg-pfp', 'hidden'); 
}

/**
 * tryExample — fill the input with a sample address and run the lookup
 * @param {string} address
 */
function tryExample(address) {
  document.getElementById('addressInput').value = address;
  lookupWallet();
}


async function lookupWallet() {
  const raw = document.getElementById('addressInput').value.trim();
  if (!raw || raw.length < 10) return;

  // Normalise: ensure lowercase with 0x prefix
  const address = raw.toLowerCase().startsWith('0x')
    ? raw.toLowerCase()
    : ('0x' + raw).toLowerCase();

  // Swap to loading view
  hideEl('heroSection');
  removeCls('dashboard',  'visible');
  removeCls('errorState', 'visible');
  addCls('loadingState',  'visible');
  addCls('bg-pfp', 'hidden'); 
  document.getElementById('searchBtn').disabled = true;

  try {
    setLoadStep(0, 10);

    // ── API CALLS 1, 2, 3 — fired simultaneously ──────────────
    //
    //  Promise.all sends all three requests at the same time
    //  and waits for all of them to finish before continuing.
    //  This is faster than making them one after another.
    //
    //  Request body reference:
    //
    //  "clearinghouseState"
    //    { type: 'clearinghouseState', user: '<address>' }
    //    Returns: assetPositions[], marginSummary, crossMarginSummary
    //
    //  "spotClearinghouseState"
    //    { type: 'spotClearinghouseState', user: '<address>' }
    //    Returns: balances[] (each has coin, total, hold, entryNtl)
    //
    //  "allMids"
    //    { type: 'allMids' }
    //    Returns: object mapping coin name → current mid price string
    //    e.g. { "BTC": "67420.5", "ETH": "3512.0", ... }
    //
    setLoadStep(1, 20);
    const [clearinghouseState, spotState, allMids] = await Promise.all([
      callHyperliquidAPI({ type: 'clearinghouseState',     user: address }),
      callHyperliquidAPI({ type: 'spotClearinghouseState', user: address }),
      callHyperliquidAPI({ type: 'allMids' })
    ]);

    setLoadStep(2, 40);
    setLoadStep(3, 55);

    // ── API CALL 4 — trade history ────────────────────────────
    //
    //  "userFills"
    //    { type: 'userFills', user: '<address>' }
    //    Returns: array of fill objects, newest first
    //    Each fill has: coin, side ('B'=buy/'A'=sell), px, sz,
    //                   closedPnl, time (ms timestamp), fee
    //
    setLoadStep(4, 65);
    const tradeHistory = await callHyperliquidAPI({
      type: 'userFills',
      user: address
    });

    // ── API CALL 5 — funding payment history ──────────────────
    //
    //  "userFunding"
    //    { type: 'userFunding', user: '<address>', startTime: <ms> }
    //    Returns: array of funding events
    //    Each event has: delta.coin, delta.usdc, delta.fundingRate, time
    //    Positive usdc = you received funding (good for longs in backwardation)
    //    Negative usdc = you paid funding (common for longs in contango)
    //
    setLoadStep(5, 78);
    const fundingHistory = await callHyperliquidAPI({
      type:      'userFunding',
      user:      address,
      startTime: Date.now() - 7 * 24 * 60 * 60 * 1000  // 7 days ago in ms
    });

    // ── RENDER EVERYTHING ─────────────────────────────────────
    setLoadStep(6, 92);
    await new Promise(r => setTimeout(r, 150));   // brief pause feels better

    renderDashboard(address, clearinghouseState, spotState, allMids, tradeHistory, fundingHistory);

    removeCls('loadingState', 'visible');
    addCls('dashboard', 'visible');

  } catch (err) {
    // Show error state — open browser DevTools console for full details
    removeCls('loadingState', 'visible');
    addCls('errorState', 'visible');
    setText('errorMsg', (err.message || 'Unknown error') + ' — check the address and try again.');
    console.error('HL API error:', err);
  }

  document.getElementById('searchBtn').disabled = false;
}


// ── 6. RENDER FUNCTION ────────────────────────────────────────

/**
 * renderDashboard
 * ---------------
 * Takes all the API data and builds the dashboard UI.
 *
 * @param {string} address           - the wallet address
 * @param {Object} clearinghouse     - result of clearinghouseState
 * @param {Object} spot              - result of spotClearinghouseState
 * @param {Object} mids              - result of allMids
 * @param {Array}  trades            - result of userFills
 * @param {Array}  funding           - result of userFunding
 */
function renderDashboard(address, clearinghouse, spot, mids, trades, funding) {

  // Header
  setText('dashAddr',    address);
  setText('dashUpdated', 'fetched at ' + new Date().toLocaleTimeString());

  // ── Extract key values from clearinghouseState ────────────
  //
  //  assetPositions[] — one entry per asset that has or had a position
  //  We filter out szi === 0 (these are closed positions that still appear)
  //
  const positions      = (clearinghouse.assetPositions || [])
    .filter(p => p.position && Number(p.position.szi) !== 0);

  const marginSummary  = clearinghouse.marginSummary || {};
  const accountValue   = Number(marginSummary.accountValue    || 0);
  const totalNotional  = Number(marginSummary.totalNtlPos     || 0);
  const totalMarginUsed= Number(marginSummary.totalMarginUsed || 0);

  const totalUnrealizedPnl = positions.reduce(
    (sum, p) => sum + Number(p.position.unrealizedPnl || 0), 0
  );

  // ── Stat cards ────────────────────────────────────────────
  const stats = [
    { label: 'ACCOUNT VALUE',  value: fmtUSD(accountValue),   cls: '' },
    { label: 'TOTAL NOTIONAL', value: fmtUSD(totalNotional),  cls: '' },
    {
      label: 'UNREALIZED PNL',
      value: (totalUnrealizedPnl >= 0 ? '+' : '') + fmtUSD(totalUnrealizedPnl),
      cls:   totalUnrealizedPnl >= 0 ? 'green' : 'red'
    },
    { label: 'MARGIN USED',    value: fmtUSD(totalMarginUsed),          cls: '' },
    { label: 'OPEN POSITIONS', value: String(positions.length),
      cls: positions.length > 0 ? 'green' : '' },
    { label: 'RECENT TRADES',  value: String((trades || []).length),    cls: '' },
  ];

  setHTML('statsGrid', stats.map(s => `
    <div class="stat-card">
      <div class="stat-label mono">${s.label}</div>
      <div class="stat-value mono ${s.cls}">${s.value}</div>
    </div>
  `).join(''));

  // ── PnL bar ───────────────────────────────────────────────
  if (positions.length > 0) {
    const profitTotal = positions
      .filter(p => Number(p.position.unrealizedPnl) > 0)
      .reduce((s, p) => s + Number(p.position.unrealizedPnl), 0);

    const lossTotal = Math.abs(positions
      .filter(p => Number(p.position.unrealizedPnl) < 0)
      .reduce((s, p) => s + Number(p.position.unrealizedPnl), 0));

    const total = profitTotal + lossTotal;
    if (total > 0) {
      addCls('pnlBarWrap', 'visible');
      document.getElementById('pnlBarProfit').style.width = (profitTotal / total * 100).toFixed(1) + '%';
      document.getElementById('pnlBarLoss').style.width   = (lossTotal   / total * 100).toFixed(1) + '%';
    }
  }

  // ── Perp positions ────────────────────────────────────────
  //
  //  Each position object (p.position) has:
  //    coin          — asset name e.g. "BTC"
  //    szi           — size as a string (positive = long, negative = short)
  //    entryPx       — average entry price as a string
  //    unrealizedPnl — current floating PnL as a string
  //    liquidationPx — liquidation price (null if no liquidation risk)
  //    marginUsed    — collateral locked for this position
  //
  if (positions.length > 0) {
    addCls('posSection', 'visible');
    setText('posCount', positions.length);

    setHTML('posBody', positions.map(p => {
      const pos       = p.position;
      const size      = Number(pos.szi);
      const side      = size > 0 ? 'LONG' : 'SHORT';
      const sideCls   = size > 0 ? 'long' : 'short';
      const upnl      = Number(pos.unrealizedPnl || 0);
      const markPrice = Number(mids[pos.coin] || 0);
      const liqPrice  = pos.liquidationPx ? '$' + fmt(Number(pos.liquidationPx), 2) : '—';

      return `<tr>
        <td><span class="pos-coin">${pos.coin}-PERP</span></td>
        <td><span class="pos-side ${sideCls} mono">${side}</span></td>
        <td class="mono">${fmt(Math.abs(size), 4)}</td>
        <td class="mono text-muted">$${fmt(Number(pos.entryPx || 0), 2)}</td>
        <td class="mono">$${fmt(markPrice, 2)}</td>
        <td class="mono text-muted">${liqPrice}</td>
        <td class="mono">${pos.marginUsed ? fmtUSD(Number(pos.marginUsed)) : '—'}</td>
        <td class="mono ${upnl >= 0 ? 'text-green' : 'text-red'}">
          ${fmtSigned(upnl)} (${fmtUSD(Math.abs(upnl))})
        </td>
      </tr>`;
    }).join(''));
  }

  // ── Spot balances ─────────────────────────────────────────
  //
  //  spot.balances[] — each entry has:
  //    coin   — token name e.g. "USDC", "BTC"
  //    total  — total amount held (string)
  //    hold   — amount locked in open orders (string)
  //
  //  USD value = total × mids[coin]
  //  USDC is a stablecoin so its price is always 1
  //
  const spotBalances = (spot.balances || []).filter(b => Number(b.total) > 0);
  if (spotBalances.length > 0) {
    addCls('spotSection', 'visible');
    setText('spotCount', spotBalances.length);

    setHTML('spotGrid', spotBalances.map(b => {
      const price  = b.coin === 'USDC' ? 1 : Number(mids[b.coin] || 0);
      const usdVal = Number(b.total) * price;
      return `<div class="bal-card">
        <div class="bal-token mono">${b.coin}</div>
        <div class="bal-amount mono">${fmt(Number(b.total), 4)}</div>
        ${usdVal > 0 ? `<div class="bal-usd mono">${fmtUSD(usdVal)}</div>` : ''}
      </div>`;
    }).join(''));
  }

  // ── Trade history ─────────────────────────────────────────
  //
  //  trades[] — each fill object has:
  //    coin       — asset traded
  //    side       — 'B' (buy) or 'A' (sell/ask)
  //    px         — fill price (string)
  //    sz         — fill size (string)
  //    closedPnl  — realised PnL if this closed a position, else '0'
  //    time       — Unix timestamp in milliseconds
  //    fee        — fee paid in USDC (string)
  //
  const recentTrades = (trades || []).slice(0, 20);
  if (recentTrades.length > 0) {
    addCls('histSection', 'visible');
    setText('histCount', recentTrades.length);

    setHTML('histList', recentTrades.map(t => {
      const side      = t.side === 'B' ? 'buy' : 'sell';
      const closedPnl = t.closedPnl ? Number(t.closedPnl) : null;
      const pnlHTML   = closedPnl !== null
        ? `<span class="${closedPnl >= 0 ? 'text-green' : 'text-red'} mono">${fmtSigned(closedPnl)}</span>`
        : '';

      return `<div class="hist-row">
        <span class="hist-coin mono">${t.coin || '—'}</span>
        <span class="hist-type ${side} mono">${side.toUpperCase()}</span>
        <span class="hist-price mono">$${fmt(Number(t.px || 0), 2)} × ${fmt(Number(t.sz || 0), 4)}</span>
        ${pnlHTML}
        <span class="hist-time mono">${t.time ? timeAgo(t.time) : ''}</span>
      </div>`;
    }).join(''));
  }

  // ── Funding payments ──────────────────────────────────────
  //
  //  funding[] — each event has a delta object:
  //    delta.coin        — which perp this funding was for
  //    delta.usdc        — USDC amount (positive = received, negative = paid)
  //    delta.fundingRate — the rate that was applied (multiply by 100 for %)
  //    time              — Unix timestamp in milliseconds
  //
  const fundRows = (funding || []).slice(0, 15);
  if (fundRows.length > 0) {
    addCls('fundSection', 'visible');
    setText('fundCount', fundRows.length);

    setHTML('fundList', fundRows.map(f => {
      const usdc = Number(f.delta?.usdc || 0);
      const rate = Number(f.delta?.fundingRate || 0) * 100;

      return `<div class="hist-row">
        <span class="hist-coin mono">${f.delta?.coin || '—'}</span>
        <span class="hist-type funding mono">FUNDING</span>
        <span class="mono text-muted">rate: ${fmt(rate, 4)}%</span>
        <span class="mono ${usdc >= 0 ? 'text-green' : 'text-red'}">${fmtSigned(usdc)} USDC</span>
        <span class="hist-time mono">${f.time ? timeAgo(f.time) : ''}</span>
      </div>`;
    }).join(''));
  }

} // end renderDashboard()


// ── 7. EVENT LISTENERS ────────────────────────────────────────

// FETCH button
document.getElementById('searchBtn').addEventListener('click', lookupWallet);

// Press Enter in the input field
document.getElementById('addressInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') lookupWallet();
});

// Back / reset buttons
document.getElementById('newSearchBtn').addEventListener('click', resetView);
document.getElementById('tryAgainBtn').addEventListener('click', resetView);

// Example address chips
document.querySelectorAll('.ex-addr').forEach(el => {
  el.addEventListener('click', () => {
    tryExample(el.dataset.address);
  });
});
