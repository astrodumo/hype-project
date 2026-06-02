# HL//TRACKER

> A clean, real-time portfolio tracker for any wallet on the Hyperliquid network.

![Static Badge](https://img.shields.io/badge/built_on-Hyperliquid-3aff8a?style=flat-square)
![Static Badge](https://img.shields.io/badge/auth-none_required-3aff8a?style=flat-square)
![Static Badge](https://img.shields.io/badge/stack-HTML_%2F_CSS_%2F_JS-blue?style=flat-square)

---

# What it does

Paste any Hyperliquid wallet address and instantly see:

- *Perp Positions* — asset, side (long/short), size, entry price, mark price, liquidation price, margin, and unrealized PnL
- **Spot Balances** — all token holdings with live USD values
- *Recent Trades* — last 20 fills with closed PnL per trade
- **Funding Payments** — last 7 days of funding received or paid
- *Account Summary* — total account value, notional exposure, margin used, and a profit/loss split bar

No login. No API key. No wallet connection. Fully read-only.

---

## Preview

```
HL//TRACKER
Track any wallet on Hyperliquid.
Perps · Spot · PnL · History — all onchain, no auth.
```

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) (LTS version recommended)

### Run locally

```bash
# 1. Clone the repo
git clone https://github.com/yourusername/hl-tracker.git
cd hl-tracker

# 2. Start the local server
node server.js

# 3. Open in browser
# http://localhost:3000
```

No `npm install` needed. Zero dependencies.

---

## Project structure

```
hl-tracker/
├── index.html      # markup and layout
├── style.css       # all styles
├── app.js          # API calls, data rendering, interactions
├── server.js       # lightweight local dev server (Node built-ins only)
└── images/
    └── pfp.jpg     # background image (homepage only)
```

---

## How the API works

All data comes from the [Hyperliquid public Info API](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint) — a single POST endpoint that requires no authentication.

```
POST https://api.hyperliquid.xyz/info
```

The app makes 5 calls per lookup:

| Request type | What it returns |
|---|---|
| `clearinghouseState` | Perp positions, margin summary, account value |
| `spotClearinghouseState` | Spot token balances |
| `allMids` | Live mid prices for all assets |
| `userFills` | Full trade history |
| `userFunding` | Funding payment history |

All API calls are in `app.js` inside the `lookupWallet()` function, each with inline comments explaining the request and response shape.

---

## Built with

- Vanilla HTML, CSS, JavaScript — no framework, no build step
- [Hyperliquid Public API](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api)
- [Space Mono](https://fonts.google.com/specimen/Space+Mono) + [DM Sans](https://fonts.google.com/specimen/DM+Sans) via Google Fonts

---

## Roadmap

- [ ] PnL chart over time
- [ ] Shareable wallet URL (e.g. `/wallet/0x...`)
- [ ] Multiple wallet comparison
- [ ] Funding rate monitor page
- [ ] Next.js + TypeScript migration

---

## License

MIT
