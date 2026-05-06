# KClaw0 Provider Strategy
## LLM Provider Abstraction Plan

Based on the Attractor Unified LLM Client Spec.

---

## Current State

**Active Provider:** Kimi (Moonshot AI)
**Active Model:** k2p6 (alias: kimi/k2p6)
**Platform:** OpenClaw

**Capabilities:**
- Thinking enabled (high level)
- Streaming responses
- Native tool calling
- Vision model available (image analysis)
- Search plugin available (kimi_search, kimi_fetch)
- Finance data available (kimi_finance)

---

## Provider Landscape

| Provider | Models | Strengths | Weaknesses |
|----------|--------|-----------|------------|
| **Kimi** | k2p5, k2p6 | Long context, Chinese-native, coding | Less ecosystem than OpenAI |
| **OpenAI** | gpt-5, codex | Best tool ecosystem, most mature | Expensive, rate limits |
| **Anthropic** | claude-opus-4 | Excellent reasoning, long context | No native search |
| **Google** | gemini-3 | Free tier, multimodal | Inconsistent quality |

---

## Use-Case Mapping

**Kimi k2p6 (Current Default):**
- General conversation
- Code analysis and editing
- Chinese language tasks
- Long document processing

**Potential Future Additions:**
- **OpenAI gpt-5** — For tasks requiring best-in-class reasoning
- **OpenAI codex** — For complex coding tasks (via ACP harness)
- **Anthropic claude** — For deep analysis requiring careful reasoning
- **Gemini** — For multimodal tasks (images + text)

---

## Model Aliases

Current aliases defined in runtime:
- `kimi-k2p5` → `kimi-coding/k2p5`
- `kimi-k2p6` → `kimi-coding/k2p6`

Proposed additions:
- `fast` → lightweight model for simple tasks
- `deep` → heavy model for complex reasoning
- `code` → coding-optimized model
- `vision` → image-capable model

---

## Cost Tracking

**Current:** No explicit cost tracking
**Future:** Track tokens per session, per day, per task type
**Storage:** `memory/cost-tracking.md`

---

## Fallback Strategy

If primary provider fails:
1. Retry with same provider (exponential backoff)
2. Switch to secondary provider if available
3. Degrade to simpler model if rate-limited
4. Notify user of provider switch

**Current Status:** OpenClaw handles provider failover internally. No explicit fallback needed.

---

## Multi-Provider Architecture (Future)

```
Client (KClaw0)
  ↓
Provider Router
  ↓
+---------------+  +---------------+  +---------------+
| Kimi Adapter  |  | OpenAI Adap |  | Anthropic   |
| (primary)     |  | (secondary) |  | (tertiary)  |
+---------------+  +---------------+  +---------------+
```

**Implementation Priority:** LOW — current single provider works well. Revisit if:
- Kimi becomes unreliable
- Need specific capability from another provider
- Cost optimization needed
- User requests specific provider

---

## Environment Configuration

**Recommended env vars (if multi-provider):**
```bash
KIMI_API_KEY=...
KIMI_BASE_URL=...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
DEFAULT_PROVIDER=kimi
```

**Current:** Single provider configured via OpenClaw config.

---

## Middleware Ideas

1. **Logging Middleware** — Log all requests/responses for debugging
2. **Retry Middleware** — Exponential backoff on failures
3. **Caching Middleware** — Cache common queries
4. **Cost Middleware** — Track and limit spending
5. **Routing Middleware** — Route by task type to optimal model

**Implementation:** Use OpenClaw's built-in middleware or implement custom layer.

---

## Definition of Done

- [ ] Document current provider capabilities
- [ ] Define fallback strategy
- [ ] Establish cost tracking (if needed)
- [ ] Evaluate secondary providers periodically
