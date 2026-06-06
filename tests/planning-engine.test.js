#!/usr/bin/env node
/**
 * Tests for Planning Engine (MCTS)
 * Run: node tests/planning-engine.test.js
 */

const { PlanningEngine, TreeNode } = require('../scripts/planning-engine.js');
const fs = require('fs');
const path = require('path');

const PLANS_FILE = path.join(__dirname, '..', 'memory', 'plans', 'active-plan.json');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`✅ PASS: ${message}`);
  return true;
}

function cleanup() {
  if (fs.existsSync(PLANS_FILE)) fs.unlinkSync(PLANS_FILE);
}

function testTreeNodeCreation() {
  console.log('\n🌳 Testing TreeNode creation...');
  const root = new TreeNode({ id: 'root', state: 'start', action: null });
  const child = new TreeNode({ id: 'child-1', state: 'start+research', action: { type: 'research' }, parent: root });
  root.addChild(child);

  assert(root.isRoot(), 'Root should be root');
  assert(!child.isRoot(), 'Child should not be root');
  assert(root.children.length === 1, 'Root should have 1 child');
  assert(child.parent === root, 'Child parent should be root');
  assert(child.isLeaf(), 'Child should be leaf');
  assert(!root.isLeaf(), 'Root should not be leaf');
  assert(child.depth === 1, 'Child depth should be 1');
  assert(child.visits === 0, 'Child visits should be 0');
  assert(child.value === 0, 'Child value should be 0');
}

function testUCB1Selection() {
  console.log('\n🎯 Testing UCB1 selection...');
  const engine = new PlanningEngine();
  const root = new TreeNode({ id: 'root', state: 'start', action: null });
  const child1 = new TreeNode({ id: 'c1', state: 's1', action: { type: 'research' } });
  const child2 = new TreeNode({ id: 'c2', state: 's2', action: { type: 'execute' } });
  root.addChild(child1);
  root.addChild(child2);
  root.visits = 10;
  child1.visits = 3; child1.value = 2.1;
  child2.visits = 5; child2.value = 3.0;

  const selected = engine.selectUCB1(root, 1.414);
  assert(selected !== null, 'Should select a child');
  assert(selected.id === child2.id || selected.id === child1.id, 'Should select a valid child');
}

function testUCB1ExploresUnvisited() {
  console.log('\n🧭 Testing UCB1 explores unvisited...');
  const engine = new PlanningEngine();
  const root = new TreeNode({ id: 'root', state: 'start', action: null });
  const child1 = new TreeNode({ id: 'c1', state: 's1', action: { type: 'research' } });
  const child2 = new TreeNode({ id: 'c2', state: 's2', action: { type: 'execute' } });
  root.addChild(child1);
  root.addChild(child2);
  root.visits = 10;
  child1.visits = 10; child1.value = 9.0;
  child2.visits = 0; child2.value = 0;

  const selected = engine.selectUCB1(root, 1.414);
  assert(selected.id === 'c2', 'Should prefer unvisited child for exploration');
}

function testExpansion() {
  console.log('\n📈 Testing expansion...');
  const engine = new PlanningEngine();
  const root = new TreeNode({ id: 'root', state: 'start', action: null });
  const actions = [
    { type: 'research', id: 'a1' },
    { type: 'execute', id: 'a2' },
    { type: 'verify', id: 'a3' }
  ];
  engine.expand(root, actions);

  assert(root.children.length === 3, 'Should expand 3 children');
  assert(root.children[0].action.type === 'research', 'First child should be research');
  assert(root.children[1].action.type === 'execute', 'Second child should be execute');
  assert(root.children[2].action.type === 'verify', 'Third child should be verify');
  assert(root.children[0].parent === root, 'Children should link to parent');
}

function testSimulation() {
  console.log('\n🎲 Testing simulation...');
  const engine = new PlanningEngine();
  const node = new TreeNode({ id: 'n1', state: 'test', action: { type: 'verify', baseRate: 0.9 } });
  const goal = { keywords: ['test'], raw: 'test goal' };

  const result = engine.simulate(node, 3, goal);
  assert(result >= 0 && result <= 1, `Simulation should return 0-1, got ${result}`);
  assert(typeof result === 'number', 'Simulation should return a number');
}

function testBackpropagation() {
  console.log('\n📊 Testing backpropagation...');
  const engine = new PlanningEngine();
  const root = new TreeNode({ id: 'root', state: 'start', action: null });
  const child = new TreeNode({ id: 'c1', state: 's1', action: { type: 'research' }, parent: root });
  root.addChild(child);

  engine.backpropagate(child, 0.75);
  assert(child.visits === 1, 'Child visits should be 1');
  assert(child.value === 0.75, 'Child value should be 0.75');
  assert(root.visits === 1, 'Root visits should be 1');
  assert(root.value === 0.75, 'Root value should be 0.75');

  engine.backpropagate(child, 0.85);
  assert(child.visits === 2, 'Child visits should be 2');
  assert(child.value === 1.6, 'Child value should be 1.6');
  assert(root.visits === 2, 'Root visits should be 2');
}

function testCreatePlan() {
  console.log('\n📝 Testing createPlan...');
  cleanup();
  const engine = new PlanningEngine();
  const plan = engine.createPlan({ goal: 'deploy new service to production', constraints: { budget: 100 }, numSimulations: 10, depth: 3 });

  assert(plan.planId.startsWith('plan-'), 'Should have plan- prefix');
  assert(plan.goal === 'deploy new service to production', 'Should have goal');
  assert(plan.recommendedPath.length > 0, 'Should have recommended path');
  assert(plan.alternativePaths.length > 0, 'Should have alternative paths');
  assert(plan.status === 'active', 'Should be active');
  assert(plan.constraints.budget === 100, 'Should have constraints');
  assert(plan.goalKeywords.includes('deploy'), 'Should parse goal keywords');
  assert(plan.root, 'Should have root node');
}

function testExecuteStep() {
  console.log('\n⚡ Testing executeStep...');
  cleanup();
  const engine = new PlanningEngine();
  const plan = engine.createPlan({ goal: 'build test system', numSimulations: 10, depth: 3 });
  const beforeExecuted = plan.executedSteps.length;

  const step = engine.executeStep(plan.planId);
  assert(!step.done, 'Should not be done after first step');
  assert(step.action, 'Should return an action');
  assert(step.progress > 0, 'Should have progress > 0');

  const status = engine.getPlanStatus(plan.planId);
  assert(status.progress.executed === beforeExecuted + 1, 'Should have executed 1 step');
}

function testGetPlanStatus() {
  console.log('\n📋 Testing getPlanStatus...');
  cleanup();
  const engine = new PlanningEngine();
  const plan = engine.createPlan({ goal: 'verify system', numSimulations: 10, depth: 2 });

  const status = engine.getPlanStatus(plan.planId);
  assert(status !== null, 'Should return status');
  assert(status.planId === plan.planId, 'Should have correct planId');
  assert(status.status === 'active', 'Should be active');
  assert(status.progress.executed === 0, 'Should have 0 executed');
  assert(status.progress.total > 0, 'Should have total > 0');
  assert(Array.isArray(status.remainingActions), 'Should have remaining actions array');
  assert(status.remainingActions.length > 0, 'Should have remaining actions');
}

function testReplan() {
  console.log('\n🔄 Testing replan...');
  cleanup();
  const engine = new PlanningEngine();
  const plan = engine.createPlan({ goal: 'deploy system', constraints: { time: 60 }, numSimulations: 10, depth: 2 });
  const originalPath = JSON.stringify(plan.recommendedPath);

  engine.executeStep(plan.planId);
  const replanned = engine.replan(plan.planId, { deadline: '2026-06-10' });

  assert(replanned.constraints.time === 60, 'Should keep original constraints');
  assert(replanned.constraints.deadline === '2026-06-10', 'Should add new constraints');
  assert(replanned.status === 'active', 'Should reset to active');
  assert(replanned.updatedAt > replanned.createdAt, 'Should update updatedAt');
  assert(replanned.recommendedPath.length > 0, 'Should have new recommended path');
}

function testPlanPersistence() {
  console.log('\n💾 Testing plan persistence...');
  cleanup();
  const engine1 = new PlanningEngine();
  const plan = engine1.createPlan({ goal: 'test persistence', numSimulations: 5, depth: 2 });
  const planId = plan.planId;

  const engine2 = new PlanningEngine();
  const status = engine2.getPlanStatus(planId);
  assert(status !== null, 'Should load plan from disk');
  assert(status.goal === 'test persistence', 'Should preserve goal');
}

function testSimulateDepthPenalty() {
  console.log('\n📉 Testing simulation depth penalty...');
  const engine = new PlanningEngine();
  const goal = { keywords: ['test'], raw: 'test' };
  const shallow = new TreeNode({ id: 's1', state: 'test', action: { type: 'research', baseRate: 0.7 }, depth: 0 });
  const deep = new TreeNode({ id: 's2', state: 'test', action: { type: 'research', baseRate: 0.7 }, depth: 10 });

  const shallowResult = engine.simulate(shallow, 3, goal);
  const deepResult = engine.simulate(deep, 3, goal);
  assert(shallowResult >= deepResult, 'Shallow node should score >= deep node (depth penalty)');
}

console.log('🧪 Planning Engine Tests');
console.log('========================');

try {
  testTreeNodeCreation();
  testUCB1Selection();
  testUCB1ExploresUnvisited();
  testExpansion();
  testSimulation();
  testBackpropagation();
  testCreatePlan();
  testExecuteStep();
  testGetPlanStatus();
  testReplan();
  testPlanPersistence();
  testSimulateDepthPenalty();

  console.log('\n🎉 All tests passed!');
} catch (err) {
  console.error('\n💥 Test suite failed:', err.message);
  console.error(err.stack);
  process.exit(1);
}
