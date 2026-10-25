"""
simulate_whatsapp.py - pretend to be Meta and send a WhatsApp message to our backend.
Use it to test or demo the WhatsApp connection without setting up Meta.

Usage (backend must be running):
    python simulate_whatsapp.py "Priya Sharma" 919876543210 "Hi, what is the price of the course?"
    python simulate_whatsapp.py "Priya Sharma" 919876543210 "Can you call me tomorrow?"   (same lead is updated)
"""

import json
import sys
import time
import urllib.request

URL = "http://127.0.0.1:8000/webhook/whatsapp"

if len(sys.argv) != 4:
    print(__doc__)
    sys.exit(1)
name, wa_id, text = sys.argv[1], sys.argv[2].lstrip("+"), sys.argv[3]

# Same shape as the message Meta's WhatsApp Cloud API sends to a webhook
payload = {
    "object": "whatsapp_business_account",
    "entry": [{
        "id": "TEST_ACCOUNT",
        "changes": [{
            "field": "messages",
            "value": {
                "messaging_product": "whatsapp",
                "metadata": {"display_phone_number": "15550000000", "phone_number_id": "TEST"},
                "contacts": [{"profile": {"name": name}, "wa_id": wa_id}],
                "messages": [{
                    "from": wa_id, "id": f"wamid.test{int(time.time())}",
                    "timestamp": str(int(time.time())), "type": "text", "text": {"body": text},
                }],
            },
        }],
    }],
}

request = urllib.request.Request(URL, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
with urllib.request.urlopen(request) as response:
    result = json.loads(response.read())
for item in result.get("handled", []):
    print(f"Lead {item['lead_id']} {item['action']}")
    if item.get("reply"):
        print("Bot reply:", item["reply"])
