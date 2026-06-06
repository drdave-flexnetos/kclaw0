#!/usr/bin/env node
/**
 * Heartbeat Scheduler — 24/7 Runtime for KClaw0
 *
 * Cron-based scheduling, file watchers, alert conditions,
 * with event-system integration and persistent state.
 *
 * API:
 *   schedule(cronExpr, taskName, callback) — Schedule a recurring task
 *   watch(filePath, callback)             — Watch a file for changes
 *   alert(condition, callback)            — Alert on threshold breach
 *   start()                               — Start the scheduler loop
 *   stop()                                — Stop and save state
 *
 * Usage:
 *   const hb = require('./heartbeat.js');
 *   hb.schedule('0 * * * *', 'hourly-check', () => console.log('tick'));
 *   hb.start();
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = '/root/.openclaw/workspace';
const STATE_FILE = path.join(WORKSPACE, 'memory', 'heartbeat-state.json');

// Import event-system for structured logging
const { emit } = require('./event-system.js');

// ──────────────────────────────────────────────
// Cron Parser
// ──────────────────────────────────────────────

const CRON_ALIASES = {
  '@yearly':  '0 0 1 1 *',
  '@annually':'0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly':  '0 0 * * 0',
  '@daily':   '0 0 * * *',
  '@hourly':  '0 * * * *',
  '@minute':  '* * * * *',
};

/**
 * Parse a 5-field cron expression into field arrays.
 * Fields: minute hour day month dow
 */
function parseCron(expr) {
  const normalized = CRON_ALIASES[expr] || expr;
  const parts = normalized.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression "${expr}": expected 5 fields, got ${parts.length}`);
  }
  return parts.map((field, idx) => parseCronField(field, idx));
}

/**
 * Parse a single cron field.
 */
function parseCronField(field, fieldIndex) {
  const ranges = [
    { min: 0, max: 59 },   // minute
    { min: 0, max: 23 },   // hour
    { min: 1, max: 31 },   // day of month
    { min: 1, max: 12 },   // month
    { min: 0, max: 6 },    // day of week (0=Sun)
  ];
  const { min, max } = ranges[fieldIndex];

  // Wildcard
  if (field === '*') {
    return { type: 'any', min, max };
  }

  // Step: */5
  if (field.startsWith('*/')) {
    const step = parseInt(field.slice(2), 10);
    if (isNaN(step) || step <= 0) throw new Error(`Invalid step in "${field}"`);
    return { type: 'step', step, min, max };
  }

  // Range: 1-5
  if (field.includes('-')) {
    const [start, end] = field.split('-').map(Number);
    if (isNaN(start) || isNaN(end)) throw new Error(`Invalid range "${field}"`);
    return { type: 'range', start, end };
  }

  // List: 1,3,5
  if (field.includes(',')) {
    const values = field.split(',').map(Number).filter(n => !isNaN(n));
    return { type: 'list', values };
  }

  // Single value
  const val = parseInt(field, 10);
  if (isNaN(val)) throw new Error(`Invalid cron field "${field}"`);
  return { type: 'value', value: val };
}

/**
 * Check if a given date matches a parsed cron field.
 */
function fieldMatches(fieldSpec, value) {
  switch (fieldSpec.type) {
    case 'any': return true;
    case 'step': return value % fieldSpec.step === 0 && value >= fieldSpec.min && value <= fieldSpec.max;
    case 'range': return value >= fieldSpec.start && value <= fieldSpec.end;
    case 'list': return fieldSpec.values.includes(value);
    case 'value': return value === fieldSpec.value;
    default: return false;
  }
}

/**
 * Check if a given date matches a full cron expression.
 */
function cronMatches(expr, date) {
  const fields = parseCron(expr);
  return (
    fieldMatches(fields[0], date.getMinutes()) &&
    fieldMatches(fields[1], date.getHours()) &&
    fieldMatches(fields[2], date.getDate()) &&
    fieldMatches(fields[3], date.getMonth() + 1) &&
    fieldMatches(fields[4], date.getDay())
  );
}

/**
 * Calculate the next run time for a cron expression.
 * Returns a Date object.
 */
function getNextRun(expr, fromTime = new Date()) {
  const fields = parseCron(expr);
  const next = new Date(fromTime);
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 1);

  // Safety limit: search up to 366 days ahead
  const maxIter = 366 * 24 * 60;
  for (let i = 0; i < maxIter; i++) {
    if (cronMatches(expr, next)) {
      return next;
    }
    next.setMinutes(next.getMinutes() + 1);
  }

  throw new Error(`Could not find next run for "${expr}" within 1 year`);
}

// ──────────────────────────────────────────────
// HeartbeatScheduler Class
// ──────────────────────────────────────────────

class HeartbeatScheduler {
  constructor() {
    this.tasks = new Map();      // taskName -> { cronExpr, callback, nextRun, lastRun, enabled, metadata }
    this.watchers = new Map();   // filePath -> { lastMtime, callback, enabled, metadata }
    this.alerts = new Map();     // alertName -> { condition, callback, enabled, lastTriggered, metadata }
    this.running = false;
    this.intervalId = null;
    this.tickIntervalMs = 60 * 1000; // 1 minute
    this.state = this.loadState();
  }

  // ── Cron Scheduling ──

  schedule(cronExpr, taskName, callback, metadata = {}) {
    if (!cronExpr || typeof taskName !== 'string' || typeof callback !== 'function') {
      throw new Error('schedule(cronExpr, taskName, callback) requires all three arguments');
    }
    // Validate cron expression
    parseCron(cronExpr);

    const nextRun = getNextRun(cronExpr);
    const task = {
      cronExpr,
      callback,
      nextRun: nextRun.toISOString(),
      lastRun: null,
      enabled: true,
      metadata,
      createdAt: new Date().toISOString(),
    };
    this.tasks.set(taskName, task);
    this.emitEvent('heartbeat', {
      action: 'schedule',
      taskName,
      cronExpr,
      nextRun: nextRun.toISOString(),
    });
    return task;
  }

  unschedule(taskName) {
    const existed = this.tasks.delete(taskName);
    if (existed) {
      this.emitEvent('heartbeat', { action: 'unschedule', taskName });
    }
    return existed;
  }

  // ── File Watchers ──

  watch(filePath, callback, metadata = {}) {
    if (!filePath || typeof callback !== 'function') {
      throw new Error('watch(filePath, callback) requires filePath and callback');
    }
    const absPath = path.resolve(filePath);
    let lastMtime = 0;
    try {
      const stat = fs.statSync(absPath);
      lastMtime = stat.mtimeMs;
    } catch (err) {
      // File may not exist yet; that's OK, we'll watch for creation
      lastMtime = 0;
    }
    const watcher = {
      filePath: absPath,
      callback,
      lastMtime,
      enabled: true,
      metadata,
      createdAt: new Date().toISOString(),
    };
    this.watchers.set(absPath, watcher);
    this.emitEvent('heartbeat', { action: 'watch', filePath: absPath });
    return watcher;
  }

  unwatch(filePath) {
    const absPath = path.resolve(filePath);
    const existed = this.watchers.delete(absPath);
    if (existed) {
      this.emitEvent('heartbeat', { action: 'unwatch', filePath: absPath });
    }
    return existed;
  }

  // ── Alert Conditions ──

  alert(condition, callback, alertName = `alert-${Date.now()}`) {
    if (!condition || typeof callback !== 'function') {
      throw new Error('alert(condition, callback) requires condition and callback');
    }
    const alertObj = {
      condition,
      callback,
      enabled: true,
      lastTriggered: null,
      createdAt: new Date().toISOString(),
    };
    this.alerts.set(alertName, alertObj);
    this.emitEvent('heartbeat', { action: 'alert', alertName, condition: this.describeCondition(condition) });
    return alertName;
  }

  removeAlert(alertName) {
    const existed = this.alerts.delete(alertName);
    if (existed) {
      this.emitEvent('heartbeat', { action: 'remove_alert', alertName });
    }
    return existed;
  }

  describeCondition(condition) {
    if (typeof condition === 'function') return '<function>';
    if (typeof condition === 'object') {
      return JSON.stringify(condition).substring(0, 200);
    }
    return String(condition);
  }

  // ── Lifecycle ──

  start() {
    if (this.running) return;
    this.running = true;
    this.emitEvent('heartbeat', { action: 'start', tasks: this.tasks.size, watchers: this.watchers.size, alerts: this.alerts.size });
    this.tick(); // immediate first tick
    this.intervalId = setInterval(() => this.tick(), this.tickIntervalMs);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.saveState();
    this.emitEvent('heartbeat', { action: 'stop' });
  }

  // ── Tick Engine ──

  tick() {
    const now = new Date();
    this.checkCronTasks(now);
    this.checkWatchers(now);
    this.checkAlerts(now);
    this.saveState();
  }

  checkCronTasks(now) {
    for (const [taskName, task] of this.tasks.entries()) {
      if (!task.enabled) continue;
      const nextRun = new Date(task.nextRun);
      if (now >= nextRun) {
        // Trigger the task
        this.runTask(taskName, task);
        // Recalculate next run
        task.lastRun = now.toISOString();
        task.nextRun = getNextRun(task.cronExpr, new Date(now.getTime() + 60000)).toISOString();
      }
    }
  }

  runTask(taskName, task) {
    try {
      task.callback();
      this.emitEvent('heartbeat', { action: 'task_run', taskName, status: 'success' });
    } catch (err) {
      this.emitEvent('heartbeat', { action: 'task_run', taskName, status: 'error', error: err.message }, { severity: 'error' });
    }
  }

  checkWatchers(now) {
    for (const [filePath, watcher] of this.watchers.entries()) {
      if (!watcher.enabled) continue;
      try {
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs > watcher.lastMtime) {
          watcher.lastMtime = stat.mtimeMs;
          try {
            watcher.callback(filePath, stat.mtimeMs);
            this.emitEvent('heartbeat', { action: 'file_change', filePath, mtime: stat.mtimeMs });
          } catch (err) {
            this.emitEvent('heartbeat', { action: 'file_change', filePath, status: 'error', error: err.message }, { severity: 'error' });
          }
        }
      } catch (err) {
        // File may have been deleted; skip silently
      }
    }
  }

  checkAlerts(now) {
    for (const [alertName, alertObj] of this.alerts.entries()) {
      if (!alertObj.enabled) continue;
      let triggered = false;
      try {
        if (typeof alertObj.condition === 'function') {
          triggered = alertObj.condition();
        } else if (typeof alertObj.condition === 'object') {
          triggered = this.evaluateAlertCondition(alertObj.condition);
        }
      } catch (err) {
        this.emitEvent('heartbeat', { action: 'alert_check', alertName, status: 'error', error: err.message }, { severity: 'error' });
        continue;
      }
      if (triggered) {
        alertObj.lastTriggered = now.toISOString();
        try {
          alertObj.callback(alertName, alertObj.condition);
          this.emitEvent('heartbeat', { action: 'alert_triggered', alertName }, { severity: 'warning' });
        } catch (err) {
          this.emitEvent('heartbeat', { action: 'alert_triggered', alertName, status: 'error', error: err.message }, { severity: 'error' });
        }
      }
    }
  }

  evaluateAlertCondition(condition) {
    // Simple metric-based conditions: { metric, threshold, operator: '>'|'<'|'>='|'<='|'=='|'!=' }
    const { metric, threshold, operator } = condition;
    if (!metric || threshold === undefined || !operator) {
      throw new Error('Alert condition must have metric, threshold, and operator');
    }
    // Resolve metric from state or simple builtins
    let value = this.resolveMetric(metric);
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      case '==': return value === threshold;
      case '!=': return value !== threshold;
      default: throw new Error(`Unknown operator: ${operator}`);
    }
  }

  resolveMetric(metric) {
    // Simple metric resolution
    const state = this.loadState();
    if (metric === 'task_count') return this.tasks.size;
    if (metric === 'watcher_count') return this.watchers.size;
    if (metric === 'alert_count') return this.alerts.size;
    if (metric === 'uptime_minutes') {
      const start = state.startedAt ? new Date(state.startedAt) : new Date();
      return Math.floor((Date.now() - start.getTime()) / 60000);
    }
    // Try resolving from state.metrics
    if (state.metrics && state.metrics[metric] !== undefined) {
      return state.metrics[metric];
    }
    throw new Error(`Unknown metric: ${metric}`);
  }

  // ── State Persistence ──

  loadState() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const data = fs.readFileSync(STATE_FILE, 'utf-8');
        return JSON.parse(data);
      }
    } catch (err) {
      // Ignore corrupt state
    }
    return {
      version: 1,
      startedAt: null,
      tasks: {},
      watchers: {},
      alerts: {},
      metrics: {},
    };
  }

  saveState() {
    const state = {
      version: 1,
      startedAt: this.state.startedAt || new Date().toISOString(),
      tasks: Object.fromEntries(
        Array.from(this.tasks.entries()).map(([k, v]) => [k, { ...v, callback: undefined }])
      ),
      watchers: Object.fromEntries(
        Array.from(this.watchers.entries()).map(([k, v]) => [k, { ...v, callback: undefined }])
      ),
      alerts: Object.fromEntries(
        Array.from(this.alerts.entries()).map(([k, v]) => [k, { ...v, callback: undefined }])
      ),
      metrics: {
        task_count: this.tasks.size,
        watcher_count: this.watchers.size,
        alert_count: this.alerts.size,
        uptime_minutes: this.state.startedAt
          ? Math.floor((Date.now() - new Date(this.state.startedAt).getTime()) / 60000)
          : 0,
      },
    };
    // Ensure directory exists
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    this.state = state;
    return state;
  }

  // ── Event Integration ──

  emitEvent(eventType, data, metadata = {}) {
    try {
      emit(eventType, data, { ...metadata, source: 'heartbeat' });
    } catch (err) {
      // If event-system fails, silently log to stderr but don't crash the heartbeat
      console.error(`[heartbeat] Event emit failed: ${err.message}`);
    }
  }

  // ── Query / Introspection ──

  getTasks() {
    return Array.from(this.tasks.entries()).map(([name, t]) => ({
      name,
      cronExpr: t.cronExpr,
      nextRun: t.nextRun,
      lastRun: t.lastRun,
      enabled: t.enabled,
    }));
  }

  getWatchers() {
    return Array.from(this.watchers.entries()).map(([path, w]) => ({
      path,
      lastMtime: w.lastMtime,
      enabled: w.enabled,
    }));
  }

  getAlerts() {
    return Array.from(this.alerts.entries()).map(([name, a]) => ({
      name,
      condition: this.describeCondition(a.condition),
      lastTriggered: a.lastTriggered,
      enabled: a.enabled,
    }));
  }

  getStatus() {
    return {
      running: this.running,
      tasks: this.tasks.size,
      watchers: this.watchers.size,
      alerts: this.alerts.size,
      startedAt: this.state.startedAt,
    };
  }
}

// ──────────────────────────────────────────────
// Singleton Instance & Factory
// ──────────────────────────────────────────────

const scheduler = new HeartbeatScheduler();

// Export both the singleton and the class for testing
module.exports = {
  HeartbeatScheduler,
  schedule: (cronExpr, taskName, callback, metadata) => scheduler.schedule(cronExpr, taskName, callback, metadata),
  unschedule: (taskName) => scheduler.unschedule(taskName),
  watch: (filePath, callback, metadata) => scheduler.watch(filePath, callback, metadata),
  unwatch: (filePath) => scheduler.unwatch(filePath),
  alert: (condition, callback, alertName) => scheduler.alert(condition, callback, alertName),
  removeAlert: (alertName) => scheduler.removeAlert(alertName),
  start: () => scheduler.start(),
  stop: () => scheduler.stop(),
  tick: () => scheduler.tick(),
  getStatus: () => scheduler.getStatus(),
  getTasks: () => scheduler.getTasks(),
  getWatchers: () => scheduler.getWatchers(),
  getAlerts: () => scheduler.getAlerts(),
  // Expose internals for testing
  parseCron,
  getNextRun,
  cronMatches,
  parseCronField,
  fieldMatches,
};

// CLI support
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  switch (command) {
    case 'status': {
      console.log(JSON.stringify(scheduler.getStatus(), null, 2));
      break;
    }
    case 'state': {
      console.log(JSON.stringify(scheduler.loadState(), null, 2));
      break;
    }
    case 'tasks': {
      console.log(JSON.stringify(scheduler.getTasks(), null, 2));
      break;
    }
    case 'watchers': {
      console.log(JSON.stringify(scheduler.getWatchers(), null, 2));
      break;
    }
    case 'alerts': {
      console.log(JSON.stringify(scheduler.getAlerts(), null, 2));
      break;
    }
    default:
      console.log('Usage: node scripts/heartbeat.js [status|state|tasks|watchers|alerts]');
      process.exit(1);
  }
}
