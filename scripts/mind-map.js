#!/usr/bin/env node
/**
 * Mind Map Visualization System
 * Tree rendering, path extraction, and planning visualization.
 *
 * Usage:
 *   const { TreeNode, render, extractPaths, buildTree, getBestPath, renderCompact } = require('./scripts/mind-map.js');
 */

const { emit } = require('./event-system.js');

const STATUS_SYMBOLS = {
  done: '✅',
  active: '🔄',
  pending: '⏳',
  failed: '❌',
};

const STATUS_SCORES = {
  done: 3,
  active: 2,
  pending: 1,
  failed: -1,
};

/**
 * Lightweight tree node
 */
class TreeNode {
  constructor(id, label, status = 'pending', value = 0, visits = 0) {
    this.id = id;
    this.label = label;
    this.status = status;
    this.children = [];
    this.value = value;
    this.visits = visits;
  }

  addChild(node) {
    this.children.push(node);
    return node;
  }

  computeValue() {
    if (this.children.length === 0) return STATUS_SCORES[this.status] || 0;
    this.value = this.children.reduce((sum, c) => sum + c.computeValue(), 0);
    return this.value;
  }
}

/**
 * Render tree as ASCII art
 */
function render(node, maxDepth = 10, depth = 0, prefix = '', isLast = true) {
  if (!node || depth > maxDepth) return '';

  const symbol = STATUS_SYMBOLS[node.status] || '⏳';
  const branch = depth === 0 ? '' : prefix + (isLast ? '└── ' : '├── ');
  const line = `${branch}${symbol} ${node.label} (v:${node.value || 0})\n`;

  const childPrefix = depth === 0 ? '' : prefix + (isLast ? '    ' : '│   ');
  let result = line;

  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const last = i === node.children.length - 1;
    result += render(child, maxDepth, depth + 1, childPrefix, last);
  }

  return result;
}

/**
 * Extract all root-to-leaf paths, sorted by score descending
 */
function extractPaths(node, currentPath = [], allPaths = []) {
  if (!node) return allPaths;

  const pathEntry = { id: node.id, label: node.label, status: node.status, value: node.value };
  const newPath = [...currentPath, pathEntry];

  if (node.children.length === 0) {
    const score = newPath.reduce((s, p) => s + (STATUS_SCORES[p.status] || 0), 0);
    allPaths.push({ path: newPath, score });
  } else {
    for (const child of node.children) {
      extractPaths(child, newPath, allPaths);
    }
  }

  return allPaths.sort((a, b) => b.score - a.score);
}

/**
 * Get the highest-scoring path
 */
function getBestPath(node) {
  const paths = extractPaths(node);
  return paths.length > 0 ? paths[0] : null;
}

/**
 * Compact one-line summary
 */
function renderCompact(node) {
  if (!node) return 'Empty tree';
  const paths = extractPaths(node);
  const best = paths[0];
  const totalNodes = countNodes(node);
  const doneCount = countByStatus(node, 'done');
  const activeCount = countByStatus(node, 'active');
  const failedCount = countByStatus(node, 'failed');

  let summary = `📊 ${totalNodes} nodes | ✅${doneCount} 🔄${activeCount} ❌${failedCount}`;
  if (best) {
    summary += ` | Best: ${best.path.map(p => p.label).join(' → ')} (score:${best.score})`;
  }
  return summary;
}

/**
 * Build tree from flat list of plan steps
 * Steps: [{ id, label, status, parentId, visits }]
 */
function buildTree(steps) {
  if (!steps || steps.length === 0) return null;

  const nodes = new Map();
  let root = null;

  // First pass: create all nodes
  for (const step of steps) {
    const node = new TreeNode(
      step.id,
      step.label,
      step.status || 'pending',
      step.value || 0,
      step.visits || 0
    );
    nodes.set(step.id, node);
  }

  // Second pass: wire up parent-child
  for (const step of steps) {
    const node = nodes.get(step.id);
    if (step.parentId && nodes.has(step.parentId)) {
      nodes.get(step.parentId).addChild(node);
    } else {
      root = node; // No parent = root
    }
  }

  // Compute values bottom-up
  if (root) root.computeValue();

  // Log event
  try {
    emit('mindmap.rendered', { nodeCount: nodes.size, rootId: root?.id });
  } catch (e) {
    // Silent fail if event system unavailable
  }

  return root;
}

// Helpers
function countNodes(node) {
  if (!node) return 0;
  return 1 + node.children.reduce((sum, c) => sum + countNodes(c), 0);
}

function countByStatus(node, status) {
  if (!node) return 0;
  const self = node.status === status ? 1 : 0;
  return self + node.children.reduce((sum, c) => sum + countByStatus(c, status), 0);
}

module.exports = {
  TreeNode,
  render,
  extractPaths,
  getBestPath,
  renderCompact,
  buildTree,
  STATUS_SYMBOLS,
  STATUS_SCORES,
};
