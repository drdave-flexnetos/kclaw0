#!/usr/bin/env node
/**
 * KClaw0 Survival System — Budget / Lifecycle Enforcement
 * Type C (Agent Loop) Upgrade — P3
 *
 * Self-preserving resource management inspired by Conway Automaton patterns:
 * The agent monitors its own "metabolic cost" and proactively downgrades
 * capabilities when budget pressure rises — just as a living organism
 * conserves energy when resources are scarce.
 *
 * Tiers:
 *   normal      — Full features: subagents, writes, execs, all tools
 *   conservative — Disable subagents, reduce LLM calls, prefer caching
 *   emergency   — Read-only: no writes, no execs, no subagents, observation only
 *
 * Usage:
 *   node scripts/survival.js [command]
 *
 * Commands:
 *   check              — Run budget check and tier decision
 *   enforce            — Enforce current tier constraints
 *   report             — Print survival report
 *   set-budget <d> <m> — Set daily and monthly budget (USD)
 *   set-tier <tier>    — Force tier: normal|conservative|emergency
 *   get-tier           — Show current tier
 *
 * API (programmatic):
 *   const survival = require('./scripts/survival.js');
 *   survival.setBudget(50, 500);        // $50/day, $500/month
 *   survival.check();                   // { status, tier, actions }
 *   survival.enforce();                 // Apply tier constraints
 *   survival.report();                    // Full report object
 *   survival.alertOnThreshold(10, fn);  // Alert when daily > $10
 *   survival.getTier();                  // 'normal' | 'conservative' | 'emergency'
 *   survival.setTier('conservative');   // Manual override
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

const WORKSPACE = process.cwd();
const STATE_PATH = process.env.KCLAW0_SURVIVAL_STATE
  || path.join(WORKSPACE, 'memory', 'survival-state.json');
const COST_LOG_PATH = path.join(WORKSPACE, 'memory', 'cost-log.ndjson');

const TIER_ORDER = ['normal', 'conservative', 'emergency'];
const TIER_DESCEND = {
  normal: 'conservative',
  conservative: 'emergency',
  emergency: 'emergency',
};

/**
 * Budget thresholds (percentage of budget consumed) that trigger tier shifts.
 * Inspired by Conway Automaton survival patterns: gradual degradation
 * preserves the agent's core functions rather than abrupt shutdown.
 */
const THRESHOLDS = {
  warning: 0.70,   // 70% consumed → start conserving
  critical: 0.90,  // 90% consumed → emergency mode
  danger: 0.98,   // 98% consumed → hard stop, read-only
};

// ============================================================================
// State Management
// ============================================================================

let _state = null;
let _costTracker = null;
let _eventSystem = null;
let _alerts = [];

/**
 * Lazy-load cost-tracker module (graceful if not installed)
 */
function getCostTracker() {
  if (_costTracker) return _costTracker;
  try {
    _costTracker = require(path.join(WORKSPACE, 'scripts', 'cost-tracker.js'));
  } catch (err) {
    // Cost-tracker not available — use direct file reading
    _costTracker = null;
  }
  return _costTracker;
}

/**
 * Lazy-load event-system module (graceful if not installed)
 */
function getEventSystem() {
  if (_eventSystem) return _eventSystem;
  try {
    _eventSystem = require(path.join(WORKSPACE, 'scripts', 'event-system.js'));
  } catch (err) {
    _eventSystem = null;
  }
  return _eventSystem;
}

/**
 * Emit a survival event via event-system (if available)
 */
function emitSurvivalEvent(eventType, data = {}, severity = 'info') {
  const events = getEventSystem();
  if (events && typeof events.emit === 'function') {
    try {
      events.emit(eventType, data, { severity, source: 'survival-system' });
    } catch (err) {
      // Event system failure is non-fatal for survival
    }
  }
}

/**
 * Load survival state from disk (or create default)
 */
function loadState() {
  if (_state) return _state;

  if (fs.existsSync(STATE_PATH)) {
    try {
      _state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
      // Validate and repair if needed
      if (!_state.budget) _state.budget = { dailyUsd: 0, monthlyUsd: 0 };
      if (!TIER_ORDER.includes(_state.currentTier)) _state.currentTier = 'normal';
      if (!_state.alerts) _state.alerts = [];
    } catch (err) {
      _state = createDefaultState();
    }
  } else {
    _state = createDefaultState();
  }

  return _state;
}

/**
 * Create default state
 */
function createDefaultState() {
  return {
    budget: { dailyUsd: 0, monthlyUsd: 0 },
    currentTier: 'normal',
    lastCheck: null,
    alerts: [],
    history: [],
    createdAt: new Date().toISOString(),
  };
}

/**
 * Persist state to disk
 */
function saveState() {
  const state = loadState();
  const dir = path.dirname(STATE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

/**
 * Reset state (for testing)
 */
function resetState() {
  _state = null;
  _alerts = [];
  if (fs.existsSync(STATE_PATH)) {
    fs.unlinkSync(STATE_PATH);
  }
}

// ============================================================================
// Cost Reading (with fallback to direct file reading)
// ============================================================================

/**
 * Read cost entries directly from NDJSON log.
 * Used when cost-tracker module is unavailable or for testing.
 */
function readCostLog() {
  if (!fs.existsSync(COST_LOG_PATH)) return [];
  return fs
    .readFileSync(COST_LOG_PATH, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}

/**
 * Get total cost across all time (uses cost-tracker if available)
 */
function getTotalCost() {
  const ct = getCostTracker();
  if (ct && typeof ct.totalCost === 'function') {
    return ct.totalCost();
  }
  const lines = readCostLog();
  return lines.reduce((sum, l) => sum + (l.totalCost || 0), 0);
}

/**
 * Get cost for a specific day (YYYY-MM-DD)
 */
function getDailyCost(dateStr) {
  const lines = readCostLog();
  const targetPrefix = dateStr || new Date().toISOString().substring(0, 10);
  return lines
    .filter((l) => l.timestamp && l.timestamp.startsWith(targetPrefix))
    .reduce((sum, l) => sum + (l.totalCost || 0), 0);
}

/**
 * Get cost for current month (YYYY-MM)
 */
function getMonthlyCost() {
  const lines = readCostLog();
  const targetPrefix = new Date().toISOString().substring(0, 7);
  return lines
    .filter((l) => l.timestamp && l.timestamp.startsWith(targetPrefix))
    .reduce((sum, l) => sum + (l.totalCost || 0), 0);
}

/**
 * Get cost for a rolling window (last N days)
 */
function getRollingCost(days) {
  const lines = readCostLog();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return lines
    .filter((l) => l.timestamp && new Date(l.timestamp) >= cutoff)
    .reduce((sum, l) => sum + (l.totalCost || 0), 0);
}

// ============================================================================
// Budget API
// ============================================================================

/**
 * Set budget limits.
 * @param {number} dailyUsd   — Daily budget in USD (0 = unlimited)
 * @param {number} monthlyUsd — Monthly budget in USD (0 = unlimited)
 */
function setBudget(dailyUsd, monthlyUsd) {
  const state = loadState();
  state.budget.dailyUsd = typeof dailyUsd === 'number' ? dailyUsd : 0;
  state.budget.monthlyUsd = typeof monthlyUsd === 'number' ? monthlyUsd : 0;
  state.budget.updatedAt = new Date().toISOString();
  saveState();

  emitSurvivalEvent('budget_set', {
    dailyUsd: state.budget.dailyUsd,
    monthlyUsd: state.budget.monthlyUsd,
  }, 'info');

  return state.budget;
}

/**
 * Check budget status against current spending.
 * Returns: { status, dailyPct, monthlyPct, dailyCost, monthlyCost, totalCost, tier }
 */
function checkBudget() {
  const state = loadState();
  const dailyCost = getDailyCost();
  const monthlyCost = getMonthlyCost();
  const totalCost = getTotalCost();
  const { dailyUsd, monthlyUsd } = state.budget;

  const dailyPct = dailyUsd > 0 ? dailyCost / dailyUsd : 0;
  const monthlyPct = monthlyUsd > 0 ? monthlyCost / monthlyUsd : 0;
  const maxPct = Math.max(dailyPct, monthlyPct);

  let status = 'safe';
  if (maxPct >= THRESHOLDS.danger) status = 'critical';
  else if (maxPct >= THRESHOLDS.critical) status = 'critical';
  else if (maxPct >= THRESHOLDS.warning) status = 'warning';

  // Determine recommended tier based on budget pressure
  let recommendedTier = 'normal';
  if (maxPct >= THRESHOLDS.danger) recommendedTier = 'emergency';
  else if (maxPct >= THRESHOLDS.critical) recommendedTier = 'emergency';
  else if (maxPct >= THRESHOLDS.warning) recommendedTier = 'conservative';

  return {
    status,
    dailyCost,
    monthlyCost,
    totalCost,
    dailyUsd,
    monthlyUsd,
    dailyPct,
    monthlyPct,
    maxPct,
    recommendedTier,
    currentTier: state.currentTier,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// Tier Management
// ============================================================================

/**
 * Get current tier.
 */
function getTier() {
  return loadState().currentTier;
}

/**
 * Set tier manually (override automatic decisions).
 * @param {string} tier — 'normal' | 'conservative' | 'emergency'
 */
function setTier(tier) {
  if (!TIER_ORDER.includes(tier)) {
    throw new Error(`Invalid tier: ${tier}. Must be one of: ${TIER_ORDER.join(', ')}`);
  }
  const state = loadState();
  const oldTier = state.currentTier;
  state.currentTier = tier;
  state.lastCheck = new Date().toISOString();

  // Record tier change in history
  state.history.push({
    from: oldTier,
    to: tier,
    reason: 'manual_override',
    timestamp: new Date().toISOString(),
  });

  saveState();

  emitSurvivalEvent('tier_changed', {
    from: oldTier,
    to: tier,
    reason: 'manual_override',
  }, tier === 'emergency' ? 'critical' : tier === 'conservative' ? 'warning' : 'info');

  return tier;
}

/**
 * Check if a feature is enabled under current tier.
 * Features: 'subagents', 'memory_write', 'file_write', 'exec', 'llm_call'
 */
function isFeatureEnabled(feature) {
  const tier = getTier();
  const capabilities = {
    normal:      ['subagents', 'memory_write', 'file_write', 'exec', 'llm_call', 'web_search', 'browser'],
    conservative: ['memory_write', 'file_write', 'llm_call', 'web_search', 'browser'],
    emergency:    [], // Read-only: nothing enabled
  };
  return capabilities[tier].includes(feature);
}

/**
 * Get full capability map for current tier.
 */
function getCapabilityMap() {
  const tier = getTier();
  const allFeatures = ['subagents', 'memory_write', 'file_write', 'exec', 'llm_call', 'web_search', 'browser'];
  const map = {};
  for (const f of allFeatures) {
    map[f] = isFeatureEnabled(f);
  }
  return { tier, capabilities: map };
}

// ============================================================================
// Alert System
// ============================================================================

/**
 * Register an alert callback that fires when cost exceeds a threshold.
 * @param {number} thresholdUsd — Cost threshold in USD
 * @param {Function} callback   — (alert) => void, where alert = { threshold, currentCost, exceeded }
 * @param {string} scope        — 'daily' | 'monthly' | 'total' (default: 'daily')
 */
function alertOnThreshold(thresholdUsd, callback, scope = 'daily') {
  if (typeof thresholdUsd !== 'number' || thresholdUsd <= 0) {
    throw new Error('thresholdUsd must be a positive number');
  }
  if (typeof callback !== 'function') {
    throw new Error('callback must be a function');
  }
  if (!['daily', 'monthly', 'total'].includes(scope)) {
    throw new Error(`Invalid scope: ${scope}. Must be daily, monthly, or total`);
  }

  const alert = {
    id: `alert-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    thresholdUsd,
    callback,
    scope,
    triggered: false,
    createdAt: new Date().toISOString(),
  };

  _alerts.push(alert);
  return alert.id;
}

/**
 * Remove an alert by ID.
 */
function removeAlert(alertId) {
  const before = _alerts.length;
  _alerts = _alerts.filter((a) => a.id !== alertId);
  return _alerts.length < before;
}

/**
 * Evaluate all registered alerts and trigger callbacks.
 */
function evaluateAlerts() {
  const dailyCost = getDailyCost();
  const monthlyCost = getMonthlyCost();
  const totalCost = getTotalCost();

  const triggered = [];
  for (const alert of _alerts) {
    let currentCost;
    switch (alert.scope) {
      case 'daily': currentCost = dailyCost; break;
      case 'monthly': currentCost = monthlyCost; break;
      case 'total': currentCost = totalCost; break;
      default: currentCost = dailyCost;
    }

    const exceeded = currentCost >= alert.thresholdUsd;

    if (exceeded && !alert.triggered) {
      // Just crossed threshold — fire callback
      alert.triggered = true;
      try {
        alert.callback({
          id: alert.id,
          thresholdUsd: alert.thresholdUsd,
          currentCost,
          exceeded: true,
          scope: alert.scope,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        // Alert callback errors are non-fatal
      }
      triggered.push(alert.id);
      emitSurvivalEvent('alert_triggered', {
        alertId: alert.id,
        threshold: alert.thresholdUsd,
        currentCost,
        scope: alert.scope,
      }, 'warning');
    } else if (!exceeded && alert.triggered) {
      // Fell back below threshold — reset
      alert.triggered = false;
    }
  }

  return triggered;
}

/**
 * List all registered alerts.
 */
function listAlerts() {
  return _alerts.map((a) => ({
    id: a.id,
    thresholdUsd: a.thresholdUsd,
    scope: a.scope,
    triggered: a.triggered,
    createdAt: a.createdAt,
  }));
}

// ============================================================================
// Main API: check, enforce, report
// ============================================================================

/**
 * Check budget status and decide if tier change is needed.
 * Returns full status object with recommended actions.
 */
function check() {
  const budget = checkBudget();
  const state = loadState();

  // Evaluate alerts
  const triggeredAlerts = evaluateAlerts();

  // Determine if tier should change
  let tierAction = 'none';
  let newTier = state.currentTier;

  if (budget.status === 'critical' && state.currentTier !== 'emergency') {
    tierAction = 'downgrade';
    newTier = 'emergency';
  } else if (budget.status === 'warning' && state.currentTier === 'normal') {
    tierAction = 'downgrade';
    newTier = 'conservative';
  } else if (budget.status === 'safe' && state.currentTier !== 'normal') {
    // Recovery path: if safe and was in conservative, can go back to normal
    // But NOT from emergency to normal directly (requires manual override)
    if (state.currentTier === 'conservative') {
      tierAction = 'upgrade';
      newTier = 'normal';
    }
  }

  // Auto-apply tier change if needed
  if (tierAction !== 'none' && newTier !== state.currentTier) {
    const oldTier = state.currentTier;
    state.currentTier = newTier;
    state.lastCheck = new Date().toISOString();
    state.history.push({
      from: oldTier,
      to: newTier,
      reason: `budget_${budget.status}`,
      timestamp: new Date().toISOString(),
    });
    saveState();

    emitSurvivalEvent('tier_auto_changed', {
      from: oldTier,
      to: newTier,
      reason: `budget_${budget.status}`,
      dailyCost: budget.dailyCost,
      monthlyCost: budget.monthlyCost,
    }, newTier === 'emergency' ? 'critical' : 'warning');
  }

  state.lastCheck = new Date().toISOString();
  saveState();

  return {
    ...budget,
    tierAction,
    triggeredAlerts,
    capabilities: getCapabilityMap(),
    actions: generateActions(budget.status, newTier),
  };
}

/**
 * Generate recommended actions based on status and tier.
 */
function generateActions(status, tier) {
  const actions = [];

  if (status === 'critical') {
    actions.push('🔒 EMERGENCY: All write/exec/subagent operations disabled');
    actions.push('📊 Switch to observation-only mode');
    actions.push('⏸️ Pause non-essential tasks');
    actions.push('📝 Log all activity for review');
  } else if (status === 'warning') {
    actions.push('⚠️ CONSERVATIVE: Subagent spawning disabled');
    actions.push('💾 Prefer cached responses over fresh LLM calls');
    actions.push('🎯 Focus on highest-priority tasks only');
    actions.push('📉 Reduce token usage (shorter prompts, less verbose output)');
  } else {
    actions.push('✅ Normal operations — all features enabled');
    actions.push('💡 Consider proactive cost optimization');
  }

  if (tier === 'emergency') {
    actions.push('🚨 Emergency tier active — manual override required to restore');
  }

  return actions;
}

/**
 * Enforce current tier constraints.
 * Returns the enforcement result with what was blocked/allowed.
 */
function enforce() {
  const tier = getTier();
  const capabilities = getCapabilityMap();

  const blocked = [];
  const allowed = [];

  for (const [feature, enabled] of Object.entries(capabilities.capabilities)) {
    if (enabled) {
      allowed.push(feature);
    } else {
      blocked.push(feature);
    }
  }

  emitSurvivalEvent('survival_enforce', {
    tier,
    blocked,
    allowed,
  }, tier === 'emergency' ? 'critical' : tier === 'conservative' ? 'warning' : 'info');

  return {
    tier,
    blocked,
    allowed,
    canSpawnSubagents: isFeatureEnabled('subagents'),
    canWriteMemory: isFeatureEnabled('memory_write'),
    canWriteFiles: isFeatureEnabled('file_write'),
    canExecute: isFeatureEnabled('exec'),
    canCallLLM: isFeatureEnabled('llm_call'),
    canBrowse: isFeatureEnabled('browser'),
    canSearchWeb: isFeatureEnabled('web_search'),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generate comprehensive survival report.
 */
function report() {
  const state = loadState();
  const budget = checkBudget();
  const capabilities = getCapabilityMap();
  const alerts = listAlerts();

  return {
    generatedAt: new Date().toISOString(),
    budget: {
      daily: { limit: state.budget.dailyUsd, spent: budget.dailyCost, remaining: Math.max(0, state.budget.dailyUsd - budget.dailyCost) },
      monthly: { limit: state.budget.monthlyUsd, spent: budget.monthlyCost, remaining: Math.max(0, state.budget.monthlyUsd - budget.monthlyCost) },
      totalSpent: budget.totalCost,
    },
    tier: {
      current: state.currentTier,
      lastCheck: state.lastCheck,
      history: state.history.slice(-10), // last 10 changes
    },
    capabilities: capabilities.capabilities,
    alerts: {
      count: alerts.length,
      triggered: alerts.filter((a) => a.triggered).length,
      list: alerts,
    },
    status: budget.status,
    recommendations: generateActions(budget.status, state.currentTier),
    conwayReference: 'Agent self-preservation: gradual degradation preserves core functions',
  };
}

// ============================================================================
// CLI
// ============================================================================

function printHelp() {
  console.log(`
Usage: node survival.js <command> [args]

Commands:
  check                          Run budget check and tier decision
  enforce                        Enforce current tier constraints
  report                         Print survival report
  set-budget <daily> <monthly>   Set budget limits in USD
  set-tier <tier>                Force tier: normal|conservative|emergency
  get-tier                       Show current tier
  alert <threshold> [scope]      Register an alert (scope: daily|monthly|total)
  list-alerts                    List registered alerts
  help                           Show this message

Examples:
  node survival.js set-budget 50 500
  node survival.js check
  node survival.js set-tier conservative
  node survival.js alert 10 daily
`);
}

function main() {
  const [cmd, ...args] = process.argv.slice(2);

  switch (cmd) {
    case 'check': {
      const result = check();
      console.log(`\n🛡️  Survival Check`);
      console.log(`   Status: ${result.status.toUpperCase()}`);
      console.log(`   Tier: ${result.currentTier} → ${result.recommendedTier} (${result.tierAction})`);
      console.log(`   Daily: $${result.dailyCost.toFixed(4)} / $${result.dailyUsd.toFixed(2)} (${(result.dailyPct * 100).toFixed(1)}%)`);
      console.log(`   Monthly: $${result.monthlyCost.toFixed(4)} / $${result.monthlyUsd.toFixed(2)} (${(result.monthlyPct * 100).toFixed(1)}%)`);
      console.log(`   Total spent: $${result.totalCost.toFixed(4)}`);
      console.log(`   Alerts triggered: ${result.triggeredAlerts.length}`);
      console.log(`\n   Actions:`);
      for (const action of result.actions) {
        console.log(`   ${action}`);
      }
      break;
    }

    case 'enforce': {
      const result = enforce();
      console.log(`\n🔒 Tier Enforcement: ${result.tier.toUpperCase()}`);
      console.log(`   Allowed: ${result.allowed.join(', ') || 'none'}`);
      console.log(`   Blocked: ${result.blocked.join(', ') || 'none'}`);
      break;
    }

    case 'report': {
      const r = report();
      console.log(`\n📊 Survival Report (${r.generatedAt})`);
      console.log(`   Budget: $${r.budget.daily.spent.toFixed(4)}/$${r.budget.daily.limit.toFixed(2)} daily, $${r.budget.monthly.spent.toFixed(4)}/$${r.budget.monthly.limit.toFixed(2)} monthly`);
      console.log(`   Tier: ${r.tier.current} (last check: ${r.tier.lastCheck || 'never'})`);
      console.log(`   Status: ${r.status.toUpperCase()}`);
      console.log(`   Alerts: ${r.alerts.triggered}/${r.alerts.count} triggered`);
      console.log(`\n   Recommendations:`);
      for (const rec of r.recommendations) {
        console.log(`   ${rec}`);
      }
      break;
    }

    case 'set-budget': {
      const [daily, monthly] = args.map((a) => parseFloat(a));
      if (isNaN(daily) || isNaN(monthly)) {
        console.error('Error: daily and monthly must be numbers');
        process.exit(1);
      }
      setBudget(daily, monthly);
      console.log(`Budget set: $${daily.toFixed(2)}/day, $${monthly.toFixed(2)}/month`);
      break;
    }

    case 'set-tier': {
      const [tier] = args;
      if (!tier) {
        console.error('Error: tier required (normal|conservative|emergency)');
        process.exit(1);
      }
      setTier(tier);
      console.log(`Tier set to: ${tier}`);
      break;
    }

    case 'get-tier': {
      console.log(getTier());
      break;
    }

    case 'alert': {
      const [threshold, scope = 'daily'] = args;
      const t = parseFloat(threshold);
      if (isNaN(t) || t <= 0) {
        console.error('Error: threshold must be a positive number');
        process.exit(1);
      }
      const id = alertOnThreshold(t, (alert) => {
        console.log(`🔔 ALERT: ${alert.scope} cost $${alert.currentCost.toFixed(4)} exceeded threshold $${alert.thresholdUsd.toFixed(2)}`);
      }, scope);
      console.log(`Alert registered: ${id} (threshold: $${t}, scope: ${scope})`);
      break;
    }

    case 'list-alerts': {
      const alerts = listAlerts();
      console.log(`\n📋 Alerts (${alerts.length} registered)`);
      for (const a of alerts) {
        console.log(`   ${a.id}: $${a.thresholdUsd} [${a.scope}] — ${a.triggered ? 'TRIGGERED' : 'pending'}`);
      }
      break;
    }

    case 'help':
    default:
      printHelp();
      if (cmd && cmd !== 'help') {
        console.error(`\nUnknown command: ${cmd}`);
        process.exit(1);
      }
  }
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  setBudget,
  checkBudget,
  alertOnThreshold,
  removeAlert,
  listAlerts,
  evaluateAlerts,
  getTier,
  setTier,
  isFeatureEnabled,
  getCapabilityMap,
  check,
  enforce,
  report,
  // Internal (for testing)
  _loadState: loadState,
  _saveState: saveState,
  _resetState: resetState,
  _readCostLog: readCostLog,
  _getDailyCost: getDailyCost,
  _getMonthlyCost: getMonthlyCost,
  _emitSurvivalEvent: emitSurvivalEvent,
  _setCostTracker: (ct) => { _costTracker = ct; },
  _setEventSystem: (es) => { _eventSystem = es; },
  _getAlerts: () => _alerts,
  _clearAlerts: () => { _alerts = []; },
  THRESHOLDS,
  TIER_ORDER,
};

if (require.main === module) {
  main();
}
