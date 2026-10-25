"""
channels.py - leads that arrive automatically (no one types them in).

  GET  /enquiry            public enquiry form to put on the business's website
  POST /public/enquiry     the form sends the customer's details here -> new "Website" lead
  GET  /webhook/whatsapp   Meta calls this once to check the webhook (verify token)
  POST /webhook/whatsapp   Meta sends every new WhatsApp message here -> new or updated lead
  POST /webhook/twilio     Twilio sends every new WhatsApp message here -> new or updated lead
  POST /leads/{id}/whatsapp   send the follow-up message to the customer on WhatsApp (Twilio)
  POST /webhook/email      an email forwarding service sends each customer email here -> Email lead
  GET  /connections        status of WhatsApp, website form and email (for the Connect page)

Settings: put them in a file called .env next to this file (see .env.example), or as
environment variables. All are optional - without them the webhooks still work for testing.
  WHATSAPP_VERIFY_TOKEN   the same text you type in Meta's webhook settings (default below)
  WHATSAPP_APP_SECRET     your Meta app secret; when set, every message is checked to be from Meta
  TWILIO_ACCOUNT_SID      from the Twilio Console home page (starts with AC)
  TWILIO_AUTH_TOKEN       from the Twilio Console; also used to check messages really came from Twilio
  TWILIO_WHATSAPP_FROM    the Twilio WhatsApp number, e.g. whatsapp:+14155238886 (the Sandbox number)
  EMAIL_WEBHOOK_TOKEN     optional secret; when set, /webhook/email?token=<it> is required
"""

import base64
import hashlib
import hmac
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Callable, Optional
from xml.sax.saxutils import escape

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

import agents
import database as db
import whatsapp_bot as bot

router = APIRouter()
score_lead: Callable[[dict], dict]          # set by app.py (ML model + Conversation Agent)


def load_env_file(path: Path) -> None:
    """Read KEY=value lines from .env (so secrets are not written inside the code)."""
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file(Path(__file__).parent / ".env")

VERIFY_TOKEN = os.environ.get("WHATSAPP_VERIFY_TOKEN", "leadai-verify-token")
APP_SECRET = os.environ.get("WHATSAPP_APP_SECRET", "")
TWILIO_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM = os.environ.get("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")

EMAIL_PATTERN = r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"


def save_new_lead(lead: dict) -> dict:
    """Same steps as the Add Lead form: clean, score, save."""
    lead = agents.analyse_lead(lead)
    lead.update(score_lead(lead))
    lead_id = db.insert_lead(lead)
    return db.get_lead(lead_id) or {}


def add_message_to_lead(lead: dict, text: str) -> dict:
    """A customer wrote again: add the new message to their lead and score it again."""
    history = f"{lead['customer_message']}\n{text}" if lead.get("customer_message") else text
    lead["customer_message"] = history[-1000:]          # keep the latest 1000 characters
    lead["last_activity"] = "Chatted with us"
    changes = {"customer_message": lead["customer_message"], "last_activity": lead["last_activity"]}
    changes.update(score_lead(lead))
    db.update_lead(lead["id"], changes)
    return db.get_lead(lead["id"]) or {}


# ======================= 1. Website enquiry form =======================
class PublicEnquiry(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    phone: str = Field(pattern=r"^\+?[0-9]{10,13}$")
    email: Optional[str] = Field(None, pattern=EMAIL_PATTERN)
    interested_in: Optional[str] = Field(None, max_length=80)
    message: Optional[str] = Field(None, max_length=1000)
    seconds_on_page: Optional[float] = Field(None, ge=0)     # measured by the page itself
    visits: Optional[int] = Field(None, ge=0)                # counted by the page itself


@router.get("/enquiry", include_in_schema=False)
def enquiry_page():
    return FileResponse(Path(__file__).parent / "public" / "enquiry.html")


@router.post("/public/enquiry", status_code=201)
def public_enquiry(form: PublicEnquiry):
    lead = save_new_lead({
        "name": form.name, "phone": form.phone, "email": form.email,
        "channel": "Website", "interested_in": form.interested_in,
        "customer_message": form.message, "last_activity": "Filled website form",
        "website_visits": min(form.visits or 1, 300),
        "time_on_website": min(round(form.seconds_on_page or 0), 3000),
    })
    # The customer only sees a thank-you; the score stays with the sales team
    return {"message": f"Thank you {lead['name'].split()[0]}! Our team will contact you soon."}


# ======================= 2. WhatsApp (Meta WhatsApp Cloud API) =======================
@router.get("/webhook/whatsapp")
def whatsapp_verify(request: Request):
    """Meta checks the webhook once: we must send back hub.challenge if the token matches."""
    p = request.query_params
    if p.get("hub.mode") == "subscribe" and p.get("hub.verify_token") == VERIFY_TOKEN:
        return Response(content=p.get("hub.challenge", ""), media_type="text/plain")
    raise HTTPException(403, "Verify token does not match")


def signature_ok(body: bytes, header: Optional[str]) -> bool:
    """When an app secret is set, check that the message really came from Meta."""
    if not APP_SECRET:
        return True
    expected = "sha256=" + hmac.new(APP_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return bool(header) and hmac.compare_digest(expected, header or "")


def message_text(message: dict) -> str:
    kind = message.get("type")
    if kind == "text":
        return message.get("text", {}).get("body", "")
    if kind == "button":
        return message.get("button", {}).get("text", "")
    if kind == "interactive":
        reply = message.get("interactive", {})
        return (reply.get("button_reply") or reply.get("list_reply") or {}).get("title", "")
    return f"[{kind} message]"                         # image, audio, document...


@router.post("/webhook/whatsapp")
async def whatsapp_message(request: Request):
    body = await request.body()
    if not signature_ok(body, request.headers.get("X-Hub-Signature-256")):
        raise HTTPException(403, "Invalid signature")
    data = json.loads(body or b"{}")

    handled = []
    for entry in data.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            names = {c.get("wa_id"): c.get("profile", {}).get("name") for c in value.get("contacts", [])}
            for message in value.get("messages", []):        # status updates have no "messages"
                wa_id = message.get("from", "")
                handled.append(receive_whatsapp(wa_id, names.get(wa_id), message_text(message)))
    # Meta only needs a quick 200 OK; the list is useful when testing with simulate_whatsapp.py
    return {"handled": handled}


def receive_whatsapp(wa_id: str, name: Optional[str], text: str) -> dict:
    """One incoming WhatsApp message (from Meta or Twilio).
    New number   -> new lead; the bot welcomes them and asks for their details (whatsapp_bot.py).
    Asking now   -> save the answer, score again, ask the next question.
    Chat is done -> add the message to the lead, score again, and answer it from the
                    owner's product list if possible (otherwise the sales team replies)."""
    phone = "+" + wa_id.lstrip("+")
    business, products = db.get_business(), db.get_products()
    existing = db.find_open_lead(phone, "WhatsApp")
    if not existing:
        lead = save_new_lead({
            "name": name or "WhatsApp user", "phone": phone,
            "channel": "WhatsApp", "customer_message": text,
            "last_activity": "Chatted with us", "chat_step": "name",
        })
        return {"lead_id": lead["id"], "action": "created", "reply": bot.first_question(business)}

    if existing.get("chat_step") in bot.NEXT:                 # the bot is still asking questions
        changes, reply = bot.next_reply(existing, text, business, products)
        existing.update(changes)
        changes.update(score_lead(existing))                  # e.g. customer type changes the score
        db.update_lead(existing["id"], changes)
        return {"lead_id": existing["id"], "action": "details", "reply": reply}

    first = (existing.get("name") or "").split(" ")[0] or "there"
    if existing.get("chat_step") == "anything_else" and bot.is_closing(text):
        # "No" / "nothing" / "ok thanks" after "Anything else?" = done asking, NOT "not interested"
        db.update_lead(existing["id"], {"chat_step": "done"})
        return {"lead_id": existing["id"], "action": "closed", "reply": bot.team_will_contact(first)}

    lead = add_message_to_lead(existing, text)
    step = "done"
    if agents.only_greeting(text):                            # "Hi" again from a known customer
        reply = bot.welcome_back(lead, business, products)
    elif agents.analyse_conversation(text) == ["Not interested"]:
        reply = bot.not_interested_reply(first, business)
    else:
        reply = bot.answer_question(text, lead, business, products)
        if reply:                                             # we had the answer: ask if there is more
            reply += f"\n\nAnything else, {first}?"
            step = "anything_else"
        else:                                                 # nothing to answer automatically
            reply = bot.team_will_contact(first)
    db.update_lead(lead["id"], {"chat_step": step})
    return {"lead_id": lead["id"], "action": "updated", "reply": reply}


# ======================= 3. WhatsApp through Twilio =======================
def twilio_signature(url: str, params: dict) -> str:
    """Twilio's rule: HMAC-SHA1 of (URL + every field name and value, sorted by name), in base64."""
    text = url + "".join(key + value for key in sorted(params) for value in params[key])
    digest = hmac.new(TWILIO_TOKEN.encode(), text.encode(), hashlib.sha1).digest()
    return base64.b64encode(digest).decode()


def from_twilio(request: Request, params: dict) -> bool:
    """When the auth token is set, accept only messages signed by Twilio."""
    if not TWILIO_TOKEN:
        return True
    header = request.headers.get("X-Twilio-Signature", "")
    # Behind the tunnel our server sees http://localhost, but Twilio signed the public https URL
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
    path = request.url.path + (f"?{request.url.query}" if request.url.query else "")
    urls = {f"https://{host}{path}", f"http://{host}{path}", str(request.url)}
    if os.environ.get("TWILIO_WEBHOOK_URL"):
        urls.add(os.environ["TWILIO_WEBHOOK_URL"])
    return any(hmac.compare_digest(twilio_signature(u, params), header) for u in urls)


def twiml(reply: str = "") -> Response:
    """Twilio expects an XML answer; <Message> in it is sent back to the customer."""
    body = f"<Message>{escape(reply)}</Message>" if reply else ""
    return Response(content=f'<?xml version="1.0" encoding="UTF-8"?><Response>{body}</Response>',
                    media_type="application/xml")


@router.post("/webhook/twilio")
@router.post("/", include_in_schema=False)        # also works if only the tunnel link is pasted in Twilio
async def twilio_message(request: Request):
    # Twilio sends a normal web form (From=whatsapp:+91..., Body=..., ProfileName=...)
    params = urllib.parse.parse_qs((await request.body()).decode(), keep_blank_values=True)
    if not from_twilio(request, params):
        print("Twilio webhook: signature did not match. Check TWILIO_AUTH_TOKEN, "
              "or set TWILIO_WEBHOOK_URL to the exact URL typed in the Twilio Console.")
        raise HTTPException(403, "Invalid Twilio signature")
    field = lambda name: params.get(name, [""])[0]          # noqa: E731
    wa_id = field("WaId") or field("From").replace("whatsapp:", "").lstrip("+")
    if not wa_id:
        return twiml()                                      # not a message (e.g. a status update)
    text = field("Body")
    if not text and int(field("NumMedia") or 0) > 0:
        text = f"[{field('MessageType') or 'media'} message]"
    result = receive_whatsapp(wa_id, field("ProfileName") or None, text)
    print(f"Twilio WhatsApp from +{wa_id}: lead {result['lead_id']} {result['action']}")
    return twiml(result["reply"] or "")                   # Twilio sends this reply to the customer


class OutgoingMessage(BaseModel):
    message: str = Field(min_length=1, max_length=1500)


def whatsapp_address(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) == 10:                                  # Indian number typed without +91
        digits = "91" + digits
    return f"whatsapp:+{digits}"


@router.post("/leads/{lead_id}/whatsapp")
def send_whatsapp(lead_id: int, body: OutgoingMessage):
    """Send the follow-up message to the customer through Twilio's WhatsApp API."""
    lead = db.get_lead(lead_id)
    if not lead:
        raise HTTPException(404, f"Lead {lead_id} not found")
    if not (TWILIO_SID and TWILIO_TOKEN):
        raise HTTPException(400, "Twilio is not set up. Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN "
                                 "to the .env file and restart the backend.")
    form = urllib.parse.urlencode({"From": TWILIO_FROM, "To": whatsapp_address(lead["phone"]),
                                   "Body": body.message}).encode()
    request = urllib.request.Request(
        f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_SID}/Messages.json", data=form, method="POST",
        headers={"Authorization": "Basic " + base64.b64encode(f"{TWILIO_SID}:{TWILIO_TOKEN}".encode()).decode()})
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            sent = json.loads(response.read())
    except urllib.error.HTTPError as error:
        detail = json.loads(error.read() or b"{}")
        hint = (". The customer must first send 'join <your sandbox code>' to the Sandbox number, "
                "and must have messaged you in the last 24 hours.") if detail.get("code") in (63015, 63016, 21608) else ""
        raise HTTPException(502, f"Twilio refused: {detail.get('message', error.reason)}{hint}")
    except urllib.error.URLError as error:
        raise HTTPException(502, f"Could not reach Twilio: {error.reason}")

    changes = {"last_contacted_at": datetime.now().isoformat(timespec="seconds")}
    if lead["status"] == "New":
        changes["status"] = "Contacted"
    db.update_lead(lead_id, changes)
    return {"sent": True, "twilio_id": sent.get("sid"), "to": whatsapp_address(lead["phone"]),
            "lead": db.get_lead(lead_id)}


# ======================= 4. Email (any service that forwards emails to a web address) =======================
EMAIL_TOKEN = os.environ.get("EMAIL_WEBHOOK_TOKEN", "")
NAME_AND_ADDRESS = re.compile(r'^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$')        # Priya Sharma <priya@gmail.com>


def first_value(data: dict, *keys) -> str:
    for key in keys:
        value = data.get(key)
        if isinstance(value, list):
            value = value[0] if value else ""
        if isinstance(value, dict):
            continue
        if value:
            return str(value).strip()
    return ""


@router.post("/webhook/email")
async def email_message(request: Request):
    """Works with JSON or a normal form. Field names used by common forwarding services
    (CloudMailin, Zapier, Make, SendGrid-style) are accepted: from / sender, subject, text / plain / body."""
    if EMAIL_TOKEN and request.query_params.get("token") != EMAIL_TOKEN:
        raise HTTPException(403, "Wrong or missing token")
    body = await request.body()
    try:
        data = json.loads(body or b"{}")
    except ValueError:
        data = urllib.parse.parse_qs(body.decode(errors="ignore"))
    headers = data.get("headers") if isinstance(data.get("headers"), dict) else {}
    envelope = data.get("envelope") if isinstance(data.get("envelope"), dict) else {}
    sender = first_value(data, "from", "sender", "email") or first_value(headers, "from", "From") \
        or first_value(envelope, "from")
    name = first_value(data, "name", "from_name")
    match = NAME_AND_ADDRESS.match(sender)
    if match:
        name, sender = name or match.group(1).strip(), match.group(2).strip()
    if not re.match(EMAIL_PATTERN, sender or ""):
        raise HTTPException(422, "No valid sender email address found")
    subject = first_value(data, "subject") or first_value(headers, "subject", "Subject")
    text = first_value(data, "text", "plain", "body", "message")
    message = "\n".join(part for part in (subject, text) if part)[:1000] or "(empty email)"

    existing = db.find_open_lead_by_email(sender)
    if existing:
        lead = add_message_to_lead(existing, message)
        action = "updated"
    else:
        lead = save_new_lead({
            "name": (name or sender.split("@")[0].replace(".", " ")).title()[:60], "phone": "-",   # no phone in an email
            "email": sender.lower(), "channel": "Email", "customer_message": message,
            "last_activity": "Chatted with us",
        })
        action = "created"
    print(f"Email from {sender}: lead {lead['id']} {action}")
    return {"lead_id": lead["id"], "action": action}


# ======================= Status of every channel (Connect page) =======================
@router.get("/connections")
def connections():
    return {
        "whatsapp": {
            "provider": "Twilio",
            "configured": bool(TWILIO_SID and TWILIO_TOKEN),
            "number": TWILIO_FROM.replace("whatsapp:", ""),
            "webhook_path": "/webhook/twilio",
            "signature_check": bool(TWILIO_TOKEN),
            **db.channel_summary("WhatsApp"),
        },
        "website": {"form_path": "/enquiry", **db.channel_summary("Website")},
        "email": {"webhook_path": "/webhook/email", "token_required": bool(EMAIL_TOKEN),
                  **db.channel_summary("Email")},
    }
