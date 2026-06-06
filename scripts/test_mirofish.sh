#!/bin/bash
cd /root/.openclaw/workspace/mirofish/backend
source .venv/bin/activate
PYTHONPATH=/root/.openclaw/workspace/mirofish/backend \
  python3 /root/.openclaw/workspace/scripts/mirofish_wrapper.py \
  --sim-id test1 \
  --problem "test" \
  --seed-path /dev/null \
  --max-rounds 1 \
  --backend-dir /root/.openclaw/workspace/mirofish/backend
