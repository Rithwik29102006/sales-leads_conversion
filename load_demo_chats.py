"""
load_demo_chats.py - add practice chats with their outcome, so the system has something to learn from.

    python load_demo_chats.py            adds every row of demo_chats.csv as a finished lead
    python load_demo_chats.py --remove   deletes them again (do this before using real customers)

The backend must be running. Each lead is added through the normal API (so it is scored like any
other lead) and then marked Converted / Not Converted. Every 10 finished leads the system retrains
by itself; press "Retrain now" on the Analytics page at the end to use all of them.
All practice leads are named "Demo - <name>" so they are easy to spot and remove.
"""

import csv
import json
import sys
import urllib.request

API = "http://127.0.0.1:8000"


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(API + path, data=data, method=method,
                                     headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request) as response:
        return json.loads(response.read())


if "--remove" in sys.argv:
    demo = [l for l in call("GET", "/leads") if l["name"].startswith("Demo - ")]
    for lead in demo:
        call("DELETE", f"/leads/{lead['id']}")
    print(f"Removed {len(demo)} demo leads. Press 'Retrain now' so the models forget them.")
    sys.exit(0)

with open("demo_chats.csv", newline="") as f:
    rows = list(csv.DictReader(f))
for number, row in enumerate(rows, 1):
    lead = call("POST", "/leads", {
        "name": "Demo - " + row["name"], "phone": f"90000{number:05d}", "channel": row["channel"],
        "customer_type": row["customer_type"], "interested_in": row["interested_in"],
        "customer_message": row["customer_message"],
    })
    call("PATCH", f"/leads/{lead['id']}/status", {"status": row["outcome"]})
    print(f"{row['outcome']:14} {lead['score']:4.0%}  {row['customer_message']}")
print(f"\nAdded {len(rows)} finished demo leads. Now open Analytics and press 'Retrain now'.")
