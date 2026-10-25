"""
database.py - everything that talks to SQLite.

Table "leads" stores each lead, its score from the model, and its status.
Functions here do the four database operations: insert, retrieve, update, delete.
"""

import sqlite3
from contextlib import contextmanager
from datetime import datetime

DB_FILE = "leads.db"


@contextmanager
def get_connection():
    """Open the database, save changes when done (or undo them on error), and always close it."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row          # rows behave like dictionaries
    try:
        with conn:                          # commit on success, rollback on error
            yield conn
    finally:
        conn.close()


def create_tables():
    with get_connection() as conn:
        # If leads.db was made by the old version (different columns), keep it as a backup table
        old_cols = [r["name"] for r in conn.execute("PRAGMA table_info(leads)")]
        if old_cols and "channel" not in old_cols:
            conn.execute(f"ALTER TABLE leads RENAME TO leads_old_{datetime.now():%Y%m%d%H%M%S}")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS leads (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                name              TEXT NOT NULL,
                phone             TEXT NOT NULL,
                email             TEXT,
                channel           TEXT NOT NULL,  -- Website, WhatsApp, Instagram, Facebook, Email, Google Search, Referral
                interested_in     TEXT,           -- product or service the customer asked about
                customer_type     TEXT,           -- Working Professional, Business Owner, Student ...
                last_activity     TEXT,           -- Chatted with us, Opened our email ...
                customer_message  TEXT,           -- what the customer wrote (WhatsApp, form, email ...)
                intent_tags       TEXT,           -- buying signals found by the Conversation Agent
                website_visits    REAL,
                time_on_website   REAL,
                score             REAL,           -- final chance of conversion (0 to 1): profile + message
                profile_score     REAL,           -- chance from the ML model alone (before the message)
                priority          TEXT,           -- HIGH / MEDIUM / LOW
                reasons           TEXT,           -- why the model gave this score
                status            TEXT DEFAULT 'New',   -- New / Contacted / Converted / Not Converted
                created_at        TEXT,
                last_contacted_at TEXT,
                chat_step         TEXT,           -- WhatsApp bot: which detail we are asking for next
                priority_override TEXT            -- priority chosen by the salesperson (empty = automatic)
            )
        """)
        # Add columns that newer versions introduced, without losing existing leads
        existing = {r["name"] for r in conn.execute("PRAGMA table_info(leads)")}
        for column in ("customer_message", "intent_tags", "chat_step", "profile_score", "priority_override"):
            if column not in existing:
                kind = "REAL" if column == "profile_score" else "TEXT"
                conn.execute(f"ALTER TABLE leads ADD COLUMN {column} {kind}")

        # The business owner's details: the WhatsApp bot answers customers from these
        conn.execute("""
            CREATE TABLE IF NOT EXISTS business (
                id                   INTEGER PRIMARY KEY CHECK (id = 1),   -- only one business
                name                 TEXT,
                business_type        TEXT,
                owner_name           TEXT,
                whatsapp_number      TEXT,
                working_hours        TEXT,
                delivery_area        TEXT,
                delivery_charge      REAL,
                advance_notice       TEXT,
                special_instructions TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                name      TEXT NOT NULL,
                price     REAL,
                details   TEXT,               -- specifications / what is included
                available INTEGER DEFAULT 1   -- 1 = in stock, 0 = not available now
            )
        """)


# ---------- INSERT ----------
def insert_lead(lead: dict) -> int:
    lead["created_at"] = datetime.now().isoformat(timespec="seconds")
    columns = ", ".join(lead.keys())
    placeholders = ", ".join("?" for _ in lead)
    with get_connection() as conn:
        cursor = conn.execute(f"INSERT INTO leads ({columns}) VALUES ({placeholders})",
                              list(lead.values()))
        return cursor.lastrowid or 0


# ---------- RETRIEVE ----------
def get_all_leads(status=None):
    query = "SELECT * FROM leads"
    params = []
    if status:
        query += " WHERE status = ?"
        params.append(status)
    # HIGH first, then MEDIUM, then LOW; inside each group, highest score first
    query += (" ORDER BY CASE priority WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END,"
              " score DESC")
    with get_connection() as conn:
        return [dict(row) for row in conn.execute(query, params)]


def get_lead(lead_id: int):
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM leads WHERE id = ?", (lead_id,)).fetchone()
        return dict(row) if row else None


# ---------- UPDATE ----------
def update_lead(lead_id: int, changes: dict) -> bool:
    if not changes:
        return False
    set_part = ", ".join(f"{col} = ?" for col in changes)
    with get_connection() as conn:
        cursor = conn.execute(f"UPDATE leads SET {set_part} WHERE id = ?",
                              list(changes.values()) + [lead_id])
        return cursor.rowcount > 0


# ---------- DELETE ----------
def delete_lead(lead_id: int) -> bool:
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM leads WHERE id = ?", (lead_id,))
        return cursor.rowcount > 0


def find_open_lead(phone: str, channel: str):
    """The latest lead from this phone number on this channel that is not finished yet."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM leads WHERE phone = ? AND channel = ? "
            "AND status NOT IN ('Converted', 'Not Converted') ORDER BY id DESC LIMIT 1",
            (phone, channel)).fetchone()
        return dict(row) if row else None


# ---------- Business profile and products (used by the WhatsApp bot) ----------
BUSINESS_FIELDS = ("name", "business_type", "owner_name", "whatsapp_number", "working_hours",
                   "delivery_area", "delivery_charge", "advance_notice", "special_instructions")


def get_business() -> dict:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM business WHERE id = 1").fetchone()
        return dict(row) if row else {field: None for field in BUSINESS_FIELDS}


def save_business(details: dict) -> dict:
    values = [details.get(field) for field in BUSINESS_FIELDS]
    with get_connection() as conn:
        conn.execute(f"INSERT OR REPLACE INTO business (id, {', '.join(BUSINESS_FIELDS)}) "
                     f"VALUES (1, {', '.join('?' for _ in BUSINESS_FIELDS)})", values)
    return get_business()


def get_products() -> list:
    with get_connection() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM products ORDER BY id")]


def replace_products(products: list) -> list:
    """The My Business page sends the whole list each time it is saved."""
    with get_connection() as conn:
        conn.execute("DELETE FROM products")
        conn.executemany("INSERT INTO products (name, price, details, available) VALUES (?, ?, ?, ?)",
                         [(p["name"], p.get("price"), p.get("details"), 1 if p.get("available", True) else 0)
                          for p in products])
    return get_products()


def find_open_lead_by_email(email: str, channel: str = "Email"):
    """The latest unfinished lead from this email address (a customer writing again)."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM leads WHERE lower(email) = lower(?) AND channel = ? "
            "AND status NOT IN ('Converted', 'Not Converted') ORDER BY id DESC LIMIT 1",
            (email, channel)).fetchone()
        return dict(row) if row else None


def channel_summary(channel: str) -> dict:
    """How many leads came from a channel and when the latest one arrived."""
    with get_connection() as conn:
        row = conn.execute("SELECT COUNT(*) AS leads, MAX(created_at) AS last_lead_at FROM leads "
                           "WHERE channel = ?", (channel,)).fetchone()
        return dict(row)
