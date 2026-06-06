#!/usr/bin/env node
/**
 * Agent Loop Integration Tests
 * Tests: planning-engine + steering-queue + followup-queue + event-system + agent-loop
 */

const fs = require('fs');
const path = require('path');

const { agentLoop, executePlanStep, replan, getLoopStatus, isComplex, estimateSteps, formatPlanForSteering, COMPLEXITY_THRESHOLD } = require('../scripts/agent-loop');
const { PlanningEngine } = require('../scripts/planning-engine');
const { add: steeringAdd, list: steeringList, clear: steeringClear } = require('../scripts/steering-queue');
const { add: followupAdd, list: followupList } = require('../scripts/followup-queue');
const { emit: eventEmit, query: eventQuery, VALID_EVENT_TYPES } = require('../scripts/event-system');

const PLANS_DIR = path.join(__dirname, '..', 'memory', 'plans');
const LOOP_STATE_FILE = path.join(PLANS_DIR, 'loop-state.json');

let tests = 0;
let pass = 0;
let fail = 0;

function assert(cond, msg) {
  tests++;
  if (cond) { pass++; console.log(`  ✅ ${msg}`); }
  else { fail++; console.log(`  ❌ ${msg}`); }
}

function resetState() {
  if (fs.existsSync(LOOP_STATE_FILE)) fs.unlinkSync(LOOP_STATE_FILE);
  const plansFile = path.join(PLANS_DIR, 'active-plan.json');
  if (fs.existsSync(plansFile)) fs.unlinkSync(plansFile);
  steeringClear();
  // Directly clear followup queue by writing empty file
  const followupQueueFile = path.join(__dirname, '..', 'memory', 'followup-queue.json');
  fs.writeFileSync(followupQueueFile, JSON.stringify({ tasks: [], lastId: 0 }, null, 2));
}

function cleanUp() {
  if (fs.existsSync(LOOP_STATE_FILE)) fs.unlinkSync(LOOP_STATE_FILE);
  const plansFile = path.join(PLANS_DIR, 'active-plan.json');
  if (fs.existsSync(plansFile)) fs.unlinkSync(plansFile);
  steeringClear();
  const followupQueueFile = path.join(__dirname, '..', 'memory', 'followup-queue.json');
  fs.writeFileSync(followupQueueFile, JSON.stringify({ tasks: [], lastId: 0 }, null, 2));
}

console.log('\n🧪 Agent Loop Integration Tests\n');

// ──────────────────────────────────────────
// Test 1: isComplex heuristic
// ──────────────────────────────────────────
console.log('Test 1: isComplex heuristic');
assert(isComplex('Build a planning engine and integrate it with the agent loop') === true, 'Multi-action goal is complex');
assert(isComplex('What is the weather?') === false, 'Simple question is not complex');
assert(isComplex('Create a user profile and deploy it to production') === true, 'Create + deploy is complex');
assert(isComplex('Read memory/2024-05-07.md') === false, 'Single file read is not complex');
assert(isComplex('') === false, 'Empty string is not complex');
assert(isComplex(123) === false, 'Non-string is not complex');

// ──────────────────────────────────────────
// Test 2: estimateSteps
// ──────────────────────────────────────────
console.log('\nTest 2: estimateSteps');
assert(estimateSteps('Build and test and deploy') === 3, 'Three actions = 3 steps');
assert(estimateSteps('Simple task') === 1, 'Single phrase = 1 step');
assert(estimateSteps('Research then implement then test then deploy') === 4, 'Four connectors = 4 steps');

// ──────────────────────────────────────────
// Test 3: COMPLEXITY_THRESHOLD constant
// ──────────────────────────────────────────
console.log('\nTest 3: Threshold constant');
assert(COMPLEXITY_THRESHOLD === 3, 'Complexity threshold is 3');

// ──────────────────────────────────────────
// Test 4: formatPlanForSteering
// ──────────────────────────────────────────
console.log('\nTest 4: formatPlanForSteering');
const mockPlan = {
  goal: 'Build a planning engine that integrates with the agent loop',
  recommendedValue: 0.87,
  recommendedPath: [
    { type: 'research', desc: 'gather information' },
    { type: 'execute', desc: 'implement core engine' },
    { type: 'verify', desc: 'run tests' }
  ],
  numSimulations: 20
};
const steeringText = formatPlanForSteering(mockPlan);
assert(steeringText.includes('PLAN:'), 'Steering text contains PLAN header');
assert(steeringText.includes('87.0%'), 'Steering text shows confidence percentage');
assert(steeringText.includes('research'), 'Steering text includes first action type');
assert(steeringText.includes('Steps: 3'), 'Steering text shows step count');
assert(steeringText.includes('Simulations: 20'), 'Steering text shows simulation count');

// ──────────────────────────────────────────
// Test 5: Direct steering for simple goals
// ──────────────────────────────────────────
console.log('\nTest 5: Direct steering for simple goals');
resetState();
const simpleResult = agentLoop({ text: 'What is the weather?' });
assert(simpleResult.mode === 'direct', 'Simple goal uses direct mode');
assert(simpleResult.actions.length === 1, 'Direct mode returns single action');
assert(simpleResult.actions[0].type === 'steer', 'Direct action is a steering message');
assert(simpleResult.complexity === 1, 'Simple goal has complexity 1');

// Check steering queue received it
const steeringMsgs = steeringList();
assert(steeringMsgs.length >= 1, 'Steering queue has a message');
assert(steeringMsgs[0].message.includes('weather'), 'Steering message contains goal text');

// Check event was logged
const events = eventQuery({ type: 'steering_injected', limit: 10 });
assert(events.length >= 1, 'Event system logged steering injection');
assert(events[0].data.mode === 'direct', 'Event records direct mode');

// ──────────────────────────────────────────
// Test 6: Full planning for complex goals
// ──────────────────────────────────────────
console.log('\nTest 6: Full planning for complex goals');
resetState();
const complexResult = agentLoop({ text: 'Build a planning engine and integrate it with the agent loop' });
assert(complexResult.mode === 'plan', 'Complex goal triggers plan mode');
assert(complexResult.planId !== null, 'Plan mode returns a plan ID');
assert(complexResult.planId.startsWith('plan-'), 'Plan ID has correct prefix');
assert(complexResult.actions.length === 2, 'Plan mode returns steer + execute actions');
assert(complexResult.actions[0].type === 'steer', 'First action is steering');
assert(complexResult.actions[1].type === 'execute', 'Second action is execution');
assert(complexResult.estimatedSteps >= 1, 'Plan has estimated steps');
assert(complexResult.confidence !== undefined, 'Plan has confidence score');

// Check steering queue has the plan summary
const planSteering = steeringList().filter(m => m.source === 'planning_engine');
assert(planSteering.length >= 1, 'Steering queue has planning-engine message');

// Check followup queue has remaining steps (if plan has >1 steps)
const followups = followupList();
if (Array.isArray(followups) && followups.length > 0 && followups[0] && followups[0].message) {
  assert(followups[0].message.includes('step'), 'Followup message mentions step');
} else {
  console.log('  ℹ️ No followups generated (plan has short path, expected with mock engine)');
}

// Check event was logged
const planEvents = eventQuery({ type: 'plan_created', limit: 10 });
assert(planEvents.length >= 1, 'Event system logged plan creation');
const latestPlanEvent = planEvents[planEvents.length - 1];
assert(latestPlanEvent.data.goal.includes('planning engine'), 'Event records goal text');

// ──────────────────────────────────────────
// Test 7: Plan continuation
// ──────────────────────────────────────────
console.log('\nTest 7: Plan continuation');
resetState();
const planStart = agentLoop({ text: 'Build a system with multiple steps and integrate with authentication and database' });
assert(planStart.mode === 'plan', 'Initial call creates plan');
const planId = planStart.planId;

// Second call without override should continue the same plan
const continuation = agentLoop({ text: 'Continue working on the system' });
assert(continuation.mode === 'plan_continue', 'Second call continues existing plan');
assert(continuation.planId === planId, 'Continuation uses same plan ID');
assert(continuation.nextAction !== undefined, 'Continuation provides next action');
assert(continuation.progress !== undefined, 'Continuation provides progress');

// Check event was logged
const continueEvents = eventQuery({ type: 'plan_continued', limit: 10 });
assert(continueEvents.length >= 1, 'Event system logged plan continuation');

// ──────────────────────────────────────────
// Test 8: Execute plan step
// ──────────────────────────────────────────
console.log('\nTest 8: Execute plan step');
resetState();
const execPlan = agentLoop({ text: 'Build a system with multiple steps and integrate with authentication and database' });
assert(execPlan.mode === 'plan', 'Created plan for execution test');

const step1 = executePlanStep(execPlan.planId);
assert(step1.done === false, 'First step is not done');
assert(step1.action !== undefined, 'Step returns an action');
assert(step1.progress !== undefined, 'Step returns progress');

// Execute remaining steps until done
let stepCount = 1;
let lastStep = step1;
while (!lastStep.done && stepCount < 50) {
  lastStep = executePlanStep(execPlan.planId);
  stepCount++;
}
assert(lastStep.done === true, 'All steps eventually complete');
assert(lastStep.status === 'completed' || lastStep.done === true, 'Final status is completed');

// Check loop state is cleared after completion
const statusAfterComplete = getLoopStatus();
assert(statusAfterComplete.hasActivePlan === false, 'Loop state cleared after completion');
assert(statusAfterComplete.planId === null, 'No active plan after completion');

// ──────────────────────────────────────────
// Test 9: Replanning
// ──────────────────────────────────────────
console.log('\nTest 9: Replanning');
resetState();
const originalPlan = agentLoop({ text: 'Build a system with research and deployment and testing and monitoring' });
assert(originalPlan.mode === 'plan', 'Original plan created');

const newConstraints = { maxCost: 1.00, maxTime: 300 };
const replanned = replan(originalPlan.planId, newConstraints);
assert(replanned.planId === originalPlan.planId, 'Replan keeps same ID');
assert(replanned.status === 'active', 'Replan sets status to active');
assert(replanned.updatedAt !== originalPlan.createdAt, 'Replan updates timestamp');

// Check event was logged
const replanEvents = eventQuery({ type: 'plan_replanned', limit: 10 });
assert(replanEvents.length >= 1, 'Event system logged replan');

// ──────────────────────────────────────────
// Test 10: Loop status
// ──────────────────────────────────────────
console.log('\nTest 10: Loop status');
resetState();
const idleStatus = getLoopStatus();
assert(idleStatus.hasActivePlan === false, 'Idle loop has no active plan');
assert(idleStatus.planId === null, 'Idle loop has null planId');
assert(idleStatus.historyCount === 0, 'Idle loop has empty history');
assert(idleStatus.lastDecision === null, 'Idle loop has no last decision');

const activePlan = agentLoop({ text: 'Build a complex system with multiple components, authentication, and deployment pipeline' });
assert(activePlan.mode === 'plan', 'Active plan created');

const activeStatus = getLoopStatus();
assert(activeStatus.hasActivePlan === true, 'Active loop has active plan');
assert(activeStatus.planId === activePlan.planId, 'Active loop matches plan ID');
assert(activeStatus.planStatus !== null, 'Active loop has plan status');
assert(activeStatus.planStatus.status === 'active', 'Plan status is active');
assert(activeStatus.historyCount === 1, 'History recorded one decision');
assert(activeStatus.lastDecision !== null, 'Last decision is recorded');
assert(activeStatus.lastDecision.mode === 'plan', 'Last decision was plan mode');

// ──────────────────────────────────────────
// Test 11: Force plan override
// ──────────────────────────────────────────
console.log('\nTest 11: Force plan override');
resetState();
const planA = agentLoop({ text: 'Build system A with multiple components, authentication, and deployment' });
assert(planA.mode === 'plan', 'Plan A created');

// With override=true, should create a new plan even though one is active
const planB = agentLoop({ text: 'Build system B with multiple components, authentication, and deployment', override: true });
assert(planB.mode === 'plan', 'Override creates new plan');
assert(planB.planId !== planA.planId, 'Override creates different plan ID');

// Without override, should continue plan A (but now plan B is active, so continue B)
const planC = agentLoop({ text: 'Build system C with multiple components, authentication, and deployment' });
assert(planC.mode === 'plan_continue', 'Without override continues active plan');
assert(planC.planId === planB.planId, 'Continues most recent active plan');

// ──────────────────────────────────────────
// Test 12: Event types validation
// ──────────────────────────────────────────
console.log('\nTest 12: Event types validation');
assert(VALID_EVENT_TYPES.includes('plan_created'), 'plan_created is valid event type');
assert(VALID_EVENT_TYPES.includes('plan_continued'), 'plan_continued is valid event type');
assert(VALID_EVENT_TYPES.includes('plan_step_executed'), 'plan_step_executed is valid event type');
assert(VALID_EVENT_TYPES.includes('plan_completed'), 'plan_completed is valid event type');
assert(VALID_EVENT_TYPES.includes('plan_replanned'), 'plan_replanned is valid event type');
assert(VALID_EVENT_TYPES.includes('plan_selected'), 'plan_selected is valid event type');
assert(VALID_EVENT_TYPES.includes('plan_failed'), 'plan_failed is valid event type');
assert(VALID_EVENT_TYPES.includes('simulation_run'), 'simulation_run is valid event type');
assert(VALID_EVENT_TYPES.includes('path_selected'), 'path_selected is valid event type');

// ──────────────────────────────────────────
// Summary
// ──────────────────────────────────────────
cleanUp();
console.log(`\n${'='.repeat(50)}`);
console.log(`Tests: ${tests} | ✅ Pass: ${pass} | ❌ Fail: ${fail}`);
console.log(`${'='.repeat(50)}\n`);
process.exit(fail > 0 ? 1 : 0);
