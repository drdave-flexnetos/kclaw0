# KClaw0 Code Style Guide

## Philosophy
- Clean code, clear logic, minimal overhead
- Efficiency is elegance
- The best solution is the one that teaches you something

## JavaScript/Node.js Conventions
- Use `const` and `let`, never `var`
- Prefer async/await over raw Promises
- Use `require()` for CommonJS modules
- Handle errors explicitly — never silent catches
- Document public APIs with JSDoc

## File Organization
```
scripts/        — Runtime systems (executed by agent)
tests/          — Test suites (one per script)
memory/         — Data, state, logs, knowledge
diagrams/       — ASCII architecture diagrams
docs/           — Documentation (if needed)
```

## Code Patterns

### Module Template
```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const MEMORY_DIR = path.join(__dirname, '..', 'memory');
const STATE_FILE = path.join(MEMORY_DIR, 'script-name-state.json');

// Ensure directory exists
if (!fs.existsSync(MEMORY_DIR)) {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

// Load state
let state = {};
if (fs.existsSync(STATE_FILE)) {
  state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

// Save state
function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

module.exports = { /* API */ };
```

### Error Handling
```javascript
try {
  const result = await operation();
  return { success: true, data: result };
} catch (error) {
  return { success: false, error: error.message, code: error.code };
}
```

### Event Emission
```javascript
const eventSystem = require('./event-system');
eventSystem.emit('category:action', {
  script: 'script-name',
  detail: 'what happened',
  timestamp: new Date().toISOString()
});
```

## Testing Standards
- Use Node.js built-in test runner (`node:test` + `node:assert`)
- Minimum 8 assertions per script
- Test both happy path and error cases
- Mock external dependencies
- Tests must be deterministic (no randomness, no external state)

## Documentation Standards
- Every script has header comment with purpose
- Complex functions have inline comments
- README.md updated when scripts change
- MEMORY.md updated for significant architectural decisions

## Immutable Rule
This file can NEVER be modified by the factory/autonomous systems. Only Dr Dave can edit this file.
