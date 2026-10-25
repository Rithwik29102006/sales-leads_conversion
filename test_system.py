"""
test_system.py - checks the whole scoring system on many realistic leads at once.

Run:  python test_system.py
It prints PASS / FAIL for:
  1. Conversation Agent  - 50 customer messages and the signals they should give
  2. Lead scenarios      - 25 typical leads and the priority they should get
  3. Consistency rules   - e.g. more time on the website must never lower the score
"""

import agents
import whatsapp_bot

scorer = agents.LeadScoringAgent()


def final(lead):
    """Same steps as the backend: ML score, then the Conversation Agent."""
    result = scorer.score(lead)
    tags = agents.analyse_conversation(lead.get("customer_message"))
    return agents.apply_signals(result, tags, scorer.cutoffs)


# ---------------------------------------------------------------- 1. messages
# (message, tags that MUST be found, tags that must NOT be found)
MESSAGES = [
    ("What is the price?", ["Asked about price"], []),
    ("Hi", ["Only said hi"], []),
    ("Just checking prices", ["Just browsing", "Asked about price"], []),
    ("Send brochure, will see later", ["Just browsing"], []),
    ("Please don't call, I was only asking", ["Not interested"], ["Asked for a call or demo"]),
    ("Hello sir, good morning", ["Only said hi"], []),
    ("Hi, what is the price?", ["Asked about price"], ["Only said hi"]),
    ("How much does it cost", ["Asked about price"], []),
    ("Can you send me the rate list", ["Asked about price"], []),
    ("Please share the quotation", ["Asked about price"], []),
    ("What are the fees for this course", ["Asked about price"], []),
    ("Is EMI available?", ["Asked about price"], []),
    ("I want to buy this week", ["Wants to buy soon"], []),
    ("Ready to order today", ["Wants to buy soon"], []),
    ("I need it urgently", ["Wants to buy soon"], []),
    ("How do I book this", ["Wants to buy soon"], []),
    ("I want to join the course", ["Wants to buy soon"], []),
    ("Can I register now?", ["Wants to buy soon"], []),
    ("Please call me", ["Asked for a call or demo"], []),
    ("Can I get a demo?", ["Asked for a call or demo"], []),
    ("I'd like to visit your showroom", ["Asked for a call or demo"], []),
    ("Can we have a meeting tomorrow", ["Asked for a call or demo", "Wants to buy soon"], []),
    ("Call back after 5 pm", ["Asked for a call or demo"], []),
    ("What are the specifications?", ["Asked about product details"], []),
    ("Hi what are specifications of this cars", ["Asked about product details"], []),
    ("Which colours are available", ["Asked about product details"], []),
    ("Is it in stock?", ["Asked about product details"], []),
    ("What features does the app have", ["Asked about product details"], []),
    ("Does it come with warranty", ["Asked about product details"], []),
    ("What is the mileage", ["Asked about product details"], []),
    ("Can I book a test drive", ["Asked about product details", "Wants to buy soon"], []),
    ("Any discount for students?", ["Asked about discounts"], []),
    ("Is there any offer going on", ["Asked about discounts"], []),
    ("Can you give the best price", ["Asked about discounts", "Asked about price"], []),
    ("I am comparing with other options", ["Comparing options"], []),
    ("Is this better than the alternative?", ["Comparing options"], []),
    ("Send me more details", ["Has questions"], []),
    ("Can you share the brochure", ["Has questions"], []),
    ("How does it work", ["Has questions"], []),
    ("Not interested", ["Not interested"], ["Wants to buy soon"]),
    ("No thanks", ["Not interested"], []),
    ("Please don't contact me again", ["Not interested"], ["Asked for a call or demo"]),
    ("I already bought from another shop", ["Not interested"], ["Wants to buy soon"]),
    ("Not needed now, thank you", ["Not interested"], []),
    ("Stop messaging me", ["Not interested"], []),
    ("Unsubscribe", ["Not interested"], []),
    ("Not interested in the price", ["Not interested"], ["Asked about price"]),
    ("Hi", [], ["Not interested", "Wants to buy soon", "Asked about price"]),
    ("Thanks", [], ["Not interested", "Wants to buy soon"]),
    ("Good morning", [], ["Wants to buy soon", "Asked about price"]),
    ("Ok", [], ["Not interested", "Wants to buy soon"]),
    ("", [], ["Not interested", "Wants to buy soon"]),
    ("WHAT IS THE PRICE", ["Asked about price"], []),
    ("price??", ["Asked about price"], []),
    ("Hello, I saw your ad on Instagram. What's the cost and can you call me?",
     ["Asked about price", "Asked for a call or demo"], []),
    ("I want to buy but what is the price and do you have it in red colour?",
     ["Wants to buy soon", "Asked about price", "Asked about product details"], []),
]

# ---------------------------------------------------------------- 2. lead scenarios
# (description, lead details, allowed priorities)
STRONG = {"HIGH"}
GOOD = {"MEDIUM", "HIGH"}
WEAK = {"LOW"}
WEAK_OR_MEDIUM = {"LOW", "MEDIUM"}
SCENARIOS = [
    ("Referral, phone call, 15 min on site",
     {"channel": "Referral", "last_activity": "Had a phone call", "time_on_website": 900, "website_visits": 3}, STRONG),
    ("Working professional, got our SMS, long visit",
     {"channel": "Google Search", "customer_type": "Working Professional", "last_activity": "Received our WhatsApp/SMS",
      "time_on_website": 1500, "website_visits": 6}, STRONG),
    ("Google, long visit, got our SMS",
     {"channel": "Google Search", "last_activity": "Received our WhatsApp/SMS", "time_on_website": 1500,
      "website_visits": 6}, STRONG),
    ("WhatsApp, working professional, chatted",
     {"channel": "WhatsApp", "customer_type": "Working Professional", "last_activity": "Chatted with us"}, STRONG),
    ("Referral only", {"channel": "Referral"}, GOOD),
    ("Website, very long visit", {"channel": "Website", "time_on_website": 2000, "website_visits": 8}, GOOD),
    ("WhatsApp, business owner, chatted, 5 visits",
     {"channel": "WhatsApp", "customer_type": "Business Owner", "last_activity": "Chatted with us",
      "website_visits": 5, "time_on_website": 500}, GOOD),
    ("Homemaker, phone call, medium visit",
     {"channel": "WhatsApp", "customer_type": "Homemaker", "last_activity": "Had a phone call",
      "website_visits": 3, "time_on_website": 500}, GOOD),
    ("Instagram, got our SMS", {"channel": "Instagram", "last_activity": "Received our WhatsApp/SMS"}, GOOD),
    ("Website only, nothing else", {"channel": "Website"}, WEAK),
    ("Instagram student, 20 on site",
     {"channel": "Instagram", "customer_type": "Student", "time_on_website": 20}, WEAK),
    ("Email, unemployed, opened email, short visit",
     {"channel": "Email", "customer_type": "Unemployed", "last_activity": "Opened our email",
      "time_on_website": 100}, WEAK_OR_MEDIUM),
    ("Not reachable, no visits", {"channel": "Facebook", "last_activity": "Not reachable"}, WEAK),
    ("Facebook, 1 visit, 30 on site", {"channel": "Facebook", "website_visits": 1, "time_on_website": 30}, WEAK),
    ("Google, short visit", {"channel": "Google Search", "time_on_website": 50, "website_visits": 1}, WEAK),
    # Customer message changes the priority
    ("Weak lead + asked price and wants to buy",
     {"channel": "Website", "customer_message": "What is the price? I want to buy this week"}, GOOD),
    ("Weak lead + asked specifications",
     {"channel": "Instagram", "customer_type": "Student", "time_on_website": 20,
      "customer_message": "What are the specifications?"}, WEAK_OR_MEDIUM),   # one question raises a weak lead, but not to hot
    ("Strong lead + not interested",
     {"channel": "Referral", "last_activity": "Had a phone call", "time_on_website": 900,
      "customer_message": "Not interested, thanks"}, WEAK),
    ("Medium lead + asked for a call",
     {"channel": "WhatsApp", "customer_type": "Business Owner", "last_activity": "Chatted with us",
      "website_visits": 5, "time_on_website": 500, "customer_message": "Can you call me?"}, STRONG),
    ("Weak lead + just says hi", {"channel": "Website", "customer_message": "Hi"}, WEAK),
    ("Working professional on WhatsApp, only said hi",
     {"channel": "WhatsApp", "customer_type": "Working Professional", "last_activity": "Chatted with us",
      "customer_message": "Hi"}, WEAK_OR_MEDIUM),    # a bare "Hi" is not a hot lead yet
    ("Weak lead + asked discount only",
     {"channel": "Website", "customer_message": "Any discount?"}, WEAK),
    ("Good lead + comparing options",
     {"channel": "Referral", "customer_message": "Comparing with other options"}, GOOD),
    ("Working professional + price question",
     {"channel": "WhatsApp", "customer_type": "Working Professional", "customer_message": "How much?"}, STRONG),
    ("Student, chatted, long visit",
     {"channel": "Instagram", "customer_type": "Student", "last_activity": "Chatted with us",
      "time_on_website": 1500, "website_visits": 5}, GOOD),
    ("Unemployed, filled form, medium visit",
     {"channel": "Website", "customer_type": "Unemployed", "last_activity": "Filled website form",
      "time_on_website": 400, "website_visits": 3}, WEAK_OR_MEDIUM),
]

# ---------------------------------------------------------------- 3. consistency rules
BASES = [
    {"channel": "WhatsApp"},
    {"channel": "Google Search", "customer_type": "Unemployed"},
    {"channel": "Instagram", "customer_type": "Working Professional", "last_activity": "Chatted with us"},
    {"channel": "Website", "customer_type": "Student", "last_activity": "Opened our email"},
    {"channel": "Referral", "customer_type": "Business Owner"},
]
TOLERANCE = 0.03   # small ups and downs (3 points) are allowed; models are not perfectly smooth


def consistency_checks():
    problems = []
    for base in BASES:
        # Among leads who visited, more time on the website should not lower the chance.
        # (0 = never visited is a separate group in the data: 42% buy, vs 13% for short visits)
        scores = [scorer.score({**base, "time_on_website": t})["score"] for t in (50, 250, 500, 1000, 1500, 2000)]
        for a, b in zip(scores, scores[1:]):
            if b < a - TOLERANCE:
                problems.append(f"{base}: time on website up, score down {scores}")
                break
        # A phone call or our SMS should never score lower than no activity at all
        none = scorer.score(base)["score"]
        for act in ("Had a phone call", "Received our WhatsApp/SMS"):
            if "last_activity" in base:
                continue
            s = scorer.score({**base, "last_activity": act})["score"]
            if s < none - TOLERANCE:
                problems.append(f"{base}: '{act}' scores {s:.2f} < no activity {none:.2f}")
        # A working professional should not score lower than an unemployed lead
        # More website visits should not lower the chance either
        scores = [scorer.score({**base, "website_visits": v, "time_on_website": 600})["score"] for v in (1, 2, 4, 8, 15)]
        for a, b in zip(scores, scores[1:]):
            if b < a - TOLERANCE:
                problems.append(f"{base}: website visits up, score down {scores}")
                break
        if "customer_type" not in base or base["customer_type"] == "Unemployed":
            wp = scorer.score({**base, "customer_type": "Working Professional"})["score"]
            un = scorer.score({**base, "customer_type": "Unemployed"})["score"]
            if wp < un - TOLERANCE:
                problems.append(f"{base}: Working Professional {wp:.2f} < Unemployed {un:.2f}")
    return problems


def main():
    failures = 0
    print(f"Model: {scorer.cutoffs}  (MEDIUM from {scorer.cutoffs['medium']:.0%}, HIGH from {scorer.cutoffs['high']:.0%})\n")

    print("1. CONVERSATION AGENT")
    ok = 0
    for msg, must, must_not in MESSAGES:
        tags = agents.analyse_conversation(msg)
        good = all(t in tags for t in must) and not any(t in tags for t in must_not)
        ok += good
        if not good:
            print(f"   FAIL  {msg!r}: got {tags}, expected {must}" + (f", not {must_not}" if must_not else ""))
    print(f"   {ok}/{len(MESSAGES)} messages correct\n")
    failures += len(MESSAGES) - ok

    print("2. LEAD SCENARIOS")
    ok = 0
    for label, lead, allowed in SCENARIOS:
        r = final(lead)
        good = r["priority"] in allowed
        ok += good
        print(f"   {'PASS' if good else 'FAIL'}  {label:48} {r['score']:4.0%}  {r['priority']:6}"
              + ("" if good else f"  (expected {'/'.join(sorted(allowed))})"))
    print(f"   {ok}/{len(SCENARIOS)} scenarios correct\n")
    failures += len(SCENARIOS) - ok

    print("3. CONSISTENCY RULES")
    problems = consistency_checks()
    for p in problems:
        print("   FAIL ", p)
    print(f"   {'all rules hold' if not problems else str(len(problems)) + ' problem(s)'}\n")
    failures += len(problems)

    print("4. PRODUCT LIST (asking for something the business does not sell lowers the score)")
    catalog = [{"name": "BMW", "price": 1000000, "details": "V4 engine", "available": 1},
               {"name": "I20", "price": 700000, "details": "1.2L petrol", "available": 1}]
    cases = [({"interested_in": "Bike", "customer_message": "Hello"}, True),
             ({"interested_in": "BMW", "customer_message": "do you have bikes?"}, True),
             ({"interested_in": "BMW", "customer_message": "chicken biryani price"}, True),
             ({"interested_in": "BMW", "customer_message": "Hi I want to join your business"}, False),
             ({"interested_in": "BMW", "customer_message": "I need detail specfications of the car"}, False),
             ({"interested_in": "Cars", "customer_message": "price?"}, False),
             ({"interested_in": "BMW", "customer_message": "I need detail specfications and price of the car, I want to book this week"}, False),
             ({"interested_in": "BMW", "customer_message": "Can I come for a test drive tomorrow evening?"}, False),
             ({"interested_in": "BMW", "customer_message": "What is the EMI? Please call me"}, False),
             ({"interested_in": "BMW", "customer_message": "Please share the on-road price of the I20 sir"}, False),
             ({"interested_in": "BMW", "customer_message": "what is the price of honda city"}, True),
             ({"interested_in": "BMW", "customer_message": "I need a bike"}, True)]
    ok = 0
    for lead, expected in cases:
        got = whatsapp_bot.not_in_catalog(lead, catalog)
        ok += got == expected
        if got != expected:
            print(f"   FAIL  {lead}: got {got}, expected {expected}")
    print(f"   {ok}/{len(cases)} correct\n")
    failures += len(cases) - ok

    print("RESULT:", "ALL TESTS PASSED" if failures == 0 else f"{failures} test(s) failed")


if __name__ == "__main__":
    main()
