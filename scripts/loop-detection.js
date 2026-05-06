#!/usr/bin/env node
/**
 * Loop Detection System
 * Detects infinite or cyclic tool call patterns.
 * 
 * Usage:
 *   node scripts/loop-detection.js [command]
 * 
 * Commands:
 *   check              — Check recent tool calls for loops
 *   watch              — Continuous monitoring
 *   history            — Show loop detection history
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = '/root/.openclaw/workspace';
const HISTORY_FILE = path.join(WORKSPACE, 'memory', 'loop-history.json');
const MAX_HISTORY = 100;

/**
 * Load recent tool calls from event log
 */
function loadRecentToolCalls(limit = 50) {
  const eventLog = path.join(WORKSPACE, 'memory', 'event-log.ndjson');
  if (!fs.existsSync(eventLog)) return [];
  
  const lines = fs.readFileSync(eventLog, 'utf-8').trim().split('\n').filter(Boolean);
  const events = lines.map(line => JSON.parse(line));
  
  return events
    .filter(e => e.eventType === 'tool_call')
    .slice(-limit);
}

/**
 * Detect identical tool calls (same tool, same arguments)
 */
function detectIdentical(toolCalls) {
  const loops = [];
  
  for (let i = 0; i < toolCalls.length - 3; i++) {
    const window = toolCalls.slice(i, i + 4);
    const first = window[0];
    
    // Check if all 4 are identical
    const allIdentical = window.every(tc => 
      tc.data.tool === first.data.tool &&
      JSON.stringify(tc.data.args) === JSON.stringify(first.data.args)
    );
    
    if (allIdentical) {
      loops.push({
        type: 'identical',
        start: i,
        end: i + 3,
        tool: first.data.tool,
        count: 4,
        events: window.map(tc => tc.id),
      });
    }
  }
  
  return loops;
}

/**
 * Detect cyclic patterns (repeating sequence)
 */
function detectCycles(toolCalls) {
  const loops = [];
  
  // Try cycle lengths from 2 to 8
  for (let cycleLen = 2; cycleLen <= 8; cycleLen++) {
    for (let start = 0; start <= toolCalls.length - cycleLen * 3; start++) {
      const firstCycle = toolCalls.slice(start, start + cycleLen);
      const secondCycle = toolCalls.slice(start + cycleLen, start + cycleLen * 2);
      const thirdCycle = toolCalls.slice(start + cycleLen * 2, start + cycleLen * 3);
      
      // Compare tool names (not full args, to allow for varying args in cycles)
      const isCycle = firstCycle.every((tc, idx) => 
        tc.data.tool === secondCycle[idx]?.data.tool &&
        tc.data.tool === thirdCycle[idx]?.data.tool
      );
      
      if (isCycle) {
        loops.push({
          type: 'cycle',
          start,
          end: start + cycleLen * 3 - 1,
          cycleLength: cycleLen,
          tool: firstCycle[0].data.tool,
          count: cycleLen * 3,
          events: toolCalls.slice(start, start + cycleLen * 3).map(tc => tc.id),
        });
      }
    }
  }
  
  return loops;
}

/**
 * Detect no-progress loops (many tool calls, no file writes)
 */
function detectNoProgress(toolCalls) {
  const loops = [];
  const minCalls = 8;
  
  if (toolCalls.length < minCalls) return loops;
  
  // Check last N calls
  const recent = toolCalls.slice(-minCalls);
  
  // Count write operations
  const writes = recent.filter(tc => 
    tc.data.tool === 'write' || 
    tc.data.tool === 'edit'
  ).length;
  
  // Count read operations
  const reads = recent.filter(tc =>
    tc.data.tool === 'read' ||
    tc.data.tool === 'web_fetch'
  ).length;
  
  // If mostly reads with no writes, it's a no-progress loop
  if (reads >= minCalls * 0.7 && writes === 0) {
    loops.push({
      type: 'no-progress',
      start: toolCalls.length - minCalls,
      end: toolCalls.length - 1,
      tool: 'read/web_fetch',
      count: minCalls,
      details: { reads, writes },
      events: recent.map(tc => tc.id),
    });
  }
  
  return loops;
}

/**
 * Detect research spirals (repeated web searches)
 */
function detectResearchSpiral(toolCalls) {
  const loops = [];
  const minSearches = 5;
  
  const searches = toolCalls.filter(tc => 
    tc.data.tool === 'kimi_search' || 
    tc.data.tool === 'kimi_fetch' ||
    tc.data.tool === 'web_fetch'
  );
  
  if (searches.length < minSearches) return loops;
  
  const recentSearches = searches.slice(-minSearches);
  
  // Check if searches have overlapping query terms (simple check: same tool)
  const allSameTool = recentSearches.every(tc => 
    tc.data.tool === recentSearches[0].data.tool
  );
  
  if (allSameTool) {
    loops.push({
      type: 'research-spiral',
      start: toolCalls.indexOf(recentSearches[0]),
      end: toolCalls.indexOf(recentSearches[recentSearches.length - 1]),
      tool: recentSearches[0].data.tool,
      count: minSearches,
      events: recentSearches.map(tc => tc.id),
    });
  }
  
  return loops;
}

/**
 * Detect retry loops (repeated errors)
 */
function detectRetry(toolCalls) {
  const loops = [];
  
  // Look for sequences of: call -> error -> call -> error -> call -> error
  for (let i = 0; i < toolCalls.length - 5; i++) {
    const window = toolCalls.slice(i, i + 6);
    
    // Check for alternating tool calls and errors
    let errorCount = 0;
    let sameTool = null;
    
    for (const tc of window) {
      if (tc.data.tool === 'tool_error' || tc.eventType === 'tool_error') {
        errorCount++;
      } else if (!sameTool) {
        sameTool = tc.data.tool;
      }
    }
    
    if (errorCount >= 3) {
      loops.push({
        type: 'retry',
        start: i,
        end: i + 5,
        tool: sameTool || 'unknown',
        count: 6,
        errors: errorCount,
        events: window.map(tc => tc.id),
      });
    }
  }
  
  return loops;
}

/**
 * Run all detection patterns
 */
function check() {
  const toolCalls = loadRecentToolCalls(50);
  
  if (toolCalls.length === 0) {
    return { loops: [], toolCalls: 0, checkedAt: new Date().toISOString() };
  }
  
  const loops = [
    ...detectIdentical(toolCalls),
    ...detectCycles(toolCalls),
    ...detectNoProgress(toolCalls),
    ...detectResearchSpiral(toolCalls),
    ...detectRetry(toolCalls),
  ];
  
  const result = {
    checkedAt: new Date().toISOString(),
    toolCalls: toolCalls.length,
    loops,
    hasLoop: loops.length > 0,
  };
  
  // Save to history
  saveHistory(result);
  
  return result;
}

/**
 * Save detection result to history
 */
function saveHistory(result) {
  let history = [];
  if (fs.existsSync(HISTORY_FILE)) {
    history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
  }
  
  history.push({
    timestamp: result.checkedAt,
    hasLoop: result.hasLoop,
    loopCount: result.loops.length,
    types: result.loops.map(l => l.type),
  });
  
  // Keep only last MAX_HISTORY entries
  if (history.length > MAX_HISTORY) {
    history = history.slice(-MAX_HISTORY);
  }
  
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

/**
 * Load history
 */
function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
}

/**
 * Generate recommendations for detected loops
 */
function generateRecommendations(result) {
  const recs = [];
  
  for (const loop of result.loops) {
    switch (loop.type) {
      case 'identical':
        recs.push({
          type: 'identical',
          action: 'STOP: You are making identical tool calls. Review the results before repeating.',
          severity: 'critical',
        });
        break;
      case 'cycle':
        recs.push({
          type: 'cycle',
          action: 'BREAK CYCLE: Detected repeating pattern of ' + loop.cycleLength + ' tools. Add a write action or ask the user for guidance.',
          severity: 'critical',
        });
        break;
      case 'no-progress':
        recs.push({
          type: 'no-progress',
          action: 'PROGRESS CHECK: ' + loop.count + ' reads with no writes. Summarize findings and write results, or ask for direction.',
          severity: 'warning',
        });
        break;
      case 'research-spiral':
        recs.push({
          type: 'research-spiral',
          action: 'SYNTHESIZE: You have searched ' + loop.count + ' times. Stop researching and write what you have learned, or ask the user if you are stuck.',
          severity: 'warning',
        });
        break;
      case 'retry':
        recs.push({
          type: 'retry',
          action: 'ESCALATE: ' + loop.errors + ' errors in sequence. Report the error to the user and ask for help instead of retrying.',
          severity: 'error',
        });
        break;
    }
  }
  
  return recs;
}

/**
 * Print check results
 */
function printCheck(result) {
  console.log('\n🔄 Loop Detection Check');
  console.log(`   Checked at: ${result.checkedAt}`);
  console.log(`   Tool calls analyzed: ${result.toolCalls}`);
  console.log(`   Loops detected: ${result.loops.length}`);
  
  if (result.hasLoop) {
    console.log('\n   ⚠️  LOOPS DETECTED:');
    for (const loop of result.loops) {
      const icon = loop.type === 'identical' || loop.type === 'cycle' ? '🚨' :
                   loop.type === 'retry' ? '❌' : '⚠️';
      console.log(`   ${icon}  ${loop.type.toUpperCase()}`);
      console.log(`      Tool: ${loop.tool} | Count: ${loop.count}`);
      if (loop.details) {
        console.log(`      Details: ${JSON.stringify(loop.details)}`);
      }
    }
    
    const recs = generateRecommendations(result);
    console.log('\n   💡 Recommendations:');
    for (const rec of recs) {
      const icon = rec.severity === 'critical' ? '🚨' : rec.severity === 'error' ? '❌' : '⚠️';
      console.log(`   ${icon}  ${rec.action}`);
    }
  } else {
    console.log('\n   ✅ No loops detected');
  }
}

/**
 * Print history
 */
function printHistory() {
  const history = loadHistory();
  console.log('\n📜 Loop Detection History');
  console.log(`   Total checks: ${history.length}`);
  
  const loopsFound = history.filter(h => h.hasLoop).length;
  console.log(`   Loops found: ${loopsFound}`);
  
  if (history.length > 0) {
    console.log('\n   Recent checks:');
    const recent = history.slice(-10);
    for (const h of recent) {
      const icon = h.hasLoop ? '⚠️' : '✅';
      console.log(`   ${icon}  ${h.timestamp} - ${h.hasLoop ? h.loopCount + ' loops' : 'clean'}`);
    }
  }
}

/**
 * Watch mode
 */
function watch() {
  console.log('👁️  Loop detection watch mode (Ctrl+C to stop)');
  console.log('   Checking every 10 tool calls...\n');
  
  let lastCount = 0;
  
  const checkLoop = () => {
    const toolCalls = loadRecentToolCalls(50);
    if (toolCalls.length > lastCount) {
      lastCount = toolCalls.length;
      const result = check();
      if (result.hasLoop) {
        console.log(`[${result.checkedAt}] ⚠️  Loop detected!`);
        for (const loop of result.loops) {
          console.log(`  - ${loop.type}: ${loop.tool} (${loop.count} calls)`);
        }
      }
    }
  };
  
  checkLoop();
  const interval = setInterval(checkLoop, 5000);
  
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\n👁️  Watch stopped');
    process.exit(0);
  });
}

/**
 * Main CLI
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'check';
  
  switch (command) {
    case 'check': {
      const result = check();
      printCheck(result);
      break;
    }
    case 'history': {
      printHistory();
      break;
    }
    case 'watch':
      watch();
      break;
    default:
      console.log('Usage: node scripts/loop-detection.js [check|history|watch]');
      process.exit(1);
  }
}

// Export for testing
module.exports = { 
  check, 
  detectIdentical, 
  detectCycles, 
  detectNoProgress, 
  detectResearchSpiral, 
  detectRetry,
  generateRecommendations,
  saveHistory,
  loadHistory,
};

if (require.main === module) {
  main();
}
