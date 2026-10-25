"""
build_intent_data.py - builds the training set for the message intent model.

Five intents (what the customer's message means for the sale):
  buy    wants to buy / order / book / pay now
  ask    asks a question: price, details, availability, delivery, a call or visit
  later  undecided: just looking, will think, maybe later, will discuss at home
  no     not interested: don't need, no money, too costly, already bought, stop messaging
  hi     greeting / thanks / ok with nothing about buying

Sources (public, downloaded from GitHub) + our own WhatsApp-style messages:
  1. Bitext customer-support dataset (27k real-style utterances): place_order -> buy,
     payment / delivery / shipping questions -> ask, cancel_order -> no
  2. CLINC150 (Larson et al. 2019): greeting / thank_you / goodbye -> hi, maybe -> later, no -> no
  3. Shop messages generated from many templates x products, with Hinglish and typos.
Output: intent_train.csv  (text, intent, source)\nNext: python train_intent_model.py
"""
import json
import random
import re
import urllib.request
from pathlib import Path

import pandas as pd

SOURCES = {   # downloaded once into this folder (not kept in git)
    "bitext.csv": "https://raw.githubusercontent.com/bitext/customer-support-llm-chatbot-training-dataset/"
                  "main/data/Bitext_Sample_Customer_Support_Training_Dataset_27K_responses-v11.csv",
    "clinc.json": "https://raw.githubusercontent.com/clinc/oos-eval/master/data/data_full.json",
}
for name, url in SOURCES.items():
    if not Path(name).exists():
        print("downloading", name)
        urllib.request.urlretrieve(url, name)

random.seed(7)
ROWS = []


def add(text, intent, source):
    text = re.sub(r"\s+", " ", str(text)).strip()
    if text:
        ROWS.append((text, intent, source))


# ---------- 1. Bitext ----------
BITEXT = {"place_order": "buy", "cancel_order": "no", "check_payment_methods": "ask",
          "delivery_options": "ask", "delivery_period": "ask", "check_cancellation_fee": "ask",
          "payment_issue": "ask", "contact_human_agent": "ask", "contact_customer_service": "ask",
          "change_order": "buy"}
bitext = pd.read_csv("bitext.csv")
for intent, label in BITEXT.items():
    sub = bitext[bitext.intent == intent].instruction
    cap = 90 if label == "ask" else 260               # keep support questions from swamping the rest
    for t in sub.sample(min(len(sub), cap), random_state=1):
        t = re.sub(r"\{\{[^}]*\}\}", "it", t)          # "{{Order Number}}" -> "it"
        add(t, label, "bitext")

# ---------- 2. CLINC150 ----------
CLINC = {"greeting": "hi", "thank_you": "hi", "goodbye": "hi", "maybe": "later", "no": "no"}
clinc = json.load(open("clinc.json"))
for text, intent in clinc["train"] + clinc["val"]:
    if intent in CLINC:
        add(text, CLINC[intent], "clinc150")

# ---------- 3. WhatsApp-style shop messages ----------
PRODUCTS = ["Creta", "Swift VXI", "the SUV", "this car", "chicken biryani", "family pack biryani", "the cake",
            "a birthday cake", "the course", "the data science course", "iPhone 15", "this phone", "the AC",
            "the 2BHK flat", "the saree", "gym membership", "the yearly plan", "the scooter", "the laptop",
            "the sofa set", "the package", "it", "this", "the service", "the treatment", "tuition classes"]
TIMES = ["today", "tomorrow", "this week", "now", "asap", "this weekend", "by Friday", "right away", "immediately"]


def fill(template):
    return (template.replace("{p}", random.choice(PRODUCTS)).replace("{t}", random.choice(TIMES)))


TEMPLATES = {
    "buy": [
        "I want to buy {p}", "I want to buy {p} {t}", "I'd like to order {p}", "please book {p} for me",
        "book {p} {t}", "I'll take {p}", "I will take it", "ready to buy {p}", "I'm ready to purchase",
        "how do I pay for {p}", "send me the payment link", "can I pay by UPI now", "let's go ahead",
        "go ahead and book it", "confirm my order", "I want 2 of {p}", "need {p} {t}", "deliver {p} {t} please",
        "I want to book a slot {t}", "please reserve {p} for me", "I'll come and buy {t}", "finalise it",
        "let's do it", "done, book it", "yes I want it", "yes please book", "ok book {p}", "place the order",
        "I want to enroll", "sign me up", "I want to register for {p}", "how can I join {t}",
        "I'll pay the advance {t}", "send the invoice", "I'm buying {p} {t}", "want to purchase {p} {t}",
        "mujhe {p} chahiye", "{p} book kar do", "{p} chahiye {t}", "order kar do", "I'll buy it {t}",
        "plz book {p}", "i wnt to buy {p}", "need to order {p} for {t}", "add {p} to my order",
        "I am interested, let's proceed", "proceed with the booking", "I want to buy it, when can I get delivery",
        "price is fine, book it", "ok the price works, I'll take {p}", "sounds good, let's book {p} {t}",
        "I've decided, I want {p}", "final, send payment details", "I'll come to the shop {t} to buy",
        "I need it urgently", "need it asap", "I need {p} urgently", "I really need {p}", "I need {p} {t}",
        "need delivery {t}", "I need it by {t}", "urgent requirement for {p}",
        "I want it {t}, don't want to wait", "don't want to wait, book it now", "can't wait, I'll buy {p}",
        "I don't need EMI, I'll pay full", "no need for a loan, I'll pay cash", "don't need finance, book {p}",
        "can I book a test drive for {t}", "book a test drive for me", "I want to book a visit {t}",
        "I want to buy {p}, what is the price", "I want to buy but do you have it in red",
    ],
    "ask": [
        "what is the price of {p}", "how much is {p}", "price?", "rate of {p}?", "{p} kitna hai",
        "{p} ka price kya hai", "what's the cost", "is {p} available", "do you have {p} in stock",
        "is {p} available {t}", "what are the specifications of {p}", "send me specs of {p}",
        "what colours does {p} come in", "what sizes do you have", "do you deliver to my area",
        "what is the delivery charge", "how long does delivery take", "is there any discount on {p}",
        "any offers on {p}?", "do you have EMI", "can I get a test drive", "can you call me",
        "please call me back", "what are your timings", "where is your shop", "can I visit {t}",
        "send me the brochure", "tell me more about {p}", "what are the features of {p}",
        "is there warranty on {p}", "what is the mileage", "what is the fee for {p}",
        "how many days is the course", "do you have veg options", "can you share details", "details please",
        "what is included in {p}", "is it spicy", "can I see photos of {p}", "compare {p} with the other one",
        "which is better", "kab tak delivery hogi", "{p} ki details bhejo", "do you have a cheaper option",
        "can you do it for less", "what payment methods do you accept", "can you share the location",
        "is installation free", "what's the on-road price", "how much for 2 kg biryani",
    ],
    "later": [
        "I'll think about it", "will think and let you know", "maybe later", "just looking", "just checking prices",
        "only asking", "just browsing for now", "I'll let you know", "I need to discuss with my family",
        "will talk to my wife and get back", "let me check with my parents", "I'll decide next month",
        "not sure yet", "I'm still comparing", "will get back to you", "let me think", "I'll see",
        "maybe next week", "not decided yet", "I'll come back later", "just wanted to know the price",
        "will confirm later", "baad mein batata hu", "sochke batata hu", "dekhte hain", "abhi soch raha hu",
        "I'm planning for next year", "need some time to decide", "let me check my budget first",
        "I'll visit sometime", "will plan later", "not in a hurry", "just exploring options",
        "I'll compare and come back", "keep me posted", "I'll call you when I'm ready",
        "what's the price? I'll think about it", "nice, but I'll decide later", "looks good, will let you know",
        "maybe after my salary", "I'll check and tell you", "not right now, maybe next month",
    ],
    "no": [
        "not interested", "no I don't need", "no I don't need it", "I don't need {p}", "I don't want {p}",
        "I do not want it", "no thanks", "no thank you", "not needed", "no need", "I am not interested in {p}",
        "I have no money", "I can't afford it", "I cannot afford {p}", "too expensive for me", "it's too costly",
        "out of my budget", "I don't have budget", "no budget right now", "I already bought one",
        "already purchased from another shop", "I bought it somewhere else", "please don't call me",
        "don't message me again", "stop messaging me", "stop sending messages", "remove my number",
        "unsubscribe", "wrong number", "I didn't ask for this", "I do not plan to buy anything",
        "I'm not planning to buy", "I won't buy", "not buying", "never mind", "cancel it", "cancel my enquiry",
        "I changed my mind", "I don't want to buy anymore", "no not interested", "nahi chahiye",
        "mujhe nahi chahiye", "interest nahi hai", "paise nahi hai", "bahut mehenga hai", "nope",
        "no, I'm good", "not now, not interested", "don't need anything", "I have no plans to buy",
        "leave it", "forget it", "dont need", "i dont want", "no money", "not intrested",
        "{p} looks nice but I don't need it", "nice but too costly for me", "I saw {p} but I'm not interested",
        "thanks for the details but I'll pass", "I'll pass", "not for me", "sorry, not interested",
        "no, I don't want to buy {p}", "I don't think I will buy", "I am not going to buy {p}",
        "we don't need {p} anymore", "my budget is gone, no", "no sir, not required", "not required",
    ],
    "hi": [
        "hi", "hello", "hey", "hii", "hiii", "hai", "hello there", "good morning", "good evening", "namaste",
        "hi sir", "hello madam", "ok", "okay", "ok thanks", "thanks", "thank you", "thank you so much", "ty",
        "👍", "ok 👍", "hmm", "fine", "sure", "alright", "noted", "got it", "good night", "bye", "see you",
        "hi there", "yo", "hey bro", "hello sir good morning", "thanks a lot", "ok sir", "k", "cool",
    ],
}
TYPOS = {"price": "prise", "interested": "intrested", "available": "availble", "want": "wnt", "please": "pls",
         "tomorrow": "tmrw", "thanks": "thx", "don't": "dont", "money": "mony", "need": "ned"}


def typo(text):
    for right, wrong in TYPOS.items():
        if right in text and random.random() < 0.5:
            return text.replace(right, wrong)
    return text


for intent, templates in TEMPLATES.items():
    for template in templates:
        for _ in range(12):
            t = fill(template)
            r = random.random()
            if r < 0.25:
                t = t.capitalize()
            elif r < 0.35:
                t = t.upper()
            if random.random() < 0.3:
                t = typo(t)
            if random.random() < 0.25:
                t = random.choice(["hi ", "hello ", "sir ", "ok ", ""]) + t
            if random.random() < 0.2:
                t += random.choice([" 🙏", " 😊", "!", "?", "...", " please", " pls"])
            add(t, intent, "shop")

df = pd.DataFrame(ROWS, columns=["text", "intent", "source"]).drop_duplicates("text")
df.to_csv("intent_train.csv", index=False)
print(len(df), "messages")
print(pd.crosstab(df.intent, df.source))
