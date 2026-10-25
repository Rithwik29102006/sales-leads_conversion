"""
train_intent_model.py - trains the message intent model and checks it on messages it never saw.

  python train_intent_model.py intent_train.csv intent_test.csv
Saves intent_model.pkl, loaded by intent_model.py (a scikit-learn pipeline: text -> buy / ask / later / no / hi).
"""
import sys

import joblib
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.pipeline import make_pipeline, make_union
from sklearn.svm import LinearSVC

from intent_model import clean   # same cleaning as the app (the saved model refers to it)

LABELS = ["buy", "ask", "later", "no", "hi"]


def features():
    # words + word pairs ("not need", "no money") and letter pieces (typos, Hinglish, emoji)
    return make_union(
        TfidfVectorizer(preprocessor=clean, ngram_range=(1, 3), min_df=1, sublinear_tf=True,
                        token_pattern=r"(?u)\b\w+\b|[^\w\s]"),
        TfidfVectorizer(preprocessor=clean, analyzer="char_wb", ngram_range=(2, 5), min_df=2, sublinear_tf=True),
    )


CANDIDATES = {
    "logistic regression": lambda: make_pipeline(
        features(), LogisticRegression(max_iter=4000, C=8, class_weight="balanced")),
    "linear SVM (calibrated)": lambda: make_pipeline(
        features(), CalibratedClassifierCV(LinearSVC(C=0.6, class_weight="balanced"), cv=5)),
}

train = pd.read_csv(sys.argv[1] if len(sys.argv) > 1 else "intent_train.csv")
test = pd.read_csv(sys.argv[2] if len(sys.argv) > 2 else "intent_test.csv")
overlap = set(train.text.str.lower()) & set(test.text.str.lower())
train = train[~train.text.str.lower().isin(overlap)]          # never train on a test message
print(f"train {len(train)} messages, test {len(test)} hand-written messages (removed {len(overlap)} overlaps)\n")

best_name, best_acc, best_model = None, -1, None
folds = StratifiedKFold(5, shuffle=True, random_state=0)
for name, build in CANDIDATES.items():
    cv = cross_val_score(build(), train.text, train.intent, cv=folds, scoring="accuracy").mean()
    model = build().fit(train.text, train.intent)
    acc = accuracy_score(test.intent, model.predict(test.text))
    print(f"{name:26s} 5-fold CV {cv:.3f}   hand-written test {acc:.3f}")
    if acc > best_acc:
        best_name, best_acc, best_model = name, acc, model

pred = best_model.predict(test.text)
print(f"\nChosen: {best_name}\n")
print(classification_report(test.intent, pred, labels=LABELS, digits=3))
print("Confusion matrix (rows = true, columns = predicted):", LABELS)
print(confusion_matrix(test.intent, pred, labels=LABELS))
wrong = test[pred != test.intent].assign(predicted=pred[pred != test.intent])
print("\nMistakes:\n" + (wrong.to_string(index=False) if len(wrong) else "none"))

# final model: train on everything (training + test messages) for the app
final = CANDIDATES[best_name]().fit(pd.concat([train.text, test.text]), pd.concat([train.intent, test.intent]))
joblib.dump({"model": final, "labels": LABELS, "test_accuracy": round(best_acc, 3), "kind": best_name},
            "intent_model.pkl")
print("\nSaved intent_model.pkl")
