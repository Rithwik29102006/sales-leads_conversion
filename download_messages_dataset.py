"""
download_messages_dataset.py - download sales conversations with their outcome
(converted or not) to train a model on customer messages.

Dataset: DeepMostInnovations/saas-sales-conversations (Hugging Face, Apache-2.0 licence)
         100,000 synthetic sales conversations written by GPT-4, each with outcome 0/1.
The full dataset is 7 GB because of an embedding column we do not need, so this script
reads ONLY the text and outcome columns from the Parquet files (a few hundred MB at most).

Run in your own terminal (with .venv active):
    pip install huggingface_hub pyarrow
    python download_messages_dataset.py
Output: sales_conversations.csv
"""

import sys
import pandas as pd
import pyarrow.parquet as pq
from huggingface_hub import HfFileSystem

REPO = "DeepMostInnovations/saas-sales-conversations"
WANTED = ["conversation_id", "conversation", "full_text", "outcome", "communication_channel",
          "product_type", "scenario", "conversation_length"]
MAX_ROWS = 40_000                     # enough for training; keeps the download small

fs = HfFileSystem()

# Hugging Face keeps a Parquet copy of every dataset (lets us read single columns)
files = []
for pattern in (f"datasets/{REPO}@~parquet/**/*.parquet",
                f"datasets/{REPO}@refs%2Fconvert%2Fparquet/**/*.parquet",
                f"datasets/{REPO}/**/*.parquet"):
    try:
        files = sorted(fs.glob(pattern))
    except Exception as error:                      # noqa: BLE001 - try the next location
        print("  (not found at", pattern.split("@")[-1][:30], "-", type(error).__name__, ")")
    if files:
        break
if not files:
    sys.exit("Could not find Parquet files. Check your internet connection or the dataset name.")
print(f"Found {len(files)} Parquet file(s)")

parts, total = [], 0
for path in files:
    schema = pq.read_schema(path, filesystem=fs)
    columns = [c for c in WANTED if c in schema.names]
    if "outcome" not in columns:
        sys.exit(f"No 'outcome' column in {path}. Columns start with: {schema.names[:20]}")
    print(f"Reading {path.split('/')[-1]}  columns: {columns}")
    table = pq.read_table(path, columns=columns, filesystem=fs)
    parts.append(table.to_pandas())
    total += table.num_rows
    print(f"  {table.num_rows} rows (total {total})")
    if total >= MAX_ROWS:
        break

data = pd.concat(parts, ignore_index=True).head(MAX_ROWS)
data.to_csv("sales_conversations.csv", index=False)
print(f"\nSaved sales_conversations.csv: {len(data)} conversations, "
      f"{data['outcome'].mean():.1%} converted")
print("Example conversation (first 600 characters):")
print(str(data.iloc[0].get("conversation", data.iloc[0].get("full_text", "")))[:600])
