# NanoChat Installation Report

**Date:** 2026-05-07
**Status:** ✅ Installed and Functional
**Location:** `/root/.openclaw/workspace/nanochat/`
**Python:** 3.10.20 (via `uv`)
**PyTorch:** 2.9.1+cpu
**Tests:** 13 passed, 10 skipped (skipped = flash-attention GPU-only tests)

---

## What is nanochat?

nanochat is Andrej Karpathy's minimal, hackable full-stack LLM training harness. It's designed to train a complete ChatGPT-like model end-to-end on a single GPU node for under $100. It covers the entire pipeline: tokenization, pretraining, supervised fine-tuning (SFT), reinforcement learning (RL), evaluation, inference, and a web UI. The key design philosophy is **one complexity dial** — you set `--depth` (number of transformer layers) and all other hyperparameters (width, heads, learning rate, training horizon, weight decay) are computed automatically for compute-optimal training.

---

## How It Could Be Adapted for KClaw0 Sub-Agent Training

### 1. **Small Sub-Agent Models**
   - nanochat's miniseries concept trains models from tiny (d4, ~1M params) to GPT-2 scale (d24-d26, ~1.6B params).
   - For KClaw0 sub-agents, we could train **depth-4 to depth-8 models** (~10-100M parameters) that are:
     - Fast to load and execute
     - Cheap to train on CPU or small GPU
     - Specialized for specific tasks (e.g., code analysis, doc summarization, pattern matching)

### 2. **Specialized Training Pipeline**
   - **Pretraining:** Train on curated datasets (KClaw0 memory, codebase, documentation)
   - **SFT:** Fine-tune on conversation data formatted with nanochat's special tokens (`<|user_start|>`, `<|assistant_start|>`, `<|python_start|>`, etc.)
   - **RL:** Use nanochat's chat_rl.py for reinforcement learning to optimize sub-agent behavior
   - **Tool Use:** nanochat has built-in Python REPL tool execution via `<|python_start|>` / `<|python_end|>` tokens — perfect for sub-agents that need to run code

### 3. **Integration Points**
   - **Tokenizer:** The RustBPE + tiktoken tokenizer is fast and can be trained on KClaw0-specific vocabulary
   - **Engine:** The `Engine` class with KV-cache is efficient for inference — sub-agents could share a single model instance
   - **Checkpoint Manager:** Save/resume training for incremental sub-agent improvement
   - **Execution Module:** `nanochat/execution.py` allows the LLM to execute Python as a tool — directly usable for sub-agent code execution

### 4. **Training Cost for Sub-Agents**
   - A d8 model (~50M params) could be pretrained on CPU in hours
   - SFT on task-specific data would be minutes on CPU
   - This makes it feasible to train **per-task sub-agent models** rather than using one giant model for everything

---

## Issues & Resolutions

| Issue | Resolution |
|-------|-----------|
| `uv` not in PATH | `/root/.local/bin/uv` was already installed |
| No GPU / CUDA 12.8 | Used `--extra cpu` flag; PyTorch CPU version installed (2.9.1+cpu) |
| pytest not finding `nanochat` module | Used `python -m pytest` instead of bare `pytest` so package is importable |
| Flash Attention tests skipped | Expected on CPU — no CUDA / Hopper GPU available |
| `.gitignore` | nanochat/ already added to workspace `.gitignore` |

---

## Quick Reference

```bash
# Activate environment
cd /root/.openclaw/workspace/nanochat
source .venv/bin/activate

# Run tests
python -m pytest tests/ -v

# Train a tiny model (CPU example — very small)
bash runs/runcpu.sh

# Chat with a trained model
python -m scripts.chat_web

# Key files
nanochat/gpt.py          — Transformer model
nanochat/engine.py       — Inference engine with KV-cache
nanochat/tokenizer.py    — BPE tokenizer
scripts/base_train.py    — Pretraining
scripts/chat_sft.py      — Supervised fine-tuning
scripts/chat_rl.py       — Reinforcement learning
scripts/chat_web.py      — Web UI
```

---

## Next Steps (Suggested)

1. **Prototype a d4 sub-agent model** (~1-5M params) for a specific KClaw0 task
2. **Curate training data** from KClaw0 memory/logs to pretrain on domain-specific content
3. **Fine-tune with SFT** using nanochat's conversation format for sub-agent behavior
4. **Export to TorchScript/ONNX** for faster loading in the KClaw0 runtime
5. **Integrate with KClaw0's script system** — sub-agents could be spawned with a model + tokenizer + engine combo
