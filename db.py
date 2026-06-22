"""SQLite persistence for Yarn AI.

Auth-aware: every brand, generation, calendar, favorite and feedback row is
scoped to a user. Kept on stdlib sqlite3 (no ORM) so the app runs with zero extra
infrastructure; maps cleanly onto Postgres for production."""

from __future__ import annotations

import json
import os
import sqlite3
import time
from pathlib import Path

# DB lives next to the code by default; on a host (Railway/Render) set
# VERTIL_DB_PATH to a path on a mounted persistent volume (e.g. /data/yarn.db)
# so data survives redeploys.
DB_PATH = Path(os.environ.get("VERTIL_DB_PATH") or (Path(__file__).resolve().parent / "yarn.db"))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _columns(c, table: str) -> set[str]:
    return {r["name"] for r in c.execute(f"PRAGMA table_info({table})").fetchall()}


def init_db() -> None:
    with _conn() as c:
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                email         TEXT UNIQUE NOT NULL,
                name          TEXT,
                password_hash TEXT NOT NULL,
                plan          TEXT NOT NULL DEFAULT 'free',
                created_at    REAL NOT NULL
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS brands (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     INTEGER,
                name        TEXT NOT NULL,
                industry    TEXT, audience TEXT, location TEXT,
                description TEXT, personality TEXT, samples TEXT,
                created_at  REAL NOT NULL
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS generations (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id      INTEGER,
                brand_id     INTEGER,
                content_type TEXT, tone TEXT, brief TEXT,
                output       TEXT,
                created_at   REAL NOT NULL
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS calendars (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER,
                brand_id   INTEGER,
                month      TEXT, year INTEGER, cadence TEXT,
                posts      TEXT,
                created_at REAL NOT NULL
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS favorites (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id      INTEGER NOT NULL,
                brand_id     INTEGER,
                content_type TEXT, tone TEXT,
                text         TEXT NOT NULL,
                created_at   REAL NOT NULL
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS gigs (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL,
                title      TEXT NOT NULL,
                client     TEXT, category TEXT,
                amount     REAL NOT NULL DEFAULT 0,
                gig_date   TEXT, status TEXT DEFAULT 'paid',
                notes      TEXT,
                created_at REAL NOT NULL
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS brand_feedback (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL,
                brand_id   INTEGER,
                rating     TEXT NOT NULL,      -- 'up' | 'down'
                text       TEXT NOT NULL,
                created_at REAL NOT NULL
            )
            """
        )
        # --- lightweight migrations: add user_id to legacy tables if missing ---
        for tbl in ("brands", "generations", "calendars"):
            if "user_id" not in _columns(c, tbl):
                c.execute(f"ALTER TABLE {tbl} ADD COLUMN user_id INTEGER")
        if "onboarded" not in _columns(c, "users"):
            c.execute("ALTER TABLE users ADD COLUMN onboarded INTEGER NOT NULL DEFAULT 0")
        if "is_admin" not in _columns(c, "users"):
            c.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")
        # token + cost tracking on generations (for the admin dashboard)
        for col, ddl in (("input_tokens", "INTEGER DEFAULT 0"),
                         ("output_tokens", "INTEGER DEFAULT 0"),
                         ("cost", "REAL DEFAULT 0"),
                         ("model", "TEXT DEFAULT ''")):
            if col not in _columns(c, "generations"):
                c.execute(f"ALTER TABLE generations ADD COLUMN {col} {ddl}")


# ------------------------------- users ------------------------------------ #

def create_user(email: str, name: str, password_hash: str) -> dict:
    with _conn() as c:
        cur = c.execute(
            "INSERT INTO users (email, name, password_hash, plan, created_at) VALUES (?,?,?,?,?)",
            (email.lower().strip(), name.strip(), password_hash, "free", time.time()),
        )
        uid = cur.lastrowid
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
            "AND content_type != 'content_calendar'",
            (user_id, since),
        ).fetchone()
    return r["n"] if r else 0


# ----------------------------- brands ------------------------------------- #

_BRAND_FIELDS = ("name", "industry", "audience", "location",
                 "description", "personality", "samples")


def create_brand(user_id: int, data: dict) -> dict:
    row = {k: (data.get(k) or "").strip() for k in _BRAND_FIELDS}
    with _conn() as c:
        cur = c.execute(
            f"INSERT INTO brands (user_id, {','.join(_BRAND_FIELDS)}, created_at) "
            f"VALUES (?, {','.join('?' for _ in _BRAND_FIELDS)}, ?)",
            (user_id, *[row[k] for k in _BRAND_FIELDS], time.time()),
        )
        bid = cur.lastrowid
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
        cur = c.execute(
            "INSERT INTO favorites (user_id, brand_id, content_type, tone, text, created_at) "
            "VALUES (?,?,?,?,?,?)",
            (user_id, brand_id, content_type, tone, text, time.time()),
        )
        fid = cur.lastrowid
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
    """Recent 👍 outputs for a brand — fed back into the prompt so the voice learns."""
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
        cur = c.execute(
            "INSERT INTO calendars (user_id, brand_id, month, year, cadence, posts, created_at) "
            "VALUES (?,?,?,?,?,?,?)",
            (user_id, brand_id, month, year, cadence, json.dumps(posts), time.time()),
        )
        cal_id = cur.lastrowid
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
        cur = c.execute(
            f"INSERT INTO gigs (user_id, {','.join(_GIG_FIELDS)}, created_at) "
            f"VALUES (?, {','.join('?' for _ in _GIG_FIELDS)}, ?)",
            (user_id, *[row[k] for k in _GIG_FIELDS], time.time()),
        )
        gid = cur.lastrowid
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


# ------------------------------- admin ------------------------------------ #

def admin_overview() -> dict:
    since = time.time() - 30 * 86400
    with _conn() as c:
        total_users = c.execute("SELECT COUNT(*) n FROM users").fetchone()["n"]
        new_users_30d = c.execute("SELECT COUNT(*) n FROM users WHERE created_at>=?", (since,)).fetchone()["n"]
        by_plan = [dict(r) for r in c.execute(
            "SELECT plan, COUNT(*) n FROM users GROUP BY plan").fetchall()]
        g = c.execute(
            "SELECT COUNT(*) n, COALESCE(SUM(input_tokens),0) it, "
            "COALESCE(SUM(output_tokens),0) ot, COALESCE(SUM(cost),0) cost FROM generations").fetchone()
        gm = c.execute(
            "SELECT COUNT(*) n, COALESCE(SUM(cost),0) cost FROM generations WHERE created_at>=?",
            (since,)).fetchone()
        by_type = [dict(r) for r in c.execute(
            "SELECT content_type, COUNT(*) n, COALESCE(SUM(cost),0) cost "
            "FROM generations GROUP BY content_type ORDER BY n DESC").fetchall()]
        by_model = [dict(r) for r in c.execute(
            "SELECT COALESCE(NULLIF(model,''),'(demo)') model, COUNT(*) n, COALESCE(SUM(cost),0) cost "
            "FROM generations GROUP BY model ORDER BY cost DESC").fetchall()]
        signups = [dict(r) for r in c.execute(
            "SELECT date(created_at,'unixepoch') d, COUNT(*) n FROM users "
            "GROUP BY d ORDER BY d DESC LIMIT 14").fetchall()]
        gens_daily = [dict(r) for r in c.execute(
            "SELECT date(created_at,'unixepoch') d, COUNT(*) n, COALESCE(SUM(cost),0) cost "
            "FROM generations GROUP BY d ORDER BY d DESC LIMIT 14").fetchall()]
        brands = c.execute("SELECT COUNT(*) n FROM brands").fetchone()["n"]
        calendars = c.execute("SELECT COUNT(*) n FROM calendars").fetchone()["n"]
        gigs = c.execute("SELECT COUNT(*) n, COALESCE(SUM(amount),0) v FROM gigs").fetchone()
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
    }


def admin_users() -> list[dict]:
    with _conn() as c:
        rows = c.execute(
            "SELECT u.id, u.email, u.name, u.plan, u.created_at, u.onboarded, "
            "COUNT(g.id) gens, COALESCE(SUM(g.input_tokens),0) it, "
            "COALESCE(SUM(g.output_tokens),0) ot, COALESCE(SUM(g.cost),0) cost, "
            "MAX(g.created_at) last_active "
            "FROM users u LEFT JOIN generations g ON g.user_id=u.id "
            "GROUP BY u.id ORDER BY u.created_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def admin_user_detail(uid: int) -> dict | None:
    with _conn() as c:
        u = c.execute("SELECT id,email,name,plan,onboarded,created_at FROM users WHERE id=?", (uid,)).fetchone()
        if not u:
            return None
        g = c.execute(
            "SELECT COUNT(*) n, COALESCE(SUM(input_tokens),0) it, "
            "COALESCE(SUM(output_tokens),0) ot, COALESCE(SUM(cost),0) cost FROM generations WHERE user_id=?",
            (uid,)).fetchone()
        by_type = [dict(r) for r in c.execute(
            "SELECT content_type, COUNT(*) n FROM generations WHERE user_id=? "
            "GROUP BY content_type ORDER BY n DESC", (uid,)).fetchall()]
        recent = [dict(r) for r in c.execute(
            "SELECT content_type, tone, brief, model, input_tokens, output_tokens, cost, created_at "
            "FROM generations WHERE user_id=? ORDER BY created_at DESC LIMIT 15", (uid,)).fetchall()]
        brands = c.execute("SELECT COUNT(*) n FROM brands WHERE user_id=?", (uid,)).fetchone()["n"]
        calendars = c.execute("SELECT COUNT(*) n FROM calendars WHERE user_id=?", (uid,)).fetchone()["n"]
        favs = c.execute("SELECT COUNT(*) n FROM favorites WHERE user_id=?", (uid,)).fetchone()["n"]
        fb = c.execute(
            "SELECT COALESCE(SUM(rating='up'),0) up, COALESCE(SUM(rating='down'),0) down "
            "FROM brand_feedback WHERE user_id=?", (uid,)).fetchone()
        gigs = c.execute("SELECT COUNT(*) n, COALESCE(SUM(amount),0) v FROM gigs WHERE user_id=?", (uid,)).fetchone()
    return {
        "user": dict(u),
        "gens": g["n"], "input_tokens": g["it"], "output_tokens": g["ot"], "cost": round(g["cost"], 2),
        "by_type": by_type, "recent": recent,
        "brands": brands, "calendars": calendars, "favorites": favs,
        "feedback_up": fb["up"], "feedback_down": fb["down"],
        "gigs": gigs["n"], "gigs_value": round(gigs["v"], 2),
    }
