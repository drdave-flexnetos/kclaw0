#!/usr/bin/env node
/**
 * Fingerprinting System
 * Computes SHA-256 hashes of tracked files to detect changes.
 * 
 * Usage:
 *   node scripts/fingerprint.js [command]
 * 
 * Commands:
 *   scan       — Compute hashes for all tracked files
 *   check      — Check for changes since last scan
 *   changed    — List only changed files
 *   hot        — List most frequently changed files
 *   watch      — Continuous monitoring (runs every 30s)
 * 
 * Examples:
 *   node scripts/fingerprint.js scan
 *   node scripts/fingerprint.js check
 *   node scripts/fingerprint.js hot --limit=5
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WORKSPACE = '/root/.openclaw/workspace';
const FINGERPRINT_FILE = path.join(WORKSPACE, 'memory', 'fingerprints.json');
const CHANGE_LOG = path.join(WORKSPACE, 'memory', 'change-log.ndjson');

// Files to track
const TRACKED_GLOBS = [
  'SOUL.md',
  'IDENTITY.md',
  'USER.md',
  'AGENTS.md',
  'TOOLS.md',
  'MEMORY.md',
  'HEARTBEAT.md',
  'BOOTSTRAP.md',
  'memory/*.md',
  'skills/**/*.md',
];

/**
 * Expand glob patterns to actual files
 */
function expandGlobs(globs, baseDir) {
  const files = new Set();
  
  for (const glob of globs) {
    if (glob.includes('**')) {
      // Recursive glob
      const parts = glob.split('/**/');
      const base = parts[0];
      const pattern = parts[1] || '*';
      const fullBase = path.join(baseDir, base);
      if (fs.existsSync(fullBase)) {
        collectFilesRecursive(fullBase, pattern, files, baseDir);
      }
    } else if (glob.includes('*')) {
      // Simple glob
      const dir = path.dirname(glob);
      const pattern = path.basename(glob);
      const fullDir = path.join(baseDir, dir);
      if (fs.existsSync(fullDir)) {
        const entries = fs.readdirSync(fullDir);
        for (const entry of entries) {
          if (matchGlob(entry, pattern)) {
            files.add(path.join(dir, entry));
          }
        }
      }
    } else {
      // Exact file
      files.add(glob);
    }
  }
  
  return Array.from(files).sort();
}

function collectFilesRecursive(dir, pattern, files, baseDir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath);
    if (entry.isDirectory()) {
      collectFilesRecursive(fullPath, pattern, files, baseDir);
    } else if (matchGlob(entry.name, pattern)) {
      files.add(relPath);
    }
  }
}

function matchGlob(filename, pattern) {
  const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
  return regex.test(filename);
}

/**
 * Compute SHA-256 hash of file content
 */
function hashFile(filePath) {
  const fullPath = path.join(WORKSPACE, filePath);
  if (!fs.existsSync(fullPath)) return null;
  const content = fs.readFileSync(fullPath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Get file metadata
 */
function getFileMeta(filePath) {
  const fullPath = path.join(WORKSPACE, filePath);
  if (!fs.existsSync(fullPath)) return null;
  const stats = fs.statSync(fullPath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  return {
    size: stats.size,
    lines: content.split('\n').length,
    mtime: stats.mtime.toISOString(),
  };
}

/**
 * Load existing fingerprints
 */
function loadFingerprints() {
  if (!fs.existsSync(FINGERPRINT_FILE)) {
    return { version: '1.0', lastUpdated: null, files: {}, hotFiles: [] };
  }
  return JSON.parse(fs.readFileSync(FINGERPRINT_FILE, 'utf-8'));
}

/**
 * Save fingerprints
 */
function saveFingerprints(data) {
  fs.writeFileSync(FINGERPRINT_FILE, JSON.stringify(data, null, 2));
}

/**
 * Log a change event
 */
function logChange(filePath, changeType, oldHash, newHash) {
  const entry = {
    timestamp: new Date().toISOString(),
    file: filePath,
    type: changeType,
    oldHash,
    newHash,
  };
  fs.appendFileSync(CHANGE_LOG, JSON.stringify(entry) + '\n');
}

/**
 * Scan all tracked files and update fingerprints
 */
function scan() {
  const files = expandGlobs(TRACKED_GLOBS, WORKSPACE);
  const existing = loadFingerprints();
  const result = {
    version: '1.0',
    lastUpdated: new Date().toISOString(),
    files: {},
    hotFiles: existing.hotFiles || [],
  };
  
  const changes = [];
  
  for (const file of files) {
    const hash = hashFile(file);
    const meta = getFileMeta(file);
    if (!hash || !meta) continue;
    
    const oldEntry = existing.files[file];
    const isNew = !oldEntry;
    const isChanged = oldEntry && oldEntry.hash !== hash;
    
    if (isNew) {
      changes.push({ file, type: 'new', oldHash: null, newHash: hash });
      logChange(file, 'new', null, hash);
    } else if (isChanged) {
      changes.push({ file, type: 'modified', oldHash: oldEntry.hash, newHash: hash });
      logChange(file, 'modified', oldEntry.hash, hash);
      
      // Update hot file count
      const hotEntry = result.hotFiles.find(h => h.path === file);
      if (hotEntry) {
        hotEntry.changeCount = (hotEntry.changeCount || 0) + 1;
        hotEntry.lastChange = new Date().toISOString();
      } else {
        result.hotFiles.push({
          path: file,
          changeCount: 1,
          firstSeen: oldEntry.firstSeen || existing.lastUpdated,
          lastChange: new Date().toISOString(),
        });
      }
    }
    
    result.files[file] = {
      hash,
      size: meta.size,
      lines: meta.lines,
      mtime: meta.mtime,
      firstSeen: oldEntry?.firstSeen || new Date().toISOString(),
    };
  }
  
  // Detect deleted files
  for (const [file, oldEntry] of Object.entries(existing.files)) {
    if (!result.files[file]) {
      changes.push({ file, type: 'deleted', oldHash: oldEntry.hash, newHash: null });
      logChange(file, 'deleted', oldEntry.hash, null);
    }
  }
  
  // Sort hot files by change count
  result.hotFiles.sort((a, b) => (b.changeCount || 0) - (a.changeCount || 0));
  
  saveFingerprints(result);
  
  return {
    scanned: files.length,
    changes,
    fingerprintFile: FINGERPRINT_FILE,
  };
}

/**
 * Check for changes without updating fingerprints
 */
function check() {
  const files = expandGlobs(TRACKED_GLOBS, WORKSPACE);
  const existing = loadFingerprints();
  const changes = [];
  
  for (const file of files) {
    const hash = hashFile(file);
    const oldEntry = existing.files[file];
    
    if (!oldEntry) {
      changes.push({ file, type: 'new' });
    } else if (oldEntry.hash !== hash) {
      changes.push({ file, type: 'modified', oldHash: oldEntry.hash, newHash: hash });
    }
  }
  
  for (const file of Object.keys(existing.files)) {
    if (!files.includes(file)) {
      changes.push({ file, type: 'deleted' });
    }
  }
  
  return { scanned: files.length, changes };
}

/**
 * Get hot files
 */
function getHotFiles(limit = 10) {
  const existing = loadFingerprints();
  return (existing.hotFiles || [])
    .sort((a, b) => (b.changeCount || 0) - (a.changeCount || 0))
    .slice(0, limit);
}

/**
 * Print scan results
 */
function printScan(result) {
  console.log(`\n📊 Fingerprint Scan Complete`);
  console.log(`   Files scanned: ${result.scanned}`);
  console.log(`   Changes detected: ${result.changes.length}`);
  
  if (result.changes.length > 0) {
    console.log('\n   Changes:');
    for (const c of result.changes) {
      const icon = c.type === 'new' ? '🆕' : c.type === 'modified' ? '✏️' : '🗑️';
      console.log(`   ${icon}  ${c.file} (${c.type})`);
    }
  }
  
  console.log(`\n   💾 Saved to: ${result.fingerprintFile}`);
}

/**
 * Print check results
 */
function printCheck(result) {
  console.log(`\n🔍 Fingerprint Check`);
  console.log(`   Files tracked: ${result.scanned}`);
  console.log(`   Changes found: ${result.changes.length}`);
  
  if (result.changes.length > 0) {
    console.log('\n   Changed files:');
    for (const c of result.changes) {
      const icon = c.type === 'new' ? '🆕' : c.type === 'modified' ? '✏️' : '🗑️';
      console.log(`   ${icon}  ${c.file}`);
    }
  } else {
    console.log('\n   ✅ All files match last scan');
  }
}

/**
 * Print hot files
 */
function printHotFiles(files, limit) {
  console.log(`\n🔥 Hot Files (top ${limit})`);
  if (files.length === 0) {
    console.log('   No changes recorded yet. Run "scan" first.');
    return;
  }
  for (const f of files) {
    const bar = '█'.repeat(Math.min(f.changeCount, 20));
    console.log(`   ${bar} ${f.changeCount}  ${f.path}`);
  }
}

/**
 * Watch mode
 */
function watch() {
  console.log('👁️  Watch mode active (Ctrl+C to stop)');
  console.log('   Checking every 30 seconds...\n');
  
  const checkAndReport = () => {
    const result = check();
    if (result.changes.length > 0) {
      console.log(`[${new Date().toISOString()}] Changes detected: ${result.changes.length}`);
      for (const c of result.changes) {
        console.log(`  - ${c.file} (${c.type})`);
      }
    }
  };
  
  checkAndReport();
  const interval = setInterval(checkAndReport, 30000);
  
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
  const command = args[0] || 'scan';
  
  switch (command) {
    case 'scan': {
      const result = scan();
      printScan(result);
      break;
    }
    case 'check': {
      const result = check();
      printCheck(result);
      break;
    }
    case 'changed': {
      const result = check();
      if (result.changes.length === 0) {
        console.log('No changes detected');
      } else {
        for (const c of result.changes) {
          console.log(c.file);
        }
      }
      break;
    }
    case 'hot': {
      const limitArg = args.find(a => a.startsWith('--limit='));
      const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 10;
      const files = getHotFiles(limit);
      printHotFiles(files, limit);
      break;
    }
    case 'watch':
      watch();
      break;
    default:
      console.log('Unknown command. Usage:');
      console.log('  node scripts/fingerprint.js [scan|check|changed|hot|watch]');
      process.exit(1);
  }
}

// Export for testing
module.exports = { scan, check, getHotFiles, hashFile, expandGlobs };

if (require.main === module) {
  main();
}
