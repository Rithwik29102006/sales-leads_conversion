"""
train_message_model.py - learn which customer messages lead to a sale, from YOUR OWN chats.

Data: leads in leads.db that the sales team marked Converted / Not Converted, and what
      those customers wrote (WhatsApp, website form ...).
Model: TF-IDF (turns text into word scores) + Logistic Regression (learns a weight per word).
It is only saved if it predicts better than guessing on chats it has not seen
(5-fold cross-validation, AUC >= 0.60). Until then the system uses the signal weights in agents.py.

Run:  python train_message_model.py        (the Retrain button on the Analytics page runs it too)
Why not a public dataset? We tested 40,000 public sales conversations
(download_messages_dataset.py): from the first messages it reached AUC 0.58-0.61 and did not
fit small-business customers, so the system learns from the business's own customers instead.
"""

import sqlite3
import sys
from datetime import datetime

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import make_pipeline

DB_FILE, MODEL_FILE = "leads.db", "message_model.pkl"
MIN_PER_GROUP = 15          # need at least 15 converted AND 15 not-converted chats
MIN_AUC = 0.60              # 0.5 = guessing; below this the model is not trusted

with sqlite3.connect(DB_FILE) as conn:
    rows = conn.execute("SELECT customer_message, status FROM leads WHERE status IN "
                        "('Converted', 'Not Converted') AND customer_message IS NOT NULL "
                        "AND TRIM(customer_message) != ''").fetchall()
texts = [r[0] for r in rows]
y = np.array([1 if r[1] == "Converted" else 0 for r in rows])
converted, not_converted = int(y.sum()), int(len(y) - y.sum())
print(f"Chats with an outcome: {len(y)} ({converted} converted, {not_converted} not converted)")

if min(converted, not_converted) < MIN_PER_GROUP:
    print(f"Not enough yet: need {MIN_PER_GROUP} of each. Using the signal weights for now.")
    sys.exit(0)


def new_pipeline():
    return make_pipeline(
        TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True, strip_accents="unicode"),
        LogisticRegression(C=1.0, class_weight="balanced", max_iter=2000))


folds = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
p = cross_val_predict(new_pipeline(), texts, y, cv=folds, method="predict_proba")[:, 1]
auc = roc_auc_score(y, p)
print(f"Cross-validated AUC: {auc:.3f} (0.5 = guessing, 1.0 = perfect)")
if auc < MIN_AUC:
    print(f"Below {MIN_AUC}: model not saved. Using the signal weights for now.")
    sys.exit(0)

pipeline = new_pipeline().fit(texts, y)
vocab = pipeline[0].get_feature_names_out()
weights = pipeline[1].coef_[0]
order = np.argsort(weights)
print("Words that go with buying:     ", ", ".join(vocab[order[-10:]][::-1]))
print("Words that go with not buying: ", ", ".join(vocab[order[:10]]))
joblib.dump({"pipeline": pipeline, "base_rate": float(y.mean()), "auc": round(auc, 3),
             "chats": len(y), "trained_at": datetime.now().isoformat(timespec="seconds")}, MODEL_FILE)
print(f"Saved {MODEL_FILE}: the lead score now uses what your customers write.")
