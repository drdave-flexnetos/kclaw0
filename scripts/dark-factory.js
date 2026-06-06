#!/usr/bin/env node
/**
 * Dark Factory Governance Engine
 * Core enforcement system for autonomous agent governance.
 *
 * Checks: immutability → budget → state machine → holdout
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MEMORY_DIR = path.join(__dirname, '..', 'memory');
const STATE_FILE = path.join(MEMORY_DIR, 'factory-state.json');

const GOVERNANCE_FILES = {
  mission: path.join(MEMORY_DIR, 'MISSION.md'),
  rules: path.join(MEMORY_DIR, 'FACTORY_RULES.md'),
  style: path.join(MEMORY_DIR, 'CLAUDE.md'),
};

function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

let state = {};
function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  }
  return state;
}

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function loadGovernance() {
  const result = {};
  for (const [key, filepath] of Object.entries(GOVERNANCE_FILES)) {
    const content = fs.readFileSync(filepath, 'utf8');
    result[key] = {
      content,
      hash: hashContent(content),
    };
  }
  return result;
}

function verifyImmutability(initialHashes) {
  const changed = [];
  for (const [key, filepath] of Object.entries(GOVERNANCE_FILES)) {
    const currentContent = fs.readFileSync(filepath, 'utf8');
    const currentHash = hashContent(currentContent);
    if (currentHash !== initialHashes[key]) {
      changed.push(path.basename(filepath));
    }
  }
  return {
    passed: changed.length === 0,
    changed,
  };
}

function enforceBudget(usedTokens, maxTokens, usedUsd, maxUsd) {
  if (usedTokens > maxTokens) {
    return {
      allowed: false,
      reason: `Budget cap exceeded: ${usedTokens} tokens used of ${maxTokens} max`,
    };
  }
  if (usedUsd > maxUsd) {
    return {
      allowed: false,
      reason: `Budget cap exceeded: $${usedUsd.toFixed(4)} used of $${maxUsd.toFixed(4)} max`,
    };
  }
  return { allowed: true, reason: 'Budget within limits' };
}

function validateHoldout(issueDescription, implementationSummary) {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'to', 'and', 'of', 'for', 'in', 'on', 'at', 'with',
    'as', 'by', 'from', 'this', 'that', 'it', 'be', 'or', 'are', 'was', 'were',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'can', 'shall',
  ]);

  const issueWords = issueDescription.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !stopWords.has(w));
  const implText = implementationSummary.toLowerCase();

  let overlap = 0;
  const concerns = [];

  for (const word of issueWords) {
    if (implText.includes(word)) {
      overlap++;
    } else {
      concerns.push(`Missing keyword: ${word}`);
    }
  }

  const coverage = issueWords.length > 0 ? overlap / issueWords.length : 0;
  const passed = coverage >= 0.5;

  return {
    passed,
    concerns: passed ? [] : concerns.slice(0, 5),
    validator: 'dark-factory',
    coverage: Math.round(coverage * 100) / 100,
  };
}

function getStateMachine(labels) {
  const labelSet = new Set(labels.map(l => l.toLowerCase()));

  if (labelSet.has('blocked')) {
    return { state: 'blocked', confidence: 1.0 };
  }
  if (labelSet.has('holdout')) {
    return { state: 'holdout', confidence: 0.9 };
  }
  if (labelSet.has('needs-review')) {
    return { state: 'needs-review', confidence: 0.8 };
  }
  if (labelSet.has('verified')) {
    return { state: 'verified', confidence: 0.95 };
  }
  if (labelSet.has('auto')) {
    return { state: 'auto', confidence: 0.7 };
  }
  return { state: 'auto', confidence: 0.5 };
}

function transitionState(currentLabels, action, outcome) {
  const labels = new Set(currentLabels.map(l => l.toLowerCase()));

  switch (action) {
    case 'start':
      if (outcome === 'holdout') {
        labels.add('holdout');
      } else {
        labels.add('auto');
      }
      break;
    case 'complete':
      if (labels.has('auto')) {
        labels.delete('auto');
        labels.add('needs-review');
      }
      break;
    case 'pass_holdout':
      if (labels.has('holdout')) {
        labels.delete('holdout');
        labels.add('verified');
      }
      break;
    case 'fail_holdout':
      labels.add('blocked');
      break;
  }

  return Array.from(labels);
}

function logEvent(eventType, data) {
  try {
    const eventSystem = require('./event-system.js');
    eventSystem.emit(eventType, data, { source: 'dark-factory', severity: 'warning' });
  } catch (err) {
    const fallback = path.join(MEMORY_DIR, 'factory-events.ndjson');
    fs.appendFileSync(fallback, JSON.stringify({
      timestamp: new Date().toISOString(),
      eventType,
      data,
    }) + '\n');
  }
}

function decisionGate(operationType, metadata = {}) {
  loadState();

  const initialHashes = state.governanceHashes || {};
  if (Object.keys(initialHashes).length > 0) {
    const immutability = verifyImmutability(initialHashes);
    if (!immutability.passed) {
      logEvent('governance.blocked', { reason: 'immutability violated', changed: immutability.changed, operationType });
      return {
        action: 'block',
        reason: `Governance immutability violated: ${immutability.changed.join(', ')} changed`,
      };
    }
  }

  if (metadata.usedTokens !== undefined && metadata.maxTokens !== undefined) {
    const budget = enforceBudget(
      metadata.usedTokens,
      metadata.maxTokens,
      metadata.usedUsd || 0,
      metadata.maxUsd || Infinity,
    );
    if (!budget.allowed) {
      logEvent('governance.blocked', { reason: budget.reason, operationType });
      return { action: 'block', reason: budget.reason };
    }
  }

  const labels = metadata.labels || [];
  const stateMachine = getStateMachine(labels);

  if (stateMachine.state === 'blocked') {
    logEvent('governance.blocked', { reason: 'state blocked', operationType, labels });
    return { action: 'block', reason: 'Operation blocked by state machine' };
  }

  if (stateMachine.state === 'holdout') {
    logEvent('governance.holdout', { reason: 'holdout state', operationType, labels });
    return { action: 'holdout', reason: 'Operation requires holdout validation' };
  }

  if (stateMachine.state === 'needs-review') {
    logEvent('governance.blocked', { reason: 'needs-review state', operationType, labels });
    return { action: 'needs-review', reason: 'Operation needs human review' };
  }

  if (metadata.issueDescription && metadata.implementationSummary) {
    const holdout = validateHoldout(metadata.issueDescription, metadata.implementationSummary);
    if (!holdout.passed) {
      logEvent('governance.holdout', { reason: 'holdout validation failed', concerns: holdout.concerns, operationType });
      return {
        action: 'holdout',
        reason: `Holdout validation failed: ${holdout.concerns.join(', ')}`,
      };
    }
  }

  logEvent('governance.allowed', { operationType, labels });
  return { action: 'allow', reason: 'All governance checks passed' };
}

function initializeState() {
  loadState();
  const gov = loadGovernance();
  state.governanceHashes = {
    mission: gov.mission.hash,
    rules: gov.rules.hash,
    style: gov.style.hash,
  };
  state.budgetUsed = state.budgetUsed || { tokens: 0, usd: 0 };
  state.lastValidation = new Date().toISOString();
  saveState();
}

module.exports = {
  loadGovernance,
  verifyImmutability,
  enforceBudget,
  validateHoldout,
  getStateMachine,
  transitionState,
  decisionGate,
  initializeState,
  logEvent,
};

if (require.main === module) {
  initializeState();
  console.log('✅ Dark Factory governance initialized');
  console.log('   Hashes stored in', STATE_FILE);
}
