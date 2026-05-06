#!/usr/bin/env node
/**
 * Cost Tracker — KClaw0 Type B (Skill) Upgrade
 *
 * Records, summarizes, and reports API token costs across sessions.
 * Storage: NDJSON line-stream to `memory/cost-log.ndjson`
 *
 * Pricing (per 1M tokens):
 *   kimi-k2p6: input $1.00, output $3.00
 *   kimi-k2p5: input $0.50, output $1.50
 *   fallback:  input $1.00, output $3.00
 */

const fs = require('fs');
const path = require('path');

// ── Configuration ────────────────────────────────────────────────────────────

const LOG_PATH = path.resolve(__dirname, '..', 'memory', 'cost-log.ndjson');

const PRICING = {
  'kimi-k2p6': { input: 1.00, output: 3.00 },
  'kimi-k2p5': { input: 0.50, output: 1.50 },
};

const DEFAULT_PRICING = { input: 1.00, output: 3.00 };
const BUDGET_WARN_PCT = 0.80; // warn at 80 % of budget
const BUDGET_DANGER_PCT = 0.95; // danger at 95 % of budget

// ── Helpers ──────────────────────────────────────────────────────────────────

function getPricing(model) {
  return PRICING[model] || DEFAULT_PRICING;
}

function ensureLogDir() {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readLines() {
  if (!fs.existsSync(LOG_PATH)) return [];
  return fs
    .readFileSync(LOG_PATH, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function appendLine(record) {
  ensureLogDir();
  fs.appendFileSync(LOG_PATH, JSON.stringify(record) + '\n', 'utf-8');
}

function formatCurrency(n) {
  return `$${n.toFixed(6)}`;
}

function formatTokens(n) {
  return n.toLocaleString();
}

// ── Core API ───────────────────────────────────────────────────────────────

function record(request) {
  if (!request || typeof request !== 'object') {
    throw new TypeError('record() expects an object');
  }
  const {
    sessionId = 'unknown',
    turnIndex = 0,
    model = 'kimi-k2p6',
    inputTokens = 0,
    outputTokens = 0,
    task = 'general',
  } = request;

  const price = getPricing(model);
  const inputCost = (inputTokens * price.input) / 1e6;
  const outputCost = (outputTokens * price.output) / 1e6;
  const totalCost = inputCost + outputCost;

  const entry = {
    timestamp: new Date().toISOString(),
    sessionId,
    turnIndex,
    model,
    inputTokens,
    outputTokens,
    inputCost,
    outputCost,
    totalCost,
    task,
  };

  appendLine(entry);
  return entry;
}

function sessionSummary(sessionId) {
  const lines = readLines();
  const relevant = sessionId
    ? lines.filter((l) => l.sessionId === sessionId)
    : lines;

  if (relevant.length === 0) {
    return null;
  }

  const totalInput = relevant.reduce((s, l) => s + (l.inputTokens || 0), 0);
  const totalOutput = relevant.reduce((s, l) => s + (l.outputTokens || 0), 0);
  const totalCost = relevant.reduce((s, l) => s + (l.totalCost || 0), 0);
  const models = [...new Set(relevant.map((l) => l.model))];

  return {
    sessionId: sessionId || 'all-sessions',
    requests: relevant.length,
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    totalTokens: totalInput + totalOutput,
    totalCost,
    models,
    entries: relevant,
  };
}

function totalCost() {
  const lines = readLines();
  return lines.reduce((s, l) => s + (l.totalCost || 0), 0);
}

function budgetCheck(budgetUsd) {
  const spent = totalCost();
  const pct = budgetUsd > 0 ? spent / budgetUsd : 0;

  let status = 'safe';
  if (pct >= BUDGET_DANGER_PCT) status = 'danger';
  else if (pct >= BUDGET_WARN_PCT) status = 'warn';

  return {
    budget: budgetUsd,
    spent,
    remaining: Math.max(0, budgetUsd - spent),
    pct,
    status,
    message:
      status === 'safe'
        ? `Healthy: ${(pct * 100).toFixed(1)} % used`
        : status === 'warn'
        ? `Warning: ${(pct * 100).toFixed(1)} % used`
        : `CRITICAL: ${(pct * 100).toFixed(1)} % used`,
  };
}

function exportReport(format = 'json') {
  const lines = readLines();
  const total = totalCost();
  const sessions = {};
  for (const line of lines) {
    const sid = line.sessionId || 'unknown';
    if (!sessions[sid]) {
      sessions[sid] = {
        sessionId: sid,
        requests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
        models: new Set(),
      };
    }
    const s = sessions[sid];
    s.requests++;
    s.totalInputTokens += line.inputTokens || 0;
    s.totalOutputTokens += line.outputTokens || 0;
    s.totalCost += line.totalCost || 0;
    s.models.add(line.model);
  }

  // convert sets to arrays
  for (const s of Object.values(sessions)) {
    s.models = [...s.models];
  }

  const report = {
    generatedAt: new Date().toISOString(),
    cumulativeCost: total,
    totalRequests: lines.length,
    sessions: Object.values(sessions),
    entries: lines,
  };

  if (format === 'json') {
    return JSON.stringify(report, null, 2);
  }

  if (format === 'csv') {
    const header =
      'timestamp,sessionId,turnIndex,model,inputTokens,outputTokens,inputCost,outputCost,totalCost,task';
    const rows = lines.map((l) =>
      [
        l.timestamp,
        l.sessionId,
        l.turnIndex,
        l.model,
        l.inputTokens,
        l.outputTokens,
        l.inputCost?.toFixed(6),
        l.outputCost?.toFixed(6),
        l.totalCost?.toFixed(6),
        l.task,
      ].join(',')
    );
    return [header, ...rows].join('\n');
  }

  if (format === 'md') {
    const md = [
      '# Cost Report',
      `Generated: ${report.generatedAt}`,
      ``,
      `## Summary`,
      `- **Cumulative Cost:** ${formatCurrency(total)}`,
      `- **Total Requests:** ${report.totalRequests}`,
      `- **Sessions:** ${Object.keys(sessions).length}`,
      ``,
      `## Sessions`,
      ...Object.values(sessions).flatMap((s) => [
        `### ${s.sessionId}`,
        `- Requests: ${s.requests}`,
        `- Input Tokens: ${formatTokens(s.totalInputTokens)}`,
        `- Output Tokens: ${formatTokens(s.totalOutputTokens)}`,
        `- Total Tokens: ${formatTokens(s.totalInputTokens + s.totalOutputTokens)}`,
        `- Cost: ${formatCurrency(s.totalCost)}`,
        `- Models: ${s.models.join(', ')}`,
      ]),
    ];
    return md.join('\n');
  }

  throw new TypeError(`Unsupported export format: ${format}. Use json, csv, or md.`);
}

function reset() {
  if (!fs.existsSync(LOG_PATH)) return false;
  fs.unlinkSync(LOG_PATH);
  return true;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
Usage: node cost-tracker.js <command> [args]

Commands:
  record <inputTokens> <outputTokens> [model] [sessionId] [task]
                        Log a single API call
  summary [sessionId]   Show session summary (default: all)
  total                 Show cumulative cost across all sessions
  budget <usd>          Check budget status
  report [format]       Export report (json | csv | md)
  reset                 Clear the cost log (destructive!)
  help                  Show this message
`);
}

function cliRecord(args) {
  const [input, output, model = 'kimi-k2p6', sessionId = 'cli', task = 'cli'] = args;
  const inputTokens = parseInt(input, 10);
  const outputTokens = parseInt(output, 10);
  if (isNaN(inputTokens) || isNaN(outputTokens)) {
    console.error('Error: inputTokens and outputTokens must be integers');
    process.exit(1);
  }
  const entry = record({ sessionId, model, inputTokens, outputTokens, task });
  console.log(
    `Recorded: ${entry.inputTokens} in / ${entry.outputTokens} out → ${formatCurrency(
      entry.totalCost
    )}`
  );
}

function cliSummary(args) {
  const [sessionId] = args;
  const summary = sessionSummary(sessionId);
  if (!summary) {
    console.log('No records found.');
    return;
  }
  console.log(`Session: ${summary.sessionId}`);
  console.log(`Requests: ${summary.requests}`);
  console.log(`Input Tokens: ${formatTokens(summary.totalInputTokens)}`);
  console.log(`Output Tokens: ${formatTokens(summary.totalOutputTokens)}`);
  console.log(`Total Tokens: ${formatTokens(summary.totalTokens)}`);
  console.log(`Total Cost: ${formatCurrency(summary.totalCost)}`);
  console.log(`Models: ${summary.models.join(', ')}`);
}

function cliTotal() {
  const total = totalCost();
  console.log(`Cumulative Cost: ${formatCurrency(total)}`);
}

function cliBudget(args) {
  const [usd] = args;
  const budget = parseFloat(usd);
  if (isNaN(budget) || budget < 0) {
    console.error('Error: budget must be a positive number');
    process.exit(1);
  }
  const check = budgetCheck(budget);
  console.log(`Budget:    ${formatCurrency(check.budget)}`);
  console.log(`Spent:     ${formatCurrency(check.spent)}`);
  console.log(`Remaining: ${formatCurrency(check.remaining)}`);
  console.log(`Usage:     ${(check.pct * 100).toFixed(1)} %`);
  console.log(`Status:    ${check.status.toUpperCase()} — ${check.message}`);
}

function cliReport(args) {
  const [format = 'json'] = args;
  try {
    const report = exportReport(format);
    console.log(report);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

function cliReset() {
  if (reset()) {
    console.log('Cost log cleared.');
  } else {
    console.log('No cost log to clear.');
  }
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case 'record':
      cliRecord(rest);
      break;
    case 'summary':
      cliSummary(rest);
      break;
    case 'total':
      cliTotal();
      break;
    case 'budget':
      cliBudget(rest);
      break;
    case 'report':
      cliReport(rest);
      break;
    case 'reset':
      cliReset();
      break;
    case 'help':
    default:
      printHelp();
      if (cmd && cmd !== 'help') {
        console.error(`Unknown command: ${cmd}`);
        process.exit(1);
      }
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  record,
  sessionSummary,
  totalCost,
  budgetCheck,
  exportReport,
  reset,
  getPricing,
};

// If executed directly, run CLI
if (require.main === module) {
  main();
}
