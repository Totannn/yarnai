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
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS plan_items (
                id             {_PK},
                user_id        INTEGER NOT NULL,
                brand_id       INTEGER,
                generation_id  INTEGER,
                text           TEXT NOT NULL,
                status         TEXT NOT NULL DEFAULT 'todo',
                due_date       TEXT,
                completed_at   {_REAL},
                last_nudged_at {_REAL},
                created_at     {_REAL} NOT NULL
            )""")
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS newsletter_schedule (
                id           {_PK},
                send_date    TEXT NOT NULL,
                brief        TEXT NOT NULL,
                subject      TEXT,
                preview_text TEXT,
                body_html    TEXT,
                style        TEXT NOT NULL DEFAULT 'A',
                status       TEXT NOT NULL DEFAULT 'draft',
                sent_count   INTEGER,
                sent_at      {_REAL},
                created_at   {_REAL} NOT NULL
            )""")
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS org_seats (
                id         {_PK},
                owner_id   INTEGER NOT NULL,
                member_id  INTEGER,
                email      TEXT NOT NULL,
                token      TEXT,
                status     TEXT NOT NULL DEFAULT 'invited',
                invited_at {_REAL} NOT NULL,
                joined_at  {_REAL}
            )""")
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS social_connections (
                id                    {_PK},
                brand_id              INTEGER NOT NULL,
                platform              TEXT NOT NULL,
                upload_post_username  TEXT NOT NULL,
                status                TEXT NOT NULL DEFAULT 'pending',
                connected_at          {_REAL},
                created_at            {_REAL} NOT NULL
            )""")
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS plan_prices (
                plan_key   TEXT PRIMARY KEY,
                price      {_REAL} NOT NULL,
                updated_at {_REAL} NOT NULL
            )""")
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS queued_posts (
                id            {_PK},
                brand_id      INTEGER NOT NULL,
                base_caption  TEXT,
                overrides     TEXT,
                platforms     TEXT NOT NULL,
                media_path    TEXT,
                media_type    TEXT,
                scheduled_at  {_REAL},
                status        TEXT NOT NULL DEFAULT 'scheduled',
                approval_required INTEGER NOT NULL DEFAULT 0,
                post_urls     TEXT,
                error         TEXT,
                created_at    {_REAL} NOT NULL,
                updated_at    {_REAL} NOT NULL
            )""")
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS post_history (
                id         {_PK},
                brand_id   INTEGER NOT NULL,
                platform   TEXT NOT NULL,
                media_type TEXT,
                thumbnail  TEXT,
                caption    TEXT,
                post_url   TEXT,
                status     TEXT NOT NULL DEFAULT 'published',
                posted_at  {_REAL} NOT NULL
            )""")
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS applications (
                id         {_PK},
                name       TEXT NOT NULL,
                phone      TEXT NOT NULL,
                email      TEXT,
                handle     TEXT,
                niche      TEXT,
                note       TEXT,
                status     TEXT DEFAULT 'new',
                created_at {_REAL} NOT NULL
            )""")
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS content_items (
                id         {_PK},
                user_id    INTEGER NOT NULL,
                brand_id   INTEGER,
                title      TEXT NOT NULL,
                notes      TEXT,
                content    TEXT,
                status     TEXT NOT NULL DEFAULT 'idea',
                platform   TEXT,
                created_at {_REAL} NOT NULL,
                updated_at {_REAL} NOT NULL
            )""")
        _add_col(c, "content_items", "content", "TEXT DEFAULT ''")
        _add_col(c, "content_items", "reminder_at", f"{_REAL}")
        _add_col(c, "content_items", "reminded", "INTEGER NOT NULL DEFAULT 0")
        _add_col(c, "users", "notify_stage", "INTEGER NOT NULL DEFAULT 1")
        # Creator Initiative review workflow
        _add_col(c, "applications", "admin_notes", "TEXT DEFAULT ''")
        _add_col(c, "applications", "ai_review", "TEXT DEFAULT ''")
        _add_col(c, "applications", "status_changed_at", f"{_REAL}")
        # migrations (idempotent on both backends)
        for tbl in ("brands", "generations", "calendars"):
            _add_col(c, tbl, "user_id", "INTEGER")
        _add_col(c, "users", "onboarded", "INTEGER NOT NULL DEFAULT 0")
        _add_col(c, "users", "is_admin", "INTEGER NOT NULL DEFAULT 0")
        _add_col(c, "users", "suspended", "INTEGER NOT NULL DEFAULT 0")
        _add_col(c, "users", "notes", "TEXT DEFAULT ''")
        _add_col(c, "users", "phone", "TEXT DEFAULT ''")
        _add_col(c, "users", "newsletter_opt_out", "INTEGER NOT NULL DEFAULT 0")
        _add_col(c, "users", "last_reengage_at", f"{_REAL}")
        _add_col(c, "generations", "input_tokens", "INTEGER DEFAULT 0")
        _add_col(c, "generations", "output_tokens", "INTEGER DEFAULT 0")
        _add_col(c, "generations", "cost", f"{_REAL} DEFAULT 0")
        _add_col(c, "generations", "model", "TEXT DEFAULT ''")
        _add_col(c, "generations", "full_json", "TEXT DEFAULT ''")
        # Flyer Maker: brand logo + palette, and saved designs
        _add_col(c, "brands", "logo", "TEXT DEFAULT ''")
        _add_col(c, "brands", "colors", "TEXT DEFAULT ''")
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS designs (
                id         {_PK},
                user_id    INTEGER NOT NULL,
                brand_id   INTEGER,
                title      TEXT DEFAULT '',
                kind       TEXT DEFAULT '',
                data       TEXT DEFAULT '',
                image      TEXT DEFAULT '',
                created_at {_REAL} NOT NULL,
                updated_at {_REAL} NOT NULL
            )""")
        # Admin agents: each run produces drafts (emails, findings) a human reviews
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS agent_runs (
                id         {_PK},
                agent      TEXT NOT NULL,
                status     TEXT NOT NULL DEFAULT 'done',
                summary    TEXT DEFAULT '',
                report     TEXT DEFAULT '',
                created_by INTEGER,
                created_at {_REAL} NOT NULL
            )""")
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS agent_items (
                id         {_PK},
                run_id     INTEGER NOT NULL,
                agent      TEXT NOT NULL,
                user_id    INTEGER,
                email      TEXT DEFAULT '',
                name       TEXT DEFAULT '',
                title      TEXT DEFAULT '',
                reason     TEXT DEFAULT '',
                subject    TEXT DEFAULT '',
                body_html  TEXT DEFAULT '',
                severity   TEXT DEFAULT '',
                status     TEXT NOT NULL DEFAULT 'pending',
                created_at {_REAL} NOT NULL,
                sent_at    {_REAL}
            )""")


# ------------------------------- users ------------------------------------ #

def create_user(email: str, name: str, password_hash: str, phone: str = "") -> dict:
    with _conn() as c:
        uid = _insert(
            c, "INSERT INTO users (email, name, password_hash, plan, phone, created_at) VALUES (?,?,?,?,?,?)",
            (email.lower().strip(), name.strip(), password_hash, "free", (phone or "").strip(), time.time()))
    return get_user(uid)


def get_user(user_id: int) -> dict | None:
    with _conn() as c:
        r = c.execute("SELECT id, email, name, plan, onboarded, phone, notify_stage, is_admin, created_at FROM users WHERE id=?", (user_id,)).fetchone()
    return dict(r) if r else None


def set_onboarded(user_id: int) -> None:
    with _conn() as c:
        c.execute("UPDATE users SET onboarded=1 WHERE id=?", (user_id,))


def update_user_name(user_id: int, name: str) -> dict | None:
    with _conn() as c:
        c.execute("UPDATE users SET name=? WHERE id=?", (name.strip(), user_id))
    return get_user(user_id)


def update_user_phone(user_id: int, phone: str) -> dict | None:
    with _conn() as c:
        c.execute("UPDATE users SET phone=? WHERE id=?", ((phone or "").strip(), user_id))
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
            "AND content_type NOT IN ('content_calendar','brand_learn','bulk_catalog','reengagement')",
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


def set_brand_style(user_id: int, brand_id: int, logo: str | None = None,
                    colors: str | None = None) -> dict | None:
    """Update a brand's logo and/or palette. Owner only (WHERE user_id)."""
    sets, args = [], []
    if logo is not None:
        sets.append("logo=?"); args.append(logo)
    if colors is not None:
        sets.append("colors=?"); args.append(colors)
    if sets:
        with _conn() as c:
            c.execute(f"UPDATE brands SET {', '.join(sets)} WHERE id=? AND user_id=?", (*args, brand_id, user_id))
    return get_brand(user_id, brand_id)


# ------------------------------- designs (Flyer Maker) -------------------- #

def save_design(user_id: int, design_id: int | None, brand_id: int | None, title: str,
                kind: str, data: str, image: str | None) -> dict | None:
    now = time.time()
    with _conn() as c:
        if design_id:
            row = c.execute("SELECT id FROM designs WHERE id=? AND user_id=?", (design_id, user_id)).fetchone()
            if not row:
                return None
            if image is not None:
                c.execute("UPDATE designs SET brand_id=?, title=?, kind=?, data=?, image=?, updated_at=? "
                          "WHERE id=? AND user_id=?", (brand_id, title, kind, data, image, now, design_id, user_id))
            else:
                c.execute("UPDATE designs SET brand_id=?, title=?, kind=?, data=?, updated_at=? "
                          "WHERE id=? AND user_id=?", (brand_id, title, kind, data, now, design_id, user_id))
        else:
            design_id = _insert(c, "INSERT INTO designs (user_id, brand_id, title, kind, data, image, created_at, updated_at) "
                                   "VALUES (?,?,?,?,?,?,?,?)", (user_id, brand_id, title, kind, data, image or "", now, now))
        r = c.execute("SELECT * FROM designs WHERE id=? AND user_id=?", (design_id, user_id)).fetchone()
    return dict(r) if r else None


def list_designs(user_id: int) -> list[dict]:
    with _conn() as c:
        rows = c.execute("SELECT d.*, b.name AS brand_name FROM designs d LEFT JOIN brands b ON b.id=d.brand_id "
                         "WHERE d.user_id=? ORDER BY d.updated_at DESC", (user_id,)).fetchall()
    return [dict(r) for r in rows]


def get_design(user_id: int, design_id: int) -> dict | None:
    with _conn() as c:
        r = c.execute("SELECT * FROM designs WHERE id=? AND user_id=?", (design_id, user_id)).fetchone()
    return dict(r) if r else None


def delete_design(user_id: int, design_id: int) -> str | None:
    """Delete a design; returns its image path so the caller can remove the file."""
    with _conn() as c:
        r = c.execute("SELECT image FROM designs WHERE id=? AND user_id=?", (design_id, user_id)).fetchone()
        if not r:
            return None
        c.execute("DELETE FROM designs WHERE id=? AND user_id=?", (design_id, user_id))
    return r["image"] or ""


def get_brand(user_id: int, brand_id: int) -> dict | None:
    with _conn() as c:
        r = c.execute("SELECT * FROM brands WHERE id=? AND user_id=?", (brand_id, user_id)).fetchone()
        if not r:
            owner = c.execute("SELECT owner_id FROM org_seats WHERE member_id=? AND status='active'",
                              (user_id,)).fetchone()
            if owner:
                r = c.execute("SELECT * FROM brands WHERE id=? AND user_id=?",
                             (brand_id, owner["owner_id"])).fetchone()
    return dict(r) if r else None


def list_brands(user_id: int) -> list[dict]:
    with _conn() as c:
        seat = c.execute("SELECT owner_id FROM org_seats WHERE member_id=? AND status='active'",
                         (user_id,)).fetchone()
        owner_id = seat["owner_id"] if seat else user_id
        rows = c.execute("SELECT * FROM brands WHERE user_id=? ORDER BY created_at DESC", (owner_id,)).fetchall()
    return [dict(r) for r in rows]


def count_brands(user_id: int) -> int:
    with _conn() as c:
        seat = c.execute("SELECT owner_id FROM org_seats WHERE member_id=? AND status='active'",
                         (user_id,)).fetchone()
        owner_id = seat["owner_id"] if seat else user_id
        r = c.execute("SELECT COUNT(*) AS n FROM brands WHERE user_id=?", (owner_id,)).fetchone()
    return r["n"] if r else 0


def delete_brand(user_id: int, brand_id: int) -> None:
    with _conn() as c:
        c.execute("DELETE FROM brands WHERE id=? AND user_id=?", (brand_id, user_id))


# --------------------------- generations ---------------------------------- #

def save_generation(user_id: int, brand_id, content_type, tone, brief, variants,
                    model: str = "", input_tokens: int = 0, output_tokens: int = 0,
                    cost: float = 0.0, full_json: str = "") -> int:
    """full_json optionally stores the complete structured result (e.g. an advisor's
    full JSON response) so it can be replayed later without another AI call.
    Returns the new row's id."""
    with _conn() as c:
        return _insert(
            c,
            "INSERT INTO generations (user_id, brand_id, content_type, tone, brief, output, "
            "model, input_tokens, output_tokens, cost, full_json, created_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (user_id, brand_id, content_type, tone, brief, json.dumps(variants),
             model, input_tokens, output_tokens, cost, full_json, time.time()),
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


def recent_generations_by_type(user_id: int, content_type: str, limit: int = 6) -> list[dict]:
    with _conn() as c:
        rows = c.execute(
            "SELECT g.*, b.name AS brand_name FROM generations g "
            "LEFT JOIN brands b ON b.id = g.brand_id "
            "WHERE g.user_id=? AND g.content_type=? ORDER BY g.created_at DESC LIMIT ?",
            (user_id, content_type, limit),
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        try:
            d["variants"] = json.loads(d.pop("output") or "[]")
        except json.JSONDecodeError:
            d["variants"] = []
        fj = d.pop("full_json", "") or ""
        d["full_result"] = None
        if fj:
            try:
                d["full_result"] = json.loads(fj)
            except json.JSONDecodeError:
                d["full_result"] = None
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


# ------------------- Creator Initiative applications ---------------------- #

def add_application(name: str, phone: str, email: str, handle: str,
                    niche: str, note: str) -> dict:
    with _conn() as c:
        aid = _insert(
            c, "INSERT INTO applications (name, phone, email, handle, niche, note, status, created_at) "
               "VALUES (?,?,?,?,?,?,?,?)",
            (name, phone, email, handle, niche, note, "new", time.time()))
    return {"id": aid}


def list_applications(limit: int = 500) -> list[dict]:
    with _conn() as c:
        rows = c.execute(
            "SELECT * FROM applications ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(r) for r in rows]


def application_count() -> int:
    with _conn() as c:
        r = c.execute("SELECT COUNT(*) AS n FROM applications").fetchone()
    return int(r["n"]) if r else 0


def set_application_status(app_id: int, status: str) -> None:
    with _conn() as c:
        c.execute("UPDATE applications SET status=?, status_changed_at=? WHERE id=?", (status, time.time(), app_id))


def get_application(app_id: int) -> dict | None:
    with _conn() as c:
        r = c.execute("SELECT * FROM applications WHERE id=?", (app_id,)).fetchone()
    return dict(r) if r else None


def update_application(app_id: int, **fields) -> None:
    allowed = {k: v for k, v in fields.items() if k in ("admin_notes", "ai_review")}
    if not allowed:
        return
    sets = ", ".join(f"{k}=?" for k in allowed)
    with _conn() as c:
        c.execute(f"UPDATE applications SET {sets} WHERE id=?", (*allowed.values(), app_id))


# --------------------- content board (idea → posted) ---------------------- #

def add_content_item(user_id: int, title: str, notes: str = "",
                     brand_id=None, platform: str = "") -> dict:
    now = time.time()
    with _conn() as c:
        iid = _insert(
            c, "INSERT INTO content_items (user_id, brand_id, title, notes, status, platform, created_at, updated_at) "
               "VALUES (?,?,?,?,?,?,?,?)",
            (user_id, brand_id, title, notes, "idea", platform, now, now))
        r = c.execute("SELECT * FROM content_items WHERE id=?", (iid,)).fetchone()
    return dict(r)


def list_content_items(user_id: int) -> list[dict]:
    with _conn() as c:
        rows = c.execute(
            "SELECT * FROM content_items WHERE user_id=? ORDER BY updated_at DESC", (user_id,)
        ).fetchall()
    return [dict(r) for r in rows]


def get_content_item(user_id: int, item_id: int) -> dict | None:
    with _conn() as c:
        r = c.execute("SELECT * FROM content_items WHERE id=? AND user_id=?", (item_id, user_id)).fetchone()
    return dict(r) if r else None


# _UNSET lets callers distinguish "leave as-is" (default) from "clear to NULL" (None)
_UNSET = object()


def update_content_item(user_id: int, item_id: int, status=None,
                        title=None, notes=None, platform=None, content=None,
                        reminder_at=_UNSET) -> None:
    sets, vals = [], []
    if status is not None:
        sets.append("status=?"); vals.append(status)
    if title is not None:
        sets.append("title=?"); vals.append(title)
    if notes is not None:
        sets.append("notes=?"); vals.append(notes)
    if platform is not None:
        sets.append("platform=?"); vals.append(platform)
    if content is not None:
        sets.append("content=?"); vals.append(content)
    if reminder_at is not _UNSET:
        sets.append("reminder_at=?"); vals.append(reminder_at)
        sets.append("reminded=?"); vals.append(0)  # a fresh reminder time re-arms it
    if not sets:
        return
    sets.append("updated_at=?"); vals.append(time.time())
    vals += [item_id, user_id]
    with _conn() as c:
        c.execute(f"UPDATE content_items SET {', '.join(sets)} WHERE id=? AND user_id=?", tuple(vals))


def delete_content_item(user_id: int, item_id: int) -> None:
    with _conn() as c:
        c.execute("DELETE FROM content_items WHERE id=? AND user_id=?", (item_id, user_id))


def due_reminders(now: float) -> list[dict]:
    """Content items whose reminder time has arrived and not yet sent."""
    with _conn() as c:
        rows = c.execute(
            "SELECT * FROM content_items WHERE reminder_at IS NOT NULL "
            "AND reminder_at<=? AND reminded=0 ORDER BY reminder_at", (now,)
        ).fetchall()
    return [dict(r) for r in rows]


def mark_reminded(item_id: int) -> None:
    with _conn() as c:
        c.execute("UPDATE content_items SET reminded=1 WHERE id=?", (item_id,))


def set_notify_stage(user_id: int, on: bool) -> None:
    with _conn() as c:
        c.execute("UPDATE users SET notify_stage=? WHERE id=?", (1 if on else 0, user_id))


def set_admin(user_id: int, on: bool) -> None:
    with _conn() as c:
        c.execute("UPDATE users SET is_admin=? WHERE id=?", (1 if on else 0, user_id))


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


# ------------------------------ plan items --------------------------------- #
# Turns an advisor's "next 30 days" steps into a trackable, nudge-able checklist.

def create_plan_items(user_id: int, brand_id, generation_id, steps: list) -> list[dict]:
    steps = [str(s).strip() for s in (steps or []) if str(s).strip()][:8]
    if not steps:
        return []
    n = len(steps)
    now = time.time()
    out = []
    with _conn() as c:
        for i, text in enumerate(steps):
            due_date = time.strftime("%Y-%m-%d", time.localtime(now + round((i + 1) * 30 / n) * 86400))
            pid = _insert(
                c, "INSERT INTO plan_items (user_id, brand_id, generation_id, text, status, due_date, created_at) "
                   "VALUES (?,?,?,?,?,?,?)",
                (user_id, brand_id, generation_id, text, "todo", due_date, now))
            out.append({"id": pid, "user_id": user_id, "brand_id": brand_id, "generation_id": generation_id,
                       "text": text, "status": "todo", "due_date": due_date,
                       "completed_at": None, "created_at": now, "brand_name": None})
    return out


def list_plan_items(user_id: int) -> list[dict]:
    with _conn() as c:
        rows = c.execute(
            "SELECT p.*, b.name AS brand_name FROM plan_items p "
            "LEFT JOIN brands b ON b.id = p.brand_id "
            "WHERE p.user_id=? ORDER BY (p.status='done'), p.due_date, p.created_at",
            (user_id,)).fetchall()
    return [dict(r) for r in rows]


def toggle_plan_item(user_id: int, item_id: int, done: bool) -> dict | None:
    with _conn() as c:
        c.execute("UPDATE plan_items SET status=?, completed_at=? WHERE id=? AND user_id=?",
                  ("done" if done else "todo", time.time() if done else None, item_id, user_id))
        r = c.execute(
            "SELECT p.*, b.name AS brand_name FROM plan_items p LEFT JOIN brands b ON b.id=p.brand_id "
            "WHERE p.id=? AND p.user_id=?", (item_id, user_id)).fetchone()
    return dict(r) if r else None


def delete_plan_item(user_id: int, item_id: int) -> None:
    with _conn() as c:
        c.execute("DELETE FROM plan_items WHERE id=? AND user_id=?", (item_id, user_id))


def plan_progress(user_id: int) -> dict:
    week_start = time.time() - 7 * 86400
    today = time.strftime("%Y-%m-%d")
    with _conn() as c:
        total = c.execute("SELECT COUNT(*) AS n FROM plan_items WHERE user_id=?", (user_id,)).fetchone()["n"]
        done = c.execute("SELECT COUNT(*) AS n FROM plan_items WHERE user_id=? AND status='done'",
                         (user_id,)).fetchone()["n"]
        week_done = c.execute(
            "SELECT COUNT(*) AS n FROM plan_items WHERE user_id=? AND status='done' AND completed_at>=?",
            (user_id, week_start)).fetchone()["n"]
        overdue = c.execute(
            "SELECT COUNT(*) AS n FROM plan_items WHERE user_id=? AND status='todo' AND due_date<?",
            (user_id, today)).fetchone()["n"]
    return {"total": total, "done": done, "week_done": week_done, "overdue": overdue}


def items_needing_nudge(cutoff_days: int = 2) -> list[dict]:
    """Overdue todo items not nudged in the last `cutoff_days` days, for the reminder cron."""
    cutoff = time.time() - cutoff_days * 86400
    today = time.strftime("%Y-%m-%d")
    with _conn() as c:
        rows = c.execute(
            "SELECT p.*, u.email, u.name AS user_name, b.name AS brand_name FROM plan_items p "
            "JOIN users u ON u.id=p.user_id LEFT JOIN brands b ON b.id=p.brand_id "
            "WHERE p.status='todo' AND p.due_date<? AND u.suspended=0 "
            "AND (p.last_nudged_at IS NULL OR p.last_nudged_at<?) "
            "ORDER BY p.user_id, p.due_date",
            (today, cutoff)).fetchall()
    return [dict(r) for r in rows]


def mark_nudged(item_ids: list) -> None:
    if not item_ids:
        return
    now = time.time()
    with _conn() as c:
        qs = ",".join("?" for _ in item_ids)
        c.execute(f"UPDATE plan_items SET last_nudged_at=? WHERE id IN ({qs})", (now, *item_ids))


# ---------------------------- re-engagement -------------------------------- #
# Users who set up a brand but have gone quiet — a candidate list for the
# win-back agent, which hands them a ready-made post instead of a plain nudge.

def quiet_users(inactive_days: int = 7, min_account_age_days: int = 3, cooldown_days: int = 10) -> list:
    now = time.time()
    with _conn() as c:
        rows = c.execute(
            "SELECT u.id, u.email, u.name FROM users u "
            "WHERE u.suspended=0 AND u.created_at<? "
            "AND (u.last_reengage_at IS NULL OR u.last_reengage_at<?) "
            "AND EXISTS (SELECT 1 FROM brands b WHERE b.user_id=u.id) "
            "AND NOT EXISTS (SELECT 1 FROM generations g WHERE g.user_id=u.id "
            "AND g.content_type NOT IN ('content_calendar','brand_learn','bulk_catalog','reengagement') "
            "AND g.created_at>=?) "
            "ORDER BY u.created_at",
            (now - min_account_age_days * 86400, now - cooldown_days * 86400, now - inactive_days * 86400),
        ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            b = c.execute("SELECT id, name FROM brands WHERE user_id=? ORDER BY created_at DESC LIMIT 1",
                         (d["id"],)).fetchone()
            d["brand_id"] = b["id"] if b else None
            d["brand_name"] = b["name"] if b else None
            out.append(d)
    return out


def set_reengaged(user_id: int) -> None:
    with _conn() as c:
        c.execute("UPDATE users SET last_reengage_at=? WHERE id=?", (time.time(), user_id))


# -------------------------------- team seats -------------------------------- #
# A "Business" plan owner can invite teammates by email; each invited person
# gets their own Vertil login, linked here as a seat. Seats share the owner's
# brand voices and pool the owner's monthly generation quota.

def get_org_owner(user_id: int) -> int | None:
    """If user_id is an active seat on someone else's workspace, returns the owner's id."""
    with _conn() as c:
        r = c.execute("SELECT owner_id FROM org_seats WHERE member_id=? AND status='active'",
                      (user_id,)).fetchone()
    return r["owner_id"] if r else None


def count_active_seats(owner_id: int) -> int:
    with _conn() as c:
        r = c.execute("SELECT COUNT(*) AS n FROM org_seats WHERE owner_id=? AND status IN ('invited','active')",
                      (owner_id,)).fetchone()
    return r["n"] if r else 0


def list_org_seats(owner_id: int) -> list[dict]:
    with _conn() as c:
        rows = c.execute(
            "SELECT s.*, u.name AS member_name FROM org_seats s "
            "LEFT JOIN users u ON u.id=s.member_id "
            "WHERE s.owner_id=? AND s.status != 'removed' ORDER BY s.invited_at",
            (owner_id,)).fetchall()
    return [dict(r) for r in rows]


def create_seat_invite(owner_id: int, email: str, token: str) -> dict:
    email = email.lower().strip()
    now = time.time()
    with _conn() as c:
        existing = c.execute(
            "SELECT id FROM org_seats WHERE owner_id=? AND email=? AND status IN ('invited','active')",
            (owner_id, email)).fetchone()
        if existing:
            raise ValueError("already invited")
        sid = _insert(c, "INSERT INTO org_seats (owner_id, email, token, status, invited_at) "
                         "VALUES (?,?,?,?,?)", (owner_id, email, token, "invited", now))
        r = c.execute("SELECT * FROM org_seats WHERE id=?", (sid,)).fetchone()
    return dict(r)


def get_seat_by_token(token: str) -> dict | None:
    with _conn() as c:
        r = c.execute("SELECT * FROM org_seats WHERE token=? AND status='invited'", (token,)).fetchone()
    return dict(r) if r else None


def accept_seat_invite(token: str, user_id: int) -> dict | None:
    with _conn() as c:
        r = c.execute("SELECT * FROM org_seats WHERE token=? AND status='invited'", (token,)).fetchone()
        if not r:
            return None
        c.execute("UPDATE org_seats SET member_id=?, status='active', joined_at=?, token=NULL WHERE id=?",
                  (user_id, time.time(), r["id"]))
    return dict(r)


def remove_seat(owner_id: int, seat_id: int) -> None:
    with _conn() as c:
        c.execute("UPDATE org_seats SET status='removed' WHERE id=? AND owner_id=?", (seat_id, owner_id))


def get_social_connection(brand_id: int, platform: str) -> dict | None:
    with _conn() as c:
        r = c.execute("SELECT * FROM social_connections WHERE brand_id=? AND platform=?",
                      (brand_id, platform)).fetchone()
    return dict(r) if r else None


def create_social_connection(brand_id: int, platform: str, upload_post_username: str) -> dict:
    now = time.time()
    with _conn() as c:
        existing = c.execute("SELECT id FROM social_connections WHERE brand_id=? AND platform=?",
                             (brand_id, platform)).fetchone()
        if existing:
            c.execute("UPDATE social_connections SET upload_post_username=?, status='pending', connected_at=NULL "
                      "WHERE id=?", (upload_post_username, existing["id"]))
            cid = existing["id"]
        else:
            cid = _insert(c, "INSERT INTO social_connections (brand_id, platform, upload_post_username, status, "
                             "created_at) VALUES (?,?,?,?,?)", (brand_id, platform, upload_post_username, "pending", now))
        r = c.execute("SELECT * FROM social_connections WHERE id=?", (cid,)).fetchone()
    return dict(r)


def set_social_connection_status(brand_id: int, platform: str, status: str) -> None:
    with _conn() as c:
        c.execute("UPDATE social_connections SET status=?, connected_at=? WHERE brand_id=? AND platform=?",
                  (status, time.time() if status == "connected" else None, brand_id, platform))


def delete_social_connection(brand_id: int, platform: str) -> None:
    with _conn() as c:
        c.execute("DELETE FROM social_connections WHERE brand_id=? AND platform=?", (brand_id, platform))


def create_post_history(brand_id: int, platform: str, media_type: str, thumbnail: str,
                        caption: str, post_url: str | None, status: str = "published") -> dict:
    now = time.time()
    with _conn() as c:
        pid = _insert(c, "INSERT INTO post_history (brand_id, platform, media_type, thumbnail, caption, "
                         "post_url, status, posted_at) VALUES (?,?,?,?,?,?,?,?)",
                      (brand_id, platform, media_type, thumbnail, caption, post_url, status, now))
        r = c.execute("SELECT * FROM post_history WHERE id=?", (pid,)).fetchone()
    return dict(r)


def get_plan_prices() -> dict[str, float]:
    with _conn() as c:
        rows = c.execute("SELECT plan_key, price FROM plan_prices").fetchall()
    return {r["plan_key"]: r["price"] for r in rows}


def set_plan_price(plan_key: str, price: float) -> None:
    now = time.time()
    with _conn() as c:
        c.execute(
            "INSERT INTO plan_prices (plan_key, price, updated_at) VALUES (?,?,?) "
            "ON CONFLICT (plan_key) DO UPDATE SET price=excluded.price, updated_at=excluded.updated_at",
            (plan_key, price, now))


def delete_plan_price(plan_key: str) -> None:
    with _conn() as c:
        c.execute("DELETE FROM plan_prices WHERE plan_key=?", (plan_key,))


def _row_to_queued_post(r) -> dict:
    d = dict(r)
    d["overrides"] = json.loads(d["overrides"]) if d.get("overrides") else {}
    d["platforms"] = json.loads(d["platforms"]) if d.get("platforms") else []
    d["post_urls"] = json.loads(d["post_urls"]) if d.get("post_urls") else {}
    return d


def create_queued_post(brand_id: int, base_caption: str, overrides: dict, platforms: list,
                       media_path: str | None, media_type: str | None, scheduled_at: float | None,
                       status: str, approval_required: bool) -> dict:
    now = time.time()
    with _conn() as c:
        pid = _insert(c, "INSERT INTO queued_posts (brand_id, base_caption, overrides, platforms, media_path, "
                         "media_type, scheduled_at, status, approval_required, post_urls, created_at, updated_at) "
                         "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                      (brand_id, base_caption, json.dumps(overrides), json.dumps(platforms), media_path, media_type,
                       scheduled_at, status, 1 if approval_required else 0, json.dumps({}), now, now))
        r = c.execute("SELECT * FROM queued_posts WHERE id=?", (pid,)).fetchone()
    return _row_to_queued_post(r)


def update_queued_post(user_id: int, post_id: int, **fields) -> dict | None:
    allowed = {"base_caption", "overrides", "platforms", "media_path", "media_type",
              "scheduled_at", "status", "approval_required", "post_urls", "error"}
    sets, params = [], []
    for k, v in fields.items():
        if k not in allowed or v is None and k not in ("media_path", "media_type", "scheduled_at", "error"):
            continue
        if k in ("overrides", "platforms", "post_urls"):
            v = json.dumps(v)
        if k == "approval_required":
            v = 1 if v else 0
        sets.append(f"{k}=?"); params.append(v)
    if not sets:
        return get_queued_post(user_id, post_id)
    sets.append("updated_at=?"); params.append(time.time())
    with _conn() as c:
        owner = c.execute(
            "SELECT qp.id FROM queued_posts qp JOIN brands b ON b.id=qp.brand_id WHERE qp.id=? AND b.user_id=?",
            (post_id, user_id)).fetchone()
        if not owner:
            return None
        params.append(post_id)
        c.execute(f"UPDATE queued_posts SET {', '.join(sets)} WHERE id=?", params)
        r = c.execute("SELECT * FROM queued_posts WHERE id=?", (post_id,)).fetchone()
    return _row_to_queued_post(r) if r else None


def get_queued_post(user_id: int, post_id: int) -> dict | None:
    with _conn() as c:
        r = c.execute(
            "SELECT qp.* FROM queued_posts qp JOIN brands b ON b.id=qp.brand_id WHERE qp.id=? AND b.user_id=?",
            (post_id, user_id)).fetchone()
    return _row_to_queued_post(r) if r else None


def list_queued_posts(user_id: int, start: float | None = None, end: float | None = None) -> list[dict]:
    with _conn() as c:
        seat = c.execute("SELECT owner_id FROM org_seats WHERE member_id=? AND status='active'",
                         (user_id,)).fetchone()
        owner_id = seat["owner_id"] if seat else user_id
        sql = "SELECT qp.*, b.name AS brand_name FROM queued_posts qp JOIN brands b ON b.id=qp.brand_id WHERE b.user_id=?"
        params = [owner_id]
        if start is not None:
            sql += " AND (qp.scheduled_at IS NULL OR qp.scheduled_at >= ?)"; params.append(start)
        if end is not None:
            sql += " AND (qp.scheduled_at IS NULL OR qp.scheduled_at <= ?)"; params.append(end)
        sql += " ORDER BY COALESCE(qp.scheduled_at, qp.created_at)"
        rows = c.execute(sql, params).fetchall()
    return [_row_to_queued_post(r) for r in rows]


def due_queued_posts(now: float) -> list[dict]:
    with _conn() as c:
        rows = c.execute("SELECT * FROM queued_posts WHERE status='scheduled' AND scheduled_at IS NOT NULL "
                         "AND scheduled_at <= ?", (now,)).fetchall()
    return [_row_to_queued_post(r) for r in rows]


def delete_queued_post(user_id: int, post_id: int) -> None:
    with _conn() as c:
        c.execute("DELETE FROM queued_posts WHERE id=? AND brand_id IN "
                 "(SELECT id FROM brands WHERE user_id=?)", (post_id, user_id))


def set_queued_post_status(post_id: int, **fields) -> None:
    """System-level update (no owning-user check) — used by the scheduled-post worker."""
    allowed = {"status", "post_urls", "error"}
    sets, params = [], []
    for k, v in fields.items():
        if k not in allowed:
            continue
        if k == "post_urls":
            v = json.dumps(v)
        sets.append(f"{k}=?"); params.append(v)
    if not sets:
        return
    sets.append("updated_at=?"); params.append(time.time())
    params.append(post_id)
    with _conn() as c:
        c.execute(f"UPDATE queued_posts SET {', '.join(sets)} WHERE id=?", params)


def list_post_history(user_id: int, start: float, end: float) -> list[dict]:
    with _conn() as c:
        seat = c.execute("SELECT owner_id FROM org_seats WHERE member_id=? AND status='active'",
                         (user_id,)).fetchone()
        owner_id = seat["owner_id"] if seat else user_id
        rows = c.execute(
            "SELECT p.*, b.name AS brand_name FROM post_history p JOIN brands b ON b.id = p.brand_id "
            "WHERE b.user_id=? AND p.posted_at >= ? AND p.posted_at <= ? ORDER BY p.posted_at",
            (owner_id, start, end)).fetchall()
    return [dict(r) for r in rows]


def leave_seat(member_id: int) -> None:
    with _conn() as c:
        c.execute("UPDATE org_seats SET status='removed' WHERE member_id=? AND status='active'", (member_id,))


def team_monthly_generation_count(owner_id: int) -> int:
    """Pooled 30-day usage across the owner + every active seat."""
    since = time.time() - 30 * 24 * 3600
    with _conn() as c:
        member_ids = [r["member_id"] for r in c.execute(
            "SELECT member_id FROM org_seats WHERE owner_id=? AND status='active'", (owner_id,)).fetchall()]
        ids = [owner_id] + [m for m in member_ids if m]
        qs = ",".join("?" for _ in ids)
        r = c.execute(
            f"SELECT COUNT(*) AS n FROM generations WHERE user_id IN ({qs}) AND created_at>=? "
            "AND content_type NOT IN ('content_calendar','brand_learn','bulk_catalog','reengagement')",
            (*ids, since)).fetchone()
    return r["n"] if r else 0


# ------------------------------- home/dashboard --------------------------- #

def getting_started(user_id: int) -> dict:
    """Which first-run milestones this user has hit (Home checklist)."""
    with _conn() as c:
        one = lambda sql: c.execute(sql, (user_id,)).fetchone()["n"] > 0
        return {
            "brand": one("SELECT COUNT(*) AS n FROM brands WHERE user_id=?"),
            "generated": one("SELECT COUNT(*) AS n FROM generations WHERE user_id=?"),
            "saved": one("SELECT COUNT(*) AS n FROM favorites WHERE user_id=?"),
            "planned": one("SELECT COUNT(*) AS n FROM calendars WHERE user_id=?"),
            "scheduled": one("SELECT COUNT(*) AS n FROM queued_posts q JOIN brands b ON b.id=q.brand_id "
                             "WHERE b.user_id=? AND q.status <> 'draft'"),
        }


def home_overview(user_id: int) -> dict:
    """Everything the Home dashboard needs, in one shot, for one user."""
    now = time.time()
    win30 = now - 30 * 86400          # current quota window
    prev30 = win30 - 30 * 86400        # the 30 days before that
    win14 = now - 14 * 86400
    REAL = "g.content_type NOT IN ('content_calendar','brand_learn','bulk_catalog','writer','reengagement')"   # exclude non-copy rows
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
            "SELECT u.id, u.email, u.name, u.phone, u.plan, u.created_at, u.onboarded, u.suspended, u.is_admin, "
            "COUNT(g.id) AS gens, COALESCE(SUM(g.input_tokens),0) AS it, "
            "COALESCE(SUM(g.output_tokens),0) AS ot, COALESCE(SUM(g.cost),0) AS cost, "
            "MAX(g.created_at) AS last_active "
            "FROM users u LEFT JOIN generations g ON g.user_id=u.id "
            "GROUP BY u.id, u.email, u.name, u.phone, u.plan, u.created_at, u.onboarded, u.suspended, u.is_admin "
            "ORDER BY u.created_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def admin_user_detail(uid: int) -> dict | None:
    with _conn() as c:
        u = c.execute("SELECT id,email,name,phone,plan,onboarded,created_at,suspended,notes,is_admin FROM users WHERE id=?", (uid,)).fetchone()
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
        for tbl in ("generations", "brands", "calendars", "favorites", "gigs", "brand_feedback", "plan_items"):
            c.execute(f"DELETE FROM {tbl} WHERE user_id=?", (uid,))
        c.execute("DELETE FROM users WHERE id=?", (uid,))
    return True


# ----------------------------- newsletter ---------------------------------- #

def list_newsletter_subscribers() -> list[dict]:
    with _conn() as c:
        rows = c.execute(
            "SELECT id, email, name FROM users WHERE suspended=0 AND newsletter_opt_out=0"
        ).fetchall()
    return [dict(r) for r in rows]


def newsletter_stats() -> dict:
    with _conn() as c:
        subs = c.execute(
            "SELECT COUNT(*) AS n FROM users WHERE suspended=0 AND newsletter_opt_out=0").fetchone()["n"]
        opted_out = c.execute("SELECT COUNT(*) AS n FROM users WHERE newsletter_opt_out=1").fetchone()["n"]
    return {"subscribers": subs, "opted_out": opted_out}


def set_newsletter_opt_out(user_id: int, out: bool) -> None:
    with _conn() as c:
        c.execute("UPDATE users SET newsletter_opt_out=? WHERE id=?", (1 if out else 0, user_id))


# ------------------------- newsletter schedule ----------------------------- #
# A calendar of planned issues: pick a date, draft it whenever, mark it
# "ready" when you're happy — a daily cron then sends whatever is ready
# for today, so 3-4 issues a week can run unattended once planned.

def create_scheduled_newsletter(send_date: str, brief: str, style: str = "A") -> dict:
    now = time.time()
    with _conn() as c:
        nid = _insert(
            c, "INSERT INTO newsletter_schedule (send_date, brief, style, status, created_at) "
               "VALUES (?,?,?,?,?)",
            (send_date, brief.strip(), style, "draft", now))
    return get_scheduled_newsletter(nid)


def get_scheduled_newsletter(nid: int) -> dict | None:
    with _conn() as c:
        r = c.execute("SELECT * FROM newsletter_schedule WHERE id=?", (nid,)).fetchone()
    return dict(r) if r else None


def list_scheduled_newsletters(start_date: str, end_date: str) -> list[dict]:
    with _conn() as c:
        rows = c.execute(
            "SELECT * FROM newsletter_schedule WHERE send_date>=? AND send_date<=? ORDER BY send_date",
            (start_date, end_date)).fetchall()
    return [dict(r) for r in rows]


_SCHED_FIELDS = {"brief", "subject", "preview_text", "body_html", "style", "status", "send_date"}


def update_scheduled_newsletter(nid: int, **fields) -> dict | None:
    sets, params = [], []
    for k, v in fields.items():
        if k in _SCHED_FIELDS:
            sets.append(f"{k}=?")
            params.append(v)
    if sets:
        with _conn() as c:
            c.execute(f"UPDATE newsletter_schedule SET {', '.join(sets)} WHERE id=?", (*params, nid))
    return get_scheduled_newsletter(nid)


def delete_scheduled_newsletter(nid: int) -> None:
    with _conn() as c:
        c.execute("DELETE FROM newsletter_schedule WHERE id=?", (nid,))


def get_ready_newsletter_for_date(send_date: str) -> dict | None:
    with _conn() as c:
        r = c.execute("SELECT * FROM newsletter_schedule WHERE send_date=? AND status='ready' LIMIT 1",
                      (send_date,)).fetchone()
    return dict(r) if r else None


def mark_scheduled_newsletter_sent(nid: int, sent_count: int, ok: bool = True) -> None:
    with _conn() as c:
        c.execute("UPDATE newsletter_schedule SET status=?, sent_count=?, sent_at=? WHERE id=?",
                  ("sent" if ok else "failed", sent_count, time.time(), nid))


# ------------------------------ admin analytics ---------------------------- #
# Everything is computed in Python from raw rows so it behaves the same on
# SQLite and Postgres. Times are bucketed in WAT (UTC+1).

_WAT = 3600


def _day(ts: float) -> str:
    return time.strftime("%Y-%m-%d", time.gmtime(ts + _WAT))


def admin_analytics(days: int, free_limit: int = 10) -> dict:
    now = time.time()
    start = now - days * 86400
    prev_start = start - days * 86400
    since = min(prev_start, now - 63 * 86400)  # also covers the 8-week cohort window
    with _conn() as c:
        users = [dict(r) for r in c.execute(
            "SELECT id, name, email, plan, created_at, onboarded, suspended, is_admin, last_reengage_at "
            "FROM users").fetchall()]
        gens = [dict(r) for r in c.execute(
            "SELECT user_id, content_type, tone, model, cost, input_tokens, output_tokens, created_at "
            "FROM generations WHERE created_at>=?", (since,)).fetchall()]
        last_gen = {r["user_id"]: r["t"] for r in c.execute(
            "SELECT user_id, MAX(created_at) AS t, COUNT(*) AS n FROM generations GROUP BY user_id").fetchall()}
        gen_counts = {r["user_id"]: r["n"] for r in c.execute(
            "SELECT user_id, COUNT(*) AS n FROM generations GROUP BY user_id").fetchall()}
        month_start = time.mktime(time.gmtime(now)[:2] + (1, 0, 0, 0, 0, 0, 0))
        month_gens = {r["user_id"]: r["n"] for r in c.execute(
            "SELECT user_id, COUNT(*) AS n FROM generations WHERE created_at>=? GROUP BY user_id",
            (month_start,)).fetchall()}
        brand_users = {r["user_id"] for r in c.execute("SELECT DISTINCT user_id FROM brands").fetchall()}
        brands_rows = [dict(r) for r in c.execute("SELECT created_at FROM brands WHERE created_at>=?", (prev_start,)).fetchall()]
        queued = [dict(r) for r in c.execute(
            "SELECT status, platforms, created_at, scheduled_at FROM queued_posts").fetchall()]
        history = [dict(r) for r in c.execute("SELECT platform, status, posted_at FROM post_history").fetchall()]
        conns = [dict(r) for r in c.execute("SELECT platform, status FROM social_connections").fetchall()]
        favs = c.execute("SELECT COUNT(*) AS n FROM favorites WHERE created_at>=?", (start,)).fetchone()["n"]
        cals = c.execute("SELECT COUNT(*) AS n FROM calendars WHERE created_at>=?", (start,)).fetchone()["n"]
        recent = [dict(r) for r in c.execute(
            "SELECT g.content_type, g.tone, g.cost, g.created_at, u.name, u.email, u.plan "
            "FROM generations g LEFT JOIN users u ON u.id=g.user_id ORDER BY g.created_at DESC LIMIT 12").fetchall()]

    days_list = [_day(start + i * 86400 + 1) for i in range(days)]
    if days_list[-1] != _day(now):
        days_list = days_list[1:] + [_day(now)]
    idx = {d: i for i, d in enumerate(days_list)}
    z = lambda: [0] * len(days_list)
    signups, gen_n, cost, brand_n = z(), z(), z(), z()
    active = [set() for _ in days_list]
    for u in users:
        d = idx.get(_day(u["created_at"]))
        if d is not None and u["created_at"] >= start - 86400:
            signups[d] += 1
    types, tones, models = {}, {}, {}
    heat = [[0] * 24 for _ in range(7)]
    type_daily = {}
    cur = {"gens": 0, "cost": 0.0, "tokens": 0, "active": set(), "signups": 0}
    prev = {"gens": 0, "cost": 0.0, "active": set(), "signups": 0}
    for g in gens:
        t = g["created_at"]
        if t >= start:
            d = idx.get(_day(t))
            if d is not None:
                gen_n[d] += 1
                cost[d] += g["cost"] or 0
                active[d].add(g["user_id"])
                type_daily.setdefault(g["content_type"], z())[d] += 1
            cur["gens"] += 1
            cur["cost"] += g["cost"] or 0
            cur["tokens"] += (g["input_tokens"] or 0) + (g["output_tokens"] or 0)
            cur["active"].add(g["user_id"])
            types[g["content_type"]] = types.get(g["content_type"], 0) + 1
            tones[g["tone"] or "—"] = tones.get(g["tone"] or "—", 0) + 1
            m = models.setdefault(g["model"] or "(demo)", {"n": 0, "cost": 0.0})
            m["n"] += 1
            m["cost"] += g["cost"] or 0
            lt = time.gmtime(t + _WAT)
            heat[lt.tm_wday][lt.tm_hour] += 1
        elif t >= prev_start:
            prev["gens"] += 1
            prev["cost"] += g["cost"] or 0
            prev["active"].add(g["user_id"])
    for b in brands_rows:
        d = idx.get(_day(b["created_at"]))
        if d is not None and b["created_at"] >= start - 86400:
            brand_n[d] += 1
    for u in users:
        if u["created_at"] >= start:
            cur["signups"] += 1
        elif u["created_at"] >= prev_start:
            prev["signups"] += 1

    # funnel for people who signed up in the window
    cohort = [u for u in users if u["created_at"] >= start]
    funnel = [
        ("Signed up", len(cohort)),
        ("Onboarded", sum(1 for u in cohort if u["onboarded"])),
        ("Created a brand", sum(1 for u in cohort if u["id"] in brand_users)),
        ("First generation", sum(1 for u in cohort if gen_counts.get(u["id"], 0) >= 1)),
        ("Activated (5+ gens)", sum(1 for u in cohort if gen_counts.get(u["id"], 0) >= 5)),
        ("Paid", sum(1 for u in cohort if u["plan"] != "free")),
    ]

    # weekly signup cohorts x weeks since signup (share of cohort that generated that week)
    wk = 7 * 86400
    cohorts = []
    for k in range(7, -1, -1):
        c0 = now - (k + 1) * wk
        members = [u["id"] for u in users if c0 <= u["created_at"] < c0 + wk]
        row = {"label": _day(c0), "size": len(members), "weeks": []}
        mset = set(members)
        for w in range(0, k + 1):
            ws, we = c0 + w * wk, c0 + (w + 1) * wk
            act = {g["user_id"] for g in gens if ws <= g["created_at"] < we and g["user_id"] in mset}
            row["weeks"].append(round(100 * len(act) / len(members)) if members else None)
        cohorts.append(row)

    # publishing
    q_status, q_platforms = {}, {}
    for q in queued:
        q_status[q["status"]] = q_status.get(q["status"], 0) + 1
        try:
            for pf in json.loads(q["platforms"] or "[]"):
                q_platforms[pf] = q_platforms.get(pf, 0) + 1
        except (TypeError, ValueError):
            pass
    published = {}
    for h in history:
        if (h["status"] or "") == "published":
            published[h["platform"]] = published.get(h["platform"], 0) + 1
    connected = {}
    for cn in conns:
        if cn["status"] == "connected":
            connected[cn["platform"]] = connected.get(cn["platform"], 0) + 1

    # segments
    at_risk, near_limit, never = [], [], []
    for u in users:
        if u["suspended"] or u["is_admin"]:
            continue
        lg = last_gen.get(u["id"])
        row = {"id": u["id"], "name": u["name"], "email": u["email"], "plan": u["plan"],
               "last_active": lg, "gens": gen_counts.get(u["id"], 0), "month_gens": month_gens.get(u["id"], 0),
               "created_at": u["created_at"]}
        if u["plan"] != "free" and (not lg or lg < now - 14 * 86400):
            at_risk.append(row)
        if u["plan"] == "free" and month_gens.get(u["id"], 0) >= max(1, int(free_limit * 0.7)):
            near_limit.append(row)
        if not lg and u["created_at"] < now - 86400:
            never.append(row)

    top = sorted(({"id": u["id"], "name": u["name"], "email": u["email"], "plan": u["plan"],
                   "gens": sum(1 for g in gens if g["user_id"] == u["id"] and g["created_at"] >= start),
                   "cost": round(sum((g["cost"] or 0) for g in gens if g["user_id"] == u["id"] and g["created_at"] >= start), 2)}
                  for u in users), key=lambda r: -r["gens"])[:10]

    return {
        "days": days, "labels": days_list,
        "series": {"signups": signups, "generations": gen_n, "cost": [round(x, 2) for x in cost],
                   "active": [len(s_) for s_ in active], "brands": brand_n},
        "totals": {"signups": cur["signups"], "generations": cur["gens"], "cost": round(cur["cost"], 2),
                   "active": len(cur["active"]), "tokens": cur["tokens"], "favorites": favs, "calendars": cals},
        "previous": {"signups": prev["signups"], "generations": prev["gens"], "cost": round(prev["cost"], 2),
                     "active": len(prev["active"])},
        "types": types, "type_daily": type_daily, "tones": tones, "models": models,
        "heatmap": heat, "funnel": [{"stage": a, "n": b} for a, b in funnel], "cohorts": cohorts,
        "publishing": {"queue_status": q_status, "queue_platforms": q_platforms,
                       "published": published, "connected": connected},
        "segments": {"at_risk": at_risk[:50], "near_limit": near_limit[:50], "never_generated": never[:50],
                     "counts": {"at_risk": len(at_risk), "near_limit": len(near_limit), "never_generated": len(never)}},
        "top_users": [t for t in top if t["gens"]], "recent": recent,
    }


# ------------------------------- admin agents ------------------------------ #

def agent_candidates(agent: str, free_limit: int = 10, limit: int = 15) -> list[dict]:
    """Who an outreach agent should write to. Never includes admins, suspended or opted-out users."""
    now = time.time()
    with _conn() as c:
        rows = [dict(r) for r in c.execute(
            "SELECT u.id, u.name, u.email, u.plan, u.created_at, u.onboarded, u.last_reengage_at, "
            "u.newsletter_opt_out, COUNT(g.id) AS gens, MAX(g.created_at) AS last_active "
            "FROM users u LEFT JOIN generations g ON g.user_id=u.id "
            "WHERE u.suspended=0 AND u.is_admin=0 "
            "GROUP BY u.id, u.name, u.email, u.plan, u.created_at, u.onboarded, u.last_reengage_at, u.newsletter_opt_out"
        ).fetchall()]
        month_start = time.mktime(time.gmtime(now)[:2] + (1, 0, 0, 0, 0, 0, 0))
        month = {r["user_id"]: r["n"] for r in c.execute(
            "SELECT user_id, COUNT(*) AS n FROM generations WHERE created_at>=? GROUP BY user_id",
            (month_start,)).fetchall()}
        brands = {}
        for r in c.execute("SELECT user_id, name, industry, audience FROM brands ORDER BY created_at").fetchall():
            brands.setdefault(r["user_id"], dict(r))
        recent_types = {}
        for r in c.execute("SELECT user_id, content_type FROM generations ORDER BY created_at DESC").fetchall():
            recent_types.setdefault(r["user_id"], [])
            if len(recent_types[r["user_id"]]) < 3 and r["content_type"] not in recent_types[r["user_id"]]:
                recent_types[r["user_id"]].append(r["content_type"])
        pending = {r["user_id"] for r in c.execute(
            "SELECT user_id FROM agent_items WHERE agent=? AND status='pending'", (agent,)).fetchall()}
    out = []
    for r in rows:
        if r["newsletter_opt_out"] or r["id"] in pending:
            continue
        cooled = not r["last_reengage_at"] or r["last_reengage_at"] < now - 10 * 86400
        b = brands.get(r["id"]) or {}
        r.update(brand=b.get("name") or "", industry=b.get("industry") or "", audience=b.get("audience") or "",
                 month_gens=month.get(r["id"], 0), recent_types=recent_types.get(r["id"], []))
        if agent == "activation" and r["gens"] == 0 and r["created_at"] < now - 86400 and cooled:
            out.append(r)
        elif agent == "winback" and r["gens"] > 0 and r["last_active"] and r["last_active"] < now - 14 * 86400 and cooled:
            out.append(r)
        elif agent == "upgrade" and r["plan"] == "free" and r["month_gens"] >= max(1, int(free_limit * 0.7)):
            out.append(r)
    key = {"activation": lambda r: -r["created_at"], "winback": lambda r: (r["plan"] == "free", -r["gens"]),
           "upgrade": lambda r: -r["month_gens"]}.get(agent, lambda r: 0)
    return sorted(out, key=key)[:limit]


def quality_sample(limit: int = 30) -> dict:
    with _conn() as c:
        recent = [dict(r) for r in c.execute(
            "SELECT id, content_type, tone, brief, output, created_at FROM generations "
            "WHERE content_type NOT IN ('content_calendar','rate_advisor','personal_brand','brand_learn') "
            "ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()]
        feedback = [dict(r) for r in c.execute(
            "SELECT rating, text, created_at FROM brand_feedback ORDER BY created_at DESC LIMIT 20").fetchall()]
    return {"generations": recent, "feedback": feedback}


def create_agent_run(agent: str, summary: str, report: str, items: list[dict], created_by: int | None) -> int:
    now = time.time()
    with _conn() as c:
        rid = _insert(c, "INSERT INTO agent_runs (agent, status, summary, report, created_by, created_at) VALUES (?,?,?,?,?,?)",
                      (agent, "done", summary, report, created_by, now))
        for it in items:
            _insert(c, "INSERT INTO agent_items (run_id, agent, user_id, email, name, title, reason, subject, body_html, "
                       "severity, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                    (rid, agent, it.get("user_id"), it.get("email", ""), it.get("name", ""), it.get("title", ""),
                     it.get("reason", ""), it.get("subject", ""), it.get("body_html", ""), it.get("severity", ""),
                     "pending", now))
    return rid


def agent_overview() -> dict:
    with _conn() as c:
        runs = {}
        for r in c.execute("SELECT agent, MAX(created_at) AS last_run, COUNT(*) AS runs FROM agent_runs GROUP BY agent").fetchall():
            runs[r["agent"]] = {"last_run": r["last_run"], "runs": r["runs"]}
        items = {}
        for r in c.execute("SELECT agent, status, COUNT(*) AS n FROM agent_items GROUP BY agent, status").fetchall():
            items.setdefault(r["agent"], {})[r["status"]] = r["n"]
    return {"runs": runs, "items": items}


def agent_runs(agent: str, limit: int = 10) -> list[dict]:
    with _conn() as c:
        return [dict(r) for r in c.execute(
            "SELECT id, agent, summary, report, created_at FROM agent_runs WHERE agent=? ORDER BY created_at DESC LIMIT ?",
            (agent, limit)).fetchall()]


def agent_items(agent: str, status: str | None = None, limit: int = 100) -> list[dict]:
    sql = "SELECT * FROM agent_items WHERE agent=?"
    args: list = [agent]
    if status:
        sql += " AND status=?"
        args.append(status)
    sql += " ORDER BY created_at DESC LIMIT ?"
    args.append(limit)
    with _conn() as c:
        return [dict(r) for r in c.execute(sql, tuple(args)).fetchall()]


def get_agent_item(item_id: int) -> dict | None:
    with _conn() as c:
        r = c.execute("SELECT * FROM agent_items WHERE id=?", (item_id,)).fetchone()
    return dict(r) if r else None


def update_agent_item(item_id: int, **fields) -> None:
    allowed = {k: v for k, v in fields.items() if k in ("subject", "body_html", "status", "sent_at")}
    if not allowed:
        return
    sets = ", ".join(f"{k}=?" for k in allowed)
    with _conn() as c:
        c.execute(f"UPDATE agent_items SET {sets} WHERE id=?", (*allowed.values(), item_id))

