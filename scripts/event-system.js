#!/usr/bin/env node
/**
 * Event System
 * Structured action logging for observable agent behavior.
 * 
 * Usage:
 *   node scripts/event-system.js [command]
 * 
 * Commands:
 *   emit <event> <data>  — Emit a single event
 *   query <filters>      — Query events with filters
 *   tail [n]             — Show last n events
 *   stats                — Event statistics
 * 
 * Examples:
 *   node scripts/event-system.js emit session_start '{"session":"abc"}'
 *   node scripts/event-system.js query --type=tool_call --since=1h
 *   node scripts/event-system.js tail 50
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = '/root/.openclaw/workspace';
const EVENT_LOG = path.join(WORKSPACE, 'memory', 'event-log.ndjson');
const SESSION_FILE = path.join(WORKSPACE, 'memory', 'current-session.json');

/**
 * Valid event types per spec
 */
const VALID_EVENT_TYPES = [
  'session_start', 'session_end',
  'tool_call', 'tool_result', 'tool_error',
  'llm_request', 'llm_response', 'llm_error',
  'memory_write', 'memory_read', 'memory_search',
  'memory_edit', 'memory_delete',
  'file_read', 'file_write', 'file_edit', 'file_delete',
  'exec_start', 'exec_result', 'exec_error',
  'subagent_spawn', 'subagent_result', 'subagent_error',
  'heartbeat', 'checkpoint', 'steering_injected',
  'followup_triggered', 'loop_detected', 'stale_files_found',
  'plan_created', 'plan_continued', 'plan_step_executed', 'plan_completed', 'plan_replanned',
  'plan_selected', 'plan_failed', 'simulation_run', 'path_selected',
];

/**
 * Generate unique event ID
 */
function generateEventId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `evt-${timestamp}-${random}`;
}

/**
 * Load current session context
 */
function loadSessionContext() {
  if (!fs.existsSync(SESSION_FILE)) {
    return { sessionId: 'unknown', turnIndex: 0, sequence: 0 };
  }
  return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
}

/**
 * Save session context
 */
function saveSessionContext(ctx) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(ctx, null, 2));
}

/**
 * Get or create session context
 */
function getSessionContext() {
  let ctx = loadSessionContext();
  
  // Check if session is stale (> 30 min inactive)
  if (ctx.lastActivity) {
    const last = new Date(ctx.lastActivity);
    const now = new Date();
    if ((now - last) > 30 * 60 * 1000) {
      // Session expired, start new
      ctx = {
        sessionId: `sess-${Date.now().toString(36)}`,
        turnIndex: 0,
        sequence: 0,
        startTime: new Date().toISOString(),
      };
    }
  }
  
  ctx.sequence = (ctx.sequence || 0) + 1;
  ctx.lastActivity = new Date().toISOString();
  saveSessionContext(ctx);
  
  return ctx;
}

/**
 * Emit an event
 */
function emit(eventType, data = {}, metadata = {}) {
  if (!VALID_EVENT_TYPES.includes(eventType)) {
    throw new Error(`Invalid event type: ${eventType}. Valid types: ${VALID_EVENT_TYPES.join(', ')}`);
  }
  
  const ctx = getSessionContext();
  const event = {
    id: generateEventId(),
    timestamp: new Date().toISOString(),
    sessionId: ctx.sessionId,
    turnIndex: ctx.turnIndex,
    sequence: ctx.sequence,
    eventType,
    data: sanitizeData(data),
    metadata: {
      ...metadata,
      source: metadata.source || 'agent',
    },
    severity: metadata.severity || 'info',
  };
  
  // Append to log
  fs.appendFileSync(EVENT_LOG, JSON.stringify(event) + '\n');
  
  return event;
}

/**
 * Sanitize event data — remove sensitive fields
 */
function sanitizeData(data) {
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'credential', 'api_key', 'private'];
  const sanitized = { ...data };
  
  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

/**
 * Query events
 */
function query(filters = {}) {
  if (!fs.existsSync(EVENT_LOG)) {
    return [];
  }
  
  const lines = fs.readFileSync(EVENT_LOG, 'utf-8').trim().split('\n').filter(Boolean);
  let events = lines.map(line => JSON.parse(line));
  
  if (filters.type) {
    events = events.filter(e => e.eventType === filters.type);
  }
  
  if (filters.since) {
    const sinceMs = parseTimeToMs(filters.since);
    const cutoff = Date.now() - sinceMs;
    events = events.filter(e => new Date(e.timestamp).getTime() > cutoff);
  }
  
  if (filters.session) {
    events = events.filter(e => e.sessionId === filters.session);
  }
  
  if (filters.severity) {
    events = events.filter(e => e.severity === filters.severity);
  }
  
  if (filters.limit) {
    events = events.slice(-filters.limit);
  }
  
  return events;
}

/**
 * Parse time string to milliseconds
 */
function parseTimeToMs(timeStr) {
  const match = timeStr.match(/^(\d+)([smhd])$/);
  if (!match) return 0;
  const [, num, unit] = match;
  const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return parseInt(num) * multipliers[unit];
}

/**
 * Get last n events
 */
function tail(n = 50) {
  return query({ limit: n });
}

/**
 * Get event statistics
 */
function stats() {
  const events = query();
  
  const typeCounts = {};
  const severityCounts = { info: 0, warning: 0, error: 0, critical: 0 };
  const sessionCounts = {};
  
  for (const event of events) {
    typeCounts[event.eventType] = (typeCounts[event.eventType] || 0) + 1;
    severityCounts[event.severity] = (severityCounts[event.severity] || 0) + 1;
    sessionCounts[event.sessionId] = (sessionCounts[event.sessionId] || 0) + 1;
  }
  
  return {
    totalEvents: events.length,
    uniqueSessions: Object.keys(sessionCounts).length,
    typeCounts,
    severityCounts,
    topTypes: Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
    timeRange: events.length > 0 ? {
      first: events[0].timestamp,
      last: events[events.length - 1].timestamp,
    } : null,
  };
}

/**
 * Print event
 */
function printEvent(event) {
  const time = new Date(event.timestamp).toISOString().substring(11, 19);
  const icon = {
    info: 'ℹ️', warning: '⚠️', error: '❌', critical: '🚨',
  }[event.severity] || 'ℹ️';
  
  console.log(`  ${icon} [${time}] ${event.eventType} (seq:${event.sequence})`);
  if (Object.keys(event.data).length > 0) {
    const dataStr = JSON.stringify(event.data).substring(0, 100);
    console.log(`      Data: ${dataStr}${dataStr.length > 100 ? '...' : ''}`);
  }
}

/**
 * Print query results
 */
function printQueryResults(events) {
  console.log(`\n📋 Found ${events.length} events`);
  for (const event of events) {
    printEvent(event);
  }
}

/**
 * Print stats
 */
function printStats(stats) {
  console.log('\n📊 Event Statistics');
  console.log(`   Total events: ${stats.totalEvents}`);
  console.log(`   Unique sessions: ${stats.uniqueSessions}`);
  console.log('');
  console.log('   By severity:');
  for (const [sev, count] of Object.entries(stats.severityCounts)) {
    console.log(`     ${sev}: ${count}`);
  }
  console.log('');
  console.log('   Top event types:');
  for (const [type, count] of stats.topTypes) {
    console.log(`     ${type}: ${count}`);
  }
  if (stats.timeRange) {
    console.log('');
    console.log(`   Time range: ${stats.timeRange.first} → ${stats.timeRange.last}`);
  }
}

/**
 * Parse CLI filters
 */
function parseFilters(args) {
  const filters = {};
  for (const arg of args) {
    if (arg.startsWith('--type=')) {
      filters.type = arg.split('=')[1];
    } else if (arg.startsWith('--since=')) {
      filters.since = arg.split('=')[1];
    } else if (arg.startsWith('--session=')) {
      filters.session = arg.split('=')[1];
    } else if (arg.startsWith('--severity=')) {
      filters.severity = arg.split('=')[1];
    } else if (arg.startsWith('--limit=')) {
      filters.limit = parseInt(arg.split('=')[1]);
    }
  }
  return filters;
}

/**
 * Main CLI
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'stats';
  
  switch (command) {
    case 'emit': {
      const eventType = args[1];
      const data = args[2] ? JSON.parse(args[2]) : {};
      const metadata = args[3] ? JSON.parse(args[3]) : {};
      const event = emit(eventType, data, metadata);
      console.log(`✅ Event emitted: ${event.id}`);
      printEvent(event);
      break;
    }
    case 'query': {
      const filters = parseFilters(args.slice(1));
      const events = query(filters);
      printQueryResults(events);
      break;
    }
    case 'tail': {
      const n = parseInt(args[1]) || 50;
      const events = tail(n);
      printQueryResults(events);
      break;
    }
    case 'stats': {
      const s = stats();
      printStats(s);
      break;
    }
    default:
      console.log('Usage: node scripts/event-system.js [emit|query|tail|stats]');
      process.exit(1);
  }
}

// Export for testing
module.exports = { emit, query, tail, stats, VALID_EVENT_TYPES, sanitizeData, parseTimeToMs };

if (require.main === module) {
  main();
}
