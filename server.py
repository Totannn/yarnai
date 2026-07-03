"""
Vertil — Flask server.

Multi-tenant: email/password auth (sessions), per-user brands/generations/
calendars/favorites, per-plan usage limits, a voice-learning feedback loop, and
Paystack checkout. Generation streams from Claude (claude-opus-4-8) over SSE.
"""

from __future__ import annotations

import datetime
import functools
import hashlib
import hmac
import json
import os
import secrets
import time

import httpx
from dotenv import load_dotenv
from flask import (Flask, Response, jsonify, redirect, render_template,
                   request, session, stream_with_context)
from werkzeug.security import check_password_hash, generate_password_hash

# Load .env BEFORE importing db — db reads DATABASE_URL at import time, so the
# env must be populated first (matters when config comes from a .env file).
load_dotenv()

import db
import voice

API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
LIVE = bool(API_KEY) and not API_KEY.startswith("sk-ant-xxxx")
PAYSTACK_SECRET = os.getenv("PAYSTACK_SECRET_KEY", "").strip()
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
MAIL_FROM = os.getenv("MAIL_FROM", "Vertil <onboarding@resend.dev>").strip()

# --------------------------------------------------------------------------- #
# Two-tier models. Standard is the fast, cost-efficient default; Premium is the
# top-quality model, gated to higher plans. The Nigerian voice lives in the
# prompts (voice.py), so Standard still produces strong, on-brand copy.
# --------------------------------------------------------------------------- #
MODELS = {
    "standard": {"id": "claude-sonnet-4-6", "label": "Standard", "sub": "Sonnet 4.6 · fast"},
    "premium":  {"id": "claude-opus-4-8",  "label": "Premium ✨", "sub": "Opus 4.8 · best"},
}
MODEL = MODELS["premium"]["id"]  # back-compat / display default


def resolve_quality(requested: str, user) -> str:
    """Clamp the requested quality to what the user's plan allows."""
    if requested == "premium" and plan_of(user).get("premium"):
        return "premium"
    return "standard"


def model_kwargs(model_id: str, effort: str = "medium") -> dict:
    """Per-model extra params. Adaptive thinking + effort are Opus-4.8 features;
    other models are called plainly to avoid unsupported-parameter errors."""
    if model_id == "claude-opus-4-8":
        return {"thinking": {"type": "adaptive"}, "output_config": {"effort": effort}}
    return {}

# --------------------------------------------------------------------------- #
# Plans — prices in Naira/month. Paystack charges price * 100 (kobo).
# gen_limit None = unlimited (fair use). calendar = is the planner available.
# --------------------------------------------------------------------------- #
PLANS = {
    "free": {
        "name": "Free", "price": 0, "gen_limit": 10, "brands": 1, "calendar": False,
        "blurb": "Kick the tyres",
        "features": ["10 generations / month", "1 brand voice", "All 8 tones", "Pidgin + English"],
    },
    "starter": {
        "name": "Starter", "price": 7500, "gen_limit": 150, "brands": 1, "calendar": False,
        "blurb": "Solo hustler",
        "features": ["150 generations / month", "1 brand voice", "All tones & content types", "Save favourites"],
    },
    "growth": {
        "name": "Growth", "price": 19000, "gen_limit": 600, "brands": 3, "calendar": True,
        "blurb": "Serious SME", "popular": True,
        "features": ["600 generations / month", "3 brand voices", "Content Calendar builder", "Voice that learns 👍"],
    },
    "pro": {
        "name": "Pro", "price": 45000, "gen_limit": None, "brands": 10, "calendar": True,
        "blurb": "Power user / team",
        "features": ["Unlimited generations", "10 brand voices", "Everything in Growth", "Priority generation"],
    },
}
PLAN_ORDER = ["free", "starter", "growth", "pro"]

# Per-million-token prices (USD) → used to compute Naira AI spend for the admin view.
PRICES = {
    "claude-opus-4-8": (5.0, 25.0),
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-haiku-4-5": (1.0, 5.0),
}
NGN_PER_USD = float(os.getenv("NGN_PER_USD", "1600"))
ADMIN_EMAILS = {e.strip().lower() for e in os.getenv("ADMIN_EMAILS", "demo@yarn.ai").split(",") if e.strip()}


def cost_naira(model_id: str, in_tok: int, out_tok: int) -> float:
    pin, pout = PRICES.get(model_id, PRICES["claude-opus-4-8"])
    return round((in_tok * pin + out_tok * pout) / 1_000_000 * NGN_PER_USD, 4)


def is_admin(user) -> bool:
    return bool(user) and (user.get("email", "").lower() in ADMIN_EMAILS)


app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "yarn-ai-dev-secret-change-me")
_client = None


def get_client():
    global _client
    if not LIVE:
        return None
    if _client is None:
        import anthropic
        _client = anthropic.Anthropic(api_key=API_KEY)
    return _client


with app.app_context():
    for _attempt in range(6):
        try:
            db.init_db()
            break
        except Exception as _e:  # DB may not be reachable for a moment at boot
            print(f"[Vertil] DB init failed (attempt {_attempt + 1}/6): {_e}", flush=True)
            if _attempt == 5:
                raise
            time.sleep(3)
    print(f"[Vertil] storage = {'PostgreSQL' if db.IS_PG else 'SQLite (' + str(db.DB_PATH) + ')'}", flush=True)


@app.get("/healthz")
def healthz():
    return jsonify({"ok": True, "storage": "postgres" if db.IS_PG else "sqlite", "ai_live": LIVE})


# ------------------------------- auth helpers ----------------------------- #

def current_user():
    uid = session.get("uid")
    return db.get_user(uid) if uid else None


def auth(fn):
    @functools.wraps(fn)
    def wrapper(*a, **kw):
        user = current_user()
        if not user:
            return jsonify({"error": "auth_required"}), 401
        return fn(user, *a, **kw)
    return wrapper


def admin(fn):
    @functools.wraps(fn)
    def wrapper(*a, **kw):
        user = current_user()
        if not user:
            return jsonify({"error": "auth_required"}), 401
        if not is_admin(user):
            return jsonify({"error": "forbidden"}), 403
        return fn(user, *a, **kw)
    return wrapper


def user_public(user) -> dict:
    """User dict for client responses, with the admin flag attached."""
    return {**user, "is_admin": is_admin(user)}


def plan_of(user) -> dict:
    return PLANS.get(user.get("plan", "free"), PLANS["free"])


def usage_payload(user) -> dict:
    p = plan_of(user)
    used = db.monthly_generation_count(user["id"])
    return {
        "plan": user.get("plan", "free"),
        "plan_name": p["name"],
        "used": used,
        "limit": p["gen_limit"],
        "brands_used": db.count_brands(user["id"]),
        "brands_limit": p["brands"],
        "calendar": p["calendar"],
    }


# ------------------------------- pages ------------------------------------ #

@app.get("/")
def landing():
    return render_template("landing.html")


@app.get("/app")
def index():
    return render_template("index.html", live=LIVE, model=MODEL)


@app.get("/reset")
def reset_page():
    # The SPA detects the /reset path + ?token and shows the reset form.
    return render_template("index.html", live=LIVE, model=MODEL)


@app.get("/admin")
def admin_page():
    return render_template("admin.html")


@app.get("/favicon.ico")
def favicon():
    from flask import send_from_directory
    return send_from_directory(app.static_folder, "favicon.svg", mimetype="image/svg+xml")


# --------------------------- PWA (installable app) ------------------------- #

_MANIFEST = {
    "name": "Vertil — Nigerian brand voice engine",
    "short_name": "Vertil",
    "description": "On-brand content for Nigerian businesses and creators — captions, ads, WhatsApp, scripts and more.",
    "start_url": "/app",
    "scope": "/",
    "display": "standalone",
    "orientation": "portrait",
    "background_color": "#0c2724",
    "theme_color": "#0e9488",
    "icons": [
        {"src": "/static/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
        {"src": "/static/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
        {"src": "/static/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
    ],
}

# Network-first service worker. Never touches /api or non-GET requests, so SSE
# streaming, auth and POSTs are unaffected; just enables install + offline shell.
_SERVICE_WORKER = """
const CACHE = 'vertil-v1';
const SHELL = ['/app', '/static/app.js', '/manifest.webmanifest', '/static/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(()=>{})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{}); return res; })
      .catch(() => caches.match(req).then(r => r || caches.match('/app')))
  );
});
"""


# Digital Asset Links — verifies the Android TWA so it opens with no URL bar.
_ASSETLINKS = [{
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
        "namespace": "android_app",
        "package_name": "ng.vertil.twa",
        "sha256_cert_fingerprints": [
            "D2:5E:73:D8:5B:D1:1F:1C:01:15:1D:86:53:94:9A:2E:3C:AA:6B:84:C7:F1:70:21:74:9A:FC:3C:44:4C:21:09"
        ],
    },
}]


@app.get("/.well-known/assetlinks.json")
def assetlinks():
    return app.response_class(json.dumps(_ASSETLINKS), mimetype="application/json")


@app.get("/manifest.webmanifest")
def manifest():
    return app.response_class(json.dumps(_MANIFEST), mimetype="application/manifest+json")


@app.get("/sw.js")
def service_worker():
    resp = app.response_class(_SERVICE_WORKER, mimetype="application/javascript")
    resp.headers["Service-Worker-Allowed"] = "/"
    resp.headers["Cache-Control"] = "no-cache"
    return resp


@app.get("/api/config")
def config():
    return jsonify({
        "live": LIVE, "model": MODEL,
        "tones": voice.list_tones(),
        "content_types": voice.list_content_types(),
        "cadences": voice.list_cadences(),
        "refine_presets": [{"key": k, "label": k.replace("_", " ").title()} for k in voice.REFINE_PRESETS],
        "plans": [{"key": k, **PLANS[k]} for k in PLAN_ORDER],
        "paystack": bool(PAYSTACK_SECRET),
        "google_client_id": GOOGLE_CLIENT_ID,
        "advisor_options": voice.advisor_options(),
        "script_options": voice.script_options(),
    })


# ------------------------------- home ------------------------------------- #

_VOICE_COLORS = ["#0e9488", "#2dd4bf", "#0c7a70", "#7cc9bf", "#b7791f", "#cbd5d2"]


@app.get("/api/home")
@auth
def home(user):
    o = db.home_overview(user["id"])
    tone_label = {t["key"]: t["label"] for t in voice.list_tones()}
    lbl_type = lambda k: _TYPE_LABELS.get(k, (k or "").replace("_", " ").title())
    lbl_tone = lambda k: tone_label.get(k, (k or "").replace("_", " ").title())

    # 14-day activity array (UTC days, oldest → newest) to match db's _DAY
    day_n = {d["d"]: d["n"] for d in o["daily"]}
    today = datetime.datetime.utcnow().date()
    activity_14d = [day_n.get((today - datetime.timedelta(days=13 - i)).isoformat(), 0) for i in range(14)]

    # streak: consecutive active days ending today or yesterday
    active = set(o["active_days"])
    streak = 0
    cur = today if today.isoformat() in active else today - datetime.timedelta(days=1)
    while cur.isoformat() in active:
        streak += 1
        cur -= datetime.timedelta(days=1)

    # days until the start of next calendar month (the "resets in" framing)
    nxt = (today.replace(day=28) + datetime.timedelta(days=4)).replace(day=1)
    resets_in_days = (nxt - today).days

    total_voice = sum(t["n"] for t in o["by_tone"]) or 1
    voice_mix = [{"name": lbl_tone(t["tone"]), "pct": round(t["n"] / total_voice * 100),
                  "color": _VOICE_COLORS[i % len(_VOICE_COLORS)]} for i, t in enumerate(o["by_tone"])]
    content_types = [{"name": lbl_type(t["content_type"]), "count": t["n"]} for t in o["by_type"]]
    top_voice = voice_mix[0]["name"] if voice_mix else None

    recent = [{"type": lbl_type(r["content_type"]), "tone": lbl_tone(r["tone"]),
               "brief": r.get("brief") or "", "brand": r.get("brand_name") or "",
               "content_type": r["content_type"], "at": r["created_at"]} for r in o["recent"]]

    delta = (round((o["month"] - o["prev_month"]) / o["prev_month"] * 100) if o["prev_month"]
             else (100 if o["month"] else 0))
    days_active = len({d["d"] for d in o["daily"]}) or 1
    kpis = {
        "generations": o["month"], "saved_copy": o["saved"], "brand_voices": o["brands"],
        "avg_per_day": round(o["month"] / days_active, 1),
        "delta_generations": delta,
    }

    # "Jump back in" cards
    cont = []
    lg = o["last_gen"]
    if lg:
        cont.append({"kind": "resume", "title": f"{lbl_type(lg['content_type'])} · {lbl_tone(lg['tone'])}",
                     "preview": (lg.get("brief") or "")[:120], "brand": lg.get("brand_name") or "",
                     "brand_id": lg.get("brand_id"), "content_type": lg["content_type"], "tone": lg["tone"]})
    lc = o["last_calendar"]
    if lc:
        try:
            posts = json.loads(lc.get("posts") or "[]")
        except Exception:
            posts = []
        cont.append({"kind": "plan", "title": f"{lc.get('month','')} {lc.get('year','')}".strip(),
                     "preview": f"{len(posts)} posts mapped to the Naija calendar.",
                     "cal_id": lc["id"], "posts": len(posts)})
    tb = o["thin_brand"]
    if tb:
        cont.append({"kind": "brand", "title": f"Finish “{tb['name']}” voice",
                     "preview": "Add samples so this brand sounds even more like itself.",
                     "brand_id": tb["id"]})

    p = plan_of(user)
    return jsonify({
        "streak": streak,
        "summary": {"pieces_month": o["month"], "brands_count": o["brands"], "top_voice": top_voice},
        "usage": {"used": db.monthly_generation_count(user["id"]), "limit": p["gen_limit"],
                  "resets_in_days": resets_in_days},
        "kpis": kpis, "activity_14d": activity_14d,
        "voice_mix": voice_mix, "content_types": content_types,
        "recent": recent, "continue": cont,
        "gig": {"earned": db.gig_summary(user["id"])["earned"], "count": db.gig_summary(user["id"])["count"]},
    })


# Nigerian cultural moments, computed in WAT (UTC+1) so they match users' clocks.
_STATIC_SUGGEST = {
    "payday": {"idea": "Drop a 'payday treat' bundle — an affordable small luxury for the week salary lands.", "tone": "pidgin", "type": "instagram_caption"},
    "indep":  {"idea": "Tie your product to Naija pride — green-white-green, made-in-Nigeria excellence.", "tone": "lagos_corporate", "type": "ad_copy"},
    "school": {"idea": "Run a resumption bundle for parents kitting their kids out for the new term.", "tone": "friendly", "type": "whatsapp_broadcast"},
    "bf":     {"idea": "Tease your Black Friday deal early to build a 'notify me' waitlist.", "tone": "pidgin", "type": "whatsapp_broadcast"},
    "detty":  {"idea": "Kick off Detty December with a festive flash sale — owambe-ready picks.", "tone": "yoruba_mix", "type": "instagram_caption"},
    "val":    {"idea": "Pitch a Valentine gifting bundle for the bae who has everything.", "tone": "luxury", "type": "ad_copy"},
}


def _naija_events():
    wat = (datetime.datetime.utcnow() + datetime.timedelta(hours=1)).date()

    def annual(m, d):
        dt = datetime.date(wat.year, m, d)
        return dt if dt >= wat else datetime.date(wat.year + 1, m, d)

    def monthly(d):
        try:
            dt = datetime.date(wat.year, wat.month, d)
        except ValueError:
            dt = datetime.date(wat.year, wat.month, 28)
        if dt >= wat:
            return dt
        y, mo = (wat.year + 1, 1) if wat.month == 12 else (wat.year, wat.month + 1)
        return datetime.date(y, mo, d)

    events = [
        {"key": "payday", "name": "Payday week", "blurb": "Salaries land — shoppers have cash to spend.", "date": monthly(28)},
        {"key": "indep", "name": "Independence Day", "blurb": "Green-white-green pride — lean local & proud.", "date": annual(10, 1)},
        {"key": "school", "name": "Back-to-school", "blurb": "Resumption rush — parents are kitting kids out.", "date": annual(9, 9)},
        {"key": "bf", "name": "Black Friday", "blurb": "The biggest sale day — build the waitlist now.", "date": annual(11, 27)},
        {"key": "detty", "name": "Detty December", "blurb": "Peak festive spending, all month long.", "date": annual(12, 1)},
        {"key": "val", "name": "Valentine", "blurb": "Love, treats and last-minute gifting.", "date": annual(2, 14)},
    ]
    for e in events:
        e["days"] = (e["date"] - wat).days
    events.sort(key=lambda e: e["days"])
    return events, wat.isoformat()


def _days_label(d):
    return "Today" if d == 0 else "Tomorrow" if d == 1 else f"in {d} days"


@app.get("/api/suggestion")
@auth
def suggestion(user):
    """Today's bespoke post idea for this user's brand + the nearest cultural
    moment. Generated once with Claude, then cached per user/day/moment."""
    events, day = _naija_events()
    try:
        idx = int(request.args.get("idx", 0))
    except (TypeError, ValueError):
        idx = 0
    ev = events[idx % len(events)]
    try:
        brand_id = int(request.args.get("brand_id")) if request.args.get("brand_id") else None
    except (TypeError, ValueError):
        brand_id = None

    s = db.get_suggestion(user["id"], day, ev["key"], brand_id)
    if not (s and s.get("idea")):
        profile = db.get_brand(user["id"], brand_id) if brand_id else None
        out = None
        client = get_client()
        if client is not None:
            try:
                with client.messages.stream(
                    model=MODEL, max_tokens=400, thinking={"type": "adaptive"},
                    output_config={"effort": "low"},
                    system=voice.build_suggestion_system(profile),
                    messages=[{"role": "user", "content": voice.build_suggestion_user(
                        ev["name"], ev["blurb"], _days_label(ev["days"]))}],
                ) as st:
                    text = "".join(st.text_stream)
                out = voice.parse_suggestion_json(text)
            except Exception:
                out = None
        if not out:
            fb = _STATIC_SUGGEST.get(ev["key"], _STATIC_SUGGEST["payday"])
            out = {"idea": fb["idea"], "tone": fb["tone"], "content_type": fb["type"]}
        db.save_suggestion(user["id"], day, ev["key"], brand_id,
                           out["idea"], out.get("tone") or "", out.get("content_type") or "")
        s = {"idea": out["idea"], "voice": out.get("tone") or "", "type": out.get("content_type") or ""}

    tone_label = {t["key"]: t["label"] for t in voice.list_tones()}
    brands = db.list_brands(user["id"])
    brand = next((b for b in brands if b["id"] == brand_id), None) or (brands[0] if brands else None)
    return jsonify({
        "event_key": ev["key"], "event_name": ev["name"], "days_label": _days_label(ev["days"]),
        "idea": s["idea"],
        "tone_key": s.get("voice") or "", "type_key": s.get("type") or "",
        "voice_label": tone_label.get(s.get("voice"), ""),
        "type_label": _TYPE_LABELS.get(s.get("type"), ""),
        "brand": brand["name"] if brand else "your brand",
    })


# -------------------------------- auth ------------------------------------ #

def send_email(to: str, subject: str, html: str) -> bool:
    """Send a transactional email via Resend. Returns False if not configured."""
    if not RESEND_API_KEY:
        return False
    try:
        r = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
            json={"from": MAIL_FROM, "to": [to], "subject": subject, "html": html},
            timeout=15,
        )
        return r.status_code in (200, 201)
    except Exception:
        return False


def _reset_email_html(name: str, link: str) -> str:
    return f"""<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:0 auto;color:#13312e">
      <div style="font-size:22px;font-weight:bold;color:#0e9488;margin-bottom:6px">Vertil</div>
      <p>Hi {name},</p>
      <p>We got a request to reset your Vertil password. Click the button below to choose a new one. This link expires in 1 hour.</p>
      <p style="margin:24px 0"><a href="{link}" style="background:#0e9488;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold;display:inline-block">Reset my password</a></p>
      <p style="font-size:13px;color:#5b6b66">If the button doesn't work, paste this link into your browser:<br><a href="{link}" style="color:#0e9488">{link}</a></p>
      <p style="font-size:13px;color:#5b6b66">If you didn't request this, you can safely ignore this email — your password won't change.</p>
      <p style="font-size:12px;color:#9aa8a4;margin-top:24px">Vertil · The Nigerian brand voice engine</p>
    </div>"""


@app.post("/api/signup")
def signup():
    d = request.get_json(force=True) or {}
    email = (d.get("email") or "").strip().lower()
    name = (d.get("name") or "").strip()
    pw = d.get("password") or ""
    if "@" not in email or len(pw) < 6:
        return jsonify({"error": "Enter a valid email and a password of at least 6 characters."}), 400
    if db.get_user_by_email(email):
        return jsonify({"error": "An account with that email already exists. Try logging in."}), 409
    user = db.create_user(email, name or email.split("@")[0], generate_password_hash(pw))
    session["uid"] = user["id"]
    return jsonify({"user": user_public(user), "usage": usage_payload(user)})


@app.post("/api/login")
def login():
    d = request.get_json(force=True) or {}
    email = (d.get("email") or "").strip().lower()
    rec = db.get_user_by_email(email)
    if not rec or not check_password_hash(rec["password_hash"], d.get("password") or ""):
        return jsonify({"error": "Wrong email or password."}), 401
    if rec.get("suspended"):
        return jsonify({"error": "This account has been suspended. Contact support."}), 403
    session["uid"] = rec["id"]
    user = db.get_user(rec["id"])
    return jsonify({"user": user_public(user), "usage": usage_payload(user)})


@app.post("/api/auth/google")
def auth_google():
    """Verify a Google Identity Services ID token and log the user in,
    creating the account on first sign-in."""
    if not GOOGLE_CLIENT_ID:
        return jsonify({"error": "Google sign-in isn't configured yet."}), 400
    cred = (request.get_json(force=True) or {}).get("credential", "")
    if not cred:
        return jsonify({"error": "Missing Google credential."}), 400
    try:
        r = httpx.get("https://oauth2.googleapis.com/tokeninfo",
                      params={"id_token": cred}, timeout=15)
        info = r.json() if r.status_code == 200 else {}
    except Exception:
        info = {}
    email = (info.get("email") or "").strip().lower()
    iss = info.get("iss", "")
    if (info.get("aud") != GOOGLE_CLIENT_ID
            or iss not in ("accounts.google.com", "https://accounts.google.com")
            or not email):
        return jsonify({"error": "Could not verify your Google sign-in. Please try again."}), 401
    if str(info.get("email_verified", "")).lower() not in ("true", "1"):
        return jsonify({"error": "Your Google email isn't verified."}), 401
    rec = db.get_user_by_email(email)
    if rec:
        if rec.get("suspended"):
            return jsonify({"error": "This account has been suspended. Contact support."}), 403
        user = db.get_user(rec["id"])
    else:
        name = (info.get("name") or info.get("given_name") or email.split("@")[0]).strip()
        user = db.create_user(email, name, generate_password_hash(secrets.token_urlsafe(24)))
    session["uid"] = user["id"]
    return jsonify({"user": user_public(user), "usage": usage_payload(user)})


@app.post("/api/auth/forgot")
def auth_forgot():
    """Start a password reset. Always returns ok so we never reveal which
    emails have accounts."""
    email = ((request.get_json(force=True) or {}).get("email") or "").strip().lower()
    rec = db.get_user_by_email(email)
    if rec and not rec.get("suspended"):
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        db.create_password_reset(rec["id"], token_hash, time.time() + 3600)  # 1 hour
        link = request.host_url.rstrip("/") + "/reset?token=" + token
        sent = send_email(email, "Reset your Vertil password",
                          _reset_email_html(rec.get("name") or "there", link))
        if not sent:  # no email provider yet — log the link so it's testable
            print(f"[Vertil] password-reset link for {email}: {link}", flush=True)
    return jsonify({"ok": True})


@app.post("/api/auth/reset")
def auth_reset():
    d = request.get_json(force=True) or {}
    pw = d.get("password") or ""
    if len(pw) < 6:
        return jsonify({"error": "Choose a password of at least 6 characters."}), 400
    token_hash = hashlib.sha256((d.get("token") or "").encode()).hexdigest()
    uid = db.consume_password_reset(token_hash)
    if not uid:
        return jsonify({"error": "This reset link is invalid or has expired. Please request a new one."}), 400
    db.update_password(uid, generate_password_hash(pw))
    return jsonify({"ok": True})


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify({"ok": True})


@app.get("/api/me")
@auth
def me(user):
    return jsonify({"user": user_public(user), "usage": usage_payload(user)})


@app.put("/api/me")
@auth
def update_me(user):
    d = request.get_json(force=True) or {}
    name = (d.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Name can't be empty."}), 400
    updated = db.update_user_name(user["id"], name)
    return jsonify({"user": user_public(updated), "usage": usage_payload(updated)})


@app.post("/api/account/password")
@auth
def change_password(user):
    d = request.get_json(force=True) or {}
    current = d.get("current") or ""
    new = d.get("new") or ""
    if len(new) < 6:
        return jsonify({"error": "New password must be at least 6 characters."}), 400
    if not check_password_hash(db.get_password_hash(user["id"]) or "", current):
        return jsonify({"error": "Current password is incorrect."}), 401
    db.update_password(user["id"], generate_password_hash(new))
    return jsonify({"ok": True})


@app.post("/api/onboarded")
@auth
def mark_onboarded(user):
    db.set_onboarded(user["id"])
    return jsonify({"ok": True})


# ------------------------------- brands ----------------------------------- #

@app.get("/api/brands")
@auth
def get_brands(user):
    return jsonify(db.list_brands(user["id"]))


@app.post("/api/brands")
@auth
def post_brand(user):
    data = request.get_json(force=True) or {}
    if not (data.get("name") or "").strip():
        return jsonify({"error": "Brand name is required"}), 400
    limit = plan_of(user)["brands"]
    if db.count_brands(user["id"]) >= limit:
        return jsonify({"error": f"Your plan allows {limit} brand(s). Upgrade for more.", "upgrade": True}), 402
    return jsonify(db.create_brand(user["id"], data))


@app.put("/api/brands/<int:brand_id>")
@auth
def put_brand(user, brand_id):
    if not db.get_brand(user["id"], brand_id):
        return jsonify({"error": "Brand not found"}), 404
    return jsonify(db.update_brand(user["id"], brand_id, request.get_json(force=True) or {}))


@app.delete("/api/brands/<int:brand_id>")
@auth
def remove_brand(user, brand_id):
    db.delete_brand(user["id"], brand_id)
    return jsonify({"ok": True})


@app.post("/api/brands/from-posts")
@auth
def brand_from_posts(user):
    samples = (request.get_json(force=True) or {}).get("samples", "").strip()
    if len(samples) < 20:
        return jsonify({"error": "Paste a bit more sample content to learn from."}), 400
    client = get_client()
    if client is None:
        return jsonify({"name": "", "industry": "", "audience": "", "location": "",
                        "description": "", "personality": "playful, bold"})
    try:
        with client.messages.stream(
            model=MODEL, max_tokens=1200, thinking={"type": "adaptive"},
            output_config={"effort": "low"},
            system=voice.build_extract_brand_system(),
            messages=[{"role": "user", "content": f"Samples:\n\"\"\"\n{samples}\n\"\"\""}],
        ) as s:
            text = "".join(s.text_stream)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    profile = voice.parse_brand_json(text)
    profile["samples"] = samples
    return jsonify(profile)


# ------------------------------ history ----------------------------------- #

@app.get("/api/history")
@auth
def history(user):
    return jsonify(db.recent_generations(user["id"]))


# ---------------------------- favorites ----------------------------------- #

@app.get("/api/favorites")
@auth
def favorites_list(user):
    return jsonify(db.list_favorites(user["id"]))


@app.post("/api/favorites")
@auth
def favorite_add(user):
    d = request.get_json(force=True) or {}
    text = (d.get("text") or "").strip()
    if not text:
        return jsonify({"error": "Nothing to save"}), 400
    return jsonify(db.add_favorite(user["id"], d.get("brand_id"),
                                   d.get("content_type"), d.get("tone"), text))


@app.delete("/api/favorites/<int:fav_id>")
@auth
def favorite_del(user, fav_id):
    db.delete_favorite(user["id"], fav_id)
    return jsonify({"ok": True})


# ----------------------------- feedback ----------------------------------- #

@app.post("/api/feedback")
@auth
def feedback(user):
    d = request.get_json(force=True) or {}
    rating = "up" if d.get("rating") == "up" else "down"
    text = (d.get("text") or "").strip()
    if text:
        db.add_feedback(user["id"], d.get("brand_id"), rating, text)
    return jsonify({"ok": True})


# ---------------------------- generation ---------------------------------- #

def _sse(event, data):
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _demo_text(content_type, tone, brief, variants):
    tlabel = voice.tone_meta(tone)["label"]
    clabel = voice.content_type_meta(content_type)["label"]
    brief = (brief or "").strip() or "your latest offer"
    blocks = [
        f"[DEMO MODE — add your ANTHROPIC_API_KEY to .env for real Naija copy]\n\n"
        f"Option {i} · {clabel} · {tlabel}\n"
        f"Omo, {brief} just land and e dey hot! 🔥 No dulling — tap that link, send your "
        f"account number sharp sharp, make we package am today. #NaijaBrand #BuyNaija"
        for i in range(1, variants + 1)
    ]
    return "\n---\n".join(blocks)


@app.post("/api/generate")
@auth
def generate(user):
    req = request.get_json(force=True) or {}
    uid = user["id"]
    p = plan_of(user)
    if p["gen_limit"] is not None and db.monthly_generation_count(uid) >= p["gen_limit"]:
        return jsonify({"error": f"You've used all {p['gen_limit']} generations on the "
                                 f"{p['name']} plan this month. Upgrade to keep yarning.",
                        "upgrade": True}), 402

    brand_id = req.get("brand_id")
    content_type = req.get("content_type", "instagram_caption")
    tone = req.get("tone", "friendly")
    brief = req.get("brief", "")
    variants = max(1, min(int(req.get("variants", 3) or 3), 5))

    def stream():
        profile = db.get_brand(uid, brand_id) if brand_id else None
        liked = db.liked_examples(uid, brand_id)
        system = voice.build_system_prompt(profile, tone, liked)
        usr = voice.build_user_prompt(content_type, brief, variants)

        yield _sse("start", {"live": LIVE, "model": MODEL})
        full = ""
        in_tok = out_tok = 0
        client = get_client()
        if client is None:
            full = _demo_text(content_type, tone, brief, variants)
            for tok in full.split(" "):
                yield _sse("delta", {"text": tok + " "})
                time.sleep(0.006)
        else:
            try:
                with client.messages.stream(
                    model=MODEL, max_tokens=4000, thinking={"type": "adaptive"},
                    output_config={"effort": "medium"}, system=system,
                    messages=[{"role": "user", "content": usr}],
                ) as s:
                    for text in s.text_stream:
                        full += text
                        yield _sse("delta", {"text": text})
                    u = s.get_final_message().usage
                    in_tok, out_tok = u.input_tokens, u.output_tokens
            except Exception as exc:
                yield _sse("error", {"message": str(exc)})
                return

        result = voice.split_variants(full)
        db.save_generation(uid, brand_id, content_type, tone, brief, result,
                           model=(MODEL if client else ""), input_tokens=in_tok,
                           output_tokens=out_tok, cost=cost_naira(MODEL, in_tok, out_tok))
        yield _sse("done", {"variants": result, "used": db.monthly_generation_count(uid)})

    return Response(stream_with_context(stream()), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post("/api/refine")
@auth
def refine(user):
    d = request.get_json(force=True) or {}
    original = (d.get("text") or "").strip()
    if not original:
        return jsonify({"error": "Nothing to refine"}), 400
    p = plan_of(user)
    if p["gen_limit"] is not None and db.monthly_generation_count(user["id"]) >= p["gen_limit"]:
        return jsonify({"error": "Monthly limit reached. Upgrade to keep refining.", "upgrade": True}), 402

    profile = db.get_brand(user["id"], d.get("brand_id")) if d.get("brand_id") else None
    system, usr = voice.build_refine_prompt(profile, d.get("tone", "friendly"),
                                            original, d.get("instruction", "punchier"))
    client = get_client()
    if client is None:
        return jsonify({"text": original + "\n\n[demo: add API key to refine for real]"})
    try:
        with client.messages.stream(
            model=MODEL, max_tokens=2000, thinking={"type": "adaptive"},
            output_config={"effort": "medium"}, system=system,
            messages=[{"role": "user", "content": usr}],
        ) as s:
            text = "".join(s.text_stream)
            u = s.get_final_message().usage
            in_tok, out_tok = u.input_tokens, u.output_tokens
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    db.save_generation(user["id"], d.get("brand_id"), d.get("content_type", ""),
                       d.get("tone", ""), "[refine] " + d.get("instruction", ""), [text.strip()],
                       model=MODEL, input_tokens=in_tok, output_tokens=out_tok,
                       cost=cost_naira(MODEL, in_tok, out_tok))
    return jsonify({"text": text.strip(), "used": db.monthly_generation_count(user["id"])})


# ---------------------------- calendars ----------------------------------- #

def _demo_calendar(cadence):
    _, count = voice.CADENCE_COUNTS.get(cadence, voice.CADENCE_COUNTS["3_week"])
    s = [
        ("Salary just land", "Pay-day promo — make your money work", "Awoof dey scarce but e still dey!", "instagram_caption", "pidgin", "graphic", "bold promo card", "warm teal, big confident type, premium feel"),
        ("Mid-week", "Showcase a bestseller with social proof", "This one don dey fly comot for shelf 👀", "instagram_caption", "pidgin", "image", "product flat-lay photo", "clean bright background, product hero, soft shadows"),
        ("Weekend rush", "Weekend-only flash offer", "Weekend plot loading… you in?", "whatsapp_broadcast", "friendly", "graphic", "countdown banner", "high-energy, bold accent colour, urgency"),
        ("Trust builder", "Behind-the-scenes / delivery proof", "See how we package with love ✨", "instagram_caption", "lagos_corporate", "video", "15s behind-the-scenes reel", "handheld, authentic, warm and human"),
    ]
    span = max(1, 28 // max(count, 1))
    return [{"day": min(28, 2 + i * span), "occasion": f"[demo] {s[i % len(s)][0]}",
             "theme": s[i % len(s)][1], "hook": s[i % len(s)][2],
             "content_type": s[i % len(s)][3], "tone": s[i % len(s)][4],
             "visual_format": s[i % len(s)][5], "visual_kind": s[i % len(s)][6],
             "visual_notes": s[i % len(s)][7]} for i in range(count)]


@app.post("/api/calendar/generate")
@auth
def calendar_generate(user):
    if not plan_of(user)["calendar"]:
        return jsonify({"error": "The Content Calendar is on the Growth plan and up. Upgrade to unlock it.",
                        "upgrade": True}), 402
    req = request.get_json(force=True) or {}
    brand_id = req.get("brand_id")
    month = (req.get("month") or "December").strip()
    try:
        year = int(req.get("year") or 2026)
    except (TypeError, ValueError):
        year = 2026
    cadence = req.get("cadence", "3_week")

    client = get_client()
    if client is None:
        posts = _demo_calendar(cadence)
    else:
        profile = db.get_brand(user["id"], brand_id) if brand_id else None
        try:
            with client.messages.stream(
                model=MODEL, max_tokens=6000, thinking={"type": "adaptive"},
                output_config={"effort": "medium"},
                system=voice.build_calendar_system(profile),
                messages=[{"role": "user", "content": voice.build_calendar_user(month, year, cadence)}],
            ) as s:
                text = "".join(s.text_stream)
                u = s.get_final_message().usage
            posts = voice.parse_calendar_json(text)
        except Exception as exc:
            return jsonify({"error": str(exc)}), 500
        if not posts:
            return jsonify({"error": "Could not parse the calendar. Please try again."}), 502
        # log the AI spend for the admin dashboard (not counted against gen quota)
        db.save_generation(user["id"], brand_id, "content_calendar", "",
                           f"{month} {year}", [f"{len(posts)} posts"], model=MODEL,
                           input_tokens=u.input_tokens, output_tokens=u.output_tokens,
                           cost=cost_naira(MODEL, u.input_tokens, u.output_tokens))

    return jsonify(db.save_calendar(user["id"], brand_id, month, year, cadence, posts))


@app.get("/api/calendars")
@auth
def calendars_list(user):
    return jsonify(db.list_calendars(user["id"]))


@app.get("/api/calendar/<int:cal_id>")
@auth
def calendar_get(user, cal_id):
    cal = db.get_calendar(user["id"], cal_id)
    return (jsonify(cal), 200) if cal else (jsonify({"error": "Not found"}), 404)


@app.delete("/api/calendar/<int:cal_id>")
@auth
def calendar_delete(user, cal_id):
    db.delete_calendar(user["id"], cal_id)
    return jsonify({"ok": True})


# ------------------------------ advisors ---------------------------------- #

def _over_limit(user) -> bool:
    p = plan_of(user)
    return p["gen_limit"] is not None and db.monthly_generation_count(user["id"]) >= p["gen_limit"]


def _complete(system: str, user_msg: str, max_tokens: int = 3000):
    """One-shot (non-streamed) completion. Returns (text, input_tokens, output_tokens)."""
    client = get_client()
    if client is None:
        return "", 0, 0
    with client.messages.stream(
        model=MODEL, max_tokens=max_tokens, thinking={"type": "adaptive"},
        output_config={"effort": "medium"}, system=system,
        messages=[{"role": "user", "content": user_msg}],
    ) as s:
        text = "".join(s.text_stream)
        u = s.get_final_message().usage
    return text, u.input_tokens, u.output_tokens


@app.post("/api/advisor/rate")
@auth
def advisor_rate(user):
    if _over_limit(user):
        return jsonify({"error": "Monthly limit reached. Upgrade to keep going.", "upgrade": True}), 402
    d = request.get_json(force=True) or {}
    if not (d.get("service") or "").strip():
        return jsonify({"error": "Tell us the service / gig first."}), 400
    if get_client() is None:
        return jsonify({"service": d.get("service", ""), "recommended": {"low": 30000, "mid": 60000, "high": 120000, "unit": "per project"},
                        "summary": "[demo] Add your API key for real Naija rate advice.",
                        "factors": ["Demo mode"], "pitch": "", "tips": [], "upsells": []})
    try:
        text, in_tok, out_tok = _complete(voice.build_rate_system(), voice.build_rate_user(d), 3000)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    result = voice.parse_rate_json(text)
    if not result["recommended"]["mid"] and not result["summary"]:
        return jsonify({"error": "Could not work out a rate. Please try again."}), 502
    r = result["recommended"]
    summary = f"₦{r['low']:,}–₦{r['high']:,} {r['unit']} · {result['service']}"
    db.save_generation(user["id"], d.get("brand_id"), "rate_advisor", "", d.get("service", ""), [summary],
                       model=MODEL, input_tokens=in_tok, output_tokens=out_tok,
                       cost=cost_naira(MODEL, in_tok, out_tok))
    result["used"] = db.monthly_generation_count(user["id"])
    return jsonify(result)


@app.post("/api/advisor/brand")
@auth
def advisor_brand(user):
    if _over_limit(user):
        return jsonify({"error": "Monthly limit reached. Upgrade to keep going.", "upgrade": True}), 402
    d = request.get_json(force=True) or {}
    if not (d.get("interests") or "").strip():
        return jsonify({"error": "Tell us your interests / niche first."}), 400
    if get_client() is None:
        return jsonify({"positioning": "[demo] Add your API key for a real personal-brand strategy.",
                        "tagline": "", "niche": "", "content_pillars": [], "voice": "",
                        "target_brands": [], "bio_options": [], "next_steps": []})
    try:
        text, in_tok, out_tok = _complete(voice.build_personal_brand_system(), voice.build_personal_brand_user(d), 4000)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    result = voice.parse_brand_advice_json(text)
    if not result["positioning"]:
        return jsonify({"error": "Could not build a strategy. Please try again."}), 502
    summary = f"Personal brand: {result.get('tagline') or result.get('niche') or 'strategy'}"
    db.save_generation(user["id"], d.get("brand_id"), "personal_brand", "", d.get("interests", ""), [summary],
                       model=MODEL, input_tokens=in_tok, output_tokens=out_tok,
                       cost=cost_naira(MODEL, in_tok, out_tok))
    result["used"] = db.monthly_generation_count(user["id"])
    return jsonify(result)


@app.post("/api/script/generate")
@auth
def script_generate(user):
    if _over_limit(user):
        return jsonify({"error": "Monthly limit reached. Upgrade to keep going.", "upgrade": True}), 402
    d = request.get_json(force=True) or {}
    if not (d.get("idea") or "").strip():
        return jsonify({"error": "Tell us the video idea / topic first."}), 400
    if get_client() is None:
        return jsonify({"title": "[demo] Add your API key for real scripts", "format": "", "length": "",
                        "hook": "", "scenes": [], "sound": "", "caption": "", "hashtags": [], "cta": ""})
    profile = db.get_brand(user["id"], d.get("brand_id")) if d.get("brand_id") else None
    system = voice.build_script_system(profile, d.get("tone", "friendly"))
    try:
        text, in_tok, out_tok = _complete(system, voice.build_script_user(d), 3500)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    result = voice.parse_script_json(text)
    if not result["scenes"] and not result["hook"]:
        return jsonify({"error": "Could not write the script. Please try again."}), 502
    summary = f"Script: {result.get('title') or d.get('idea', '')[:60]}"
    db.save_generation(user["id"], d.get("brand_id"), "script", d.get("tone", ""), d.get("idea", ""), [summary],
                       model=MODEL, input_tokens=in_tok, output_tokens=out_tok,
                       cost=cost_naira(MODEL, in_tok, out_tok))
    result["used"] = db.monthly_generation_count(user["id"])
    return jsonify(result)


# ------------------------------- gigs ------------------------------------- #

@app.get("/api/gigs")
@auth
def gigs_list(user):
    return jsonify({"gigs": db.list_gigs(user["id"]), "summary": db.gig_summary(user["id"])})


@app.post("/api/gigs")
@auth
def gig_create(user):
    data = request.get_json(force=True) or {}
    if not (data.get("title") or "").strip():
        return jsonify({"error": "What was the gig? Give it a title."}), 400
    return jsonify(db.create_gig(user["id"], data))


@app.put("/api/gigs/<int:gig_id>")
@auth
def gig_update(user, gig_id):
    if not db.get_gig(user["id"], gig_id):
        return jsonify({"error": "Gig not found"}), 404
    return jsonify(db.update_gig(user["id"], gig_id, request.get_json(force=True) or {}))


@app.delete("/api/gigs/<int:gig_id>")
@auth
def gig_delete(user, gig_id):
    db.delete_gig(user["id"], gig_id)
    return jsonify({"ok": True})


# ------------------------------ billing ----------------------------------- #

@app.post("/api/billing/init")
@auth
def billing_init(user):
    plan = (request.get_json(force=True) or {}).get("plan", "")
    if plan not in PLANS or plan == "free":
        return jsonify({"error": "Choose a paid plan."}), 400
    if not PAYSTACK_SECRET:
        return jsonify({"error": "Paystack not configured", "paystack": False}), 400
    amount = PLANS[plan]["price"] * 100  # kobo
    callback = request.host_url.rstrip("/") + "/billing/callback"
    try:
        r = httpx.post(
            "https://api.paystack.co/transaction/initialize",
            headers={"Authorization": f"Bearer {PAYSTACK_SECRET}", "Content-Type": "application/json"},
            json={"email": user["email"], "amount": amount, "callback_url": callback,
                  "metadata": {"user_id": user["id"], "plan": plan}},
            timeout=20,
        )
        data = r.json().get("data", {})
    except Exception as exc:
        return jsonify({"error": f"Paystack error: {exc}"}), 502
    if not data.get("authorization_url"):
        return jsonify({"error": "Could not start checkout."}), 502
    return jsonify({"authorization_url": data["authorization_url"]})


@app.get("/billing/callback")
def billing_callback():
    ref = request.args.get("reference", "")
    if ref and PAYSTACK_SECRET:
        try:
            r = httpx.get(f"https://api.paystack.co/transaction/verify/{ref}",
                          headers={"Authorization": f"Bearer {PAYSTACK_SECRET}"}, timeout=20)
            data = r.json().get("data", {})
            if data.get("status") == "success":
                meta = data.get("metadata", {}) or {}
                uid, plan = meta.get("user_id"), meta.get("plan")
                if uid and plan in PLANS:
                    db.set_user_plan(int(uid), plan)
                return redirect("/?upgraded=1")
        except Exception:
            pass
    return redirect("/?upgraded=0")


@app.post("/billing/webhook")
def billing_webhook():
    """Paystack server-to-server confirmation — the reliable source of truth.
    Fires even if the customer closes the tab before the redirect. We verify the
    signature so only genuine Paystack calls can change a plan."""
    if not PAYSTACK_SECRET:
        return ("", 200)
    body = request.get_data()
    sig = request.headers.get("x-paystack-signature", "")
    expected = hmac.new(PAYSTACK_SECRET.encode(), body, hashlib.sha512).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return ("", 401)
    event = request.get_json(silent=True) or {}
    if event.get("event") == "charge.success":
        data = event.get("data", {}) or {}
        meta = data.get("metadata", {}) or {}
        uid, plan = meta.get("user_id"), meta.get("plan")
        if uid and plan in PLANS and data.get("status") == "success":
            try:
                db.set_user_plan(int(uid), plan)
            except (TypeError, ValueError):
                pass
    return ("", 200)


@app.post("/api/billing/simulate")
@auth
def billing_simulate(user):
    """Switch plan without payment. Downgrades are always allowed; paid-plan
    simulation is restricted to test mode (no Paystack) or admins, so live users
    can't bypass payment by calling this endpoint directly."""
    plan = (request.get_json(force=True) or {}).get("plan", "")
    if plan not in PLANS:
        return jsonify({"error": "Unknown plan"}), 400
    if plan != "free" and PAYSTACK_SECRET and not is_admin(user):
        return jsonify({"error": "Payment required.", "paystack": True}), 402
    updated = db.set_user_plan(user["id"], plan)
    return jsonify({"user": updated, "usage": usage_payload(updated), "simulated": True})


# ------------------------------- admin ------------------------------------ #

# Friendly labels for content types (incl. the synthetic admin-only ones).
_TYPE_LABELS = {**{k: v["label"] for k, v in voice.CONTENT_TYPES.items()},
                "content_calendar": "Content Calendar",
                "rate_advisor": "Rate Advisor", "personal_brand": "Brand Advisor",
                "script": "Script Writer"}


@app.get("/api/admin/overview")
@admin
def admin_overview(_user):
    o = db.admin_overview()
    # estimated MRR from paid subscribers
    plan_price = {k: PLANS[k]["price"] for k in PLANS}
    paid = 0
    mrr = 0
    plan_rows = []
    for row in o["by_plan"]:
        price = plan_price.get(row["plan"], 0)
        if price:
            paid += row["n"]
            mrr += price * row["n"]
        plan_rows.append({"plan": row["plan"],
                          "name": PLANS.get(row["plan"], {}).get("name", row["plan"]),
                          "count": row["n"], "price": price})
    for t in o["by_type"]:
        t["label"] = _TYPE_LABELS.get(t["content_type"], t["content_type"])
    return jsonify({
        **o,
        "paid_users": paid, "mrr": mrr, "arr": mrr * 12,
        "plans": sorted(plan_rows, key=lambda x: -x["count"]),
        "all_plans": [{"key": k, "name": PLANS[k]["name"], "price": PLANS[k]["price"]} for k in PLAN_ORDER],
        "fx": NGN_PER_USD,
    })


@app.get("/api/admin/users")
@admin
def admin_users(_user):
    rows = db.admin_users()
    for r in rows:
        r["is_admin"] = r["email"].lower() in ADMIN_EMAILS
        r["plan_name"] = PLANS.get(r["plan"], {}).get("name", r["plan"])
    return jsonify(rows)


@app.get("/api/admin/users/<int:uid>")
@admin
def admin_user(_user, uid):
    detail = db.admin_user_detail(uid)
    if not detail:
        return jsonify({"error": "Not found"}), 404
    detail["user"]["plan_name"] = PLANS.get(detail["user"]["plan"], {}).get("name", detail["user"]["plan"])
    detail["user"]["is_admin"] = detail["user"]["email"].lower() in ADMIN_EMAILS
    for t in detail["by_type"]:
        t["label"] = _TYPE_LABELS.get(t["content_type"], t["content_type"])
    for g in detail["recent"]:
        g["label"] = _TYPE_LABELS.get(g["content_type"], g["content_type"])
    return jsonify(detail)


@app.post("/api/admin/users/<int:uid>/update")
@admin
def admin_user_update(actor, uid):
    """Change a customer's plan, suspend/unsuspend them, or save admin notes."""
    target = db.get_user(uid)
    if not target:
        return jsonify({"error": "User not found."}), 404
    target_is_admin = target["email"].lower() in ADMIN_EMAILS
    d = request.get_json(force=True) or {}

    plan = d.get("plan")
    if plan is not None and plan not in PLANS:
        return jsonify({"error": "Unknown plan."}), 400

    suspended = d.get("suspended")
    if suspended is not None:
        if uid == actor["id"]:
            return jsonify({"error": "You can't suspend your own account."}), 400
        if target_is_admin:
            return jsonify({"error": "You can't suspend another admin."}), 400

    notes = d.get("notes")
    updated = db.admin_update_user(uid, plan=plan,
                                   suspended=None if suspended is None else bool(suspended),
                                   notes=notes)
    return jsonify({"ok": True, "user": updated})


@app.delete("/api/admin/users/<int:uid>")
@admin
def admin_user_delete(actor, uid):
    """Permanently delete a customer and all their data."""
    target = db.get_user(uid)
    if not target:
        return jsonify({"error": "User not found."}), 404
    if uid == actor["id"]:
        return jsonify({"error": "You can't delete your own account."}), 400
    if target["email"].lower() in ADMIN_EMAILS:
        return jsonify({"error": "You can't delete another admin."}), 400
    db.admin_delete_user(uid)
    return jsonify({"ok": True})


if __name__ == "__main__":
    # Bind to 0.0.0.0 and the platform-provided PORT (Railway/Render/etc.);
    # fall back to localhost:5055 for local dev.
    port = int(os.environ.get("PORT", "5055"))
    debug = os.environ.get("FLASK_DEBUG", "").lower() in ("1", "true", "yes")
    app.run(host="0.0.0.0", port=port, debug=debug, use_reloader=False)
