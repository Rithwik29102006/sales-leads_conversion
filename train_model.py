"""
Lead conversion model - training script
---------------------------------------
Usage:
    python train_model.py Leads.csv
    python train_model.py Leads.csv new_outcomes.csv     (retrain with new results added)

The CSV must have a target column named "Converted" (1 = became a customer, 0 = did not).
Output: lead_model.pkl (the trained model) and a printed report.
"""

import sys
import numpy as np
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.inspection import permutation_importance
from sklearn.preprocessing import FunctionTransformer
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (accuracy_score, precision_score, recall_score, f1_score,
                             confusion_matrix, brier_score_loss)

TARGET = "Converted"

# Columns that must NOT be used as inputs:
#  - IDs carry no meaning
#  - "Tags", "Lead Quality", "Lead Profile" etc. are filled in by the sales team AFTER talking
#    to the lead, so they leak the answer and make accuracy look falsely high
DROP_COLUMNS = [
    "Prospect ID", "Lead Number",
    "Tags", "Lead Quality", "Lead Profile",
    "Asymmetrique Activity Index", "Asymmetrique Profile Index",
    "Asymmetrique Activity Score", "Asymmetrique Profile Score",
    "Last Notable Activity",
]


# Only the columns our website form collects (see FIELD mapping in agents.py).
# Columns the form cannot fill would always be empty in real use and pull every score down.
# Set USE_COLUMNS = None to train on all dataset columns instead.
USE_COLUMNS = [
    "Lead Source",                      # channel
    "Lead Origin",                      # worked out from the channel
    "What is your current occupation",  # customer type
    "Last Activity",                    # last activity
    "TotalVisits",                      # website visits
    "Total Time Spent on Website",      # time on website
]


def clean(df, drop_empty=None):
    # "Select" in this dataset means the user left it blank
    df = df.replace("Select", np.nan)
    df = df.drop(columns=[c for c in DROP_COLUMNS if c in df.columns])
    if USE_COLUMNS:
        df = df[[c for c in USE_COLUMNS + [TARGET] if c in df.columns]]
    # Very rare customer types (Businessman 8 leads, Housewife 10) are grouped with "Other"
    # so the model has enough examples to learn from (34 leads together)
    occupation = "What is your current occupation"
    if occupation in df.columns:
        df[occupation] = df[occupation].replace({"Businessman": "Other", "Housewife": "Other"})
    if drop_empty is None:
        # Drop columns that are more than 40% empty
        drop_empty = [c for c in df.columns if df[c].isna().mean() > 0.40 and c != TARGET]
    df = df.drop(columns=[c for c in drop_empty if c in df.columns])
    return df.dropna(subset=[TARGET]), drop_empty


def load_data(paths):
    # 1. Load one or more CSV files and join them (old data + new outcomes)
    df = pd.concat([pd.read_csv(p) for p in paths], ignore_index=True)
    print(f"Loaded {len(df)} leads from {len(paths)} file(s)")
    return df


TIME_COLUMN = "Total Time Spent on Website"
# Columns where "more" must never lower the chance of buying (monotonic constraint)
INCREASING = ["TotalVisits", TIME_COLUMN]


def build_preprocessor(X):
    # Numbers: fill blanks with the median
    # "No website visit" flag: time = 0 means the lead never visited (e.g. added by staff from a
    #   referral). In Leads.csv these convert at 42%, so they are kept apart from short visits (13%).
    # Text categories: fill blanks with "Unknown", then one-hot encode
    num_cols = X.select_dtypes(include="number").columns.tolist()
    cat_cols = X.select_dtypes(exclude="number").columns.tolist()
    parts = [("num", SimpleImputer(strategy="median"), num_cols)]
    if TIME_COLUMN in num_cols:
        parts.append(("flag", FunctionTransformer(np.logical_not, feature_names_out="one-to-one"), [TIME_COLUMN]))
    parts.append(("cat", Pipeline([
        ("fill", SimpleImputer(strategy="constant", fill_value="Unknown")),
        ("onehot", OneHotEncoder(handle_unknown="ignore", min_frequency=20, sparse_output=False)),
    ]), cat_cols))
    # Output a table with column names, so rules can refer to columns by name
    return ColumnTransformer(parts).set_output(transform="pandas")


# +1 = this input may only push the score up (looked up by column name)
MONOTONIC_RULES = {f"num__{c}": 1 for c in INCREASING}


HIGH_PRECISION = 0.80   # a HIGH lead should really buy at least 80% of the time


def find_cutoffs(y_true, prob):
    """Choose the priority cut-offs from data instead of guessing them.
    MEDIUM starts where the F1-score is best (the point that balances catching buyers
    and avoiding false alarms). HIGH starts where at least 80% of leads really bought."""
    steps = np.round(np.arange(0.15, 0.91, 0.01), 2)
    medium = max(steps, key=lambda t: f1_score(y_true, prob >= t))
    high = next((t for t in steps if t > medium and (prob >= t).sum() >= 20
                 and precision_score(y_true, prob >= t) >= HIGH_PRECISION), 0.70)
    return {"medium": float(medium), "high": float(high)}


def evaluate(name, prob, cutoffs, y_test):
    pred = prob >= cutoffs["medium"]          # MEDIUM or HIGH = "likely to buy"
    scores = {
        "accuracy": accuracy_score(y_test, pred),
        "precision": precision_score(y_test, pred),
        "recall": recall_score(y_test, pred),
        "f1": f1_score(y_test, pred),
        "brier": brier_score_loss(y_test, prob),   # lower = percentages closer to reality
        "high_precision": precision_score(y_test, prob >= cutoffs["high"]),
    }
    print(f"\n{name}")
    print(f"  cut-offs   MEDIUM from {cutoffs['medium']:.0%}, HIGH from {cutoffs['high']:.0%}")
    for k, v in scores.items():
        print(f"  {k:<15} {v:.3f}")
    print("  confusion matrix [[TN FP] [FN TP]]:", confusion_matrix(y_test, pred).tolist())
    return scores


def importances_of(pipe, X_val, y_val):
    """How much each input matters: shuffle one input at a time and measure how much
    the predictions get worse (permutation importance). Used for the "reasons"."""
    prep, model = pipe.named_steps["prep"], pipe.named_steps["model"]
    result = permutation_importance(model, prep.transform(X_val), y_val, n_repeats=5,
                                    random_state=42, scoring="roc_auc")
    return np.clip(result.importances_mean, 0, None)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    raw = load_data(sys.argv[1:])
    print(f"Conversion rate in data: {raw[TARGET].mean():.1%}")

    # 2. Split: 20% of leads are kept aside as a FIXED test set (test_set.csv).
    #    The first run creates it; every retrain reuses it, so old and new models
    #    are always compared on leads that neither of them was trained on.
    try:
        test_raw = pd.read_csv("test_set.csv")
        key = "Prospect ID" if "Prospect ID" in raw.columns else None
        if key:
            train_raw = raw[~raw[key].isin(test_raw[key])]
        else:
            train_raw = raw.merge(test_raw, how="left", indicator=True)
            train_raw = train_raw[train_raw["_merge"] == "left_only"].drop(columns="_merge")
        print(f"Using saved test set ({len(test_raw)} leads)")
    except FileNotFoundError:
        train_raw, test_raw = train_test_split(raw, test_size=0.2, random_state=42,
                                               stratify=raw[TARGET])
        test_raw.to_csv("test_set.csv", index=False)
        print(f"Created test_set.csv ({len(test_raw)} leads kept aside for testing)")

    # 3. Clean both parts the same way
    train_df, empty_cols = clean(train_raw)
    test_df, _ = clean(test_raw, empty_cols)
    if empty_cols:
        print("Dropped mostly-empty columns:", empty_cols)
    X_train, y_train = train_df.drop(columns=[TARGET]), train_df[TARGET].astype(int)
    X_test, y_test = test_df.drop(columns=[TARGET]), test_df[TARGET].astype(int)
    print(f"Training on {len(X_train)} leads, testing on {len(X_test)}")

    # 4. Train both models. CalibratedClassifierCV adjusts the raw outputs so that
    #    "60%" really means about 60 out of 100 such leads buy.
    #    HistGradientBoosting is told that more time / more visits never lower the score.
    candidates = {
        "Gradient Boosting (monotonic)": HistGradientBoostingClassifier(
            max_iter=300, learning_rate=0.05, max_leaf_nodes=15, min_samples_leaf=20,
            monotonic_cst=MONOTONIC_RULES, random_state=42),
        "Random Forest": RandomForestClassifier(n_estimators=300, max_depth=12,
                                                class_weight="balanced", random_state=42),
    }
    # Part of the training data is used only to choose the priority cut-offs
    X_fit, X_val, y_fit, y_val = train_test_split(X_train, y_train, test_size=0.2,
                                                  random_state=42, stratify=y_train)

    def make(clf):
        return Pipeline([("prep", build_preprocessor(X_train)),
                         ("model", CalibratedClassifierCV(clf, method="sigmoid", cv=5))])

    results = {}
    for name, clf in candidates.items():
        cutoffs = find_cutoffs(y_val, make(clf).fit(X_fit, y_fit).predict_proba(X_val)[:, 1])
        pipe = make(clf).fit(X_train, y_train)                 # final model on all training data
        scores = evaluate(name, pipe.predict_proba(X_test)[:, 1], cutoffs, y_test)
        results[name] = (pipe, scores, cutoffs)

    # 5. Prefer the monotonic model (its scores always move in a sensible direction)
    #    unless the other model is clearly more accurate (F1 better by more than 0.01)
    best_name = "Gradient Boosting (monotonic)"
    other = max((n for n in results if n != best_name), key=lambda n: results[n][1]["f1"])
    if results[other][1]["f1"] > results[best_name][1]["f1"] + 0.01:
        best_name = other
    best_model, best_scores, best_cutoffs = results[best_name]
    print(f"\nChosen model: {best_name} (F1 = {best_scores['f1']:.3f})")

    # 6. Show the 10 features that matter most (used for the "reason for priority" tag)
    names = best_model.named_steps["prep"].get_feature_names_out()
    importances = importances_of(best_model, X_val, y_val)
    top = sorted(zip(importances, names), reverse=True)[:10]
    print("\nTop 10 features:")
    for imp, n in top:
        label = "No website visit (time = 0)" if n.startswith("flag__") else n.split("__", 1)[-1]
        print(f"  {label:<55} {imp:.3f}")

    # 7. Save the model only if it is better than the previous saved one
    try:
        old = joblib.load("lead_model.pkl")
        same_inputs = list(old["model"].feature_names_in_) == list(X_train.columns)
        if not same_inputs or "fill_values" not in old:
            # Different inputs or older format: the old model cannot be compared fairly
            print("\nModel inputs or format changed since the last model, so it is replaced.")
            joblib.dump(old, "lead_model_previous.pkl")
            print("Old model kept as lead_model_previous.pkl")
        else:
            old_prob = old["model"].predict_proba(X_test)[:, 1]
            old_f1 = f1_score(y_test, old_prob >= old["cutoffs"]["medium"])
            print(f"\nPrevious saved model F1 on the same test data: {old_f1:.3f}")
            if old_f1 >= best_scores["f1"]:
                print("New model is not better. Keeping the old model.")
                return
    except FileNotFoundError:
        pass
    # How common each value is, used by the backend when a form field is left empty:
    # the model's answer is averaged over these values instead of treating empty as "Unknown"
    fill_values = {}
    for col in ("What is your current occupation", "Last Activity"):
        if col in X_train.columns:
            counts = X_train[col].value_counts()
            counts = counts[counts >= 20]
            fill_values[col] = (counts / counts.sum()).round(4).to_dict()
    joblib.dump({"model": best_model, "name": best_name, "scores": best_scores,
                 "cutoffs": best_cutoffs, "importances": importances,
                 "fill_values": fill_values}, "lead_model.pkl")
    print(f"Saved model to lead_model.pkl (MEDIUM from {best_cutoffs['medium']:.0%}, "
          f"HIGH from {best_cutoffs['high']:.0%})")


if __name__ == "__main__":
    main()
