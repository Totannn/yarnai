# Yarn AI — Nigerian Brand Voice Engine 🇳🇬

AI content generation that doesn't just write copy — it writes copy that sounds
like it came from a brand rooted in Surulere, Aba, Kano or Enugu. The moat is
**localisation**: real Pidgin, Yoruba/Igbo/Hausa code-switching, Naira pricing,
and Nigerian consumer psychology baked into every generation.

Built with **Flask** + **Claude (`claude-opus-4-8`)**, adaptive thinking, live streaming.

## What's in this MVP

| Module | Status |
|---|---|
| **1 · Brand Voice Engine** — onboarding → stored brand profile injected into every generation | ✅ |
| **2 · Content Generation Core** — captions, product descriptions, WhatsApp/SMS, ad copy, email, blog intros | ✅ |
| **3 · Nigerian Language Layer** — Pidgin, Yoruba mix, Igbo market, Hausa/North, Lagos corporate, luxury, faith, friendly | ✅ |
| **4 · Content Calendar Builder** — Claude plans a month of posts tuned to the Naija cultural calendar; one click → finished copy | ✅ |
| Live streaming generation · multi-variant output · copy-to-clipboard · history | ✅ |
| Image pairing · analytics · A/B scoring · white-label · Paystack | 🚧 next |

## Run it (Windows)

```powershell
cd C:\Users\olatu\Documents\yarn-ai
.\run.ps1
```

Then open **http://127.0.0.1:5055**.

First run creates a virtualenv, installs deps, and (if missing) copies
`.env.example` to `.env`. Put your Anthropic API key in `.env` for real copy —
without one it runs in Demo mode.

```
ANTHROPIC_API_KEY=sk-ant-...
```

(Get a key at https://console.anthropic.com/settings/keys)

## The Content Calendar Builder

Go to **Content Calendar** in the sidebar → pick a brand, month, year and cadence
→ **Build plan**. Claude returns a month of post ideas anchored to what actually
happens in Nigeria that month (Detty December, ember-month rush, salary cycles,
public holidays, aso-ebi season…). Each card shows the day, occasion, theme, hook,
content type and tone — and **✍ Write this post** jumps to the Studio with
everything pre-filled and generates the finished copy instantly.

## How the moat works

Every generation builds a system prompt from three layers (`voice.py`):

1. **Brand block** — your stored profile (industry, audience, location,
   personality, pasted samples).
2. **Tone layer** — a tested prompt config for the chosen Nigerian voice.
3. **Context layer** — Naira pricing, the Nigerian cultural calendar, and local
   payment methods.

## Project layout

```
server.py            Flask app — generation (SSE stream) + calendar engine
voice.py             Voice engine: tone library, content templates, calendar planner
db.py                SQLite — brands, generations, calendars
templates/index.html Page shell (Tailwind + fonts via CDN, no build step)
static/app.js        Single-page studio UI (sidebar, studio, calendar, brands, history)
run.ps1              One-command launcher
```
