"""
agents.py - the agents from our architecture. Each agent does ONE job.

    Lead Analysis Agent  -> cleans the form data and converts it into the model's format
    Lead Scoring Agent   -> uses the trained ML model to give a score, priority and reasons
    Follow-up Agent      -> decides which leads need a follow-up now
    Message Agent        -> drafts a personalised follow-up message (template based)
    Analytics Agent      -> conversion numbers for the dashboard

The Orchestrator (in app.py) calls these agents in order.
"""

import itertools
import re
from datetime import datetime, timedelta
from typing import Literal, get_args
import numpy as np
import pandas as pd
import joblib

from intent_model import IntentModel, split_lines

MODEL_FILE = "lead_model.pkl"

# ---------------------------------------------------------------------------
# Our form uses simple business words. The model was trained on Leads.csv,
# which uses different words. These tables translate our words -> dataset words.
# ---------------------------------------------------------------------------
# Dropdown choices for the form. Literal = only these exact values are accepted.
Channel = Literal["Website", "WhatsApp", "Instagram", "Facebook", "Email", "Google Search", "Referral"]
CustomerType = Literal["Working Professional", "Business Owner", "Student", "Homemaker",
                       "Unemployed", "Other"]
Activity = Literal["Chatted with us", "Received our WhatsApp/SMS", "Opened our email",
                   "Clicked email link", "Visited website", "Filled website form",
                   "Had a phone call", "Not reachable"]
CHANNELS = list(get_args(Channel))          # the same values as a normal list

CHANNEL_TO_SOURCE = {            # our channel -> "Lead Source" in Leads.csv
    "Website": "Direct Traffic",
    "WhatsApp": "Olark Chat",    # chat enquiry, closest match in the dataset
    "Instagram": "Olark Chat",   # an Instagram DM is an inbound chat, like WhatsApp
                                 # ("Facebook" in Leads.csv = bulk-imported contact lists)
    "Facebook": "Facebook",
    "Email": "Direct Traffic",
    "Google Search": "Google",
    "Referral": "Reference",
}
CHANNEL_TO_ORIGIN = {            # how the lead entered the system -> "Lead Origin"
    "Website": "Landing Page Submission",
    "Google Search": "Landing Page Submission",
    "Referral": "Lead Add Form",     # added by staff
}                                     # all others (WhatsApp, Instagram, ...) come through an API
CUSTOMER_TYPE_TO_OCCUPATION = {   # rare types are grouped as "Other" in training (see train_model.py)
    "Business Owner": "Other",
    "Homemaker": "Other",
}
ACTIVITY_TO_DATASET = {
    # In Leads.csv "Olark Chat Conversation" (a website chat pop-up) converts only 9%.
    # A two-way chat on WhatsApp/Instagram shows more interest, so we map it to a
    # medium-engagement activity instead ("Email Opened", 36% conversion, 3,437 leads).
    "Chatted with us": "Email Opened",
    "Received our WhatsApp/SMS": "SMS Sent",
    "Opened our email": "Email Opened",
    "Clicked email link": "Email Link Clicked",
    "Visited website": "Page Visited on Website",
    "Filled website form": "Form Submitted on Website",
    "Had a phone call": "Had a Phone Conversation",
    "Not reachable": "Unreachable",
}

# Fields that change the model's score (editing them triggers a re-score)
MODEL_FIELDS = {"channel", "customer_type", "last_activity", "website_visits", "time_on_website"}
# Fields that change the priority (model fields + the customer's message)
SCORING_FIELDS = MODEL_FIELDS | {"customer_message"}


# Leads from these channels usually never visit the website. In Leads.csv, 91% of chat
# leads and 76% of referral leads have time on website = 0, so an empty value means 0 here.
NO_WEBSITE_CHANNELS = {"WhatsApp", "Instagram", "Facebook", "Referral"}


def to_dataset_row(lead: dict) -> dict:
    """Translate one lead from our form format into the Leads.csv column format."""
    channel = lead.get("channel") or ""
    visits, time_on_site = lead.get("website_visits"), lead.get("time_on_website")
    if channel in NO_WEBSITE_CHANNELS:
        visits = 0 if visits is None else visits
        time_on_site = 0 if time_on_site is None else time_on_site
    ctype = lead.get("customer_type") or ""
    activity = lead.get("last_activity") or ""
    return {
        "Lead Source": CHANNEL_TO_SOURCE.get(channel),
        "Lead Origin": CHANNEL_TO_ORIGIN.get(channel, "API") if channel else None,
        "What is your current occupation": CUSTOMER_TYPE_TO_OCCUPATION.get(ctype, ctype or None),
        "Last Activity": ACTIVITY_TO_DATASET.get(activity),
        "TotalVisits": visits,
        "Total Time Spent on Website": time_on_site,
    }


# ======================= Lead Analysis Agent =======================
def analyse_lead(form: dict) -> dict:
    """Clean the raw form data: trim spaces, name in Title Case, email in lower case."""
    lead = {}
    for key, value in form.items():
        if isinstance(value, str):
            value = value.strip() or None
        lead[key] = value
    if lead.get("name"):
        lead["name"] = lead["name"].title()
    if lead.get("email"):
        lead["email"] = lead["email"].lower()
    return lead


# ======================= Lead Scoring Agent =======================
# How each model column is explained to the sales team
REASON_TEXT = {
    "Total Time Spent on Website": lambda l: "spent a lot of time on website",
    "TotalVisits": lambda l: "visited website many times",
    "Page Views Per Visit": lambda l: "viewed many pages",
    "Lead Source": lambda l: f"came via {l.get('channel')}",
    "Lead Origin": lambda l: f"came via {l.get('channel')}",
    "What is your current occupation": lambda l: f"customer is {l.get('customer_type')}",
    "Last Activity": lambda l: f"last activity: {l.get('last_activity')}",
}


class LeadScoringAgent:
    def __init__(self):
        self.load()

    def load(self):
        saved = joblib.load(MODEL_FILE)
        self.model = saved["model"]
        self.prep = self.model.named_steps["prep"]
        self.expected_columns = list(self.model.feature_names_in_)   # columns used in training
        self.num_columns = list(self.prep.transformers_[0][2])
        self.medians = self.prep.named_transformers_["num"].statistics_
        # Priority cut-offs and feature importances are worked out during training
        self.cutoffs = saved.get("cutoffs", {"medium": 0.40, "high": 0.70})
        self.fill_values = saved.get("fill_values", {})
        self.importances = saved.get("importances")
        if self.importances is None:
            self.importances = self.model.named_steps["model"].feature_importances_

    def _probability(self, row: dict) -> float:
        """Chance of buying. If customer type or last activity is empty, the form simply
        did not record it, so we average the model's answer over the usual values
        (weighted by how common each is in the training data)."""
        missing = [c for c, weights in self.fill_values.items()
                   if c in row and pd.isna(row[c]) and weights]
        if not missing:
            return float(self.model.predict_proba(pd.DataFrame([row]))[0, 1])
        options = [list(self.fill_values[c].items()) for c in missing]
        rows, weights = [], []
        for combo in itertools.product(*options):
            filled = dict(row)
            weight = 1.0
            for column, (value, share) in zip(missing, combo):
                filled[column] = value
                weight *= share
            rows.append(filled)
            weights.append(weight)
        probs = self.model.predict_proba(pd.DataFrame(rows))[:, 1]
        return float(np.average(probs, weights=weights))

    def score(self, lead: dict) -> dict:
        # Every training column starts empty; we fill the ones our form provides.
        row = {col: np.nan for col in self.expected_columns}
        for col, value in to_dataset_row(lead).items():
            if col in row and value is not None:
                row[col] = value
        X = pd.DataFrame([row])
        probability = self._probability(row)
        if probability >= self.cutoffs["high"]:
            priority = "HIGH"
        elif probability >= self.cutoffs["medium"]:
            priority = "MEDIUM"
        else:
            priority = "LOW"

        # Reasons: the lead's strong points, ordered by how important the model finds them.
        names = self.prep.get_feature_names_out()
        encoded = np.asarray(self.prep.transform(X), dtype=float)
        n_num = len(self.medians)
        filled = np.array([pd.notna(row[c]) and row[c] > 0 for c in self.num_columns])
        active = np.concatenate([(encoded[0, :n_num] > self.medians) & filled,
                                 encoded[0, n_num:] != 0])
        reasons = []
        for _, name in sorted(zip(self.importances[active], names[active]), reverse=True):
            column = name.split("__", 1)[1]
            if name.startswith("flag__"):
                continue                           # internal "no website visit" flag
            if name.startswith("cat__"):
                column = next((c for c in REASON_TEXT if column.startswith(c + "_")), None)
                if column is None or row.get(column) is None or row[column] is np.nan:
                    continue                       # skip "Unknown" / empty fields
            text = REASON_TEXT.get(column, lambda l: column)(lead)
            if text not in reasons:
                reasons.append(text)
            if len(reasons) == 3:
                break
        return {"score": round(probability, 3), "priority": priority,
                "reasons": ", ".join(reasons) or "no strong signals"}


# ======================= Message Model (learned from the business's own chats) =======================
MESSAGE_MODEL_FILE = "message_model.pkl"


class MessageModel:
    """Text model trained by train_message_model.py on the customer messages of leads that the
    business marked Converted / Not Converted. Not used until enough outcomes exist."""

    def __init__(self):
        self.load()

    def load(self):
        try:
            saved = joblib.load(MESSAGE_MODEL_FILE)
        except FileNotFoundError:
            saved = None
        self.pipeline = saved["pipeline"] if saved else None
        self.base_rate = saved["base_rate"] if saved else None
        self.info = {k: v for k, v in (saved or {}).items() if k != "pipeline"}

    def boost(self, message: str):
        """How much this message multiplies the odds, compared with an average lead.
        e.g. 2.0 = messages like this convert twice as often (in odds). None = no model yet."""
        if self.pipeline is None:
            return None
        p = float(self.pipeline.predict_proba([message])[0, 1])
        p = min(max(p, 0.01), 0.99)
        base_odds = self.base_rate / (1 - self.base_rate)
        return (p / (1 - p)) / base_odds


# ======================= Follow-up Agent =======================
FOLLOW_UP_AFTER = {"HIGH": timedelta(days=1), "MEDIUM": timedelta(days=3), "LOW": timedelta(days=7)}


def needs_follow_up(lead: dict, now=None) -> bool:
    """A lead needs follow-up if it is still open and has waited longer than its priority allows."""
    if lead["status"] in ("Converted", "Not Converted"):
        return False
    if lead["status"] == "New" and lead["priority"] == "HIGH":
        return True                                   # hot new leads: contact immediately
    now = now or datetime.now()
    last = lead["last_contacted_at"] or lead["created_at"]
    return now - datetime.fromisoformat(last) >= FOLLOW_UP_AFTER.get(lead["priority"], timedelta(days=7))


# ======================= Conversation Agent =======================
# Reads what the customer wrote and finds buying signals using keyword rules.
# Each signal: tag shown to the sales team, effect on priority, keywords to look for.
SIGNALS = [
    ("Not interested", "down", ["not interested", "no thanks", "no thank you", "don't contact", "do not contact",
                                "stop messaging", "unsubscribe", "already bought", "not needed", "not now",
                                "don't call", "do not call", "dont call", "wrong number", "no money", "no budget",
                                "can't afford", "cannot afford", "cant afford", "not affordable"]),
    ("Just browsing", "down", ["just checking", "just asking", "only asking", "just looking", "only looking",
                               "information only", "info only", "will see later", "see later", "maybe later",
                               "let you know", "discuss with family", "will think", "think about it"]),
    ("Wants to buy soon", "up", ["buy", "purchase", "order", "book", "booking", "today", "tomorrow", "this week",
                                 "asap", "urgent", "urgently", "immediately", "ready to", "join", "enroll",
                                 "enrol", "sign up", "register"]),
    ("Asked about price", "up", ["price", "prices", "cost", "costs", "rate", "rates", "how much", "fees", "fee",
                                 "charges", "quotation",
                                 "quote", "budget", "emi"]),
    ("Asked about product details", "up", ["specification", "specifications", "specs", "features", "feature",
                                           "model", "models", "variant", "variants", "colour", "colours", "color",
                                           "colors", "size", "sizes", "mileage", "availability", "available",
                                           "in stock", "warranty", "delivery", "test drive"]),
    ("Asked for a call or demo", "up", ["call me", "call back", "callback", "meeting", "demo", "visit",
                                         "appointment", "contact me", "talk"]),
    ("Asked about discounts", "neutral", ["discount", "offer", "deal", "cheaper", "best price", "coupon"]),
    ("Comparing options", "neutral", ["compare", "comparison", "alternative", "other options", "vs", "versus"]),
    ("Has questions", "neutral", ["?", "what", "how", "which", "when", "where", "can you", "could you",
                                  "is there", "do you", "details", "information", "info", "brochure",
                                  "more about"]),
]


def _has_keyword(text: str, keyword: str) -> bool:
    if not keyword[0].isalnum():                      # symbols like "?" -> simple search
        return keyword in text
    return re.search(r"\b" + re.escape(keyword) + r"\b", text) is not None


GREETING_WORDS = {"hi", "hii", "hiii", "hello", "helo", "hey", "heyy", "hai", "namaste", "namaskar",
                  "good", "morning", "afternoon", "evening", "sir", "madam", "mam", "bro", "there",
                  "ok", "okay", "k", "thanks", "thank", "you", "thankyou", "yes", "no", "hmm"}


def only_greeting(message: str) -> bool:
    """True when the customer only said hello / ok / thanks, with nothing about what they want."""
    words = re.findall(r"[a-z]+", message.lower())
    return all(w in GREETING_WORDS for w in words)


# "do not plan to buy", "I won't purchase", "never interested": a no-word up to 3 words before
# a buying word turns it around, so "buy" in these sentences is NOT a buying signal.
NEGATED_BUYING = re.compile(
    r"\b(?:don'?t|dont|do not|does not|doesn'?t|did not|didn'?t|not|never|won'?t|will not|no plans?)"
    r"(?:\s+\w+){0,3}?\s+(?:buy|buying|purchase|purchasing|order|ordering|book|booking|interested)\b")


# "No I don't need", "I don't want it", "dont need anything": a refusal when nothing else follows
# ("I don't want to wait" or "I don't need EMI" are not refusals).
FLAT_REFUSAL = re.compile(
    r"\b(?:do not|don'?t|dont)\s+(?:need|want)(?:\s+(?:it|this|that|anything|any|now|thanks?|sir|madam|bro))*"
    r"\s*[.!🙏]*\s*$")


def keyword_tags(message) -> list:
    """The keyword rules: which signal words appear in the text."""
    if not message:
        return []
    text = message.lower().replace("\u2019", "'")     # phones type a curly apostrophe: don’t
    tags = [tag for tag, _, words in SIGNALS if any(_has_keyword(text, w) for w in words)]
    if (NEGATED_BUYING.search(text) or any(FLAT_REFUSAL.search(line.strip()) for line in text.splitlines())) \
            and "Not interested" not in tags:
        tags.append("Not interested")
    if "Not interested" in tags:                      # "not interested" overrides positive words
        tags = ["Not interested"]
    if not tags and only_greeting(message):
        tags = ["Only said hi"]
    return tags


# The intent model (intent_model.py) decides what each message MEANS: buy / ask / later / no / hi.
# The keyword rules above only add the details (price, specs, call, discount) for the "Why" text.
INTENT_MODEL = IntentModel()
OPTION_WORDS = re.compile(r"\b(emi|loan|finance|installments?|instalments?|delivery|installation|"
                          r"warranty|insurance|gift wrap|accessories)\b")
DETAIL_TAGS = ("Asked about price", "Asked about product details", "Asked for a call or demo",
               "Asked about discounts", "Comparing options")


def analyse_conversation(message) -> list:
    """Return the buying-signal tags for the customer's messages.
    The LATEST message that says something decides: "No I don't need" after "Hi" -> Not interested,
    "Book it" after "I'll think" -> Wants to buy soon."""
    if not message:
        return []
    lines = split_lines(message)
    intents = INTENT_MODEL.predict(lines)
    if not lines or intents[0][0] is None:            # no model available: keyword rules only
        return keyword_tags(message)
    # a clear refusal phrase ("not needed", "stop messaging") is always a "no", whatever the model says
    intents = [("no", 1.0) if keyword_tags(line) == ["Not interested"] else found
               for line, found in zip(lines, intents)]
    said = [(line, intent) for line, (intent, _) in zip(lines, intents) if intent != "hi"
            # "I don't need EMI / delivery" turns down an option, not the purchase
            and not (intent == "no" and len(lines) > 1 and OPTION_WORDS.search(line.lower()))]
    if not said:
        return ["Only said hi"]
    last_line, last = said[-1]
    if last == "no" or keyword_tags(last_line) == ["Not interested"]:
        return ["Not interested"]
    tags = []
    if last == "later":
        tags.append("Just browsing")
    elif any(intent == "buy" for _, intent in said) or (
            last == "ask" and "Wants to buy soon" in keyword_tags(last_line)):   # "I want to buy, price?"
        tags.append("Wants to buy soon")
    tags += [t for t in keyword_tags(message) if t in DETAIL_TAGS]
    if not tags and any(intent == "ask" for _, intent in said):
        tags.append("Has questions")
    return tags


# How much each signal changes the chance, as a multiplier on the odds (chance / (1 - chance)).
# 2.0 = the odds double, 1.0 = no change, 0.1 = the odds drop to a tenth.
# These are set by sales common sense: a public dataset of 40,000 sales chats was tested
# (download_messages_dataset.py) and its patterns did not fit small-business customers.
# Once the business records outcomes, these weights can be checked against its own data.
SIGNAL_WEIGHTS = {
    "Wants to buy soon": 2.5,
    "Asked for a call or demo": 2.0,
    "Asked about price": 1.6,
    "Asked about product details": 1.6,
    "Asked about discounts": 1.2,
    "Comparing options": 1.0,
    "Has questions": 1.0,
    "Not interested": 0.1,
    "Only said hi": 0.35,            # a bare "Hi" tells us nothing yet about what they want
    "Just browsing": 0.5,            # "just checking", "will see later"
    "Not in our product list": 0.5,  # asked for something the business does not sell
}
MAX_BOOST = 5.0                   # all signals together can raise the odds at most 5 times


def apply_signals(model_result: dict, tags: list, cutoffs: dict,
                  message: str = None, message_model=None) -> dict:
    """Combine the profile score (ML model) with the customer's message.
    final chance = profile chance with its odds multiplied by the message's effect.
    The message's effect comes from the Message Model when it has been trained on the
    business's own chats (train_message_model.py), otherwise from the signal weights above.
    The priority (HIGH / MEDIUM / LOW) is then decided from this final chance."""
    profile = model_result["score"]
    learned = message_model.boost(message) if (message_model and message) else None
    if learned is not None:
        boost = learned
    else:
        boost = 1.0
        for tag in tags:
            boost *= SIGNAL_WEIGHTS.get(tag, 1.0)
    boost = min(boost, MAX_BOOST)
    odds = profile / (1 - profile) if profile < 1 else 99.0
    final = (odds * boost) / (1 + odds * boost)
    if "Not interested" in tags or final < cutoffs["medium"]:
        priority = "LOW"
    elif final >= cutoffs["high"]:
        priority = "HIGH"
    else:
        priority = "MEDIUM"
    reasons = ", ".join(tags + [model_result["reasons"]]) if tags else model_result["reasons"]
    return {"score": round(final, 3), "profile_score": profile, "priority": priority,
            "reasons": reasons, "intent_tags": ", ".join(tags) or None}


# ======================= Message Agent =======================
TEMPLATES = {
    "HIGH": ("Hi {first_name}, thank you for your interest in {product}! I'd love to help you get "
             "started. Can I call you today at a time that suits you?"),
    "MEDIUM": ("Hi {first_name}, thanks for reaching out about {product}. Do you have any questions "
               "I can answer? I'm happy to share more details whenever you're ready."),
    "LOW": ("Hi {first_name}, thanks for your interest in {product}. We'll keep you updated with "
            "useful information. Feel free to reply anytime."),
}


# Extra sentence added to the message for each signal found in the customer's message
SIGNAL_LINES = {
    "Asked about price": "I'll share the full price details with you right away.",
    "Asked about discounts": "We also have some current offers I can tell you about.",
    "Asked for a call or demo": "Please let me know a good time for a call or demo.",
    "Wants to buy soon": "We can get you started as soon as you're ready.",
    "Comparing options": "I'm happy to explain how we compare with other options.",
    "Asked about product details": "I'll send you the full details and specifications.",
    "Not in our product list": "We may not have exactly what you asked for, but I can suggest the closest option we offer.",
}


def draft_message(lead: dict) -> str:
    first_name = (lead.get("name") or "there").split()[0]
    product = lead.get("interested_in") or "our products and services"
    tags = [t.strip() for t in (lead.get("intent_tags") or "").split(",") if t.strip()]
    if "Not interested" in tags:
        return (f"Hi {first_name}, thank you for letting us know. We won't disturb you further. "
                f"If you ever need {product} in the future, we're here to help.")
    message = TEMPLATES.get(lead.get("priority") or "LOW", TEMPLATES["LOW"]).format(
        first_name=first_name, product=product)
    extra = " ".join(SIGNAL_LINES[t] for t in tags if t in SIGNAL_LINES)
    return f"{message} {extra}".strip()


# ======================= Analytics Agent =======================
def analytics(leads: list) -> dict:
    closed = [l for l in leads if l["status"] in ("Converted", "Not Converted")]
    converted = [l for l in leads if l["status"] == "Converted"]
    by_channel = {}
    for l in leads:
        c = l["channel"] or "Unknown"
        by_channel.setdefault(c, {"leads": 0, "closed": 0, "converted": 0})
        by_channel[c]["leads"] += 1
        by_channel[c]["closed"] += l["status"] in ("Converted", "Not Converted")
        by_channel[c]["converted"] += l["status"] == "Converted"
    return {
        "total_leads": len(leads),
        "by_priority": {p: sum(l["priority"] == p for l in leads) for p in ("HIGH", "MEDIUM", "LOW")},
        "by_status": {s: sum(l["status"] == s for l in leads)
                      for s in ("New", "Contacted", "Converted", "Not Converted")},
        "conversion_rate": round(len(converted) / len(closed), 3) if closed else None,
        "by_channel": by_channel,
    }
