"""Persistence for Vertil — dual-mode.

Uses PostgreSQL when DATABASE_URL is set (e.g. Railway's managed Postgres), and
falls back to SQLite locally (zero setup for dev). All SQL is written with '?'
placeholders and auto-converted to '%s' for Postgres, so the rest of the app is
backend-agnostic. Every brand/generation/calendar/favorite/feedback row is
scoped to a user."""

from __future__ import annotations

import json
import os
import sqlite3
import time
from pathlib import Path

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
if DATABASE_URL.startswith("postgres://"):  # normalize legacy scheme
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://"):]
IS_PG = bool(DATABASE_URL)

# SQLite path (local). VERTIL_DB_PATH can point at a mounted volume.
DB_PATH = Path(os.environ.get("VERTIL_DB_PATH") or (Path(__file__).resolve().parent / "yarn.db"))
if not IS_PG:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

if IS_PG:
    import psycopg
    from psycopg.rows import dict_row


def _q(sql: str) -> str:
    """Convert '?' placeholders to '%s' for Postgres."""
    return sql.replace("?", "%s") if IS_PG else sql


class _CW:
    """Thin connection wrapper: accepts '?' placeholders for both backends and
    proxies commit/close."""

    def __init__(self, raw):
        self._raw = raw

    def execute(self, sql, params=()):
        return self._raw.execute(_q(sql), params)

    def commit(self):
        return self._raw.commit()

    def close(self):
        return self._raw.close()


class _ConnCtx:
    def __enter__(self):
        if IS_PG:
            self._raw = psycopg.connect(DATABASE_URL, row_factory=dict_row)
        else:
            self._raw = sqlite3.connect(DB_PATH)
            self._raw.row_factory = sqlite3.Row
            self._raw.execute("PRAGMA foreign_keys = ON")
        return _CW(self._raw)

    def __exit__(self, exc_type, exc, tb):
        try:
            if exc_type is None:
                self._raw.commit()
            else:
                self._raw.rollback()
        finally:
            self._raw.close()
        return False


def _conn():
    return _ConnCtx()


def _insert(c, sql, params):
    """Run an INSERT and return the new row id on either backend."""
    if IS_PG:
        return c.execute(sql + " RETURNING id", params).fetchone()["id"]
    return c.execute(sql, params).lastrowid


# dialect bits
_PK = "SERIAL PRIMARY KEY" if IS_PG else "INTEGER PRIMARY KEY AUTOINCREMENT"
_REAL = "DOUBLE PRECISION" if IS_PG else "REAL"
_DAY = ("to_char(to_timestamp(created_at), 'YYYY-MM-DD')" if IS_PG
        else "date(created_at, 'unixepoch')")


def _columns(c, table: str) -> set[str]:
    if IS_PG:
        rows = c.execute(
            "SELECT column_name AS name FROM information_schema.columns WHERE table_name=?",
            (table,)).fetchall()
    else:
        rows = c.execute(f"PRAGMA table_info({table})").fetchall()
    return {r["name"] for r in rows}


def _add_col(c, table, col, ddl):
    if IS_PG:
        c.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {ddl}")
    elif col not in _columns(c, table):
        c.execute(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}")


def init_db() -> None:
    with _conn() as c:
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS users (
                id            {_PK},
                email         TEXT UNIQUE NOT NULL,
                name          TEXT,
                password_hash TEXT NOT NULL,
                plan          TEXT NOT NULL DEFAULT 'free',
                created_at    {_REAL} NOT NULL
            )""")
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS brands (
                id          {_PK},
                user_id     INTEGER,
                name        TEXT NOT NULL,
                industry    TEXT, audience TEXT, location TEXT,
                description TEXT, personality TEXT, samples TEXT,
                created_at  {_REAL} NOT NULL
            )""")
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS generations (
                id           {_PK},
                user_id      INTEGER,
                brand_id     INTEGER,
                content_type TEXT, tone TEXT, brief TEXT,
                output       TEXT,
                created_at   {_REAL} NOT NULL
            )""")
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS calendars (
                id         {_PK},
                user_id    INTEGER,
                brand_id   INTEGER,
                month      TEXT, year INTEGER, cadence TEXT,
                posts      TEXT,
                created_at {_REAL} NOT NULL
            )""")
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS favorites (
                id           {_PK},
                user_id      INTEGER NOT NULL,
                brand_id     INTEGER,
                content_type TEXT, tone TEXT,
                text         TEXT NOT NULL,
                created_at   {_REAL} NOT NULL
            )""")
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS gigs (
                id         {_PK},
                user_id    INTEGER NOT NULL,
                title      TEXT NOT NULL,
                client     TEXT, category TEXT,
                amount     {_REAL} NOT NULL DEFAULT 0,
                gig_date   TEXT, status TEXT DEFAULT 'paid',
                notes      TEXT,
                created_at {_REAL} NOT NULL
            )""")
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS brand_feedback (
                id         {_PK},
                user_id    INTEGER NOT NULL,
                brand_id   INTEGER,
                rating     TEXT NOT NULL,
                text       TEXT NOT NULL,
                created_at {_REAL} NOT NULL
            )""")
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS password_resets (
                id         {_PK},
                user_id    INTEGER NOT NULL,
                token      TEXT NOT NULL,
                expires_at {_REAL} NOT NULL,
                used       INTEGER NOT NULL DEFAULT 0,
                created_at {_REAL} NOT NULL
            )""")
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS suggestions (
                id         {_PK},
                user_id    INTEGER NOT NULL,
                day        TEXT NOT NULL,
                event_key  TEXT NOT NULL,
                brand_id   INTEGER,
                idea       TEXT, voice TEXT, type TEXT,
                created_at {_REAL} NOT NULL
            )""")
        # migrations (idempotent on both backends)
        for tbl in ("brands", "generations", "calendars"):
            _add_col(c, tbl, "user_id", "INTEGER")
        _add_col(c, "users", "onboarded", "INTEGER NOT NULL DEFAULT 0")
        _add_col(c, "users", "is_admin", "INTEGER NOT NULL DEFAULT 0")
        _add_col(c, "users", "suspended", "INTEGER NOT NULL DEFAULT 0")
        _add_col(c, "users", "notes", "TEXT DEFAULT ''")
        _add_col(c, "generations", "input_tokens", "INTEGER DEFAULT 0")
        _add_col(c, "generations", "output_tokens", "INTEGER DEFAULT 0")
        _add_col(c, "generations", "cost", f"{_REAL} DEFAULT 0")
        _add_col(c, "generations", "model", "TEXT DEFAULT ''")


# ------------------------------- users ------------------------------------ #

def create_user(email: str, name: str, password_hash: str) -> dict:
    with _conn() as c:
        uid = _insert(
            c, "INSERT INTO users (email, name, password_hash, plan, created_at) VALUES (?,?,?,?,?)",
            (email.lower().strip(), name.strip(), password_hash, "free", time.time()))
    return get_user(uid)


def get_user(user_id: int) -> dict | None:
    with _conn() as c:
        r = c.execute("SELECT id, email, name, plan, onboarded, created_at FROM users WHERE id=?", (user_id,)).fetchone()
    return dict(r) if r else None


def set_onboarded(user_id: int) -> None:
    with _conn() as c:
        c.execute("UPDATE users SET onboarded=1 WHERE id=?", (user_id,))


def update_user_name(user_id: int, name: str) -> dict | None:
    with _conn() as c:
        c.execute("UPDATE users SET name=? WHERE id=?", (name.strip(), user_id))
    return get_user(user_id)


def get_password_hash(user_id: int) -> str | None:
    with _conn() as c:
        r = c.execute("SELECT password_hash FROM users WHERE id=?", (user_id,)).fetchone()
    return r["password_hash"] if r else None


def update_password(user_id: int, password_hash: str) -> None:
    with _conn() as c:
        c.execute("UPDATE users SET password_hash=? WHERE id=?", (password_hash, user_id))


def create_password_reset(user_id: int, token_hash: str, expires_at: float) -> None:
    """Store a single active reset token per user (replaces any prior one)."""
    with _conn() as c:
        c.execute("DELETE FROM password_resets WHERE user_id=?", (user_id,))
        _insert(c, "INSERT INTO password_resets (user_id, token, expires_at, used, created_at) "
                   "VALUES (?,?,?,?,?)", (user_id, token_hash, expires_at, 0, time.time()))


def consume_password_reset(token_hash: str) -> int | None:
    """Return the user_id for a valid (unused, unexpired) token and mark it used."""
    with _conn() as c:
        r = c.execute("SELECT id, user_id, expires_at, used FROM password_resets WHERE token=?",
                      (token_hash,)).fetchone()
        if not r or r["used"] or r["expires_at"] < time.time():
            return None
        c.execute("UPDATE password_resets SET used=1 WHERE id=?", (r["id"],))
        return r["user_id"]


def get_user_by_email(email: str) -> dict | None:
    with _conn() as c:
        r = c.execute("SELECT * FROM users WHERE email=?", (email.lower().strip(),)).fetchone()
    return dict(r) if r else None


def set_user_plan(user_id: int, plan: str) -> dict | None:
    with _conn() as c:
        c.execute("UPDATE users SET plan=? WHERE id=?", (plan, user_id))
    return get_user(user_id)


def monthly_generation_count(user_id: int) -> int:
    """User-facing generations in the trailing 30 days (the quota window).
    Content-calendar rows are spend-tracking only and don't count toward quota."""
    since = time.time() - 30 * 24 * 3600
    with _conn() as c:
        r = c.execute(
            "SELECT COUNT(*) AS n FROM generations WHERE user_id=? AND created_at>=? "
            "AND content_type NOT IN ('content_calendar','brand_learn','bulk_catalog')",
            (user_id, since),
        ).fetchone()
    return r["n"] if r else 0


# ----------------------------- brands ------------------------------------- #

_BRAND_FIELDS = ("name", "industry", "audience", "location",
                 "description", "personality", "samples")


def create_brand(user_id: int, data: dict) -> dict:
    row = {k: (data.get(k) or "").strip() for k in _BRAND_FIELDS}
    with _conn() as c:
        bid = _insert(
            c,
            f"INSERT INTO brands (user_id, {','.join(_BRAND_FIELDS)}, created_at) "
            f"VALUES (?, {','.join('?' for _ in _BRAND_FIELDS)}, ?)",
            (user_id, *[row[k] for k in _BRAND_FIELDS], time.time()))
    return get_brand(user_id, bid)


def update_brand(user_id: int, brand_id: int, data: dict) -> dict | None:
    row = {k: (data.get(k) or "").strip() for k in _BRAND_FIELDS}
    with _conn() as c:
        c.execute(
            f"UPDATE brands SET {', '.join(f'{k}=?' for k in _BRAND_FIELDS)} WHERE id=? AND user_id=?",
            (*[row[k] for k in _BRAND_FIELDS], brand_id, user_id),
        )
    return get_brand(user_id, brand_id)


def get_brand(user_id: int, brand_id: int) -> dict | None:
    with _conn() as c:
        r = c.execute("SELECT * FROM brands WHERE id=? AND user_id=?", (brand_id, user_id)).fetchone()
    return dict(r) if r else None


def list_brands(user_id: int) -> list[dict]:
    with _conn() as c:
        rows = c.execute("SELECT * FROM brands WHERE user_id=? ORDER BY created_at DESC", (user_id,)).fetchall()
    return [dict(r) for r in rows]


def count_brands(user_id: int) -> int:
    with _conn() as c:
        r = c.execute("SELECT COUNT(*) AS n FROM brands WHERE user_id=?", (user_id,)).fetchone()
    return r["n"] if r else 0


def delete_brand(user_id: int, brand_id: int) -> None:
    with _conn() as c:
        c.execute("DELETE FROM brands WHERE id=? AND user_id=?", (brand_id, user_id))


# --------------------------- generations ---------------------------------- #

def save_generation(user_id: int, brand_id, content_type, tone, brief, variants,
                    model: str = "", input_tokens: int = 0, output_tokens: int = 0,
                    cost: float = 0.0) -> None:
    with _conn() as c:
        c.execute(
            "INSERT INTO generations (user_id, brand_id, content_type, tone, brief, output, "
            "model, input_tokens, output_tokens, cost, created_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (user_id, brand_id, content_type, tone, brief, json.dumps(variants),
             model, input_tokens, output_tokens, cost, time.time()),
        )


def recent_generations(user_id: int, limit: int = 20) -> list[dict]:
    with _conn() as c:
        rows = c.execute(
            "SELECT g.*, b.name AS brand_name FROM generations g "
            "LEFT JOIN brands b ON b.id = g.brand_id "
            "WHERE g.user_id=? ORDER BY g.created_at DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        try:
            d["variants"] = json.loads(d.pop("output") or "[]")
        except json.JSONDecodeError:
            d["variants"] = []
        out.append(d)
    return out


# ---------------------------- favorites ----------------------------------- #

def add_favorite(user_id: int, brand_id, content_type, tone, text: str) -> dict:
    with _conn() as c:
        fid = _insert(
            c, "INSERT INTO favorites (user_id, brand_id, content_type, tone, text, created_at) "
               "VALUES (?,?,?,?,?,?)",
            (user_id, brand_id, content_type, tone, text, time.time()))
        r = c.execute("SELECT * FROM favorites WHERE id=?", (fid,)).fetchone()
    return dict(r)


def list_favorites(user_id: int) -> list[dict]:
    with _conn() as c:
        rows = c.execute(
            "SELECT f.*, b.name AS brand_name FROM favorites f "
            "LEFT JOIN brands b ON b.id = f.brand_id "
            "WHERE f.user_id=? ORDER BY f.created_at DESC",
            (user_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def delete_favorite(user_id: int, fav_id: int) -> None:
    with _conn() as c:
        c.execute("DELETE FROM favorites WHERE id=? AND user_id=?", (fav_id, user_id))


# ---------------------------- feedback ------------------------------------ #

def add_feedback(user_id: int, brand_id, rating: str, text: str) -> None:
    with _conn() as c:
        c.execute(
            "INSERT INTO brand_feedback (user_id, brand_id, rating, text, created_at) VALUES (?,?,?,?,?)",
            (user_id, brand_id, rating, text, time.time()),
        )


def liked_examples(user_id: int, brand_id, limit: int = 3) -> list[str]:
    """Recent thumbs-up outputs for a brand — fed back into the prompt so the voice learns."""
    if not brand_id:
        return []
    with _conn() as c:
        rows = c.execute(
            "SELECT text FROM brand_feedback WHERE user_id=? AND brand_id=? AND rating='up' "
            "ORDER BY created_at DESC LIMIT ?",
            (user_id, brand_id, limit),
        ).fetchall()
    return [r["text"] for r in rows]


# ---------------------------- calendars ----------------------------------- #

def save_calendar(user_id: int, brand_id, month, year, cadence, posts) -> dict:
    with _conn() as c:
        cal_id = _insert(
            c, "INSERT INTO calendars (user_id, brand_id, month, year, cadence, posts, created_at) "
               "VALUES (?,?,?,?,?,?,?)",
            (user_id, brand_id, month, year, cadence, json.dumps(posts), time.time()))
    return get_calendar(user_id, cal_id)


def get_calendar(user_id: int, cal_id: int) -> dict | None:
    with _conn() as c:
        r = c.execute(
            "SELECT cal.*, b.name AS brand_name FROM calendars cal "
            "LEFT JOIN brands b ON b.id = cal.brand_id WHERE cal.id=? AND cal.user_id=?",
            (cal_id, user_id),
        ).fetchone()
    if not r:
        return None
    d = dict(r)
    try:
        d["posts"] = json.loads(d.get("posts") or "[]")
    except json.JSONDecodeError:
        d["posts"] = []
    return d


def list_calendars(user_id: int, limit: int = 30) -> list[dict]:
    with _conn() as c:
        rows = c.execute(
            "SELECT cal.id, cal.brand_id, cal.month, cal.year, cal.cadence, cal.created_at, "
            "b.name AS brand_name FROM calendars cal "
            "LEFT JOIN brands b ON b.id = cal.brand_id "
            "WHERE cal.user_id=? ORDER BY cal.created_at DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def delete_calendar(user_id: int, cal_id: int) -> None:
    with _conn() as c:
        c.execute("DELETE FROM calendars WHERE id=? AND user_id=?", (cal_id, user_id))


# ------------------------------- gigs ------------------------------------- #

_GIG_FIELDS = ("title", "client", "category", "amount", "gig_date", "status", "notes")


def _gig_row(data: dict) -> dict:
    row = {k: (data.get(k) or "") for k in _GIG_FIELDS}
    try:
        row["amount"] = float(str(data.get("amount") or 0).replace("₦", "").replace(",", "").strip() or 0)
    except (TypeError, ValueError):
        row["amount"] = 0.0
    row["status"] = data.get("status") if data.get("status") in ("paid", "pending", "ongoing") else "paid"
    for k in ("title", "client", "category", "gig_date", "notes"):
        row[k] = str(row[k]).strip()
    return row


def create_gig(user_id: int, data: dict) -> dict:
    row = _gig_row(data)
    with _conn() as c:
        gid = _insert(
            c,
            f"INSERT INTO gigs (user_id, {','.join(_GIG_FIELDS)}, created_at) "
            f"VALUES (?, {','.join('?' for _ in _GIG_FIELDS)}, ?)",
            (user_id, *[row[k] for k in _GIG_FIELDS], time.time()))
    return get_gig(user_id, gid)


def update_gig(user_id: int, gig_id: int, data: dict) -> dict | None:
    row = _gig_row(data)
    with _conn() as c:
        c.execute(
            f"UPDATE gigs SET {', '.join(f'{k}=?' for k in _GIG_FIELDS)} WHERE id=? AND user_id=?",
            (*[row[k] for k in _GIG_FIELDS], gig_id, user_id),
        )
    return get_gig(user_id, gig_id)


def get_gig(user_id: int, gig_id: int) -> dict | None:
    with _conn() as c:
        r = c.execute("SELECT * FROM gigs WHERE id=? AND user_id=?", (gig_id, user_id)).fetchone()
    return dict(r) if r else None


def list_gigs(user_id: int) -> list[dict]:
    with _conn() as c:
        rows = c.execute(
            "SELECT * FROM gigs WHERE user_id=? ORDER BY (gig_date='') ASC, gig_date DESC, created_at DESC",
            (user_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def delete_gig(user_id: int, gig_id: int) -> None:
    with _conn() as c:
        c.execute("DELETE FROM gigs WHERE id=? AND user_id=?", (gig_id, user_id))


def gig_summary(user_id: int) -> dict:
    with _conn() as c:
        rows = c.execute("SELECT amount, status, gig_date FROM gigs WHERE user_id=?", (user_id,)).fetchall()
    earned = pending = month_earned = 0.0
    count = len(rows)
    month_prefix = time.strftime("%Y-%m")
    for r in rows:
        amt = r["amount"] or 0
        if r["status"] == "pending":
            pending += amt
        else:
            earned += amt
            if (r["gig_date"] or "").startswith(month_prefix):
                month_earned += amt
    return {
        "earned": round(earned, 2), "pending": round(pending, 2),
        "count": count, "month_earned": round(month_earned, 2),
        "avg": round(earned / count, 2) if count else 0,
    }


# ------------------------------- suggestions ------------------------------ #

def get_suggestion(user_id: int, day: str, event_key: str, brand_id) -> dict | None:
    bid = brand_id if brand_id else -1
    with _conn() as c:
        r = c.execute(
            "SELECT idea, voice, type FROM suggestions WHERE user_id=? AND day=? AND event_key=? "
            "AND COALESCE(brand_id,-1)=? ORDER BY id DESC LIMIT 1",
            (user_id, day, event_key, bid)).fetchone()
    return dict(r) if r else None


def save_suggestion(user_id: int, day: str, event_key: str, brand_id, idea: str, voice: str, type_: str) -> None:
    with _conn() as c:
        _insert(c, "INSERT INTO suggestions (user_id, day, event_key, brand_id, idea, voice, type, created_at) "
                   "VALUES (?,?,?,?,?,?,?,?)",
                (user_id, day, event_key, brand_id, idea, voice, type_, time.time()))


# ------------------------------- home/dashboard --------------------------- #

def home_overview(user_id: int) -> dict:
    """Everything the Home dashboard needs, in one shot, for one user."""
    now = time.time()
    win30 = now - 30 * 86400          # current quota window
    prev30 = win30 - 30 * 86400        # the 30 days before that
    win14 = now - 14 * 86400
    REAL = "g.content_type NOT IN ('content_calendar','brand_learn','bulk_catalog')"   # exclude non-copy rows
    with _conn() as c:
        total = c.execute(
            f"SELECT COUNT(*) AS n FROM generations g WHERE g.user_id=? AND {REAL}",
            (user_id,)).fetchone()["n"]
        month = c.execute(
            f"SELECT COUNT(*) AS n FROM generations g WHERE g.user_id=? AND {REAL} AND g.created_at>=?",
            (user_id, win30)).fetchone()["n"]
        prev = c.execute(
            f"SELECT COUNT(*) AS n FROM generations g WHERE g.user_id=? AND {REAL} "
            f"AND g.created_at>=? AND g.created_at<?", (user_id, prev30, win30)).fetchone()["n"]
        by_tone = [dict(r) for r in c.execute(
            f"SELECT g.tone, COUNT(*) AS n FROM generations g WHERE g.user_id=? AND {REAL} "
            f"AND g.tone IS NOT NULL AND g.tone != '' GROUP BY g.tone ORDER BY 2 DESC LIMIT 6",
            (user_id,)).fetchall()]
        by_type = [dict(r) for r in c.execute(
            f"SELECT g.content_type, COUNT(*) AS n FROM generations g WHERE g.user_id=? AND {REAL} "
            f"GROUP BY g.content_type ORDER BY 2 DESC LIMIT 5", (user_id,)).fetchall()]
        daily = [dict(r) for r in c.execute(
            f"SELECT {_DAY} AS d, COUNT(*) AS n FROM generations g WHERE g.user_id=? AND g.created_at>=? "
            f"GROUP BY 1 ORDER BY 1", (user_id, win14)).fetchall()]
        active_days = [r["d"] for r in c.execute(
            f"SELECT DISTINCT {_DAY} AS d FROM generations g WHERE g.user_id=? AND g.created_at>=? "
            f"ORDER BY 1 DESC", (user_id, now - 70 * 86400)).fetchall()]
        recent = [dict(r) for r in c.execute(
            "SELECT g.content_type, g.tone, g.brief, g.created_at, b.name AS brand_name "
            "FROM generations g LEFT JOIN brands b ON b.id=g.brand_id "
            "WHERE g.user_id=? ORDER BY g.created_at DESC LIMIT 6", (user_id,)).fetchall()]
        last_gen = c.execute(
            "SELECT g.content_type, g.tone, g.brief, g.brand_id, g.created_at, b.name AS brand_name "
            "FROM generations g LEFT JOIN brands b ON b.id=g.brand_id "
            f"WHERE g.user_id=? AND {REAL} ORDER BY g.created_at DESC LIMIT 1", (user_id,)).fetchone()
        saved = c.execute("SELECT COUNT(*) AS n FROM favorites WHERE user_id=?", (user_id,)).fetchone()["n"]
        brands_n = c.execute("SELECT COUNT(*) AS n FROM brands WHERE user_id=?", (user_id,)).fetchone()["n"]
        last_cal = c.execute(
            "SELECT id, month, year, posts FROM calendars WHERE user_id=? ORDER BY created_at DESC LIMIT 1",
            (user_id,)).fetchone()
        # a brand that still has no samples (good "finish setup" nudge)
        thin_brand = c.execute(
            "SELECT id, name FROM brands WHERE user_id=? AND (samples IS NULL OR samples='') "
            "ORDER BY created_at DESC LIMIT 1", (user_id,)).fetchone()
    return {
        "total": total, "month": month, "prev_month": prev,
        "by_tone": by_tone, "by_type": by_type, "daily": daily,
        "active_days": active_days, "recent": recent,
        "last_gen": dict(last_gen) if last_gen else None,
        "saved": saved, "brands": brands_n,
        "last_calendar": dict(last_cal) if last_cal else None,
        "thin_brand": dict(thin_brand) if thin_brand else None,
    }


# ------------------------------- admin ------------------------------------ #

def admin_overview() -> dict:
    since = time.time() - 30 * 86400
    with _conn() as c:
        total_users = c.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]
        new_users_30d = c.execute("SELECT COUNT(*) AS n FROM users WHERE created_at>=?", (since,)).fetchone()["n"]
        by_plan = [dict(r) for r in c.execute(
            "SELECT plan, COUNT(*) AS n FROM users GROUP BY plan").fetchall()]
        g = c.execute(
            "SELECT COUNT(*) AS n, COALESCE(SUM(input_tokens),0) AS it, "
            "COALESCE(SUM(output_tokens),0) AS ot, COALESCE(SUM(cost),0) AS cost FROM generations").fetchone()
        gm = c.execute(
            "SELECT COUNT(*) AS n, COALESCE(SUM(cost),0) AS cost FROM generations WHERE created_at>=?",
            (since,)).fetchone()
        by_type = [dict(r) for r in c.execute(
            "SELECT content_type, COUNT(*) AS n, COALESCE(SUM(cost),0) AS cost "
            "FROM generations GROUP BY content_type ORDER BY 2 DESC").fetchall()]
        by_model = [dict(r) for r in c.execute(
            "SELECT COALESCE(NULLIF(model,''),'(demo)') AS model, COUNT(*) AS n, COALESCE(SUM(cost),0) AS cost "
            "FROM generations GROUP BY model ORDER BY 3 DESC").fetchall()]
        signups = [dict(r) for r in c.execute(
            f"SELECT {_DAY} AS d, COUNT(*) AS n FROM users GROUP BY 1 ORDER BY 1 DESC LIMIT 14").fetchall()]
        gens_daily = [dict(r) for r in c.execute(
            f"SELECT {_DAY} AS d, COUNT(*) AS n, COALESCE(SUM(cost),0) AS cost "
            f"FROM generations GROUP BY 1 ORDER BY 1 DESC LIMIT 14").fetchall()]
        brands = c.execute("SELECT COUNT(*) AS n FROM brands").fetchone()["n"]
        calendars = c.execute("SELECT COUNT(*) AS n FROM calendars").fetchone()["n"]
        gigs = c.execute("SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS v FROM gigs").fetchone()
        active_7d = c.execute("SELECT COUNT(DISTINCT user_id) AS n FROM generations WHERE created_at>=?",
                              (time.time() - 7 * 86400,)).fetchone()["n"]
        active_30d = c.execute("SELECT COUNT(DISTINCT user_id) AS n FROM generations WHERE created_at>=?",
                               (since,)).fetchone()["n"]
        suspended = c.execute("SELECT COUNT(*) AS n FROM users WHERE suspended=1").fetchone()["n"]
    return {
        "total_users": total_users, "new_users_30d": new_users_30d,
        "by_plan": by_plan, "by_type": by_type, "by_model": by_model,
        "generations": g["n"], "input_tokens": g["it"], "output_tokens": g["ot"],
        "ai_spend": round(g["cost"], 2),
        "ai_spend_30d": round(gm["cost"], 2), "generations_30d": gm["n"],
        "signups_daily": list(reversed(signups)),
        "gens_daily": list(reversed(gens_daily)),
        "brands": brands, "calendars": calendars,
        "gigs": gigs["n"], "gigs_value": round(gigs["v"], 2),
        "active_7d": active_7d, "active_30d": active_30d, "suspended_users": suspended,
    }


def admin_users() -> list[dict]:
    with _conn() as c:
        rows = c.execute(
            "SELECT u.id, u.email, u.name, u.plan, u.created_at, u.onboarded, u.suspended, "
            "COUNT(g.id) AS gens, COALESCE(SUM(g.input_tokens),0) AS it, "
            "COALESCE(SUM(g.output_tokens),0) AS ot, COALESCE(SUM(g.cost),0) AS cost, "
            "MAX(g.created_at) AS last_active "
            "FROM users u LEFT JOIN generations g ON g.user_id=u.id "
            "GROUP BY u.id, u.email, u.name, u.plan, u.created_at, u.onboarded, u.suspended "
            "ORDER BY u.created_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def admin_user_detail(uid: int) -> dict | None:
    with _conn() as c:
        u = c.execute("SELECT id,email,name,plan,onboarded,created_at,suspended,notes FROM users WHERE id=?", (uid,)).fetchone()
        if not u:
            return None
        daily = [dict(r) for r in c.execute(
            f"SELECT {_DAY} AS d, COUNT(*) AS n, COALESCE(SUM(cost),0) AS cost "
            f"FROM generations WHERE user_id=? GROUP BY 1 ORDER BY 1 DESC LIMIT 14", (uid,)).fetchall()]
        g = c.execute(
            "SELECT COUNT(*) AS n, COALESCE(SUM(input_tokens),0) AS it, "
            "COALESCE(SUM(output_tokens),0) AS ot, COALESCE(SUM(cost),0) AS cost FROM generations WHERE user_id=?",
            (uid,)).fetchone()
        by_type = [dict(r) for r in c.execute(
            "SELECT content_type, COUNT(*) AS n FROM generations WHERE user_id=? "
            "GROUP BY content_type ORDER BY 2 DESC", (uid,)).fetchall()]
        recent = [dict(r) for r in c.execute(
            "SELECT content_type, tone, brief, model, input_tokens, output_tokens, cost, created_at "
            "FROM generations WHERE user_id=? ORDER BY created_at DESC LIMIT 15", (uid,)).fetchall()]
        brands = c.execute("SELECT COUNT(*) AS n FROM brands WHERE user_id=?", (uid,)).fetchone()["n"]
        calendars = c.execute("SELECT COUNT(*) AS n FROM calendars WHERE user_id=?", (uid,)).fetchone()["n"]
        favs = c.execute("SELECT COUNT(*) AS n FROM favorites WHERE user_id=?", (uid,)).fetchone()["n"]
        fb = c.execute(
            "SELECT COALESCE(SUM(CASE WHEN rating='up' THEN 1 ELSE 0 END),0) AS up, "
            "COALESCE(SUM(CASE WHEN rating='down' THEN 1 ELSE 0 END),0) AS down "
            "FROM brand_feedback WHERE user_id=?", (uid,)).fetchone()
        gigs = c.execute("SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS v FROM gigs WHERE user_id=?", (uid,)).fetchone()
    return {
        "user": dict(u),
        "gens": g["n"], "input_tokens": g["it"], "output_tokens": g["ot"], "cost": round(g["cost"], 2),
        "by_type": by_type, "recent": recent, "daily": list(reversed(daily)),
        "brands": brands, "calendars": calendars, "favorites": favs,
        "feedback_up": fb["up"], "feedback_down": fb["down"],
        "gigs": gigs["n"], "gigs_value": round(gigs["v"], 2),
    }


def admin_update_user(uid: int, plan=None, suspended=None, notes=None) -> dict | None:
    sets, params = [], []
    if plan is not None:
        sets.append("plan=?"); params.append(plan)
    if suspended is not None:
        sets.append("suspended=?"); params.append(1 if suspended else 0)
    if notes is not None:
        sets.append("notes=?"); params.append(str(notes))
    if sets:
        with _conn() as c:
            c.execute(f"UPDATE users SET {', '.join(sets)} WHERE id=?", (*params, uid))
    return get_user(uid)


def admin_delete_user(uid: int) -> bool:
    """Permanently remove a user and all of their data."""
    with _conn() as c:
        exists = c.execute("SELECT id FROM users WHERE id=?", (uid,)).fetchone()
        if not exists:
            return False
        for tbl in ("generations", "brands", "calendars", "favorites", "gigs", "brand_feedback"):
            c.execute(f"DELETE FROM {tbl} WHERE user_id=?", (uid,))
        c.execute("DELETE FROM users WHERE id=?", (uid,))
    return True
