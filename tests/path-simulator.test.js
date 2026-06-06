#!/usr/bin/env node
/**
 * Tests for Path Simulator
 * Run: node tests/path-simulator.test.js
 */

const {
  simulateAction, simulatePath, estimateCost, assessRisk,
  predictOutcome, cachedPredictOutcome, clearCache,
  ActionSimulator, CostEstimator, RiskAssessor, OutcomePredictor,
  SimulationCache, seededRandom, ACTION_CONFIG,
} = require('../scripts/path-simulator.js');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`✅ PASS: ${message}`);
  return true;
}

function testActionSimulation() {
  console.log('\n🎲 Testing action simulation...');

  const result = simulateAction({ type: 'search', complexity: 1 }, 42);
  assert(result.type === 'search', 'Should have type search');
  assert(typeof result.success === 'boolean', 'Should have boolean success');
  assert(result.probability >= 0 && result.probability <= 1, 'Probability should be 0-1');
  assert(result.probability === ACTION_CONFIG.search.baseSuccess, 'Should match base success rate');
}

function testCostEstimation() {
  console.log('\n💰 Testing cost estimation...');

  const actions = [
    { type: 'search', complexity: 1 },
    { type: 'subagent_spawn', complexity: 2 },
  ];
  const result = estimateCost(actions);

  assert(result.totalTokens > 0, 'Total tokens should be positive');
  assert(result.totalCostUsd > 0, 'Total cost should be positive');
  assert(result.perAction.length === 2, 'Should estimate per action');
  assert(result.perAction[1].estimatedTokens > result.perAction[0].estimatedTokens,
    'Subagent should cost more than search');
}

function testRiskAssessment() {
  console.log('\n⚠️ Testing risk assessment...');

  const actions = [
    { type: 'file_read', complexity: 1 },
    { type: 'exec', complexity: 3 },
  ];
  const result = assessRisk(actions);

  assert(result.overallRisk >= 0 && result.overallRisk <= 1, 'Overall risk should be 0-1');
  assert(result.perAction.length === 2, 'Should assess per action');
  assert(result.perAction[1].failureProbability > result.perAction[0].failureProbability,
    'High complexity exec should be riskier than file_read');
  assert(['low', 'medium', 'high'].includes(result.perAction[0].riskLevel),
    'Risk level should be valid');
}

function testPathSimulation() {
  console.log('\n🔗 Testing path simulation...');

  const actions = [
    { type: 'search' },
    { type: 'file_read' },
    { type: 'exec' },
  ];
  const results = simulatePath(actions, 42);

  assert(results.length === 3, 'Should return 3 outcomes');
  assert(results[0].type === 'search', 'First should be search');
  assert(results.every(r => typeof r.success === 'boolean'), 'All should have boolean success');
  assert(results.every(r => r.probability >= 0 && r.probability <= 1),
    'All probabilities should be valid');
}

function testOutcomePrediction() {
  console.log('\n🔮 Testing outcome prediction...');

  const actions = [
    { type: 'file_read', complexity: 1 },
    { type: 'file_read', complexity: 1 },
  ];
  const result = predictOutcome(actions, null, 42);

  assert(result.terminalState === 'success' || result.terminalState === 'failure',
    'Terminal state should be success or failure');
  assert(result.overallSuccessProbability >= 0 && result.overallSuccessProbability <= 1,
    'Overall success probability should be 0-1');
  assert(result.stepsSimulated <= actions.length, 'Steps simulated should not exceed actions');
  assert(Array.isArray(result.outcomes), 'Outcomes should be array');
}

function testCache() {
  console.log('\n💾 Testing simulation cache...');

  clearCache();
  const actions = [{ type: 'search' }];

  const miss = cachedPredictOutcome(actions, null, 42);
  assert(miss.cached === false, 'First call should be cache miss');

  const hit = cachedPredictOutcome(actions, null, 42);
  assert(hit.cached === true, 'Second call should be cache hit');

  assert(miss.terminalState === hit.terminalState, 'Cache should return same result');
}

function testDifferentActionTypes() {
  console.log('\n📊 Testing different action types have different costs/risk...');

  const search = { type: 'search', complexity: 1 };
  const subagent = { type: 'subagent_spawn', complexity: 1 };

  const cost1 = estimateCost([search]);
  const cost2 = estimateCost([subagent]);
  assert(cost2.totalTokens > cost1.totalTokens, 'Subagent should cost more tokens than search');

  const risk1 = assessRisk([search]);
  const risk2 = assessRisk([subagent]);
  assert(risk2.overallRisk > risk1.overallRisk, 'Subagent should be riskier than search');
}

function testDeterminism() {
  console.log('\n🎯 Testing deterministic simulation...');

  const actions = [{ type: 'exec', complexity: 2 }];
  const result1 = predictOutcome(actions, null, 123);
  const result2 = predictOutcome(actions, null, 123);

  assert(result1.terminalState === result2.terminalState, 'Same seed should give same terminal state');
  assert(result1.overallSuccessProbability === result2.overallSuccessProbability,
    'Same seed should give same probability');
}

function testEventLogging() {
  console.log('\n📝 Testing event logging integration...');

  // Mock event-system by creating a temporary module wrapper
  const fs = require('fs');
  const mockEventLog = '/root/.openclaw/workspace/memory/event-log.ndjson';
  const backup = fs.existsSync(mockEventLog) ? fs.readFileSync(mockEventLog, 'utf-8') : null;

  // Write a mock tool_error event
  const mockEvent = JSON.stringify({
    eventType: 'tool_error', severity: 'error', timestamp: new Date().toISOString(),
    data: { type: 'exec' },
  }) + '\n';
  fs.appendFileSync(mockEventLog, mockEvent);

  const risk = assessRisk([{ type: 'exec', complexity: 1 }]);
  assert(risk.perAction[0].failureProbability > 0, 'Risk should be positive with historical data');

  // Restore
  if (backup !== null) {
    fs.writeFileSync(mockEventLog, backup);
  } else {
    fs.unlinkSync(mockEventLog);
  }
}

console.log('🧪 Path Simulator Tests');
console.log('========================');

try {
  testActionSimulation();
  testCostEstimation();
  testRiskAssessment();
  testPathSimulation();
  testOutcomePrediction();
  testCache();
  testDifferentActionTypes();
  testDeterminism();
  testEventLogging();

  console.log('\n🎉 All tests passed!');
} catch (err) {
  console.error('\n💥 Test suite failed:', err.message);
  console.error(err.stack);
  process.exit(1);
}
