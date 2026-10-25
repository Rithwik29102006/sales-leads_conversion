"""
intent_model.py - reads what a customer's message MEANS for the sale.

Every line the customer wrote is sorted into one of five intents:
  buy    wants to buy / order / book / pay           ("Book the Creta for Saturday")
  ask    asks about price, details, delivery, a call  ("Is home delivery available?")
  later  undecided / just looking / will think        ("I'll discuss with my family")
  no     not interested / can't afford / stop          ("No I don't need", "too costly for me")
  hi     greeting / thanks / ok                        ("Hi", "Ok thanks")

The model (TF-IDF words + letter pieces -> linear SVM) is trained by train_intent_model.py on
public datasets (Bitext customer support, CLINC150) plus WhatsApp-style shop messages
(build_intent_data.py). On 95 hand-written messages it never saw it gets 95.8% right, against
61% for the old keyword rules.

If intent_model.pkl is missing or was made with another scikit-learn version, the model is
trained again from intent_train.csv when the server starts (takes a few seconds).
"""
import re
import warnings
from pathlib import Path

import joblib

HERE = Path(__file__).resolve().parent
MODEL_FILE = HERE / "intent_model.pkl"
DATA_FILE = HERE / "intent_train.csv"
TEST_FILE = HERE / "intent_test.csv"
LABELS = ["buy", "ask", "later", "no", "hi"]


def clean(text: str) -> str:
    """Same cleaning at training and at prediction time (keep in sync with train_intent_model.py)."""
    return str(text).lower().replace("’", "'").replace("n't", " not").replace("dont", "do not")


def build_pipeline():
    from sklearn.calibration import CalibratedClassifierCV
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.pipeline import make_pipeline, make_union
    from sklearn.svm import LinearSVC
    features = make_union(
        TfidfVectorizer(preprocessor=clean, ngram_range=(1, 3), min_df=1, sublinear_tf=True,
                        token_pattern=r"(?u)\b\w+\b|[^\w\s]"),
        TfidfVectorizer(preprocessor=clean, analyzer="char_wb", ngram_range=(2, 5), min_df=2, sublinear_tf=True),
    )
    return make_pipeline(features, CalibratedClassifierCV(LinearSVC(C=0.6, class_weight="balanced"), cv=5))


class IntentModel:
    def __init__(self):
        self.pipeline = None
        self.load()

    def load(self):
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error")             # a version mismatch -> retrain below
                self.pipeline = joblib.load(MODEL_FILE)["model"]
                self.pipeline.predict(["hi"])
        except Exception:
            self.pipeline = self.train_from_csv()

    @staticmethod
    def train_from_csv():
        try:
            import pandas as pd
            files = [DATA_FILE] + ([TEST_FILE] if TEST_FILE.exists() else [])   # same data as the saved model
            data = pd.concat([pd.read_csv(f) for f in files])
            return build_pipeline().fit(data.text, data.intent)
        except Exception as err:                           # no data either: keyword rules only
            print("Intent model not available:", err)
            return None

    def predict(self, lines: list) -> list:
        """[(intent, confidence), ...] for each line."""
        if self.pipeline is None or not lines:
            return [(None, 0.0) for _ in lines]
        probs = self.pipeline.predict_proba(lines)
        classes = list(self.pipeline.classes_)
        return [(classes[row.argmax()], float(row.max())) for row in probs]


def split_lines(message: str) -> list:
    """The lead keeps every WhatsApp message on its own line; a long form message may hold
    several sentences, so it is split on sentence ends too."""
    parts = []
    for line in str(message or "").splitlines():
        parts += [p.strip() for p in re.split(r"(?<=[.!?])\s+", line) if p.strip()]
    return parts
