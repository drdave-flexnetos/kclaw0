const fs = require('fs');
const path = require('path');

const AGENTS_DIR = path.join(__dirname, '..', 'memory', 'agents');
const FALLBACK = {
  role: 'coder',
  name: 'Infrastructure Coder',
  skills: ['javascript', 'nodejs', 'testing', 'documentation', 'architecture'],
  tools: ['read', 'write', 'edit', 'exec', 'process'],
  model: 'kimi-k2p6',
  triggers: ['code', 'build', 'implement', 'script', 'infrastructure', 'develop', 'programming'],
  description: 'Expert JavaScript infrastructure developer for KClaw0.',
  priority: 'high',
  maxTokens: 100000,
  timeoutMinutes: 10,
  id: 'coder-001'
};

function parseValue(v) {
  if (v.startsWith('[') && v.endsWith(']')) {
    return v.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
  }
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (!isNaN(Number(v)) && v !== '') return Number(v);
  return v;
}

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;

  const yamlLines = match[1].split('\n');
  const body = match[2].trim();
  const data = {};
  let currentSection = null;
  let currentSubSection = null;

  for (const line of yamlLines) {
    if (line.trim() === '') continue;

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    if (trimmed.startsWith('- ')) {
      const item = trimmed.slice(2).trim();
      if (currentSubSection && currentSection) {
        data[currentSection] = data[currentSection] || {};
        data[currentSection][currentSubSection] = data[currentSection][currentSubSection] || [];
        data[currentSection][currentSubSection].push(item);
      } else if (currentSection) {
        data[currentSection] = data[currentSection] || [];
        data[currentSection].push(item);
      }
      continue;
    }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx <= 0) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();

    if (indent === 0) {
      if (value === '') {
        currentSection = key;
        currentSubSection = null;
        data[key] = data[key] || [];
      } else {
        currentSection = null;
        currentSubSection = null;
        data[key] = parseValue(value);
      }
    } else if (indent === 2) {
      if (currentSection === 'constraints' || currentSection === 'capabilities') {
        if (value === '') {
          currentSubSection = key;
          data[currentSection] = data[currentSection] || {};
          data[currentSection][key] = [];
        } else {
          data[currentSection] = data[currentSection] || {};
          data[currentSection][key] = parseValue(value);
          currentSubSection = null;
        }
      }
    }
  }

  return { data, body };
}

function buildProfile(role, parsed) {
  const { data, body } = parsed;

  const triggers = {
    coder: ['code', 'build', 'implement', 'script', 'infrastructure', 'develop', 'programming'],
    tester: ['test', 'validate', 'verify', 'assertion', 'coverage', 'bug', 'regression'],
    researcher: ['research', 'analyze', 'pattern', 'discover', 'investigate', 'study', 'survey'],
    oracle: ['architecture', 'design', 'review', 'decision', 'strategy', 'plan', 'roadmap'],
    scout: ['integrate', 'connect', 'deploy', 'install', 'dependency', 'migration', 'bridge'],
    documenter: ['document', 'write', 'readme', 'guide', 'manual', 'explain', 'clarify'],
    safety_reviewer: ['safety', 'security', 'review', 'risk', 'audit', 'compliance', 'governance']
  };

  const tools = {
    coder: ['read', 'write', 'edit', 'exec', 'process'],
    tester: ['read', 'write', 'edit', 'exec', 'process'],
    researcher: ['read', 'web_fetch', 'kimi_search', 'kimi_fetch', 'write'],
    oracle: ['read', 'write', 'edit'],
    scout: ['read', 'write', 'edit', 'exec', 'process'],
    documenter: ['read', 'write', 'edit'],
    safety_reviewer: ['read', 'write', 'edit']
  };

  const constraints = data.constraints || {};
  const models = constraints.models || data.models || [];

  return {
    role,
    name: data.name || `${role.charAt(0).toUpperCase() + role.slice(1)} Agent`,
    skills: data.capabilities || [],
    tools: tools[role] || ['read', 'write'],
    model: models[0] || 'kimi-k2p6',
    triggers: triggers[role] || [role],
    description: body.split('\n')[0].replace(/^You are /, '').replace(/\.$/, '') || `${role} agent`,
    priority: data.priority || 'medium',
    maxTokens: constraints.maxTokens || data.maxTokens || 80000,
    timeoutMinutes: constraints.timeoutMinutes || data.timeoutMinutes || 10,
    id: data.id || `${role}-001`
  };
}

function loadProfiles() {
  if (!fs.existsSync(AGENTS_DIR)) {
    return { [FALLBACK.role]: FALLBACK };
  }

  const files = fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'));
  const profiles = {};

  for (const file of files) {
    const role = path.basename(file, '.md');
    const text = fs.readFileSync(path.join(AGENTS_DIR, file), 'utf8');
    const parsed = parseFrontmatter(text);
    if (!parsed) continue;

    profiles[role] = buildProfile(role, parsed);
  }

  if (Object.keys(profiles).length === 0) {
    return { [FALLBACK.role]: FALLBACK };
  }

  return profiles;
}

function getProfile(role) {
  const profiles = loadProfiles();
  return profiles[role] || FALLBACK;
}

function matchProfile(taskDescription) {
  const profiles = loadProfiles();
  const task = (taskDescription || '').toLowerCase();
  let best = null;
  let bestTriggerScore = -1;
  let bestTotalScore = -1;

  for (const profile of Object.values(profiles)) {
    let triggerScore = 0;
    for (const trigger of profile.triggers || []) {
      if (task.includes(trigger.toLowerCase())) {
        triggerScore += 1;
      }
    }
    if (triggerScore === 0) continue; // No trigger match — skip

    const priorityBoost = { critical: 0.3, high: 0.2, medium: 0.1, low: 0 };
    const totalScore = triggerScore + (priorityBoost[profile.priority] || 0);

    if (triggerScore > bestTriggerScore ||
        (triggerScore === bestTriggerScore && totalScore > bestTotalScore)) {
      bestTriggerScore = triggerScore;
      bestTotalScore = totalScore;
      best = profile;
    }
  }

  return best || FALLBACK;
}

function listProfiles() {
  return Object.values(loadProfiles());
}

module.exports = {
  loadProfiles,
  getProfile,
  matchProfile,
  listProfiles,
  FALLBACK,
  parseFrontmatter,
  buildProfile
};
