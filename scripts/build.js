#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

// Define paths
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const templateSrcDir = path.join(rootDir, 'src', 'templates');
const templateDistDir = path.join(distDir, 'templates');

// ANSI colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

console.log(`${colors.blue}Starting build process...${colors.reset}`);

// Clean dist directory
console.log(`${colors.yellow}Cleaning dist directory...${colors.reset}`);
try {
  fs.removeSync(distDir);
  fs.ensureDirSync(distDir);
} catch (error) {
  console.error(`${colors.red}Error cleaning dist directory:${colors.reset}`, error);
  process.exit(1);
}

// Compile TypeScript
console.log(`${colors.yellow}Compiling TypeScript...${colors.reset}`);
try {
  // Use --skipLibCheck to avoid checking types in template files
  execSync('npx tsc --skipLibCheck', { stdio: 'inherit', cwd: rootDir });
} catch (error) {
  console.error(`${colors.red}TypeScript compilation failed${colors.reset}`);
  process.exit(1);
}

// Copy template files
console.log(`${colors.yellow}Copying template files...${colors.reset}`);
try {
  fs.copySync(templateSrcDir, templateDistDir, {
    filter: (src) => {
      // Skip node_modules and d.ts files
      return !src.includes('node_modules') && !src.endsWith('.d.ts');
    }
  });
  
  // Create an empty .gitkeep file in each template directory to ensure
  // directory structure is preserved even if empty
  const dirs = ['init', 'add', 'init/src', 'init/workers', 'add/workers'];
  for (const dir of dirs) {
    const dirPath = path.join(templateDistDir, dir);
    fs.ensureDirSync(dirPath);
    const gitkeepPath = path.join(dirPath, '.gitkeep');
    fs.writeFileSync(gitkeepPath, '');
  }
} catch (error) {
  console.error(`${colors.red}Error copying template files:${colors.reset}`, error);
  process.exit(1);
}

// Make CLI executable
console.log(`${colors.yellow}Making CLI executable...${colors.reset}`);
try {
  const cliPath = path.join(distDir, 'cli.js');
  let content = fs.readFileSync(cliPath, 'utf8');
  
  // Remove any existing shebang to avoid duplicates
  if (content.startsWith('#!')) {
    content = content.replace(/^#!.*\n/, '');
  }
  
  // Add the shebang at the beginning
  fs.writeFileSync(cliPath, `#!/usr/bin/env node\n${content}`);
  
  // Make it executable on Unix-like systems
  if (process.platform !== 'win32') {
    execSync(`chmod +x ${cliPath}`);
  }
  
  console.log(`${colors.green}CLI executable created at: ${cliPath}`);
} catch (error) {
  console.error(`${colors.red}Error making CLI executable:${colors.reset}`, error);
  process.exit(1);
}

console.log(`${colors.green}Build completed successfully!${colors.reset}`);
console.log(`${colors.blue}You can now run 'npm link' to test the CLI locally or 'npm publish' to publish to npm.${colors.reset}`);