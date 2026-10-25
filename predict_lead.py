"""
Score leads from a CSV file (same columns as Leads.csv) with the trained model.
Usage:
    python predict_lead.py sample_leads.csv
Prints each lead's chance of buying, priority and the top reasons.
"""

import sys
import numpy as np
import pandas as pd
import joblib

saved = joblib.load("lead_model.pkl")
model = saved["model"]
prep = model.named_steps["prep"]
cutoffs = saved.get("cutoffs", {"medium": 0.40, "high": 0.70})
importance = saved["importances"]

leads = pd.read_csv(sys.argv[1]).replace("Select", np.nan)
occupation = "What is your current occupation"
if occupation in leads.columns:   # same grouping as in training
    leads[occupation] = leads[occupation].replace({"Businessman": "Other", "Housewife": "Other"})
probs = model.predict_proba(leads)[:, 1]

names = prep.get_feature_names_out()
encoded = np.asarray(prep.transform(leads), dtype=float)
medians = prep.named_transformers_["num"].statistics_
n_num = len(medians)

for i, p in enumerate(probs):
    priority = "HIGH" if p >= cutoffs["high"] else "MEDIUM" if p >= cutoffs["medium"] else "LOW"
    # Strong points: number columns above the usual value, categories the lead has
    active = np.zeros(len(names), dtype=bool)
    active[:n_num] = encoded[i, :n_num] > medians
    for j in range(n_num, len(names)):
        active[j] = encoded[i, j] != 0 and names[j].startswith("cat__") and not names[j].endswith("_Unknown")
    top = sorted(zip(importance[active], names[active]), reverse=True)[:3]
    reasons = ", ".join(n.split("__", 1)[1].replace("_", " = ", 1) if n.startswith("cat__")
                        else "high " + n.split("__", 1)[1] for _, n in top) or "no strong signals"
    print(f"Lead {i + 1}: {p:.0%} chance  ->  {priority} priority   (reasons: {reasons})")
