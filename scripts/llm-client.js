#!/usr/bin/env node
/**
 * Multi-Provider LLM Client — KClaw0 Type D (Infrastructure) Upgrade
 *
 * Unified LLM client abstracting Kimi, OpenAI, Anthropic, Google Gemini, and Ollama.
 * Implements adapter pattern with provider-specific request/response translation.
 *
 * Core API:
 *   createClient(provider, config)  → Factory returning provider client
 *   complete(prompt, options)       → Single completion (unified interface)
 *   stream(prompt, options)         → Streaming completion
 *   listModels()                    → List available models for providers
 *   estimateCost(prompt, model)     → Estimate cost before calling
 *   switchProvider(provider)        → Runtime provider switching
 *
 * CLI commands:
 *   list       — Show configured providers and models
 *   test       — Test connection to provider
 *   complete   — Single completion test
 *   switch     — Set default provider
 *   config     — Show current config
 *
 * @module scripts/llm-client
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// ── Configuration ────────────────────────────────────────────────────────────

const CONFIG_PATH = path.resolve(__dirname, '..', 'memory', 'llm-providers.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Provider config not found at ${CONFIG_PATH}. Run with --init to create default.`);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

// ── HTTP Helper ──────────────────────────────────────────────────────────────

function httpRequest(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      url,
      {
        method: options.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
        ...(options.timeout ? { timeout: options.timeout } : {}),
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve({ status: res.statusCode, body: body ? JSON.parse(body) : {}, headers: res.headers });
            } catch {
              resolve({ status: res.statusCode, body, headers: res.headers });
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        });
      }
    );
    req.on('error', reject);
    if (options.timeout) req.on('timeout', () => req.destroy());
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ── Provider Adapters ────────────────────────────────────────────────────────

/**
 * Kimi (Moonshot AI) Adapter
 */
class KimiAdapter {
  constructor(config) {
    this.config = config;
    this.name = 'kimi';
    this.baseUrl = config.baseUrl || 'https://api.moonshot.cn';
    this.apiKey = process.env[config.apiKeyEnv];
    this.models = config.models || ['kimi-k2p6', 'kimi-k2p5'];
    this.defaultModel = config.defaultModel || 'kimi-k2p6';
    this.pricing = config.pricing || {};
  }

  toNativeRequest(unified) {
    const model = unified.model || this.defaultModel;
    const nativeModel = model.replace(/^kimi-/, '');
    return {
      url: `${this.baseUrl}/v1/chat/completions`,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: nativeModel,
        messages: unified.messages,
        temperature: unified.temperature,
        max_tokens: unified.maxTokens,
        stream: unified.stream || false,
        tools: unified.tools,
        tool_choice: unified.toolChoice,
      }),
    };
  }

  fromNativeResponse(native, unifiedModel) {
    const choice = native.choices?.[0];
    const usage = native.usage || {};
    return {
      content: choice?.message?.content || choice?.delta?.content || '',
      usage: {
        inputTokens: usage.prompt_tokens || usage.input_tokens || 0,
        outputTokens: usage.completion_tokens || usage.output_tokens || 0,
        totalTokens: usage.total_tokens || 0,
      },
      model: unifiedModel,
      finishReason: choice?.finish_reason || 'unknown',
      raw: native,
    };
  }

  parseStreamChunk(chunk, buffer) {
    const lines = (buffer + chunk).split('\n');
    const newBuffer = lines.pop();
    const parsed = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (trimmed.startsWith('data: ')) {
        try {
          parsed.push(JSON.parse(trimmed.slice(6)));
        } catch { /* ignore malformed */ }
      }
    }
    return { parsed, buffer: newBuffer };
  }

  getStreamContent(chunk) {
    return chunk.choices?.[0]?.delta?.content || '';
  }
}

/**
 * OpenAI Adapter
 */
class OpenAIAdapter {
  constructor(config) {
    this.config = config;
    this.name = 'openai';
    this.baseUrl = config.baseUrl || 'https://api.openai.com';
    this.apiKey = process.env[config.apiKeyEnv];
    this.models = config.models || ['gpt-4o', 'gpt-4o-mini'];
    this.defaultModel = config.defaultModel || 'gpt-4o';
    this.pricing = config.pricing || {};
  }

  toNativeRequest(unified) {
    const model = unified.model || this.defaultModel;
    return {
      url: `${this.baseUrl}/v1/chat/completions`,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: unified.messages,
        temperature: unified.temperature,
        max_tokens: unified.maxTokens,
        stream: unified.stream || false,
        tools: unified.tools,
        tool_choice: unified.toolChoice,
      }),
    };
  }

  fromNativeResponse(native, unifiedModel) {
    const choice = native.choices?.[0];
    const usage = native.usage || {};
    return {
      content: choice?.message?.content || choice?.delta?.content || '',
      usage: {
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
      },
      model: unifiedModel,
      finishReason: choice?.finish_reason || 'unknown',
      raw: native,
    };
  }

  parseStreamChunk(chunk, buffer) {
    const lines = (buffer + chunk).split('\n');
    const newBuffer = lines.pop();
    const parsed = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (trimmed.startsWith('data: ')) {
        try {
          parsed.push(JSON.parse(trimmed.slice(6)));
        } catch { /* ignore malformed */ }
      }
    }
    return { parsed, buffer: newBuffer };
  }

  getStreamContent(chunk) {
    return chunk.choices?.[0]?.delta?.content || '';
  }
}

/**
 * Anthropic Adapter
 */
class AnthropicAdapter {
  constructor(config) {
    this.config = config;
    this.name = 'anthropic';
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com';
    this.apiKey = process.env[config.apiKeyEnv];
    this.models = config.models || ['claude-sonnet-4', 'claude-opus-4'];
    this.defaultModel = config.defaultModel || 'claude-sonnet-4';
    this.pricing = config.pricing || {};
  }

  toNativeRequest(unified) {
    const model = unified.model || this.defaultModel;
    const messages = unified.messages.map((m) => ({
      role: m.role === 'system' ? 'user' : m.role,
      content: m.content,
    }));
    const systemMsg = unified.messages.find((m) => m.role === 'system');
    const body = {
      model,
      messages,
      max_tokens: unified.maxTokens || 4096,
      stream: unified.stream || false,
      ...(systemMsg ? { system: systemMsg.content } : {}),
      ...(unified.temperature !== undefined ? { temperature: unified.temperature } : {}),
    };
    return {
      url: `${this.baseUrl}/v1/messages`,
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    };
  }

  fromNativeResponse(native, unifiedModel) {
    return {
      content:
        typeof native.content === 'string'
          ? native.content
          : native.content?.map((c) => c.text).join('') || '',
      usage: {
        inputTokens: native.usage?.input_tokens || 0,
        outputTokens: native.usage?.output_tokens || 0,
        totalTokens: (native.usage?.input_tokens || 0) + (native.usage?.output_tokens || 0),
      },
      model: unifiedModel,
      finishReason: native.stop_reason || 'unknown',
      raw: native,
    };
  }

  parseStreamChunk(chunk, buffer) {
    const lines = (buffer + chunk).split('\n');
    const newBuffer = lines.pop();
    const parsed = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'event: message_stop') continue;
      if (trimmed.startsWith('data: ')) {
        try {
          parsed.push(JSON.parse(trimmed.slice(6)));
        } catch { /* ignore malformed */ }
      }
    }
    return { parsed, buffer: newBuffer };
  }

  getStreamContent(chunk) {
    if (chunk.type === 'content_block_delta') return chunk.delta?.text || '';
    if (chunk.type === 'content_block_start') return chunk.content_block?.text || '';
    return '';
  }
}

/**
 * Google Gemini Adapter
 */
class GeminiAdapter {
  constructor(config) {
    this.config = config;
    this.name = 'gemini';
    this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com';
    this.apiKey = process.env[config.apiKeyEnv];
    this.models = config.models || ['gemini-2.5-pro', 'gemini-2.5-flash'];
    this.defaultModel = config.defaultModel || 'gemini-2.5-pro';
    this.pricing = config.pricing || {};
  }

  toNativeRequest(unified) {
    const model = unified.model || this.defaultModel;
    const contents = unified.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    return {
      url: `${this.baseUrl}/v1beta/models/${model}:generateContent?key=${this.apiKey}`,
      headers: {},
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: unified.temperature,
          maxOutputTokens: unified.maxTokens,
        },
      }),
    };
  }

  fromNativeResponse(native, unifiedModel) {
    const candidate = native.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const text = parts.map((p) => p.text).join('');
    const usage = native.usageMetadata || {};
    return {
      content: text,
      usage: {
        inputTokens: usage.promptTokenCount || 0,
        outputTokens: usage.candidatesTokenCount || 0,
        totalTokens: usage.totalTokenCount || 0,
      },
      model: unifiedModel,
      finishReason: candidate?.finishReason || 'unknown',
      raw: native,
    };
  }

  parseStreamChunk(chunk, buffer) {
    const lines = (buffer + chunk).split('\n');
    const newBuffer = lines.pop();
    const parsed = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        parsed.push(JSON.parse(trimmed));
      } catch { /* ignore malformed */ }
    }
    return { parsed, buffer: newBuffer };
  }

  getStreamContent(chunk) {
    const parts = chunk.candidates?.[0]?.content?.parts || [];
    return parts.map((p) => p.text).join('');
  }
}

/**
 * Ollama (Local) Adapter
 */
class OllamaAdapter {
  constructor(config) {
    this.config = config;
    this.name = 'ollama';
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.apiKey = null;
    this.models = config.models || ['llama3', 'mistral'];
    this.defaultModel = config.defaultModel || 'llama3';
    this.pricing = {};
  }

  toNativeRequest(unified) {
    const model = unified.model || this.defaultModel;
    return {
      url: `${this.baseUrl}/api/chat`,
      headers: {},
      body: JSON.stringify({
        model,
        messages: unified.messages,
        stream: unified.stream || false,
        options: {
          temperature: unified.temperature,
          num_predict: unified.maxTokens,
        },
      }),
    };
  }

  fromNativeResponse(native, unifiedModel) {
    return {
      content: native.message?.content || '',
      usage: {
        inputTokens: native.prompt_eval_count || 0,
        outputTokens: native.eval_count || 0,
        totalTokens: (native.prompt_eval_count || 0) + (native.eval_count || 0),
      },
      model: unifiedModel,
      finishReason: native.done ? 'stop' : 'unknown',
      raw: native,
    };
  }

  parseStreamChunk(chunk, buffer) {
    const lines = (buffer + chunk).split('\n');
    const newBuffer = lines.pop();
    const parsed = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        parsed.push(JSON.parse(trimmed));
      } catch { /* ignore malformed */ }
      }
    return { parsed, buffer: newBuffer };
  }

  getStreamContent(chunk) {
    return chunk.message?.content || '';
  }
}

// ── Adapter Factory ──────────────────────────────────────────────────────────

const ADAPTER_REGISTRY = {
  kimi: KimiAdapter,
  openai: OpenAIAdapter,
  anthropic: AnthropicAdapter,
  gemini: GeminiAdapter,
  ollama: OllamaAdapter,
};

function createAdapter(providerName, config) {
  const AdapterClass = ADAPTER_REGISTRY[providerName];
  if (!AdapterClass) {
    throw new Error(`Unknown provider: ${providerName}. Available: ${Object.keys(ADAPTER_REGISTRY).join(', ')}`);
  }
  return new AdapterClass(config);
}

// ── Mock Provider (for testing) ──────────────────────────────────────────────

class MockAdapter {
  constructor(config = {}) {
    this.name = config.name || 'mock';
    this.models = config.models || ['mock-model'];
    this.defaultModel = config.defaultModel || 'mock-model';
    this.pricing = config.pricing || { 'mock-model': { inputPerM: 0.001, outputPerM: 0.002 } };
    this.latency = config.latency || 0;
    this.failRate = config.failRate || 0;
    this._callCount = 0;
  }

  toNativeRequest(unified) {
    return { url: 'http://mock.test/completions', headers: {}, body: JSON.stringify(unified) };
  }

  fromNativeResponse(native, unifiedModel) {
    const usage = native.mockUsage || { inputTokens: 10, outputTokens: 20, totalTokens: 30 };
    return {
      content: native.mockContent || `Mock response for ${unifiedModel}`,
      model: unifiedModel,
      finishReason: native.mockFinish || 'stop',
      usage: {
        inputTokens: usage.inputTokens || 0,
        outputTokens: usage.outputTokens || 0,
        totalTokens: (usage.inputTokens || 0) + (usage.outputTokens || 0),
      },
      raw: native,
    };
  }

  parseStreamChunk(chunk, buffer) {
    return { parsed: chunk.mockParsed || [], buffer: '' };
  }

  getStreamContent(chunk) {
    return chunk.content || '';
  }

  shouldFail() {
    this._callCount++;
    return Math.random() < this.failRate;
  }
}

// ── LLM Client ───────────────────────────────────────────────────────────────

class LLMClient {
  constructor(options = {}) {
    this.config = options.config || loadConfig();
    this.provider = options.provider || this.config.default || 'kimi';
    this.adapter = null;
    this._initAdapter();
  }

  _initAdapter() {
    const providerCfg = this.config.providers[this.provider];
    if (!providerCfg) {
      throw new Error(`Provider "${this.provider}" not configured`);
    }
    this.adapter = createAdapter(this.provider, providerCfg);
  }

  /**
   * Resolve a model alias or full model name to canonical form.
   */
  resolveModel(model) {
    if (!model) return this.adapter.defaultModel;
    // Check aliases first
    const aliases = this.config.aliases || {};
    if (aliases[model]) return aliases[model];
    // Check if provider prefix is present
    for (const [pName, pCfg] of Object.entries(this.config.providers)) {
      for (const m of pCfg.models || []) {
        if (m === model) return m;
        if (m === `${pName}-${model}`) return m;
      }
    }
    return model;
  }

  /**
   * Resolve a model to its provider.
   */
  resolveProvider(model) {
    const aliases = this.config.aliases || {};
    const resolved = aliases[model] || model;
    for (const [pName, pCfg] of Object.entries(this.config.providers)) {
      for (const m of pCfg.models || []) {
        if (m === resolved || resolved.startsWith(`${pName}-`)) return pName;
      }
    }
    return this.config.default;
  }

  /**
   * Perform a single completion.
   *
   * @param {string|object} prompt — String prompt or unified request object
   * @param {object} options — Optional overrides (temperature, maxTokens, model, etc.)
   * @returns {Promise<UnifiedResponse>}
   */
  async complete(prompt, options = {}) {
    const unified = this._buildUnifiedRequest(prompt, options);
    const provider = this.resolveProvider(unified.model);
    if (provider !== this.provider) {
      this.switchProvider(provider);
    }

    const nativeReq = this.adapter.toNativeRequest(unified);
    const response = await httpRequest(nativeReq.url, {
      method: 'POST',
      headers: nativeReq.headers,
      body: nativeReq.body,
      timeout: options.timeout || 60000,
    });

    const result = this.adapter.fromNativeResponse(response.body, unified.model);
    this._logCall(unified, result);
    return result;
  }

  /**
   * Perform a streaming completion.
   *
   * @param {string|object} prompt — String prompt or unified request object
   * @param {object} options — Optional overrides
   * @yields {string} Chunks of generated content
   */
  async *stream(prompt, options = {}) {
    const unified = this._buildUnifiedRequest(prompt, { ...options, stream: true });
    const provider = this.resolveProvider(unified.model);
    if (provider !== this.provider) {
      this.switchProvider(provider);
    }

    const nativeReq = this.adapter.toNativeRequest(unified);
    const url = new URL(nativeReq.url);
    const lib = url.protocol === 'https:' ? https : http;

    const response = await new Promise((resolve, reject) => {
      const req = lib.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(nativeReq.headers || {}),
          },
          timeout: options.timeout || 120000,
        },
        (res) => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${body}`)));
            return;
          }
          resolve(res);
        }
      );
      req.on('error', reject);
      req.write(nativeReq.body);
      req.end();
    });

    let buffer = '';
    let totalTokens = 0;
    for await (const chunk of response) {
      const { parsed, buffer: newBuffer } = this.adapter.parseStreamChunk(chunk.toString(), buffer);
      buffer = newBuffer;
      for (const item of parsed) {
        const content = this.adapter.getStreamContent(item);
        if (content) {
          totalTokens += content.length / 4; // rough estimate
          yield content;
        }
      }
    }
  }

  /**
   * List all available models across all configured providers.
   *
   * @returns {Array<{provider, models, defaultModel}>}
   */
  listModels() {
    const result = [];
    for (const [name, cfg] of Object.entries(this.config.providers)) {
      result.push({
        provider: name,
        models: cfg.models || [],
        defaultModel: cfg.defaultModel,
        pricing: cfg.pricing || {},
      });
    }
    return result;
  }

  /**
   * Estimate cost for a given prompt and model.
   *
   * @param {string} prompt — The prompt text
   * @param {string} model — Model identifier
   * @returns {object} Cost estimate
   */
  estimateCost(prompt, model) {
    const resolved = this.resolveModel(model);
    const provider = this.resolveProvider(resolved);
    const pCfg = this.config.providers[provider];
    const pricing = pCfg?.pricing?.[resolved] || pCfg?.pricing?.default || { inputPerM: 1.0, outputPerM: 3.0 };

    // Rough token estimation: ~4 chars per token
    const inputTokens = Math.ceil(prompt.length / 4);
    // Assume output is roughly input length for estimate
    const outputTokens = Math.ceil(inputTokens * 0.5);

    const inputCost = (inputTokens / 1_000_000) * pricing.inputPerM;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPerM;

    return {
      model: resolved,
      provider,
      estimatedInputTokens: inputTokens,
      estimatedOutputTokens: outputTokens,
      estimatedInputCost: inputCost,
      estimatedOutputCost: outputCost,
      estimatedTotalCost: inputCost + outputCost,
      currency: 'USD',
    };
  }

  /**
   * Switch active provider at runtime.
   *
   * @param {string} provider — Provider name
   */
  switchProvider(provider) {
    if (!this.config.providers[provider]) {
      throw new Error(`Provider "${provider}" not configured`);
    }
    this.provider = provider;
    this._initAdapter();
    return this;
  }

  /**
   * Test connectivity to a provider.
   *
   * @param {string} provider — Provider name (defaults to current)
   * @returns {Promise<{ok: boolean, latency: number, error?: string}>}
   */
  async test(provider) {
    const target = provider || this.provider;
    const cfg = this.config.providers[target];
    if (!cfg) return { ok: false, latency: 0, error: 'Not configured' };

    const adapter = createAdapter(target, cfg);
    const start = Date.now();

    try {
      // Try a minimal request (list models or a simple completion)
      const testUrl = adapter.baseUrl;
      if (target === 'ollama') {
        await httpRequest(`${testUrl}/api/tags`, { method: 'GET', headers: adapter.apiKey ? { Authorization: `Bearer ${adapter.apiKey}` } : {} });
      } else if (target === 'gemini') {
        await httpRequest(`${testUrl}/v1beta/models?key=${adapter.apiKey}`, { method: 'GET' });
      } else {
        // For others, try a simple models endpoint
        await httpRequest(`${testUrl}/v1/models`, {
          method: 'GET',
          headers: adapter.apiKey ? { Authorization: `Bearer ${adapter.apiKey}` } : {},
        });
      }
      return { ok: true, latency: Date.now() - start };
    } catch (err) {
      return { ok: false, latency: Date.now() - start, error: err.message };
    }
  }

  /**
   * Get fallback provider list.
   */
  getFallbacks() {
    return this.config.fallbacks || Object.keys(this.config.providers);
  }

  /**
   * Execute with automatic fallback on failure.
   */
  async completeWithFallback(prompt, options = {}) {
    const fallbacks = [this.provider, ...this.getFallbacks().filter((p) => p !== this.provider)];
    const errors = [];

    for (const provider of fallbacks) {
      try {
        this.switchProvider(provider);
        const result = await this.complete(prompt, options);
        if (provider !== options._originalProvider) {
          result._providerSwitched = true;
          result._originalProvider = options._originalProvider;
        }
        return result;
      } catch (err) {
        errors.push({ provider, error: err.message });
      }
    }

    const err = new Error(`All providers failed: ${errors.map((e) => `${e.provider}: ${e.error}`).join('; ')}`);
    err.errors = errors;
    throw err;
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  _buildUnifiedRequest(prompt, options) {
    const messages =
      typeof prompt === 'string'
        ? [{ role: 'user', content: prompt }]
        : Array.isArray(prompt)
          ? prompt
          : prompt.messages || [{ role: 'user', content: String(prompt) }];

    const model = this.resolveModel(options.model || (typeof prompt === 'object' ? prompt.model : undefined));
    return {
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens || 4096,
      stream: options.stream || false,
      tools: options.tools,
      toolChoice: options.toolChoice,
    };
  }

  _logCall(request, response) {
    const entry = {
      ts: new Date().toISOString(),
      provider: this.provider,
      model: response.model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      finishReason: response.finishReason,
    };
    // Append to cost log for integration with cost-tracker
    const costLogPath = path.resolve(__dirname, '..', 'memory', 'cost-log.ndjson');
    const line = JSON.stringify(entry) + '\n';
    try {
      fs.appendFileSync(costLogPath, line);
    } catch { /* cost log optional */ }
  }
}

// ── Factory Function ─────────────────────────────────────────────────────────

function createClient(provider, config) {
  const cfg = config || loadConfig();
  return new LLMClient({ provider: provider || cfg.default, config: cfg });
}

// ── CLI Interface ────────────────────────────────────────────────────────────

async function runCLI() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === '--help' || cmd === '-h') {
    console.log(`
Usage: llm-client <command> [args]

Commands:
  list                    Show all configured providers and models
  test [provider]          Test connection to provider (default: current)
  complete <provider> "<prompt>"  Run a single completion test
  switch <provider>        Set default provider in config
  config                   Show current configuration
  estimate <model> "<prompt>"  Estimate cost for a prompt
  --init                   Create default provider config

Environment variables:
  KIMI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY
`);
    return;
  }

  if (cmd === '--init') {
    const defaultConfig = {
      providers: {
        kimi: {
          baseUrl: 'https://api.moonshot.cn',
          apiKeyEnv: 'KIMI_API_KEY',
          models: ['kimi-k2p6', 'kimi-k2p5'],
          defaultModel: 'kimi-k2p6',
          pricing: { 'kimi-k2p6': { inputPerM: 1.0, outputPerM: 3.0 }, 'kimi-k2p5': { inputPerM: 0.5, outputPerM: 1.5 } },
        },
        openai: {
          baseUrl: 'https://api.openai.com',
          apiKeyEnv: 'OPENAI_API_KEY',
          models: ['gpt-4o', 'gpt-4o-mini'],
          defaultModel: 'gpt-4o',
          pricing: { 'gpt-4o': { inputPerM: 2.5, outputPerM: 10.0 }, 'gpt-4o-mini': { inputPerM: 0.15, outputPerM: 0.6 } },
        },
        anthropic: {
          baseUrl: 'https://api.anthropic.com',
          apiKeyEnv: 'ANTHROPIC_API_KEY',
          models: ['claude-sonnet-4', 'claude-opus-4'],
          defaultModel: 'claude-sonnet-4',
          pricing: { 'claude-sonnet-4': { inputPerM: 3.0, outputPerM: 15.0 }, 'claude-opus-4': { inputPerM: 15.0, outputPerM: 75.0 } },
        },
        gemini: {
          baseUrl: 'https://generativelanguage.googleapis.com',
          apiKeyEnv: 'GEMINI_API_KEY',
          models: ['gemini-2.5-pro', 'gemini-2.5-flash'],
          defaultModel: 'gemini-2.5-pro',
          pricing: { 'gemini-2.5-pro': { inputPerM: 1.25, outputPerM: 10.0 } },
        },
        ollama: {
          baseUrl: 'http://localhost:11434',
          apiKeyEnv: null,
          models: ['llama3', 'mistral'],
          defaultModel: 'llama3',
          pricing: {},
        },
      },
      default: 'kimi',
      fallbacks: ['kimi', 'openai', 'anthropic', 'gemini'],
      aliases: { fast: 'kimi-k2p5', deep: 'claude-opus-4', code: 'kimi-k2p6', vision: 'gpt-4o' },
    };
    saveConfig(defaultConfig);
    console.log('✅ Default provider config created at', CONFIG_PATH);
    return;
  }

  let client;
  try {
    client = createClient();
  } catch (err) {
    if (err.message.includes('not found')) {
      console.error('❌', err.message);
      console.log('Run: llm-client --init');
      process.exit(1);
    }
    throw err;
  }

  switch (cmd) {
    case 'list': {
      const models = client.listModels();
      console.log('\n📋 Configured Providers\n' + '='.repeat(40));
      for (const p of models) {
        console.log(`\n🔹 ${p.provider}`);
        console.log(`   Default: ${p.defaultModel}`);
        console.log(`   Models:  ${p.models.join(', ')}`);
        if (Object.keys(p.pricing).length) {
          console.log(`   Pricing: ${Object.entries(p.pricing).map(([m, pr]) => `${m} ($${pr.inputPerM}/$${pr.outputPerM} per 1M)`).join(', ')}`);
        }
      }
      const aliases = client.config.aliases || {};
      if (Object.keys(aliases).length) {
        console.log(`\n🏷️  Aliases: ${Object.entries(aliases).map(([k, v]) => `${k}→${v}`).join(', ')}`);
      }
      console.log(`\n🎯 Default provider: ${client.config.default}`);
      console.log(`🔄 Fallbacks: ${client.config.fallbacks?.join(' → ')}`);
      break;
    }

    case 'test': {
      const provider = args[1] || client.provider;
      process.stdout.write(`Testing ${provider}... `);
      const result = await client.test(provider);
      if (result.ok) {
        console.log(`✅ OK (${result.latency}ms)`);
      } else {
        console.log(`❌ FAIL: ${result.error}`);
        process.exitCode = 1;
      }
      break;
    }

    case 'complete': {
      const provider = args[1];
      const prompt = args[2];
      if (!provider || !prompt) {
        console.error('Usage: llm-client complete <provider> "<prompt>"');
        process.exit(1);
      }
      client.switchProvider(provider);
      console.log(`\n🤖 ${provider} → ${client.adapter.defaultModel}\n`);
      const result = await client.complete(prompt);
      console.log(result.content);
      console.log(`\n─── Tokens: ${result.usage.inputTokens} in / ${result.usage.outputTokens} out | Finish: ${result.finishReason}`);
      break;
    }

    case 'switch': {
      const newProvider = args[1];
      if (!newProvider) {
        console.error('Usage: llm-client switch <provider>');
        process.exit(1);
      }
      client.switchProvider(newProvider);
      client.config.default = newProvider;
      saveConfig(client.config);
      console.log(`✅ Default provider switched to: ${newProvider}`);
      break;
    }

    case 'config': {
      console.log(JSON.stringify(client.config, null, 2));
      break;
    }

    case 'estimate': {
      const model = args[1];
      const prompt = args[2] || 'Hello, how are you?';
      if (!model) {
        console.error('Usage: llm-client estimate <model> "<prompt>"');
        process.exit(1);
      }
      const est = client.estimateCost(prompt, model);
      console.log(`\n💰 Cost Estimate for ${est.model} (${est.provider})`);
      console.log(`   Input:  ~${est.estimatedInputTokens} tokens → $${est.estimatedInputCost.toFixed(6)}`);
      console.log(`   Output: ~${est.estimatedOutputTokens} tokens → $${est.estimatedOutputCost.toFixed(6)}`);
      console.log(`   Total:  $${est.estimatedTotalCost.toFixed(6)} USD`);
      break;
    }

    default:
      console.error(`Unknown command: ${cmd}`);
      process.exit(1);
  }
}

// ── Module Exports ───────────────────────────────────────────────────────────

module.exports = {
  // Core API
  createClient,
  LLMClient,
  // Adapters (for extension)
  KimiAdapter,
  OpenAIAdapter,
  AnthropicAdapter,
  GeminiAdapter,
  OllamaAdapter,
  MockAdapter,
  createAdapter,
  // Helpers
  loadConfig,
  saveConfig,
  httpRequest,
};

// CLI entry point
if (require.main === module) {
  runCLI().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}
