"""
app.py - FastAPI backend (the Orchestrator).

Run:   uvicorn app:app --reload
Test:  open http://127.0.0.1:8000/docs in the browser

Endpoints
  POST   /leads                 add a lead          (INSERT)  -> analysed, scored, saved
  GET    /leads                 list leads by score (RETRIEVE)
  GET    /leads/{id}            one lead            (RETRIEVE)
  PUT    /leads/{id}            edit a lead         (UPDATE)  -> re-scored
  PATCH  /leads/{id}/status     mark Contacted / Converted / Not Converted (UPDATE)
  DELETE /leads/{id}            remove a lead       (DELETE)
  GET    /leads/{id}/message    drafted follow-up message
  GET    /followups             leads that need a follow-up now
  GET    /analytics             numbers for the dashboard
  GET    /options               dropdown values for the website form
  PATCH  /leads/{id}/priority   salesperson sets the priority themselves (or back to automatic)
  POST   /retrain               retrain the profile model and the message model with the recorded outcomes
                                (also runs by itself after every 10 new Converted / Not Converted leads)
  POST   /rescore               score every saved lead again with the current model
  GET/PUT /business  GET/PUT /products   business details and product list for the bot (business.py)
  GET    /enquiry               public enquiry form for the business website (channels.py)
  POST   /webhook/whatsapp      new WhatsApp messages from Meta become leads (channels.py)
  POST   /webhook/twilio        new WhatsApp messages through Twilio become leads (channels.py)
  POST   /leads/{id}/whatsapp   send the follow-up message on WhatsApp through Twilio (channels.py)
"""

import json
import subprocess
import sys
import threading
from datetime import datetime
from pathlib import Path
from typing import Literal, Optional

import pandas as pd
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import database as db
import agents
import whatsapp_bot
from agents import Channel, CustomerType, Activity, SCORING_FIELDS
from typing import get_args

app = FastAPI(title="Lead Conversion Intelligence System")

# Allow the React dashboard (running on another port) to call this API
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

db.create_tables()
scorer = agents.LeadScoringAgent()
message_model = agents.MessageModel()      # learned from your own chats once outcomes exist


# ---------- Form validation (Pydantic checks every request automatically) ----------
# Email: letters, digits and . _ % + - before @, a domain, and a 2+ letter ending (e.g. ravi.k@gmail.com)
EMAIL_PATTERN = r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"

# Number limits match the range seen in Leads.csv. The model cannot judge values
# far outside what it was trained on, so we reject them instead of giving a wrong score.
MAX_VISITS, MAX_TIME = 300, 3000

SAMPLE_LEAD = {
    "name": "Ravi Kumar", "phone": "9876543210", "email": "ravi@gmail.com",
    "channel": "Instagram", "interested_in": "Digital Marketing Course",
    "customer_type": "Working Professional", "last_activity": "Chatted with us",
    "website_visits": 5, "time_on_website": 1200,
    "customer_message": "Hi, what is the price of the course? I want to join this week.",
}


class LeadForm(BaseModel):
    model_config = {"json_schema_extra": {"examples": [SAMPLE_LEAD]}}   # sample shown in /docs
    # Contact details
    name: str = Field(min_length=2, max_length=60)
    phone: str = Field(pattern=r"^\+?[0-9]{10,13}$", description="10-13 digits, optional +")
    email: Optional[str] = Field(None, pattern=EMAIL_PATTERN)
    # Where the lead came from and what they want
    channel: Channel
    interested_in: Optional[str] = Field(None, max_length=80, description="Product or service asked about")
    customer_message: Optional[str] = Field(None, max_length=1000, description="What the customer wrote")
    # Signals used by the model
    customer_type: Optional[CustomerType] = None
    last_activity: Optional[Activity] = None
    website_visits: Optional[float] = Field(None, ge=0, le=MAX_VISITS)
    time_on_website: Optional[float] = Field(None, ge=0, le=MAX_TIME, description="Same unit as Leads.csv")


class LeadUpdate(BaseModel):
    """Same fields as LeadForm, but all optional: send only what changes."""
    model_config = {"json_schema_extra": {"examples": [{"last_activity": "Had a phone call"}]}}
    name: Optional[str] = Field(None, min_length=2, max_length=60)
    phone: Optional[str] = Field(None, pattern=r"^\+?[0-9]{10,13}$")
    email: Optional[str] = Field(None, pattern=EMAIL_PATTERN)
    channel: Optional[Channel] = None
    interested_in: Optional[str] = Field(None, max_length=80)
    customer_message: Optional[str] = Field(None, max_length=1000)
    customer_type: Optional[CustomerType] = None
    last_activity: Optional[Activity] = None
    website_visits: Optional[float] = Field(None, ge=0, le=MAX_VISITS)
    time_on_website: Optional[float] = Field(None, ge=0, le=MAX_TIME)


class StatusUpdate(BaseModel):
    model_config = {"json_schema_extra": {"examples": [{"status": "Contacted"}]}}
    status: Literal["New", "Contacted", "Converted", "Not Converted"]


class PriorityChoice(BaseModel):
    """null = let the system decide again"""
    model_config = {"json_schema_extra": {"examples": [{"priority": "HIGH"}, {"priority": None}]}}
    priority: Optional[Literal["HIGH", "MEDIUM", "LOW"]] = None


def find_or_404(lead_id: int) -> dict:
    lead = db.get_lead(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail=f"Lead {lead_id} not found")
    return lead


def score_lead(lead: dict) -> dict:
    """Profile score from the ML model, then the customer's message raises or lowers it."""
    model_result = scorer.score(lead)                                  # Lead Scoring Agent
    tags = agents.analyse_conversation(lead.get("customer_message"))   # Conversation Agent
    products = db.get_products()
    if "Not interested" not in tags and whatsapp_bot.not_in_catalog(lead, products):
        tags = tags + ["Not in our product list"]     # asked for something the business does not sell
    result = agents.apply_signals(model_result, tags, scorer.cutoffs,
                                  lead.get("customer_message"), message_model)
    if lead.get("priority_override"):                 # the salesperson's own choice always wins
        result["priority"] = lead["priority_override"]
    return result


# Leads that arrive by themselves: website enquiry form and WhatsApp (see channels.py)
import channels  # noqa: E402
channels.score_lead = score_lead
app.include_router(channels.router)

# The business owner's profile, products and policies (used by the WhatsApp bot)
import business  # noqa: E402
app.include_router(business.router)


# ---------- INSERT: the Orchestrator flow for a new lead ----------
@app.post("/leads", status_code=201)
def add_lead(form: LeadForm):
    lead = agents.analyse_lead(form.model_dump())     # 1. Lead Analysis Agent
    lead.update(score_lead(lead))                      # 2-3. Scoring + Conversation Agents
    lead_id = db.insert_lead(lead)                     # 4. save in SQLite
    saved = find_or_404(lead_id)
    saved["needs_follow_up"] = agents.needs_follow_up(saved)   # 5. Follow-up Agent
    saved["draft_message"] = agents.draft_message(saved)       # 6. Message Agent
    return saved


# ---------- RETRIEVE ----------
@app.get("/leads")
def list_leads(status: Optional[str] = None):
    return db.get_all_leads(status)


@app.get("/leads/{lead_id}")
def get_one_lead(lead_id: int):
    return find_or_404(lead_id)


# ---------- UPDATE ----------
@app.put("/leads/{lead_id}")
def edit_lead(lead_id: int, changes: LeadUpdate):
    lead = find_or_404(lead_id)
    new_values = agents.analyse_lead(changes.model_dump(exclude_none=True))
    lead.update(new_values)
    if SCORING_FIELDS & new_values.keys():
        new_values.update(score_lead(lead))            # details changed -> score again
    db.update_lead(lead_id, new_values)
    return db.get_lead(lead_id)


@app.patch("/leads/{lead_id}/status")
def change_status(lead_id: int, body: StatusUpdate, background: BackgroundTasks):
    find_or_404(lead_id)
    changes = {"status": body.status}
    if body.status == "Contacted":
        changes["last_contacted_at"] = datetime.now().isoformat(timespec="seconds")
    db.update_lead(lead_id, changes)
    if body.status in ("Converted", "Not Converted"):
        background.add_task(retrain_if_due)           # learn from new outcomes automatically
    return db.get_lead(lead_id)


@app.patch("/leads/{lead_id}/priority")
def set_priority(lead_id: int, body: PriorityChoice):
    """The salesperson knows this customer: their priority is kept until they switch back to automatic."""
    lead = find_or_404(lead_id)
    lead["priority_override"] = body.priority
    changes = {"priority_override": body.priority}
    changes.update(score_lead(lead))
    db.update_lead(lead_id, changes)
    return db.get_lead(lead_id)


# ---------- DELETE ----------
@app.delete("/leads/{lead_id}")
def remove_lead(lead_id: int):
    find_or_404(lead_id)
    db.delete_lead(lead_id)
    return {"message": f"Lead {lead_id} deleted"}


# ---------- Dropdown values for the website (one source of truth) ----------
@app.get("/options")
def options():
    return {"channels": list(get_args(Channel)),
            "customer_types": list(get_args(CustomerType)),
            "activities": list(get_args(Activity)),
            "statuses": ["New", "Contacted", "Converted", "Not Converted"],
            "limits": {"website_visits": MAX_VISITS, "time_on_website": MAX_TIME}}


# ---------- Agents ----------
@app.get("/leads/{lead_id}/message")
def get_message(lead_id: int):
    lead = find_or_404(lead_id)
    return {"lead_id": lead_id, "priority": lead["priority"], "message": agents.draft_message(lead)}


@app.get("/followups")
def followups():
    due = [l for l in db.get_all_leads() if agents.needs_follow_up(l)]
    return [{"id": l["id"], "name": l["name"], "priority": l["priority"], "status": l["status"],
             "message": agents.draft_message(l)} for l in due]


@app.get("/analytics")
def get_analytics():
    return agents.analytics(db.get_all_leads())


# ---------- Re-score every lead (after a new model or new rules) ----------
def rescore_all() -> int:
    leads = db.get_all_leads()
    for lead in leads:
        db.update_lead(lead["id"], score_lead(lead))
    return len(leads)


@app.post("/rescore")
def rescore():
    return {"rescored": rescore_all()}


# ---------- Retraining with new outcomes (by button, or automatically) ----------
AUTO_RETRAIN_EVERY = 10                     # retrain after every 10 new finished leads
STATE_FILE = Path("training_state.json")    # remembers how many outcomes the last training used
training_lock = threading.Lock()


def closed_leads() -> list:
    return [l for l in db.get_all_leads() if l["status"] in ("Converted", "Not Converted")]


def last_training_count() -> int:
    try:
        return json.loads(STATE_FILE.read_text()).get("outcomes_used", 0)
    except (FileNotFoundError, ValueError):
        return 0


def run_retraining() -> dict:
    closed = closed_leads()
    # Save outcomes in the same column format as Leads.csv
    rows = []
    for l in closed:
        row = agents.to_dataset_row(l)
        row["Prospect ID"] = f"app-{l['id']}"
        row["Converted"] = 1 if l["status"] == "Converted" else 0
        rows.append(row)
    pd.DataFrame(rows).to_csv("new_outcomes.csv", index=False)

    # Profile model: train_model.py only keeps the new model if it is better on the fixed test set
    result = subprocess.run([sys.executable, "train_model.py", "Leads.csv", "new_outcomes.csv"],
                            capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError("Training failed: " + result.stderr[-500:])
    scorer.load()

    # Message Model: learns from what converted / not converted customers wrote
    text_result = subprocess.run([sys.executable, "train_message_model.py"], capture_output=True, text=True)
    message_model.load()
    rescored = rescore_all()                           # every lead gets the new models' score
    STATE_FILE.write_text(json.dumps({"outcomes_used": len(rows),
                                      "trained_at": datetime.now().isoformat(timespec="seconds")}))
    return {"outcomes_used": len(rows), "rescored": rescored,
            "training_output": result.stdout.splitlines()[-3:],
            "message_model": (text_result.stdout or text_result.stderr).strip().splitlines()[-2:]}


def retrain_if_due():
    """Runs in the background after a lead is marked Converted / Not Converted."""
    closed = len(closed_leads())
    if closed < 10 or closed - last_training_count() < AUTO_RETRAIN_EVERY:
        return
    if not training_lock.acquire(blocking=False):      # a training is already running
        return
    try:
        result = run_retraining()
        print(f"Automatic retraining done with {result['outcomes_used']} outcomes")
    except Exception as error:                        # noqa: BLE001 - keep the server running
        print("Automatic retraining failed:", error)
    finally:
        training_lock.release()


@app.post("/retrain")
def retrain():
    closed = len(closed_leads())
    if closed < 10:
        raise HTTPException(400, f"Need at least 10 closed leads to retrain, have {closed}")
    if not training_lock.acquire(blocking=False):
        raise HTTPException(409, "Training is already running. Try again in a minute.")
    try:
        return run_retraining()
    except RuntimeError as error:
        raise HTTPException(500, str(error))
    finally:
        training_lock.release()


@app.get("/learning")
def learning_status():
    """For the Analytics page: how much the system has learned and when it learns next."""
    closed = len(closed_leads())
    last = last_training_count()
    next_at = max(10, last + AUTO_RETRAIN_EVERY)
    return {"finished_leads": closed, "used_in_last_training": last,
            "next_training_at": next_at, "message_model": message_model.info or None}
