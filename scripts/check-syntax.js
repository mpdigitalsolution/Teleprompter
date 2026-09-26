/**
 * GhostPrompter Syntax Validator
 * Recursively scans and validates JavaScript syntax across the extension and desktop app.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const scanDirs = [
  path.join(rootDir, 'src'),
  path.join(rootDir, 'desktop', 'src'),
  path.join(rootDir, 'desktop', 'tests'),
  path.join(rootDir, 'tests')
];

function getAllJsFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist') {
        getAllJsFiles(fullPath, fileList);
      }
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function runSyntaxCheck() {
  console.log('🔍 Running JavaScript Syntax Validation across GhostPrompter...\n');

  let allFiles = [];
  for (const dir of scanDirs) {
    getAllJsFiles(dir, allFiles);
  }

  // Remove duplicate paths
  allFiles = [...new Set(allFiles)];

  let passed = 0;
  let failed = 0;
  const errors = [];

  for (const file of allFiles) {
    const relPath = path.relative(rootDir, file);
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
      console.log(`  ✓ ${relPath}`);
      passed++;
    } catch (err) {
      console.error(`  ✕ ${relPath} (SYNTAX ERROR)`);
      failed++;
      errors.push({
        file: relPath,
        error: err.stderr ? err.stderr.toString() : err.message
      });
    }
  }

  console.log(`\n==================================================`);
  console.log(`Summary: ${passed} passed, ${failed} failed (Total: ${allFiles.length} files)`);
  console.log(`==================================================\n`);

  if (failed > 0) {
    console.error('❌ Syntax errors found:\n');
    for (const item of errors) {
      console.error(`File: ${item.file}`);
      console.error(item.error);
      console.error('--------------------------------------------------');
    }
    process.exit(1);
  } else {
    console.log('✅ 100% of JavaScript files passed syntax check with 0 errors!\n');
    process.exit(0);
  }
}

runSyntaxCheck();
