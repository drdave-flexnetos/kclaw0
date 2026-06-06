const fs = require('fs');
const path = require('path');

const PLANS_DIR = path.join(__dirname, '..', 'memory', 'plans');
const PLANS_FILE = path.join(PLANS_DIR, 'active-plan.json');

function ensureDir() {
  if (!fs.existsSync(PLANS_DIR)) fs.mkdirSync(PLANS_DIR, { recursive: true });
}

function loadPlans() {
  ensureDir();
  if (!fs.existsSync(PLANS_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(PLANS_FILE, 'utf-8')); } catch { return {}; }
}

function savePlans(plans) {
  ensureDir();
  fs.writeFileSync(PLANS_FILE, JSON.stringify(plans, null, 2));
}

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

class TreeNode {
  constructor({ id, state, action, parent = null, depth = 0 }) {
    this.id = id;
    this.state = state;
    this.action = action;
    this.parent = parent;
    this.children = [];
    this.visits = 0;
    this.value = 0;
    this.depth = depth;
  }

  addChild(child) {
    this.children.push(child);
    child.parent = this;
    child.depth = this.depth + 1;
  }

  isLeaf() {
    return this.children.length === 0;
  }

  toJSON() {
    return {
      id: this.id,
      state: this.state,
      action: this.action,
      children: this.children,
      visits: this.visits,
      value: this.value,
      depth: this.depth
    };
  }
  isRoot() {
    return this.parent === null;
  }
}

class PlanningEngine {
  constructor() {
    this.plans = loadPlans();
  }

  _save() { savePlans(this.plans); }

  _parseGoal(goal) {
    const keywords = goal.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
    return { keywords: [...new Set(keywords)], raw: goal };
  }

  _generateActions(state, goalObj, depth) {
    const actions = [];
    const baseActions = [
      { type: 'research', desc: 'gather information', cost: 1, baseRate: 0.7 },
      { type: 'execute', desc: 'execute step', cost: 2, baseRate: 0.8 },
      { type: 'verify', desc: 'verify result', cost: 1, baseRate: 0.9 },
      { type: 'delegate', desc: 'delegate to subagent', cost: 1, baseRate: 0.6 },
      { type: 'retry', desc: 'retry on failure', cost: 2, baseRate: 0.5 },
      { type: 'deploy', desc: 'deploy to production', cost: 3, baseRate: 0.75 }
    ];
    const rand = seededRandom(hashString(state + depth));
    const count = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      const action = baseActions[Math.floor(rand() * baseActions.length)];
      actions.push({ ...action, id: `act-${state}-${depth}-${i}` });
    }
    return actions;
  }

  selectUCB1(node, C = 1.414) {
    if (node.isLeaf()) return node;
    let best = null;
    let bestScore = -Infinity;
    for (const child of node.children) {
      let score;
      if (child.visits === 0) {
        score = Infinity;
      } else {
        score = (child.value / child.visits) + C * Math.sqrt(Math.log(node.visits) / child.visits);
      }
      if (score > bestScore) { bestScore = score; best = child; }
    }
    return best;
  }

  expand(node, actions) {
    for (const action of actions) {
      const child = new TreeNode({
        id: `${node.id}-${action.id}`,
        state: `${node.state}+${action.type}`,
        action,
        parent: node,
        depth: node.depth + 1
      });
      node.addChild(child);
    }
  }

  simulate(node, depthLeft, goalObj) {
    const rand = seededRandom(hashString(node.state + node.depth + depthLeft + goalObj.raw));
    if (depthLeft <= 0) return 0.5;
    const action = node.action || { type: 'research', baseRate: 0.7 };
    const baseRate = action.baseRate || 0.5;
    const variation = (rand() - 0.5) * 0.4;
    const goalBoost = goalObj.keywords.length > 0 ? 0.05 : 0;
    const depthPenalty = node.depth * 0.02;
    return Math.max(0, Math.min(1, baseRate + variation + goalBoost - depthPenalty));
  }

  backpropagate(node, result) {
    let current = node;
    while (current) {
      current.visits += 1;
      current.value += result;
      current = current.parent;
    }
  }

  _buildPath(node) {
    const path = [];
    let current = node;
    while (current && !current.isRoot()) {
      if (current.action) path.unshift(current.action);
      current = current.parent;
    }
    return path;
  }

  _findBestPath(root) {
    const paths = [];
    const traverse = (node, path) => {
      if (node.isLeaf()) {
        paths.push({ path, value: node.visits > 0 ? node.value / node.visits : 0 });
        return;
      }
      for (const child of node.children) {
        traverse(child, [...path, child.action]);
      }
    };
    traverse(root, []);
    paths.sort((a, b) => b.value - a.value);
    return paths;
  }

  createPlan({ goal, constraints = {}, numSimulations = 20, depth = 5 }) {
    const planId = `plan-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const goalObj = this._parseGoal(goal);
    const root = new TreeNode({ id: planId, state: 'root', action: null, depth: 0 });

    const initialActions = this._generateActions('root', goalObj, 0);
    this.expand(root, initialActions);

    for (let sim = 0; sim < numSimulations; sim++) {
      let node = root;
      let currentDepth = 0;
      while (!node.isLeaf() && currentDepth < depth) {
        node = this.selectUCB1(node);
        currentDepth = node.depth;
      }
      if (node.depth < depth && node.isLeaf()) {
        const actions = this._generateActions(node.state, goalObj, node.depth);
        this.expand(node, actions);
      }
      const result = this.simulate(node, depth - node.depth, goalObj);
      this.backpropagate(node, result);
    }

    const paths = this._findBestPath(root);
    const recommendedPath = paths[0] || { path: [], value: 0 };
    const alternativePaths = paths.slice(1, 4);

    const plan = {
      planId,
      goal,
      goalKeywords: goalObj.keywords,
      constraints,
      root,
      recommendedPath: recommendedPath.path,
      recommendedValue: recommendedPath.value,
      alternativePaths: alternativePaths.map(p => ({ path: p.path, expectedValue: p.value })),
      executedSteps: [],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      numSimulations,
      maxDepth: depth
    };

    this.plans[planId] = plan;
    this._save();
    return plan;
  }

  executeStep(planId) {
    const plan = this.plans[planId];
    if (!plan) throw new Error(`Plan ${planId} not found`);
    if (plan.status !== 'active') return { done: true, status: plan.status };

    const nextAction = plan.recommendedPath[plan.executedSteps.length];
    if (!nextAction) {
      plan.status = 'completed';
      this._save();
      return { done: true, status: 'completed' };
    }

    plan.executedSteps.push(nextAction);
    plan.updatedAt = new Date().toISOString();
    if (plan.executedSteps.length >= plan.recommendedPath.length) {
      plan.status = 'completed';
    }
    this._save();
    return { done: false, action: nextAction, progress: plan.executedSteps.length / plan.recommendedPath.length };
  }

  getPlanStatus(planId) {
    const plan = this.plans[planId];
    if (!plan) return null;
    const remainingActions = plan.recommendedPath.slice(plan.executedSteps.length);
    return {
      planId: plan.planId,
      status: plan.status,
      goal: plan.goal,
      progress: {
        executed: plan.executedSteps.length,
        total: plan.recommendedPath.length,
        percent: plan.recommendedPath.length > 0 ? Math.round((plan.executedSteps.length / plan.recommendedPath.length) * 100) : 0
      },
      bestPath: plan.recommendedPath,
      remainingActions,
      constraints: plan.constraints,
      updatedAt: plan.updatedAt
    };
  }

  replan(planId, newConstraints) {
    const plan = this.plans[planId];
    if (!plan) throw new Error(`Plan ${planId} not found`);
    plan.constraints = { ...plan.constraints, ...newConstraints };
    plan.updatedAt = new Date().toISOString();
    const goalObj = this._parseGoal(plan.goal);
    const root = new TreeNode({ id: planId, state: 'root', action: null, depth: 0 });
    const initialActions = this._generateActions('root', goalObj, 0);
    this.expand(root, initialActions);
    for (let sim = 0; sim < plan.numSimulations; sim++) {
      let node = root;
      let currentDepth = 0;
      while (!node.isLeaf() && currentDepth < plan.maxDepth) {
        node = this.selectUCB1(node);
        currentDepth = node.depth;
      }
      if (node.depth < plan.maxDepth && node.isLeaf()) {
        const actions = this._generateActions(node.state, goalObj, node.depth);
        this.expand(node, actions);
      }
      const result = this.simulate(node, plan.maxDepth - node.depth, goalObj);
      this.backpropagate(node, result);
    }
    const paths = this._findBestPath(root);
    const recommendedPath = paths[0] || { path: [], value: 0 };
    plan.root = root;
    plan.recommendedPath = recommendedPath.path;
    plan.recommendedValue = recommendedPath.value;
    plan.alternativePaths = paths.slice(1, 4).map(p => ({ path: p.path, expectedValue: p.value }));
    plan.status = 'active';
    this._save();
    return plan;
  }
}

module.exports = { PlanningEngine, TreeNode };
