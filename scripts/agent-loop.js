#!/usr/bin/env node
/**
 * Agent Loop — KClaw0 Planning-Integrated Execution Engine
 *
 * Orchestrates: planning-engine → steering-queue → followup-queue → event-system
 * Entry point: planning-decision hooks into actual tool execution.
 */

const fs = require('fs');
const path = require('path');

const PlanningEngine = require('./planning-engine').PlanningEngine;
const { add: steeringAdd } = require('./steering-queue');
const { add: followupAdd } = require('./followup-queue');
const { emit: eventEmit } = require('./event-system');

const PLANS_DIR = path.join(__dirname, '..', 'memory', 'plans');
const LOOP_STATE_FILE = path.join(PLANS_DIR, 'loop-state.json');

/**
 * How many actions in the recommended path triggers planning vs. steering?
 * Goals with >3 steps → full plan via planning engine.
 */
const COMPLEXITY_THRESHOLD = 3;

/**
 * Load or create the loop state.
 */
function loadLoopState() {
  if (!fs.existsSync(PLANS_DIR)) fs.mkdirSync(PLANS_DIR, { recursive: true });
  if (!fs.existsSync(LOOP_STATE_FILE)) return { currentPlanId: null, stepIndex: 0, history: [] };
  try { return JSON.parse(fs.readFileSync(LOOP_STATE_FILE, 'utf-8')); } catch { return { currentPlanId: null, stepIndex: 0, history: [] }; }
}

function saveLoopState(state) {
  if (!fs.existsSync(PLANS_DIR)) fs.mkdirSync(PLANS_DIR, { recursive: true });
  fs.writeFileSync(LOOP_STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Heuristic: does a goal need multi-step planning?
 */
function isComplex(goal) {
  if (typeof goal !== 'string') return false;
  const words = goal.split(/\s+/);
  const actionWords = ['build', 'create', 'integrate', 'implement', 'add', 'update', 'delete',
    'deploy', 'migrate', 'refactor', 'test', 'fix', 'design', 'plan', 'setup', 'install'];
  const actionCount = actionWords.filter(w => goal.toLowerCase().includes(w)).length;
  return actionCount >= 2 || words.length > 12;
}

/**
 * Estimate the number of steps from the plan.
 */
function estimateSteps(goal) {
  const keywords = ['and', 'then', 'also', 'plus', 'additionally', 'after', 'before', 'followed by'];
  const count = keywords.reduce((c, k) => c + (goal.toLowerCase().split(k).length - 1), 0);
  return Math.max(1, count + 1);
}

/**
 * The main agent loop decision.
 *
 * @param {Object} goal - { text: string, context?: object, constraints?: object }
 * @returns {Object} - { mode: 'plan'|'steer'|'direct', actions: [], planId? }
 */
function agentLoop(goal) {
  const state = loadLoopState();
  const engine = new PlanningEngine();

  // If we're already executing a plan and the user hasn't overridden it, continue.
  if (state.currentPlanId && !goal.override) {
    const planStatus = engine.getPlanStatus(state.currentPlanId);
    if (planStatus && planStatus.status === 'active' && planStatus.remainingActions.length > 0) {
      eventEmit('plan_continued', { planId: state.currentPlanId, remaining: planStatus.remainingActions.length }, { severity: 'info' });
      return {
        mode: 'plan_continue',
        planId: state.currentPlanId,
        nextAction: planStatus.remainingActions[0],
        progress: planStatus.progress
      };
    }
    // Plan completed or failed — clear and fall through.
    state.currentPlanId = null;
    state.stepIndex = 0;
  }

  // Evaluate if planning is needed.
  const complexity = estimateSteps(goal.text);
  const needsPlan = isComplex(goal.text) || complexity > COMPLEXITY_THRESHOLD || (goal.forcePlan === true) || (goal.override === true);

  if (!needsPlan) {
    // Direct steering: single-step goals get steering-queue injection.
    const steerId = steeringAdd(goal.text, 'normal', { source: 'agent_loop', context: { complexity, estimatedSteps: 1 } });
    eventEmit('steering_injected', { messageId: steerId, goal: goal.text, mode: 'direct' }, { severity: 'info' });
    saveLoopState({ ...state, currentPlanId: null, stepIndex: 0, history: [...state.history, { time: new Date().toISOString(), mode: 'direct', goal: goal.text }] });
    return { mode: 'direct', actions: [{ type: 'steer', steerId }], complexity };
  }

  // Full planning path.
  const plan = engine.createPlan({
    goal: goal.text,
    constraints: goal.constraints || { maxCost: 5.00, maxTime: 600 },
    numSimulations: goal.simulations || 20,
    depth: goal.depth || 5
  });

  eventEmit('plan_created', {
    planId: plan.planId,
    goal: goal.text,
    estimatedSteps: plan.recommendedPath.length,
    estimatedValue: plan.recommendedValue,
    complexity
  }, { severity: 'info' });

  // Inject best path as steering message.
  const planSummary = formatPlanForSteering(plan);
  const steerId = steeringAdd(planSummary, 'high', { source: 'planning_engine', context: { planId: plan.planId } });

  // Queue remaining steps as followups.
  for (let i = 1; i < plan.recommendedPath.length; i++) {
    followupAdd(`Execute plan step ${i + 1}/${plan.recommendedPath.length}: ${plan.recommendedPath[i].desc || plan.recommendedPath[i].type}`,
      { priority: 'normal', context: { planId: plan.planId, stepIndex: i } });
  }

  state.currentPlanId = plan.planId;
  state.stepIndex = 0;
  state.history = [...state.history, { time: new Date().toISOString(), mode: 'plan', goal: goal.text, planId: plan.planId }];
  saveLoopState(state);

  return {
    mode: 'plan',
    planId: plan.planId,
    actions: [{
      type: 'steer',
      steerId,
      planSummary
    }, {
      type: 'execute',
      action: plan.recommendedPath[0]
    }],
    complexity,
    estimatedSteps: plan.recommendedPath.length,
    confidence: plan.recommendedValue
  };
}

/**
 * Execute the next step of an active plan.
 *
 * @param {string} planId
 */
function executePlanStep(planId) {
  const engine = new PlanningEngine();
  const state = loadLoopState();

  const result = engine.executeStep(planId);
  eventEmit('plan_step_executed', { planId, stepIndex: result.progress, done: result.done }, { severity: 'info' });

  if (result.done) {
    state.currentPlanId = null;
    state.stepIndex = 0;
    saveLoopState(state);
    eventEmit('plan_completed', { planId }, { severity: 'info' });
    return { done: true, planId };
  }

  state.stepIndex = result.progress;
  saveLoopState(state);

  // Steer the next step.
  const steerId = steeringAdd(`Next step: ${result.action.desc || result.action.type}`,
    'normal', { source: 'plan_execution', context: { planId, stepIndex: state.stepIndex } });

  return { done: false, planId, action: result.action, steerId, progress: result.progress };
}

/**
 * Format a plan object for steering-queue injection.
 */
function formatPlanForSteering(plan) {
  const lines = [
    `📋 PLAN: ${plan.goal.substring(0, 80)}`,
    `   Confidence: ${(plan.recommendedValue * 100).toFixed(1)}%`,
    `   Steps: ${plan.recommendedPath.length}`,
    `   Simulations: ${plan.numSimulations}`,
    '',
    'Recommended path:'
  ];
  plan.recommendedPath.forEach((a, i) => {
    lines.push(`   ${i + 1}. [${a.type}] ${a.desc || a.type}`);
  });
  return lines.join('\n');
}

/**
 * Ad-hoc replan: user changed constraints or a step failed.
 *
 * @param {string} planId
 * @param {Object} newConstraints
 */
function replan(planId, newConstraints) {
  const engine = new PlanningEngine();
  const updated = engine.replan(planId, newConstraints);
  eventEmit('plan_replanned', { planId, newConstraints }, { severity: 'warning' });
  return updated;
}

/**
 * Get current loop status for heartbeat / diagnostics.
 */
function getLoopStatus() {
  const state = loadLoopState();
  const engine = new PlanningEngine();
  const planStatus = state.currentPlanId ? engine.getPlanStatus(state.currentPlanId) : null;
  return {
    hasActivePlan: !!state.currentPlanId,
    planId: state.currentPlanId,
    planStatus,
    stepIndex: state.stepIndex,
    historyCount: state.history.length,
    lastDecision: state.history.length > 0 ? state.history[state.history.length - 1] : null
  };
}

/**
 * CLI entry point.
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  switch (command) {
    case 'plan': {
      const goalText = args.slice(1).join(' ');
      if (!goalText) {
        console.log('Usage: node scripts/agent-loop.js plan <goal text>');
        process.exit(1);
      }
      const result = agentLoop({ text: goalText });
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case 'step': {
      const planId = args[1];
      if (!planId) {
        console.log('Usage: node scripts/agent-loop.js step <planId>');
        process.exit(1);
      }
      const result = executePlanStep(planId);
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case 'replan': {
      const planId = args[1];
      const rawConstraints = args[2] ? JSON.parse(args[2]) : {};
      if (!planId) {
        console.log('Usage: node scripts/agent-loop.js replan <planId> [constraints-json]');
        process.exit(1);
      }
      const result = replan(planId, rawConstraints);
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case 'status': {
      const status = getLoopStatus();
      console.log(JSON.stringify(status, null, 2));
      break;
    }
    default: {
      console.log('Usage: node scripts/agent-loop.js [plan <goal>|step <planId>|replan <planId>|status]');
      process.exit(1);
    }
  }
}

module.exports = {
  agentLoop,
  executePlanStep,
  replan,
  getLoopStatus,
  isComplex,
  estimateSteps,
  formatPlanForSteering,
  COMPLEXITY_THRESHOLD
};

if (require.main === module) {
  main();
}
