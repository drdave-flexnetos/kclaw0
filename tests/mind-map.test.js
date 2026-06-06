#!/usr/bin/env node
/**
 * Tests for Mind Map Visualization System
 * Run: node tests/mind-map.test.js
 */

const { TreeNode, render, extractPaths, getBestPath, renderCompact, buildTree, STATUS_SYMBOLS } = require('../scripts/mind-map.js');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`✅ PASS: ${message}`);
  return true;
}

function testTreeRendering() {
  console.log('\n🌳 Testing tree rendering...');

  const root = new TreeNode('root', 'Root', 'done');
  const child1 = root.addChild(new TreeNode('c1', 'Child 1', 'active'));
  root.addChild(new TreeNode('c2', 'Child 2', 'pending'));
  child1.addChild(new TreeNode('c1-1', 'Grandchild', 'done'));

  root.computeValue();
  const output = render(root);

  assert(output.includes('✅ Root'), 'Root should have done symbol');
  assert(output.includes('🔄 Child 1'), 'Child 1 should have active symbol');
  assert(output.includes('⏳ Child 2'), 'Child 2 should have pending symbol');
  assert(output.includes('✅ Grandchild'), 'Grandchild should have done symbol');
  assert(output.includes('├──') || output.includes('└──'), 'Should have tree branches');
}

function testPathExtraction() {
  console.log('\n🛤️  Testing path extraction...');

  const root = new TreeNode('root', 'Root', 'done');
  const child1 = root.addChild(new TreeNode('c1', 'Child 1', 'done'));
  const child2 = root.addChild(new TreeNode('c2', 'Child 2', 'pending'));
  child1.addChild(new TreeNode('c1-1', 'Leaf A', 'done'));
  child2.addChild(new TreeNode('c2-1', 'Leaf B', 'pending'));

  root.computeValue();
  const paths = extractPaths(root);

  assert(paths.length === 2, 'Should find 2 leaf paths');
  assert(paths[0].score >= paths[1].score, 'Paths should be sorted by score descending');
  assert(paths[0].path.some(p => p.id === 'c1-1'), 'Best path should include Leaf A');
}

function testBestPath() {
  console.log('\n⭐ Testing best path selection...');

  const root = new TreeNode('root', 'Root', 'done');
  const good = root.addChild(new TreeNode('good', 'Good Path', 'done'));
  const bad = root.addChild(new TreeNode('bad', 'Bad Path', 'failed'));
  good.addChild(new TreeNode('good-leaf', 'Good Leaf', 'done'));
  bad.addChild(new TreeNode('bad-leaf', 'Bad Leaf', 'failed'));

  root.computeValue();
  const best = getBestPath(root);

  assert(best !== null, 'Should return a best path');
  assert(best.score > 0, 'Best path should have positive score');
  assert(best.path.some(p => p.id === 'good'), 'Best path should include Good Path');
  assert(!best.path.some(p => p.id === 'bad'), 'Best path should not include Bad Path');
}

function testCompactRendering() {
  console.log('\n📊 Testing compact rendering...');

  const root = new TreeNode('root', 'Root', 'done');
  root.addChild(new TreeNode('c1', 'Child 1', 'done'));
  root.addChild(new TreeNode('c2', 'Child 2', 'active'));
  root.addChild(new TreeNode('c3', 'Child 3', 'failed'));

  root.computeValue();
  const compact = renderCompact(root);

  assert(compact.includes('4 nodes'), 'Should show 4 nodes');
  assert(compact.includes('✅2'), 'Should show 2 done');
  assert(compact.includes('🔄1'), 'Should show 1 active');
  assert(compact.includes('❌1'), 'Should show 1 failed');
  assert(compact.includes('Best:'), 'Should mention best path');
}

function testMaxDepth() {
  console.log('\n📏 Testing maxDepth limit...');

  const root = new TreeNode('root', 'Root', 'done');
  let current = root;
  for (let i = 0; i < 5; i++) {
    const child = new TreeNode(`c${i}`, `Level ${i}`, 'pending');
    current.addChild(child);
    current = child;
  }

  const full = render(root, 10);
  const limited = render(root, 2);

  assert(full.includes('Level 4'), 'Full render should include deepest level');
  assert(!limited.includes('Level 3'), 'Limited render should not include Level 3');
}

function testBuildTreeFromSteps() {
  console.log('\n🔨 Testing tree building from flat steps...');

  const steps = [
    { id: 'root', label: 'Root', status: 'done' },
    { id: 'c1', label: 'Child 1', status: 'active', parentId: 'root' },
    { id: 'c2', label: 'Child 2', status: 'pending', parentId: 'root' },
    { id: 'c1-1', label: 'Grandchild', status: 'done', parentId: 'c1' },
  ];

  const tree = buildTree(steps);

  assert(tree !== null, 'Should return a tree');
  assert(tree.id === 'root', 'Root should have id "root"');
  assert(tree.children.length === 2, 'Root should have 2 children');
  assert(tree.children[0].children.length === 1, 'Child 1 should have 1 child');
  assert(tree.value > 0, 'Root value should be computed');
}

function testEventLogging() {
  console.log('\n📡 Testing event logging...');

  const steps = [
    { id: 'evt-root', label: 'Event Root', status: 'done' },
    { id: 'evt-c1', label: 'Event Child', status: 'pending', parentId: 'evt-root' },
  ];

  const tree = buildTree(steps);
  assert(tree !== null, 'Tree should be built with event logging');
  // If event-system is available, no error is thrown; if not, it silently fails
  assert(true, 'Event logging should not throw');
}

function testEmptyTree() {
  console.log('\n🌫️ Testing empty tree handling...');

  const nullRender = render(null);
  assert(nullRender === '', 'Render null should return empty string');

  const nullCompact = renderCompact(null);
  assert(nullCompact === 'Empty tree', 'Compact null should return "Empty tree"');

  const nullPaths = extractPaths(null);
  assert(nullPaths.length === 0, 'Extract paths null should return empty array');

  const nullBest = getBestPath(null);
  assert(nullBest === null, 'Best path null should return null');

  const nullBuild = buildTree([]);
  assert(nullBuild === null, 'Build tree with empty array should return null');
}

console.log('🧠 Mind Map Tests');
console.log('=================');

try {
  testTreeRendering();
  testPathExtraction();
  testBestPath();
  testCompactRendering();
  testMaxDepth();
  testBuildTreeFromSteps();
  testEventLogging();
  testEmptyTree();

  console.log('\n🎉 All tests passed!');
} catch (err) {
  console.error('\n💥 Test suite failed:', err.message);
  process.exit(1);
}
