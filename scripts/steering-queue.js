#!/usr/bin/env node
/**
 * Steering Queue System
 * Mid-conversation course correction via injected messages.
 * 
 * Usage:
 *   node scripts/steering-queue.js [command]
 * 
 * Commands:
 *   add <message> [priority]   — Add steering message
 *   list                     — Show pending messages
 *   flush                    — Get and clear all messages
 *   process                  — Show + mark as consumed
 *   clear                    — Clear all messages
 *   expire                   — Remove expired messages
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = '/root/.openclaw/workspace';
const QUEUE_FILE = path.join(WORKSPACE, 'memory', 'steering-queue.json');

// Priority levels and their urgency
const PRIORITY_CONFIG = {
  urgent: { ttlMinutes: 15, icon: '🚨' },
  high: { ttlMinutes: 60, icon: '⚠️' },
  normal: { ttlMinutes: 240, icon: 'ℹ️' },
  low: { ttlMinutes: 1440, icon: '💡' },
};

/**
 * Load queue
 */
function loadQueue() {
  if (!fs.existsSync(QUEUE_FILE)) {
    return { messages: [], lastId: 0 };
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
 * Generate message ID
 */
function generateId(queue) {
  queue.lastId = (queue.lastId || 0) + 1;
  return `str-${String(queue.lastId).padStart(3, '0')}`;
}

/**
 * Add message to queue
 */
function add(message, priority = 'normal', metadata = {}) {
  const queue = loadQueue();
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.normal;
  
  const entry = {
    id: generateId(queue),
    timestamp: new Date().toISOString(),
    message,
    priority,
    status: 'pending',
    ttlMinutes: metadata.ttlMinutes || config.ttlMinutes,
    source: metadata.source || 'user',
    context: metadata.context || null,
    expiresAt: new Date(Date.now() + (metadata.ttlMinutes || config.ttlMinutes) * 60 * 1000).toISOString(),
  };
  
  queue.messages.push(entry);
  saveQueue(queue);
  
  return entry;
}

/**
 * List pending messages
 */
function list() {
  const queue = loadQueue();
  expireOld();
  
  return queue.messages.filter(m => m.status === 'pending');
}

/**
 * Get all pending messages (for injection)
 */
function flush() {
  const queue = loadQueue();
  expireOld();
  
  const pending = queue.messages.filter(m => m.status === 'pending');
  
  // Mark all as consumed
  for (const msg of pending) {
    msg.status = 'consumed';
    msg.consumedAt = new Date().toISOString();
  }
  
  saveQueue(queue);
  return pending;
}

/**
 * Process messages (show without consuming)
 */
function process() {
  const queue = loadQueue();
  expireOld();
  
  const pending = queue.messages.filter(m => m.status === 'pending');
  
  // Mark as consumed
  for (const msg of pending) {
    msg.status = 'consumed';
    msg.consumedAt = new Date().toISOString();
  }
  
  saveQueue(queue);
  return pending;
}

/**
 * Clear all messages
 */
function clear() {
  saveQueue({ messages: [], lastId: 0 });
  return { cleared: true };
}

/**
 * Remove expired messages
 */
function expireOld() {
  const queue = loadQueue();
  const now = new Date();
  
  let expired = 0;
  for (const msg of queue.messages) {
    if (msg.status === 'pending' && new Date(msg.expiresAt) < now) {
      msg.status = 'expired';
      expired++;
    }
  }
  
  if (expired > 0) {
    saveQueue(queue);
  }
  
  return expired;
}

/**
 * Get formatted messages for injection
 */
function getInjectionMessages() {
  const messages = flush();
  
  if (messages.length === 0) return null;
  
  const parts = messages.map(m => {
    const config = PRIORITY_CONFIG[m.priority] || PRIORITY_CONFIG.normal;
    return `${config.icon} [${m.priority.toUpperCase()}] ${m.message}`;
  });
  
  return `\n🎯 STEERING MESSAGES:\n${parts.join('\n')}\n`;
}

/**
 * Print list
 */
function printList(messages) {
  console.log('\n🎯 Steering Queue');
  console.log(`   Pending messages: ${messages.length}`);
  
  if (messages.length === 0) {
    console.log('   (Empty)');
    return;
  }
  
  console.log('');
  for (const msg of messages) {
    const config = PRIORITY_CONFIG[msg.priority] || PRIORITY_CONFIG.normal;
    const timeLeft = Math.max(0, Math.floor((new Date(msg.expiresAt) - Date.now()) / 60000));
    
    console.log(`   ${config.icon}  ${msg.id} [${msg.priority}]`);
    console.log(`      ${msg.message}`);
    console.log(`      Source: ${msg.source} | Expires in: ${timeLeft}m`);
    if (msg.context) {
      console.log(`      Context: ${msg.context}`);
    }
    console.log('');
  }
}

/**
 * Print flush results
 */
function printFlush(messages) {
  console.log('\n🎯 Flushed Steering Messages');
  console.log(`   Consumed: ${messages.length}`);
  
  for (const msg of messages) {
    const config = PRIORITY_CONFIG[msg.priority] || PRIORITY_CONFIG.normal;
    console.log(`   ${config.icon}  ${msg.message}`);
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
      const message = args[1];
      const priority = args[2] || 'normal';
      if (!message) {
        console.log('Usage: node scripts/steering-queue.js add <message> [priority]');
        process.exit(1);
      }
      const entry = add(message, priority);
      console.log(`✅ Added: ${entry.id} (${priority})`);
      break;
    }
    case 'list': {
      const messages = list();
      printList(messages);
      break;
    }
    case 'flush': {
      const messages = flush();
      printFlush(messages);
      break;
    }
    case 'process': {
      const messages = process();
      printFlush(messages);
      break;
    }
    case 'clear': {
      clear();
      console.log('✅ Queue cleared');
      break;
    }
    case 'expire': {
      const count = expireOld();
      console.log(`🧹 Expired ${count} old messages`);
      break;
    }
    case 'inject': {
      const injection = getInjectionMessages();
      if (injection) {
        console.log(injection);
      } else {
        console.log('(No pending steering messages)');
      }
      break;
    }
    default:
      console.log('Usage: node scripts/steering-queue.js [add|list|flush|process|clear|expire|inject]');
      process.exit(1);
  }
}

// Export for testing
module.exports = { add, list, flush, process, clear, expireOld, getInjectionMessages, PRIORITY_CONFIG };

// Only run main if called directly, not when required
if (require.main === module) {
  main();
}
