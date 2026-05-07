#!/usr/bin/env node
/**
 * LLM Client Test Suite — KClaw0 Type D (Infrastructure) Upgrade
 *
 * Tests all core APIs of the Multi-Provider LLM Client:
 *  1. createClient factory
 *  2. Provider resolution (aliases, prefixes)
 *  3. Unified request building
 *  4. Cost estimation
 *  5. Model listing
 *  6. Provider switching
 *  7. Mock adapter
 *  8. Config persistence
 *  9. Fallback chain
 * 10. Adapter registry
 * 11. Ollama local adapter
 * 12. CLI config display
 */

const fs = require('fs');
const path = require('path');

// Import the module under test
const {
  createClient,
  LLMClient,
  KimiAdapter,
  OpenAIAdapter,
  AnthropicAdapter,
  GeminiAdapter,
  OllamaAdapter,
  MockAdapter,
  createAdapter,
  loadConfig,
  saveConfig,
} = require('../scripts/llm-client.js');

const WORKSPACE = '/root/.openclaw/workspace';
const CONFIG_PATH = path.join(WORKSPACE, 'memory', 'llm-providers.json');
const TEST_CONFIG_PATH = path.join(WORKSPACE, 'memory', 'llm-providers-test.json');

// ── Test Harness ─────────────────────────────────────────────────────────────

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  testsRun++;
  if (condition) {
    testsPassed++;
    console.log(`✅ ${message}`);
    return true;
  } else {
    testsFailed++;
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
    return false;
  }
}

function assertEqual(actual, expected, message) {
  const pass = actual === expected;
  if (!pass) {
    console.error(`   Expected: ${expected}`);
    console.error(`   Actual:   ${actual}`);
  }
  return assert(pass, message);
}

function assertDeep(actual, expected, message) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) {
    console.error(`   Expected: ${JSON.stringify(expected)}`);
    console.error(`   Actual:   ${JSON.stringify(actual)}`);
  }
  return assert(pass, message);
}

function section(name) {
  console.log(`\n${name}`);
  console.log('─'.repeat(name.length));
}

// ── Setup ──────────────────────────────────────────────────────────────────────

// Backup existing config
let originalConfig = null;
if (fs.existsSync(CONFIG_PATH)) {
  originalConfig = fs.readFileSync(CONFIG_PATH, 'utf-8');
}

const testConfig = {
  providers: {
    kimi: {
      baseUrl: 'https://api.moonshot.cn',
      apiKeyEnv: 'KIMI_API_KEY',
      models: ['kimi-k2p6', 'kimi-k2p5'],
      defaultModel: 'kimi-k2p6',
      pricing: {
        'kimi-k2p6': { inputPerM: 1.00, outputPerM: 3.00 },
        'kimi-k2p5': { inputPerM: 0.50, outputPerM: 1.50 },
      },
    },
    openai: {
      baseUrl: 'https://api.openai.com',
      apiKeyEnv: 'OPENAI_API_KEY',
      models: ['gpt-4o', 'gpt-4o-mini'],
      defaultModel: 'gpt-4o',
      pricing: {
        'gpt-4o': { inputPerM: 2.50, outputPerM: 10.00 },
        'gpt-4o-mini': { inputPerM: 0.15, outputPerM: 0.60 },
      },
    },
    anthropic: {
      baseUrl: 'https://api.anthropic.com',
      apiKeyEnv: 'ANTHROPIC_API_KEY',
      models: ['claude-sonnet-4', 'claude-opus-4'],
      defaultModel: 'claude-sonnet-4',
      pricing: {
        'claude-sonnet-4': { inputPerM: 3.00, outputPerM: 15.00 },
        'claude-opus-4': { inputPerM: 15.00, outputPerM: 75.00 },
      },
    },
    gemini: {
      baseUrl: 'https://generativelanguage.googleapis.com',
      apiKeyEnv: 'GEMINI_API_KEY',
      models: ['gemini-2.5-pro'],
      defaultModel: 'gemini-2.5-pro',
      pricing: {
        'gemini-2.5-pro': { inputPerM: 1.25, outputPerM: 10.00 },
      },
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
  fallbacks: ['kimi', 'openai', 'anthropic'],
  aliases: {
    fast: 'kimi-k2p5',
    deep: 'claude-opus-4',
    code: 'kimi-k2p6',
    vision: 'gpt-4o',
  },
};

fs.writeFileSync(CONFIG_PATH, JSON.stringify(testConfig, null, 2));

// ── Tests ──────────────────────────────────────────────────────────────────────

console.log('🔬 LLM Client Test Suite');
console.log('=========================\n');

// ── Test 1: Factory creates client with correct provider ────────────────────
section('Test 1: Factory — createClient()');
{
  const client = createClient('openai', testConfig);
  assertEqual(client.provider, 'openai', 'Factory sets provider to openai');
  assert(client.adapter instanceof OpenAIAdapter, 'Adapter is OpenAIAdapter');
  assertEqual(client.adapter.name, 'openai', 'Adapter name is openai');

  const client2 = createClient(null, testConfig);
  assertEqual(client2.provider, 'kimi', 'Factory defaults to kimi from config');
  assert(client2.adapter instanceof KimiAdapter, 'Default adapter is KimiAdapter');
}

// ── Test 2: Model resolution (aliases + canonical names) ──────────────────
section('Test 2: Model Resolution');
{
  const client = createClient('kimi', testConfig);

  assertEqual(client.resolveModel('fast'), 'kimi-k2p5', 'Alias "fast" resolves to k2p5');
  assertEqual(client.resolveModel('deep'), 'claude-opus-4', 'Alias "deep" resolves to claude-opus-4');
  assertEqual(client.resolveModel('code'), 'kimi-k2p6', 'Alias "code" resolves to k2p6');
  assertEqual(client.resolveModel('vision'), 'gpt-4o', 'Alias "vision" resolves to gpt-4o');
  assertEqual(client.resolveModel('kimi-k2p6'), 'kimi-k2p6', 'Canonical name passes through');
  assertEqual(client.resolveModel(null), 'kimi-k2p6', 'Null defaults to adapter defaultModel');

  assertEqual(client.resolveProvider('kimi-k2p6'), 'kimi', 'k2p6 belongs to kimi');
  assertEqual(client.resolveProvider('gpt-4o'), 'openai', 'gpt-4o belongs to openai');
  assertEqual(client.resolveProvider('claude-opus-4'), 'anthropic', 'claude-opus-4 belongs to anthropic');
}

// ── Test 3: Unified request building ────────────────────────────────────────
section('Test 3: Unified Request Building');
{
  const client = createClient('kimi', testConfig);
  const req = client._buildUnifiedRequest('Hello world', { temperature: 0.5, maxTokens: 512 });

  assertDeep(req.messages, [{ role: 'user', content: 'Hello world' }], 'String prompt becomes message array');
  assertEqual(req.model, 'kimi-k2p6', 'Default model selected');
  assertEqual(req.temperature, 0.5, 'Temperature set correctly');
  assertEqual(req.maxTokens, 512, 'Max tokens set correctly');
  assertEqual(req.stream, false, 'Stream defaults to false');

  const req2 = client._buildUnifiedRequest(
    { messages: [{ role: 'system', content: 'You are helpful' }, { role: 'user', content: 'Hi' }] },
    { model: 'gpt-4o' }
  );
  assertDeep(req2.messages, [{ role: 'system', content: 'You are helpful' }, { role: 'user', content: 'Hi' }], 'Message array preserved');
  assertEqual(req2.model, 'gpt-4o', 'Model override applied');
}

// ── Test 4: Cost estimation ─────────────────────────────────────────────────
section('Test 4: Cost Estimation');
{
  const client = createClient('kimi', testConfig);
  const est = client.estimateCost('Hello world', 'kimi-k2p6');

  assertEqual(est.provider, 'kimi', 'Estimation uses correct provider');
  assertEqual(est.model, 'kimi-k2p6', 'Estimation uses correct model');
  assert(est.estimatedInputTokens > 0, 'Input tokens estimated');
  assert(est.estimatedOutputTokens > 0, 'Output tokens estimated');
  assert(est.estimatedTotalCost > 0, 'Total cost is positive');
  assertEqual(est.currency, 'USD', 'Currency is USD');

  // Test with alias
  const est2 = client.estimateCost('Testing', 'fast');
  assertEqual(est2.model, 'kimi-k2p5', 'Alias resolved in cost estimate');
  assert(est2.estimatedTotalCost < est.estimatedTotalCost, 'k2p5 is cheaper than k2p6');

  // Test OpenAI pricing
  const client3 = createClient('openai', testConfig);
  const est3 = client3.estimateCost('Hello world', 'gpt-4o');
  assert(est3.estimatedTotalCost > 0, 'OpenAI cost estimated');
  assertEqual(est3.provider, 'openai', 'OpenAI provider in estimate');
}

// ── Test 5: List models across providers ────────────────────────────────────
section('Test 5: Model Listing');
{
  const client = createClient('kimi', testConfig);
  const models = client.listModels();

  assertEqual(models.length, 5, 'Lists all 5 providers');

  const kimiEntry = models.find((m) => m.provider === 'kimi');
  assert(kimiEntry, 'Kimi entry exists');
  assert(kimiEntry.models.includes('kimi-k2p6'), 'Kimi k2p6 listed');
  assertEqual(kimiEntry.defaultModel, 'kimi-k2p6', 'Kimi default correct');

  const ollamaEntry = models.find((m) => m.provider === 'ollama');
  assert(ollamaEntry, 'Ollama entry exists');
  assert(ollamaEntry.models.includes('llama3'), 'Ollama llama3 listed');
}

// ── Test 6: Provider switching ──────────────────────────────────────────────
section('Test 6: Provider Switching');
{
  const client = createClient('kimi', testConfig);
  assertEqual(client.provider, 'kimi', 'Initial provider is kimi');

  client.switchProvider('openai');
  assertEqual(client.provider, 'openai', 'Switched to openai');
  assert(client.adapter instanceof OpenAIAdapter, 'Adapter updated to OpenAI');
  assertEqual(client.adapter.defaultModel, 'gpt-4o', 'OpenAI default model correct');

  client.switchProvider('anthropic');
  assertEqual(client.provider, 'anthropic', 'Switched to anthropic');
  assert(client.adapter instanceof AnthropicAdapter, 'Adapter updated to Anthropic');

  client.switchProvider('gemini');
  assertEqual(client.provider, 'gemini', 'Switched to gemini');
  assert(client.adapter instanceof GeminiAdapter, 'Adapter updated to Gemini');

  client.switchProvider('ollama');
  assertEqual(client.provider, 'ollama', 'Switched to ollama');
  assert(client.adapter instanceof OllamaAdapter, 'Adapter updated to Ollama');

  // Switch back to kimi
  client.switchProvider('kimi');
  assertEqual(client.provider, 'kimi', 'Switched back to kimi');
}

// ── Test 7: Mock adapter ────────────────────────────────────────────────────
section('Test 7: Mock Adapter');
{
  const mock = new MockAdapter({
    name: 'test-mock',
    models: ['mock-alpha', 'mock-beta'],
    defaultModel: 'mock-alpha',
    pricing: { 'mock-alpha': { inputPerM: 0.001, outputPerM: 0.002 } },
  });

  assertEqual(mock.name, 'test-mock', 'Mock name set');
  assertEqual(mock.defaultModel, 'mock-alpha', 'Mock default model');
  assert(mock.models.includes('mock-beta'), 'Mock models includes beta');

  const req = mock.toNativeRequest({ model: 'mock-alpha', messages: [{ role: 'user', content: 'test' }] });
  assert(req.url.includes('mock.test'), 'Mock URL contains mock.test');

  const resp = mock.fromNativeResponse({ mockContent: 'Hello from mock', mockUsage: { inputTokens: 5, outputTokens: 10 } }, 'mock-alpha');
  assertEqual(resp.content, 'Hello from mock', 'Mock content extracted');
  assertDeep(resp.usage, { inputTokens: 5, outputTokens: 10, totalTokens: 0 }, 'Mock usage extracted');
  assertEqual(resp.finishReason, 'stop', 'Mock finish reason is stop');

  // Test failure simulation
  let failures = 0;
  for (let i = 0; i < 100; i++) {
    const m = new MockAdapter({ failRate: 0.3 });
    if (m.shouldFail()) failures++;
  }
  assert(failures > 10 && failures < 50, `Failure rate ~30% (got ${failures}/100)`);
}

// ── Test 8: Config persistence (load/save) ──────────────────────────────────
section('Test 8: Config Persistence');
{
  const loaded = loadConfig();
  assertDeep(loaded.default, 'kimi', 'Loaded config has correct default');
  assert(loaded.providers.kimi, 'Loaded config has kimi provider');
  assert(loaded.providers.openai, 'Loaded config has openai provider');

  // Save to temp and reload
  fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(loaded, null, 2));
  const reloaded = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf-8'));
  assertDeep(reloaded, loaded, 'Save/load roundtrip preserves config');

  // Modify, save, verify
  reloaded.default = 'openai';
  fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(reloaded, null, 2));
  const modified = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf-8'));
  assertEqual(modified.default, 'openai', 'Config modification persisted');

  fs.unlinkSync(TEST_CONFIG_PATH);
}

// ── Test 9: Fallback chain ──────────────────────────────────────────────────
section('Test 9: Fallback Chain');
{
  const client = createClient('kimi', testConfig);
  const fallbacks = client.getFallbacks();

  assert(Array.isArray(fallbacks), 'Fallbacks returns array');
  assert(fallbacks.length >= 3, 'At least 3 fallbacks');
  assertEqual(fallbacks[0], 'kimi', 'First fallback is current provider');
  assert(fallbacks.includes('openai'), 'Fallbacks include openai');
  assert(fallbacks.includes('anthropic'), 'Fallbacks include anthropic');
}

// ── Test 10: Adapter registry covers all providers ──────────────────────────
section('Test 10: Adapter Registry');
{
  const adapters = {
    kimi: createAdapter('kimi', testConfig.providers.kimi),
    openai: createAdapter('openai', testConfig.providers.openai),
    anthropic: createAdapter('anthropic', testConfig.providers.anthropic),
    gemini: createAdapter('gemini', testConfig.providers.gemini),
    ollama: createAdapter('ollama', testConfig.providers.ollama),
  };

  assert(adapters.kimi instanceof KimiAdapter, 'Registry creates KimiAdapter');
  assert(adapters.openai instanceof OpenAIAdapter, 'Registry creates OpenAIAdapter');
  assert(adapters.anthropic instanceof AnthropicAdapter, 'Registry creates AnthropicAdapter');
  assert(adapters.gemini instanceof GeminiAdapter, 'Registry creates GeminiAdapter');
  assert(adapters.ollama instanceof OllamaAdapter, 'Registry creates OllamaAdapter');

  // Verify each adapter has required methods
  for (const [name, adapter] of Object.entries(adapters)) {
    assert(typeof adapter.toNativeRequest === 'function', `${name} has toNativeRequest`);
    assert(typeof adapter.fromNativeResponse === 'function', `${name} has fromNativeResponse`);
    assert(typeof adapter.parseStreamChunk === 'function', `${name} has parseStreamChunk`);
    assert(typeof adapter.getStreamContent === 'function', `${name} has getStreamContent`);
  }
}

// ── Test 11: Ollama adapter specifics ───────────────────────────────────────
section('Test 11: Ollama Local Adapter');
{
  const ollama = new OllamaAdapter(testConfig.providers.ollama);

  assertEqual(ollama.baseUrl, 'http://localhost:11434', 'Ollama base URL correct');
  assertEqual(ollama.apiKey, null, 'Ollama has no API key');
  assertEqual(ollama.name, 'ollama', 'Ollama adapter name');

  const req = ollama.toNativeRequest({
    model: 'llama3',
    messages: [{ role: 'user', content: 'Hello' }],
    temperature: 0.8,
    maxTokens: 256,
  });

  assert(req.url.includes('localhost:11434/api/chat'), 'Ollama request URL correct');
  const body = JSON.parse(req.body);
  assertEqual(body.model, 'llama3', 'Ollama body has model');
  assertEqual(body.stream, false, 'Ollama stream flag');
  assertEqual(body.options.temperature, 0.8, 'Ollama temperature');
  assertEqual(body.options.num_predict, 256, 'Ollama num_predict');

  const resp = ollama.fromNativeResponse(
    { message: { content: 'Hi there!' }, prompt_eval_count: 5, eval_count: 2, done: true },
    'llama3'
  );
  assertEqual(resp.content, 'Hi there!', 'Ollama response content');
  assertEqual(resp.usage.inputTokens, 5, 'Ollama input tokens');
  assertEqual(resp.usage.outputTokens, 2, 'Ollama output tokens');
  assertEqual(resp.finishReason, 'stop', 'Ollama finish reason when done');
}

// ── Test 12: Provider-specific request translation ──────────────────────────
section('Test 12: Provider Request Translation');
{
  // Kimi: strips prefix
  const kimi = new KimiAdapter(testConfig.providers.kimi);
  const kimiReq = kimi.toNativeRequest({
    model: 'kimi-k2p6',
    messages: [{ role: 'user', content: 'Hi' }],
    temperature: 0.7,
    maxTokens: 100,
  });
  const kimiBody = JSON.parse(kimiReq.body);
  assertEqual(kimiBody.model, 'k2p6', 'Kimi strips "kimi-" prefix');
  assert(kimiReq.headers.Authorization, 'Kimi has Authorization header');

  // Anthropic: system message extraction
  const anthropic = new AnthropicAdapter(testConfig.providers.anthropic);
  const anthropicReq = anthropic.toNativeRequest({
    model: 'claude-sonnet-4',
    messages: [
      { role: 'system', content: 'You are a bot' },
      { role: 'user', content: 'Hello' },
    ],
    maxTokens: 512,
  });
  const anthropicBody = JSON.parse(anthropicReq.body);
  assertEqual(anthropicBody.system, 'You are a bot', 'Anthropic extracts system message');
  assert(!anthropicBody.messages.some((m) => m.role === 'system'), 'Anthropic body has no system in messages');
  assert(anthropicReq.headers['x-api-key'], 'Anthropic has x-api-key header');
  assertEqual(anthropicReq.headers['anthropic-version'], '2023-06-01', 'Anthropic version header');

  // Gemini: key in query param
  const gemini = new GeminiAdapter(testConfig.providers.gemini);
  process.env.GEMINI_API_KEY = 'test-key-123';
  const geminiReq = gemini.toNativeRequest({
    model: 'gemini-2.5-pro',
    messages: [{ role: 'user', content: 'Hi' }],
  });
  assert(geminiReq.url.includes('key=test-key-123'), 'Gemini API key in URL');
  assert(!Object.keys(geminiReq.headers).length, 'Gemini has no special headers');
}

// ── Test 13: Error handling for unknown provider ────────────────────────────
section('Test 13: Error Handling');
{
  try {
    createAdapter('nonexistent', {});
    assert(false, 'Should throw for unknown provider');
  } catch (err) {
    assert(err.message.includes('Unknown provider'), 'Error message mentions unknown provider');
    assert(err.message.includes('kimi'), 'Error lists available providers');
  }

  try {
    const client = createClient('kimi', testConfig);
    client.switchProvider('nonexistent');
    assert(false, 'Should throw when switching to unknown provider');
  } catch (err) {
    assert(err.message.includes('not configured'), 'Error mentions not configured');
  }
}

// ── Test 14: Unified response format ────────────────────────────────────────
section('Test 14: Unified Response Format');
{
  const openai = new OpenAIAdapter(testConfig.providers.openai);
  const resp = openai.fromNativeResponse(
    {
      choices: [{ message: { content: 'Hello!' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    },
    'gpt-4o'
  );

  assertEqual(resp.content, 'Hello!', 'Unified content field');
  assertEqual(resp.model, 'gpt-4o', 'Unified model field');
  assertEqual(resp.finishReason, 'stop', 'Unified finishReason field');
  assertDeep(resp.usage, { inputTokens: 10, outputTokens: 5, totalTokens: 15 }, 'Unified usage object');
  assert(resp.raw, 'Unified response includes raw');
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

if (originalConfig) {
  fs.writeFileSync(CONFIG_PATH, originalConfig);
} else {
  // Restore from test config since we overwrote it
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(testConfig, null, 2));
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(40));
console.log(`📊 Results: ${testsPassed}/${testsRun} passed`);
if (testsFailed > 0) {
  console.log(`❌ ${testsFailed} test(s) failed`);
  process.exitCode = 1;
} else {
  console.log('🎉 All tests passed!');
}
console.log('='.repeat(40));
