#!/usr/bin/env node
/**
 * Followup Queue System
 * Post-completion task processing with scheduling.
 * 
 * Usage:
 *   node scripts/followup-queue.js [command]
 * 
 * Commands:
 *   add <summary> <priority>    — Add followup task
 *   list                        — Show pending tasks
 *   run                         — Execute due tasks
 *   clear                       — Clear completed tasks
 *   stats                       — Queue statistics
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = '/root/.openclaw/workspace';
const QUEUE_FILE = path.join(WORKSPACE, 'memory', 'followup-queue.json');

const PRIORITY_CONFIG = {
  critical: { icon: '🚨', defaultDelay: 0 },      // Immediate
  high: { icon: '⚠️', defaultDelay: 15 },         // 15 minutes
  normal: { icon: 'ℹ️', defaultDelay: 60 },       // 1 hour
  low: { icon: '💡', defaultDelay: 240 },         // 4 hours
};

/**
 * Load queue
 */
function loadQueue() {
  if (!fs.existsSync(QUEUE_FILE)) {
    return { tasks: [], lastId: 0 };
  }
  return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
}

/**
 * Save queue
 */
function saveQueue(queue) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

/**
 * Generate task ID
 */
function generateId(queue) {
  queue.lastId = (queue.lastId || 0) + 1;
  return `fol-${String(queue.lastId).padStart(3, '0')}`;
}

/**
 * Add followup task
 */
function add(summary, priority = 'normal', metadata = {}) {
  const queue = loadQueue();
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.normal;
  
  const delayMinutes = metadata.delayMinutes !== undefined 
    ? metadata.delayMinutes 
    : config.defaultDelay;
  
  const task = {
    id: generateId(queue),
    timestamp: new Date().toISOString(),
    summary,
    priority,
    status: 'pending',
    delayMinutes,
    dueAt: new Date(Date.now() + delayMinutes * 60 * 1000).toISOString(),
    source: metadata.source || 'conversation',
    action: metadata.action || null,
    origin: metadata.origin || null,
    completedAt: null,
    result: null,
  };
  
  queue.tasks.push(task);
  saveQueue(queue);
  
  return task;
}

/**
 * List pending tasks
 */
function list() {
  const queue = loadQueue();
  expireOld();
  
  return queue.tasks.filter(t => t.status === 'pending');
}

/**
 * List tasks due now
 */
function due() {
  const now = new Date();
  const all = list();
  
  return all.filter(t => new Date(t.dueAt) <= now);
}

/**
 * Mark task as completed
 */
function complete(taskId, result = null) {
  const queue = loadQueue();
  const task = queue.tasks.find(t => t.id === taskId);
  
  if (!task) return null;
  
  task.status = 'completed';
  task.completedAt = new Date().toISOString();
  task.result = result;
  
  saveQueue(queue);
  return task;
}

/**
 * Cancel a task
 */
function cancel(taskId) {
  const queue = loadQueue();
  const task = queue.tasks.find(t => t.id === taskId);
  
  if (!task) return null;
  
  task.status = 'cancelled';
  task.cancelledAt = new Date().toISOString();
  
  saveQueue(queue);
  return task;
}

/**
 * Remove expired tasks (older than 7 days)
 */
function expireOld() {
  const queue = loadQueue();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const beforeCount = queue.tasks.length;
  queue.tasks = queue.tasks.filter(t => {
    if (t.status === 'pending') return true;
    const completedDate = t.completedAt ? new Date(t.completedAt) : null;
    const createdDate = new Date(t.timestamp);
    
    // Keep completed tasks for 7 days, pending tasks forever
    if (t.status === 'completed' && completedDate && completedDate < sevenDaysAgo) {
      return false;
    }
    if (t.status === 'cancelled' && createdDate < sevenDaysAgo) {
      return false;
    }
    return true;
  });
  
  const removed = beforeCount - queue.tasks.length;
  if (removed > 0) {
    saveQueue(queue);
  }
  
  return removed;
}

/**
 * Clear completed/cancelled tasks
 */
function clearCompleted() {
  const queue = loadQueue();
  const beforeCount = queue.tasks.length;
  
  queue.tasks = queue.tasks.filter(t => t.status === 'pending');
  
  const removed = beforeCount - queue.tasks.length;
  saveQueue(queue);
  
  return { removed, remaining: queue.tasks.length };
}

/**
 * Get queue statistics
 */
function stats() {
  const queue = loadQueue();
  
  const pending = queue.tasks.filter(t => t.status === 'pending');
  const completed = queue.tasks.filter(t => t.status === 'completed');
  const cancelled = queue.tasks.filter(t => t.status === 'cancelled');
  const expired = queue.tasks.filter(t => t.status === 'expired');
  
  const dueNow = pending.filter(t => new Date(t.dueAt) <= new Date());
  
  return {
    total: queue.tasks.length,
    pending: pending.length,
    completed: completed.length,
    cancelled: cancelled.length,
    expired: expired.length,
    dueNow: dueNow.length,
    byPriority: {
      critical: pending.filter(t => t.priority === 'critical').length,
      high: pending.filter(t => t.priority === 'high').length,
      normal: pending.filter(t => t.priority === 'normal').length,
      low: pending.filter(t => t.priority === 'low').length,
    },
  };
}

/**
 * Run due tasks (simulated execution)
 */
function run() {
  const tasks = due();
  const results = [];
  
  for (const task of tasks) {
    // In real implementation, this would execute the task
    // For now, we just mark as completed with a note
    complete(task.id, { executed: true, auto: true });
    results.push(task);
  }
  
  return results;
}

/**
 * Print list
 */
function printList(tasks) {
  console.log('\n📋 Followup Queue');
  console.log(`   Pending tasks: ${tasks.length}`);
  
  if (tasks.length === 0) {
    console.log('   (Empty)');
    return;
  }
  
  // Sort by due date
  tasks.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  
  console.log('');
  for (const task of tasks) {
    const config = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.normal;
    const dueIn = Math.floor((new Date(task.dueAt) - Date.now()) / 60000);
    const dueText = dueIn <= 0 ? 'DUE NOW' : `${dueIn}m`;
    
    console.log(`   ${config.icon}  ${task.id} [${task.priority}] — ${dueText}`);
    console.log(`      ${task.summary}`);
    if (task.origin) {
      console.log(`      Origin: ${task.origin}`);
    }
    console.log('');
  }
}

/**
 * Print stats
 */
function printStats(stats) {
  console.log('\n📊 Followup Queue Statistics');
  console.log(`   Total: ${stats.total}`);
  console.log(`   Pending: ${stats.pending}`);
  console.log(`   Due now: ${stats.dueNow}`);
  console.log(`   Completed: ${stats.completed}`);
  console.log(`   Cancelled: ${stats.cancelled}`);
  console.log('');
  console.log('   By priority:');
  for (const [prio, count] of Object.entries(stats.byPriority)) {
    console.log(`     ${prio}: ${count}`);
  }
}

/**
 * Print run results
 */
function printRun(results) {
  console.log('\n⚡ Executed Tasks');
  console.log(`   Completed: ${results.length}`);
  
  for (const task of results) {
    const config = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.normal;
    console.log(`   ${config.icon}  ${task.id}: ${task.summary}`);
  }
}

/**
 * Main CLI
 */
function main() {
  let args = [];
  try {
    args = process.argv ? process.argv.slice(2) : [];
  } catch (e) {
    args = [];
  }
  
  const command = args[0] || 'list';
  
  switch (command) {
    case 'add': {
      const summary = args[1];
      const priority = args[2] || 'normal';
      if (!summary) {
        console.log('Usage: node scripts/followup-queue.js add <summary> [priority]');
        process.exit(1);
      }
      const task = add(summary, priority);
      console.log(`✅ Added: ${task.id} (${priority}, due in ${task.delayMinutes}m)`);
      break;
    }
    case 'list': {
      const tasks = list();
      printList(tasks);
      break;
    }
    case 'due': {
      const tasks = due();
      printList(tasks);
      break;
    }
    case 'complete': {
      const taskId = args[1];
      if (!taskId) {
        console.log('Usage: node scripts/followup-queue.js complete <taskId>');
        process.exit(1);
      }
      const task = complete(taskId);
      if (task) {
        console.log(`✅ Completed: ${task.id}`);
      } else {
        console.log(`❌ Task not found: ${taskId}`);
      }
      break;
    }
    case 'cancel': {
      const taskId = args[1];
      if (!taskId) {
        console.log('Usage: node scripts/followup-queue.js cancel <taskId>');
        process.exit(1);
      }
      const task = cancel(taskId);
      if (task) {
        console.log(`🚫 Cancelled: ${task.id}`);
      } else {
        console.log(`❌ Task not found: ${taskId}`);
      }
      break;
    }
    case 'run': {
      const results = run();
      printRun(results);
      break;
    }
    case 'clear': {
      const result = clearCompleted();
      console.log(`🧹 Cleared ${result.removed} completed/cancelled tasks`);
      break;
    }
    case 'stats': {
      const s = stats();
      printStats(s);
      break;
    }
    default:
      console.log('Usage: node scripts/followup-queue.js [add|list|due|complete|cancel|run|clear|stats]');
      process.exit(1);
  }
}

// Export for testing
module.exports = { add, list, due, complete, cancel, expireOld, clearCompleted, stats, run, PRIORITY_CONFIG };

// Only run main if called directly
if (require.main === module) {
  main();
}
