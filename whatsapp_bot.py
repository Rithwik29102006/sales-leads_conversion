"""
whatsapp_bot.py - the WhatsApp chat with a new customer.

1. Collects the details the system needs to score the lead, one question at a time:
       welcome + name  ->  email  ->  occupation  ->  product (from the owner's list)  ->  their concern
   Each answer is saved into the lead and the lead is scored again.
2. Answers questions from the business owner's details (My Business page):
       price, details / specifications, availability, delivery, working hours.
   Anything it cannot answer is left for the sales team, who reply with "Send on WhatsApp".

The step the chat has reached is stored in the lead's "chat_step" column:
    "name", "email", "type", "interest", "concern"  -> still asking
    "done" (or empty, for older leads)                -> finished; questions are still answered
"""

import re
from difflib import get_close_matches
from typing import Optional, Tuple

import agents

EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
NAME = re.compile(r"^[A-Za-z][A-Za-z .']{1,59}$")
SKIP_WORDS = {"skip", "no", "none", "nil", "na", "n/a", "dont have", "don't have", "-"}

# Same values as the website form (agents.CustomerType)
CUSTOMER_TYPES = ["Student", "Working Professional", "Business Owner", "Homemaker", "Unemployed", "Other"]
TYPE_WORDS = {
    "student": "Student", "studying": "Student", "college": "Student",
    "working": "Working Professional", "job": "Working Professional", "employee": "Working Professional",
    "professional": "Working Professional", "business": "Business Owner", "owner": "Business Owner",
    "shop": "Business Owner", "homemaker": "Homemaker", "housewife": "Homemaker",
    "unemployed": "Unemployed", "not working": "Unemployed", "other": "Other",
}
TYPE_MENU = "\n".join(f"{i}. {t}" for i, t in enumerate(CUSTOMER_TYPES, 1))

# Order of the questions (same as a salesperson would ask)
NEXT = {"name": "email", "email": "type", "type": "interest", "interest": "concern", "concern": "done"}

AVAILABILITY_WORDS = ("available", "availability", "in stock", "stock")
DELIVERY_WORDS = ("deliver", "delivery", "home delivery", "shipping", "courier", "deliveries")
HOURS_WORDS = ("timing", "timings", "time", "open", "close", "closing", "hours", "working hours")
COMMON_WORDS = {"the", "and", "for", "with", "pack", "box", "set", "new", "plan", "course", "service"}
# Words that do not name a product. If a question has other words too ("non veg thali price"),
# the customer is asking about something specific that is not in our list.
QUESTION_WORDS = set("""i im want wanted to know the and of a an is are was what whats how much price prices cost costs
rate rates details detail specification specifications specs features feature please pls plz kindly tell me
about can could you give send share for it its this that these those do does have has had available
availability stock in any my your sir madam mam hi hello hey ok okay there will be on with we us our need
looking interested also again more info information all list car cars vehicle vehicles product products item
items one ones model models service services thing things which when where get buy book now today""".split())


# ---------------------------------------------------------------- helpers
def rupees(value) -> str:
    """Indian style: 749000 -> ₹7,49,000"""
    if value is None:
        return "price on request"
    whole, paise = divmod(round(float(value) * 100), 100)
    digits = str(int(whole))
    if len(digits) > 3:
        head, tail = digits[:-3], digits[-3:]
        head = ",".join(re.findall(r"\d{1,2}", head[::-1]))[::-1]
        digits = f"{head},{tail}"
    return f"₹{digits}" + (f".{paise:02d}" if paise else "")


def product_menu(products: list) -> str:
    """Numbered list of names only: prices are given only when the customer asks for them."""
    return "\n".join(f"{i}. {p['name']}" for i, p in enumerate(products, 1))


def has_word(text: str, word: str) -> bool:
    return re.search(r"\b" + re.escape(word) + r"\b", text) is not None


def find_products(text: str, products: list) -> list:
    """Products the customer named. "non veg thali" should pick Non-Veg Thali, not Veg Thali,
    so the product(s) matching the most words of their name win."""
    text = text.lower().replace("-", " ")
    best, best_score = [], 0
    for p in products:
        words = [w for w in re.findall(r"[a-z0-9]+", p["name"].lower()) if len(w) > 1]
        if not words:
            continue
        matched = sum(has_word(text, w) for w in words)
        whole = has_word(text, " ".join(words))               # the full name appears
        meaningful = any(has_word(text, w) for w in words if w not in COMMON_WORDS and len(w) > 2)
        if not (whole or meaningful):
            continue
        score = matched + (len(words) if whole else 0)
        if score > best_score:
            best, best_score = [p], score
        elif score == best_score:
            best.append(p)
    return best


def ask(step: str, business: dict, products: list) -> str:
    """The question for each step."""
    if step == "name":
        return "May I know your *full name*?"
    if step == "email":
        return "What is your *email address*? (Type *skip* if you don't want to share it.)"
    if step == "type":
        return "What is your *occupation*? Reply with the number:\n" + TYPE_MENU
    if step == "interest":
        if products:
            return "Which *product or service* are you interested in? Reply with the number or name:\n" \
                   + product_menu(products)
        return "Which *product or service* are you interested in?"
    if step == "concern":
        return "May I know your *concern*? Ask me anything: price, details, availability, delivery..."
    return ""


def retry(step: str, business: dict, products: list) -> str:
    return {
        "name": "Sorry, I didn't catch your name. Could you type just your *full name*?",
        "email": "That doesn't look like an email address. Please type your email (like name@gmail.com) or *skip*.",
        "type": "Please reply with a number from *1 to 6*:\n" + TYPE_MENU,
    }.get(step) or ask(step, business, products)


def welcome_back(lead: dict, business: dict, products: list) -> str:
    """A customer who already gave their details says "Hi" again."""
    first = (lead.get("name") or "").split(" ")[0] or "there"
    shop = f" to *{business['name']}*" if business.get("name") else ""
    text = f"Hello {first}, welcome back{shop}! 👋 How can I help you today?"
    if products:
        text += "\nAsk me about the price, details or availability of:\n" + product_menu(products)
    return text


def first_question(business: dict) -> str:
    shop = f" to *{business['name']}*" if business.get("name") else ""
    return f"Hello, welcome{shop}! 👋 I'm happy to help you.\nFirst, may I know your *full name*?"


# ---------------------------------------------------------------- answers from the owner's details
# Customers type fast on WhatsApp: "specfications", "pirce", "avilable". Words close to these
# (80% the same letters) are read as the correct word before we look for the question.
KNOWN_WORDS = ["specification", "specifications", "specs", "details", "detail", "features", "price", "prices",
               "cost", "available", "availability", "delivery", "deliver", "timings", "timing", "include",
               "includes", "mileage", "warranty", "stock"]


def fix_typos(text: str) -> str:
    def fix(match):
        word = match.group(0)
        if len(word) < 5 or word in KNOWN_WORDS:
            return word
        close = get_close_matches(word, KNOWN_WORDS, n=1, cutoff=0.8)
        return close[0] if close else word
    return re.sub(r"[a-z]+", fix, text.lower())


def product_summary(product: dict) -> str:
    parts = [f"Price: {rupees(product.get('price'))}"]
    if product.get("details"):
        parts.append(f"Details: {product['details']}")
    parts.append("Available now ✅" if product.get("available", 1) else "Not available at the moment ❌")
    return f"*{product['name']}*\n" + "\n".join(parts)


CLOSING_WORDS = {"no", "nope", "nah", "nothing", "else", "thanks", "thank", "thankyou", "you", "ok", "okay", "k",
                 "fine", "thats", "that", "s", "is", "it", "all", "bye", "sir", "madam", "mam", "good", "great",
                 "done", "noted", "sure", "for", "now", "cool"}


def is_closing(text: str) -> bool:
    """'No', 'nothing else', 'ok thanks', 'that's all' after "Anything else?" = they are done asking."""
    words = re.findall(r"[a-z]+", text.lower().replace("\u2019", "'"))
    return all(w in CLOSING_WORDS for w in words)


def team_will_contact(first: str) -> str:
    return f"Thank you {first}! 🙏 Our team will contact you soon."


def not_interested_reply(first: str, business: dict) -> str:
    """Polite close when the customer says they don't need anything: no prices, no pushing."""
    shop = (business or {}).get("name") or "us"
    return (f"No problem, {first}! 🙏 Thank you for your time. "
            f"If you ever need anything, just message {shop} here.")


def answer_question(text: str, lead: dict, business: dict, products: list) -> Optional[str]:
    """Reply with the owner's real details when the customer asks about price, details,
    availability, delivery or timings. None = nothing we can answer automatically."""
    if not text:
        return None
    text = fix_typos(text)
    low = text.lower()
    tags = agents.analyse_conversation(text)
    if tags == ["Not interested"]:
        first = (lead.get("name") or "").split(" ")[0] or "there"
        return not_interested_reply(first, business)
    wants_price = "Asked about price" in tags
    wants_availability = any(has_word(low, w) for w in AVAILABILITY_WORDS)
    wants_details = ("Asked about product details" in tags and not wants_availability) or any(
        has_word(low, w) for w in ("details", "detail", "specification", "specifications", "specs", "features",
                                   "include", "includes"))
    wants_delivery = any(has_word(low, w) for w in DELIVERY_WORDS)
    wants_hours = any(has_word(low, w) for w in HOURS_WORDS) and "delivery time" not in low

    named = find_products(text, products)
    # Something specific that is not in our list? ("do you have bikes", "chicken biryani price")
    other_words = asks_for_unknown_product(text, products) if not named else False
    chosen = named or ([] if other_words else find_products(lead.get("interested_in") or "", products))
    if named and not (wants_price or wants_details or wants_availability):
        wants_price = wants_details = True                    # "tell me about veg thali"

    lines = []
    if chosen and (wants_price or wants_details or wants_availability):
        for p in chosen[:3]:
            parts = []
            if wants_price:
                parts.append(f"Price: {rupees(p.get('price'))}")
            if wants_details and p.get("details"):
                parts.append(f"Details: {p['details']}")
            if wants_availability:
                parts.append("Available now ✅" if p.get("available", 1) else "Not available at the moment ❌")
            if parts:
                lines.append(f"*{p['name']}*\n" + "\n".join(parts))
    elif products and wants_price:                            # price asked, no product named: ask which one
        intro = "Sorry, we don't have that. We offer:\n" if other_words else "Which product would you like the price of?\n"
        lines.append(intro + product_menu(products))

    if wants_delivery and (business.get("delivery_area") or business.get("delivery_charge") is not None):
        info = []
        if business.get("delivery_area"):
            info.append(f"We deliver {business['delivery_area']}.")
        if business.get("delivery_charge") is not None:
            charge = business["delivery_charge"]
            info.append("Free delivery." if charge == 0 else f"Delivery charge: {rupees(charge)}.")
        if business.get("advance_notice"):
            info.append(f"Please order {business['advance_notice']} in advance.")
        lines.append(" ".join(info))
    if wants_hours and business.get("working_hours"):
        lines.append(f"Our working hours: {business['working_hours']}.")

    if not lines and other_words and products:                # "do you have bikes?" in a car showroom
        lines.append("Sorry, we don't have that. We offer:\n" + product_menu(products))
    return "\n\n".join(lines) or None


# ---------------------------------------------------------------- products we do not sell
# Phrases that name the thing the customer wants: "do you have bikes", "looking for a sofa",
# "price of honda city", or a short "chicken biryani price".
ITEM_AFTER = re.compile(r"\b(?:do (?:you|u) (?:have|sell)|looking for|need (?:a|an|some)|want (?:a|an|some)|"
                        r"interested in|price of|cost of|rate of|details of|specifications of)\s+([a-z0-9 \-]{2,40})")
ITEM_BEFORE = re.compile(r"^\s*([a-z0-9 \-]{2,40}?)\s+(?:price|prices|cost|rate)\b")
ITEM_END = re.compile(r"\b(?:and|or|for|with|please|pls|today|tomorrow|now|in|at|is|are|from)\b")


def unknown_words(text: str) -> list:
    """Words that look like a product name but are not question words."""
    low = fix_typos(text)
    return [w for w in re.findall(r"[a-z]+", low) if w not in QUESTION_WORDS and len(w) > 3
            and not any(has_word(w, k) for k in AVAILABILITY_WORDS + DELIVERY_WORDS + HOURS_WORDS)]


def named_items(line: str) -> list:
    """The pieces of a sentence that name a product, e.g. ["bikes"] from "do you have bikes?"."""
    low = fix_typos(line)
    items = [m.group(1) for m in ITEM_AFTER.finditer(low)]
    if len(low.split()) <= 6:                              # short "chicken biryani price"
        items += [m.group(1) for m in ITEM_BEFORE.finditer(low)]
    return [ITEM_END.split(item)[0].strip() for item in items]


def asks_for_unknown_product(message: str, products: list) -> bool:
    """True when the customer asked about something that is not in the owner's product list,
    e.g. "do you have bikes?" or "chicken biryani price" in a car showroom.
    "price of the car" or "test drive tomorrow" do not count (no specific other product named)."""
    for line in (message or "").splitlines():
        for item in named_items(line):
            if not unknown_words(item):                    # "the car", "it", "this one": nothing specific
                continue
            if not find_products(item, products):
                return True
    return False


def not_in_catalog(lead: dict, products: list) -> bool:
    """Used by the scoring: the product they chose or asked for is not something we sell."""
    if not products:
        return False                       # the owner has not entered a product list yet
    interest = lead.get("interested_in") or ""
    if interest and not find_products(interest, products) and unknown_words(interest):
        return True
    return asks_for_unknown_product(lead.get("customer_message"), products)


# ---------------------------------------------------------------- the question flow
def looks_like_message(text: str) -> bool:
    """A question or a long sentence is a real message, not an answer to our question."""
    return "?" in text or len(text.split()) > 6


def read_answer(step: str, text: str, products: list) -> Tuple[Optional[dict], bool]:
    """Returns (fields to save, accepted?). Fields can be {} when the customer skips."""
    answer = text.strip()
    low = answer.lower()
    if step == "name":
        if NAME.match(answer) and len(answer.split()) <= 5 and not looks_like_message(answer) \
                and not agents.only_greeting(answer):       # "Hi" / "Hello" is not a name
            return {"name": answer.title()}, True
    elif step == "email":
        found = EMAIL.search(answer)
        if found:
            return {"email": found.group(0).lower()}, True
        if low in SKIP_WORDS:
            return {}, True
    elif step == "type":
        if answer.isdigit() and 1 <= int(answer) <= len(CUSTOMER_TYPES):
            return {"customer_type": CUSTOMER_TYPES[int(answer) - 1]}, True
        for word, ctype in TYPE_WORDS.items():
            if word in low:
                return {"customer_type": ctype}, True
    elif step == "interest":
        if answer.isdigit() and products and 1 <= int(answer) <= len(products):
            return {"interested_in": products[int(answer) - 1]["name"]}, True
        found = find_products(answer, products)
        if len(found) == 1:
            return {"interested_in": found[0]["name"]}, True
        if 2 <= len(answer) and "?" not in answer:
            return {"interested_in": answer[:80]}, True
    elif step == "concern":
        if answer:
            return {}, True
    return None, False


def add_to_history(lead: dict, text: str) -> str:
    history = f"{lead['customer_message']}\n{text}" if lead.get("customer_message") else text
    return history[-1000:]


def next_reply(lead: dict, text: str, business: dict, products: list) -> Tuple[dict, Optional[str]]:
    """The customer answered while the bot was asking something.
    Returns (changes to save in the lead, reply to send back)."""
    step = lead.get("chat_step")
    if not step or step not in NEXT:
        return {}, None
    fields, accepted = read_answer(step, text, products)

    if not accepted:
        if looks_like_message(text):            # a real question: answer it if we can, then ask again
            answer = answer_question(text, lead, business, products) or "Noted your question 👍 Our team will answer it soon."
            return {"customer_message": add_to_history(lead, text)}, answer + "\n\n" + ask(step, business, products)
        return {}, retry(step, business, products)

    changes = dict(fields or {})
    changes["chat_step"] = NEXT[step]
    first = (changes.get("name") or lead.get("name") or "").split(" ")[0] or "there"

    if step == "concern":                       # their question: keep it and answer from the owner's details
        changes["customer_message"] = add_to_history(lead, text)
        if agents.analyse_conversation(text) == ["Not interested"]:     # "No I don't need"
            return changes, not_interested_reply(first, business)
        answer = answer_question(text, {**lead, **changes}, business, products)
        if not answer:                          # not sure what they asked: show the product they chose
            chosen = [p for p in products if p["name"] == lead.get("interested_in")]
            answer = product_summary(chosen[0]) if chosen else None
        if answer:
            changes["chat_step"] = "anything_else"         # their next message decides what we say
            return changes, f"{answer}\n\nAnything else, {first}?"
        return changes, f"Thank you {first}! 🙏 Our team will get back to you shortly about this."

    thanks = f"Thanks {first}! " if step == "name" else ""
    return changes, thanks + ask(NEXT[step], business, products)
