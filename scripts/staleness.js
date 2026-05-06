#!/usr/bin/env node
/**
 * Staleness Detection System
 * Determines when memory files need updating.
 * 
 * Usage:
 *   node scripts/staleness.js [command]
 * 
 * Commands:
 *   check       — Check all tracked files for staleness
 *   report      — Generate full staleness report
 *   auto-fix    — Update staleness-state.json for changed files
 *   watch       — Continuous monitoring
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = '/root/.openclaw/workspace';
const STATE_FILE = path.join(WORKSPACE, 'memory', 'staleness-state.json');
const FINGERPRINT_FILE = path.join(WORKSPACE, 'memory', 'fingerprints.json');

// Staleness rules: max age in days, dependencies, check trigger
const STALENESS_RULES = {
  'SOUL.md': { maxAge: 30, dependencies: [], checkTrigger: 'heartbeat-weekly' },
  'IDENTITY.md': { maxAge: 30, dependencies: [], checkTrigger: 'heartbeat-weekly' },
  'USER.md': { maxAge: 7, dependencies: ['user-interactions'], checkTrigger: 'session-end' },
  'MEMORY.md': { maxAge: 7, dependencies: ['daily-notes'], checkTrigger: 'heartbeat-daily' },
  'memory/knowledge-graph.md': { maxAge: 14, dependencies: ['file-changes'], checkTrigger: 'code-change' },
  'memory/capabilities.md': { maxAge: 14, dependencies: ['skill-changes'], checkTrigger: 'skill-usage' },
  'memory/patterns.md': { maxAge: 7, dependencies: ['new-patterns'], checkTrigger: 'pattern-used' },
  'memory/lessons-learned.md': { maxAge: 3, dependencies: ['mistakes'], checkTrigger: 'lesson-learned' },
  'memory/upgrades.md': { maxAge: 1, dependencies: ['upgrades'], checkTrigger: 'immediate' },
  'memory/self-upgrade-queue.md': { maxAge: 1, dependencies: ['plans'], checkTrigger: 'daily-review' },
  'memory/agent-loop.md': { maxAge: 14, dependencies: ['loop-changes'], checkTrigger: 'heartbeat-weekly' },
  'memory/self-upgrade-pipeline.md': { maxAge: 14, dependencies: ['pipeline-changes'], checkTrigger: 'heartbeat-weekly' },
  'memory/fingerprinting.md': { maxAge: 7, dependencies: [], checkTrigger: 'heartbeat-daily' },
  'memory/staleness.md': { maxAge: 7, dependencies: [], checkTrigger: 'heartbeat-daily' },
  'memory/event-system.md': { maxAge: 14, dependencies: [], checkTrigger: 'heartbeat-weekly' },
  'memory/loop-detection.md': { maxAge: 14, dependencies: [], checkTrigger: 'heartbeat-weekly' },
  'memory/steering-queue.md': { maxAge: 14, dependencies: [], checkTrigger: 'heartbeat-weekly' },
  'memory/followup-queue.md': { maxAge: 14, dependencies: [], checkTrigger: 'heartbeat-weekly' },
  'memory/subagent-roles.md': { maxAge: 14, dependencies: [], checkTrigger: 'heartbeat-weekly' },
};

/**
 * Load staleness state
 */
function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return { lastCheck: null, files: {} };
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
}

/**
 * Save staleness state
 */
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Load fingerprints
 */
function loadFingerprints() {
  if (!fs.existsSync(FINGERPRINT_FILE)) {
    return { files: {} };
  }
  return JSON.parse(fs.readFileSync(FINGERPRINT_FILE, 'utf-8'));
}

/**
 * Get file modification time
 */
function getFileMtime(filePath) {
  const fullPath = path.join(WORKSPACE, filePath);
  if (!fs.existsSync(fullPath)) return null;
  return fs.statSync(fullPath).mtime;
}

/**
 * Calculate days since date
 */
function daysSince(date) {
  if (!date) return Infinity;
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  return diffMs / (1000 * 60 * 60 * 24);
}

/**
 * Calculate staleness score
 */
function calculateStaleness(filePath, rule, state, fingerprints) {
  const fpEntry = fingerprints.files[filePath];
  const stateEntry = state.files[filePath];
  const mtime = getFileMtime(filePath);
  
  // Days since update
  const lastUpdate = stateEntry?.lastUpdate || (fpEntry?.firstSeen);
  const daysSinceUpdate = daysSince(lastUpdate);
  
  // Has file been modified since last check?
  const fpHash = fpEntry?.hash;
  const stateHash = stateEntry?.lastHash;
  const hashChanged = fpHash && stateHash && fpHash !== stateHash;
  
  // Time component (0-60 scale)
  const timeScore = Math.min(daysSinceUpdate / rule.maxAge * 30, 30);
  
  // Change component (0-40 scale)
  const changeScore = hashChanged ? 40 : 0;
  
  // Age component (0-30 scale)
  const ageScore = Math.min(daysSinceUpdate / 30 * 30, 30);
  
  const totalScore = Math.min(timeScore + changeScore + ageScore, 100);
  
  let status;
  if (totalScore === 0 || daysSinceUpdate < rule.maxAge * 0.5) {
    status = 'fresh';
  } else if (totalScore < 30 || daysSinceUpdate < rule.maxAge) {
    status = 'mildly-stale';
  } else if (totalScore < 60 || daysSinceUpdate < rule.maxAge * 2) {
    status = 'stale';
  } else {
    status = 'very-stale';
  }
  
  return {
    file: filePath,
    lastUpdate: lastUpdate || null,
    daysSinceUpdate: Math.round(daysSinceUpdate * 10) / 10,
    maxAge: rule.maxAge,
    hashChanged,
    stalenessScore: Math.round(totalScore),
    status,
    nextReview: calculateNextReview(status, daysSinceUpdate, rule.maxAge),
  };
}

/**
 * Calculate next review date
 */
function calculateNextReview(status, daysSinceUpdate, maxAge) {
  const now = new Date();
  if (status === 'fresh') {
    const daysUntilStale = Math.max(maxAge - daysSinceUpdate, 1);
    return new Date(now.getTime() + daysUntilStale * 24 * 60 * 60 * 1000).toISOString();
  } else if (status === 'mildly-stale') {
    return new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString();
  } else {
    return now.toISOString(); // Review immediately
  }
}

/**
 * Check all files
 */
function check() {
  const state = loadState();
  const fingerprints = loadFingerprints();
  const results = [];
  
  for (const [filePath, rule] of Object.entries(STALENESS_RULES)) {
    const result = calculateStaleness(filePath, rule, state, fingerprints);
    results.push(result);
  }
  
  // Sort by staleness score (descending)
  results.sort((a, b) => b.stalenessScore - a.stalenessScore);
  
  return results;
}

/**
 * Generate report
 */
function generateReport() {
  const results = check();
  const now = new Date().toISOString();
  
  const fresh = results.filter(r => r.status === 'fresh');
  const mild = results.filter(r => r.status === 'mildly-stale');
  const stale = results.filter(r => r.status === 'stale');
  const veryStale = results.filter(r => r.status === 'very-stale');
  
  return {
    timestamp: now,
    summary: {
      total: results.length,
      fresh: fresh.length,
      mildlyStale: mild.length,
      stale: stale.length,
      veryStale: veryStale.length,
    },
    files: results,
    recommendations: generateRecommendations(results),
  };
}

/**
 * Generate recommendations
 */
function generateRecommendations(results) {
  const recommendations = [];
  
  const veryStale = results.filter(r => r.status === 'very-stale');
  const stale = results.filter(r => r.status === 'stale');
  
  if (veryStale.length > 0) {
    recommendations.push({
      priority: 'urgent',
      action: 'Update very stale files immediately',
      files: veryStale.map(r => r.file),
    });
  }
  
  if (stale.length > 0) {
    recommendations.push({
      priority: 'high',
      action: 'Review and update stale files',
      files: stale.map(r => r.file),
    });
  }
  
  return recommendations;
}

/**
 * Auto-fix: update state to match current fingerprints
 */
function autoFix() {
  const state = loadState();
  const fingerprints = loadFingerprints();
  const now = new Date().toISOString();
  
  state.lastCheck = now;
  
  for (const filePath of Object.keys(STALENESS_RULES)) {
    const fpEntry = fingerprints.files[filePath];
    if (!fpEntry) continue;
    
    state.files[filePath] = {
      lastUpdate: now,
      lastHash: fpEntry.hash,
      lastSize: fpEntry.size,
      lastLines: fpEntry.lines,
      status: 'fresh',
      nextReview: calculateNextReview('fresh', 0, STALENESS_RULES[filePath].maxAge),
    };
  }
  
  saveState(state);
  return state;
}

/**
 * Print report
 */
function printReport(report) {
  console.log('\n📊 Staleness Report');
  console.log(`   Generated: ${report.timestamp}`);
  console.log('');
  console.log(`   Total tracked: ${report.summary.total}`);
  console.log(`   ✅ Fresh: ${report.summary.fresh}`);
  console.log(`   🟡 Mildly stale: ${report.summary.mildlyStale}`);
  console.log(`   🟠 Stale: ${report.summary.stale}`);
  console.log(`   🔴 Very stale: ${report.summary.veryStale}`);
  console.log('');
  
  if (report.recommendations.length > 0) {
    console.log('   Recommendations:');
    for (const rec of report.recommendations) {
      const icon = rec.priority === 'urgent' ? '🔴' : '🟠';
      console.log(`   ${icon}  [${rec.priority.toUpperCase()}] ${rec.action}`);
      for (const file of rec.files) {
        console.log(`      → ${file}`);
      }
    }
    console.log('');
  }
  
  console.log('   File Details:');
  for (const file of report.files) {
    const icon = file.status === 'fresh' ? '✅' : 
                 file.status === 'mildly-stale' ? '🟡' :
                 file.status === 'stale' ? '🟠' : '🔴';
    console.log(`   ${icon}  ${file.file}`);
    console.log(`      Score: ${file.stalenessScore}/100 | Age: ${file.daysSinceUpdate}d | Max: ${file.maxAge}d`);
  }
}

/**
 * Watch mode
 */
function watch() {
  console.log('👁️  Staleness watch mode (Ctrl+C to stop)');
  console.log('   Checking every 60 seconds...\n');
  
  const checkAndReport = () => {
    const report = generateReport();
    const stale = report.files.filter(f => f.status === 'stale' || f.status === 'very-stale');
    if (stale.length > 0) {
      console.log(`[${new Date().toISOString()}] ⚠️  ${stale.length} stale files detected`);
      for (const f of stale) {
        console.log(`  - ${f.file} (${f.status}, score: ${f.stalenessScore})`);
      }
    }
  };
  
  checkAndReport();
  const interval = setInterval(checkAndReport, 60000);
  
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
      const results = check();
      const report = generateReport();
      printReport(report);
      break;
    }
    case 'report': {
      const report = generateReport();
      printReport(report);
      break;
    }
    case 'auto-fix': {
      const state = autoFix();
      console.log('✅ Staleness state updated');
      console.log(`   Files tracked: ${Object.keys(state.files).length}`);
      console.log(`   Last check: ${state.lastCheck}`);
      break;
    }
    case 'watch':
      watch();
      break;
    default:
      console.log('Usage: node scripts/staleness.js [check|report|auto-fix|watch]');
      process.exit(1);
  }
}

// Export for testing
module.exports = { check, generateReport, autoFix, calculateStaleness, daysSince, STALENESS_RULES };

if (require.main === module) {
  main();
}
