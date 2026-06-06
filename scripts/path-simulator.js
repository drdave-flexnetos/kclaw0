#!/usr/bin/env node
/**
 * Path Simulator — KClaw0 Action Simulation System
 *
 * Simulates tool-call outcomes, estimates costs, assesses risk,
 * and predicts terminal states for planned action paths.
 *
 * Storage: memory/plans/simulation-cache.json
 */

const fs = require('fs');
const path = require('path');

const CACHE_PATH = path.resolve(__dirname, '..', 'memory', 'plans', 'simulation-cache.json');

// ── Seeded PRNG (deterministic for testing) ─────────────────────────────────

function seededRandom(seed) {
  let s = seed || 1;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Base Configuration ────────────────────────────────────────────────────────

const ACTION_CONFIG = {
  search: { baseSuccess: 0.92, baseCost: 8000, complexityFactor: 1.0 },
  file_read: { baseSuccess: 0.98, baseCost: 2000, complexityFactor: 0.5 },
  file_write: { baseSuccess: 0.95, baseCost: 3000, complexityFactor: 0.7 },
  file_edit: { baseSuccess: 0.90, baseCost: 4000, complexityFactor: 0.9 },
  exec: { baseSuccess: 0.85, baseCost: 5000, complexityFactor: 1.2 },
  subagent_spawn: { baseSuccess: 0.80, baseCost: 15000, complexityFactor: 1.5 },
  browser: { baseSuccess: 0.88, baseCost: 6000, complexityFactor: 1.1 },
  web_fetch: { baseSuccess: 0.93, baseCost: 3500, complexityFactor: 0.8 },
  message: { baseSuccess: 0.97, baseCost: 2500, complexityFactor: 0.6 },
  default: { baseSuccess: 0.90, baseCost: 4000, complexityFactor: 1.0 },
};

// ── Cost Integration ───────────────────────────────────────────────────────────

function loadCostPricing() {
  try {
    const ct = require('./cost-tracker.js');
    return ct.getPricing ? ct.getPricing('kimi-k2p6') : null;
  } catch {
    return null;
  }
}

function getCostMultiplier() {
  const pricing = loadCostPricing();
  if (!pricing) return 1.0;
  // Average cost per 1M tokens in cents
  const avgPer1M = (pricing.input + pricing.output) / 2;
  return avgPer1M / 2.0; // Normalize against $2.00 baseline
}

// ── Historical Failure Rates (from event-system) ────────────────────────────────

function loadHistoricalFailures() {
  try {
    const es = require('./event-system.js');
    const events = es.query ? es.query({ type: 'tool_error', limit: 200 }) : [];
    const total = es.query ? es.query({ limit: 1000 }).length : 0;
    return total > 0 ? events.length / total : 0.05;
  } catch {
    return 0.05;
  }
}

// ── Simulation Classes ────────────────────────────────────────────────────────

class ActionSimulator {
  constructor(seed = 42) {
    this.rand = seededRandom(seed);
  }

  simulate(action) {
    const type = action.type || 'default';
    const complexity = action.complexity || 1;
    const cfg = ACTION_CONFIG[type] || ACTION_CONFIG.default;

    const successProb = Math.max(0.01, Math.min(0.99,
      cfg.baseSuccess - (complexity - 1) * 0.05
    ));

    const roll = this.rand();
    const success = roll < successProb;

    return {
      type,
      success,
      probability: successProb,
      roll,
      complexity,
    };
  }
}

class CostEstimator {
  estimate(action) {
    const type = action.type || 'default';
    const cfg = ACTION_CONFIG[type] || ACTION_CONFIG.default;
    const multiplier = getCostMultiplier();
    const complexity = action.complexity || 1;

    return {
      type,
      estimatedTokens: Math.round(cfg.baseCost * complexity * multiplier),
      estimatedCostUsd: (cfg.baseCost * complexity * multiplier * 2) / 1e6,
    };
  }
}

class RiskAssessor {
  assess(action) {
    const type = action.type || 'default';
    const cfg = ACTION_CONFIG[type] || ACTION_CONFIG.default;
    const complexity = action.complexity || 1;
    const historicalRate = loadHistoricalFailures();

    const failureProb = Math.min(0.99,
      (1 - cfg.baseSuccess) * cfg.complexityFactor * complexity * 0.5 +
      historicalRate * 0.5
    );

    return {
      type,
      failureProbability: failureProb,
      riskLevel: failureProb < 0.1 ? 'low' : failureProb < 0.3 ? 'medium' : 'high',
    };
  }
}

class OutcomePredictor {
  constructor(seed = 42) {
    this.simulator = new ActionSimulator(seed);
  }

  predict(actions, depth = null) {
    const steps = depth || actions.length;
    let cumulativeSuccess = 1.0;
    const outcomes = [];

    for (let i = 0; i < Math.min(steps, actions.length); i++) {
      const outcome = this.simulator.simulate(actions[i]);
      cumulativeSuccess *= outcome.probability;
      outcomes.push(outcome);
      if (!outcome.success) break;
    }

    return {
      terminalState: outcomes.length === steps && outcomes.every(o => o.success) ? 'success' : 'failure',
      overallSuccessProbability: cumulativeSuccess,
      stepsSimulated: outcomes.length,
      outcomes,
    };
  }
}

class SimulationCache {
  constructor() {
    this.cache = this.load();
  }

  load() {
    if (!fs.existsSync(CACHE_PATH)) return {};
    try {
      return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
    } catch {
      return {};
    }
  }

  save() {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(this.cache, null, 2));
  }

  get(key) {
    return this.cache[key] || null;
  }

  set(key, value) {
    this.cache[key] = { value, timestamp: new Date().toISOString() };
    this.save();
  }

  clear() {
    this.cache = {};
    this.save();
  }
}

// ── Top-Level API ──────────────────────────────────────────────────────────────

const globalCache = new SimulationCache();

function simulateAction(action, seed = 42) {
  const sim = new ActionSimulator(seed);
  return sim.simulate(action);
}

function simulatePath(actions, seed = 42) {
  const sim = new ActionSimulator(seed);
  return actions.map(a => sim.simulate(a));
}

function estimateCost(actions) {
  const est = new CostEstimator();
  const estimates = actions.map(a => est.estimate(a));
  const totalTokens = estimates.reduce((s, e) => s + e.estimatedTokens, 0);
  const totalCost = estimates.reduce((s, e) => s + e.estimatedCostUsd, 0);
  return { perAction: estimates, totalTokens, totalCostUsd: totalCost };
}

function assessRisk(actions) {
  const ra = new RiskAssessor();
  const risks = actions.map(a => ra.assess(a));
  const maxRisk = Math.max(...risks.map(r => r.failureProbability));
  return { perAction: risks, overallRisk: maxRisk };
}

function predictOutcome(actions, depth = null, seed = 42) {
  const pred = new OutcomePredictor(seed);
  return pred.predict(actions, depth);
}

function cacheKey(actions, depth, seed) {
  const hash = JSON.stringify({ actions, depth, seed });
  return `sim-${Buffer.from(hash).toString('base64').substring(0, 32)}`;
}

function cachedPredictOutcome(actions, depth = null, seed = 42) {
  const key = cacheKey(actions, depth, seed);
  const hit = globalCache.get(key);
  if (hit) return { ...hit.value, cached: true };

  const result = predictOutcome(actions, depth, seed);
  globalCache.set(key, result);
  return { ...result, cached: false };
}

function clearCache() {
  globalCache.clear();
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  simulateAction,
  simulatePath,
  estimateCost,
  assessRisk,
  predictOutcome,
  cachedPredictOutcome,
  clearCache,
  ActionSimulator,
  CostEstimator,
  RiskAssessor,
  OutcomePredictor,
  SimulationCache,
  seededRandom,
  ACTION_CONFIG,
};

// ── CLI ───────────────────────────────────────────────────────────────────────

function main() {
  const [cmd, ...args] = process.argv.slice(2);

  if (cmd === 'simulate') {
    const actions = JSON.parse(args[0] || '[]');
    const result = predictOutcome(actions);
    console.log(JSON.stringify(result, null, 2));
  } else if (cmd === 'cost') {
    const actions = JSON.parse(args[0] || '[]');
    console.log(JSON.stringify(estimateCost(actions), null, 2));
  } else if (cmd === 'risk') {
    const actions = JSON.parse(args[0] || '[]');
    console.log(JSON.stringify(assessRisk(actions), null, 2));
  } else if (cmd === 'clear') {
    clearCache();
    console.log('Cache cleared.');
  } else {
    console.log(`Usage: node path-simulator.js [simulate|cost|risk|clear] '[{"type":"search"}]'`);
  }
}

if (require.main === module) {
  main();
}
