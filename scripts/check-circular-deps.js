#!/usr/bin/env node

/**
 * Script to detect circular dependencies in TypeScript/JavaScript files
 * This helps prevent runtime errors that TypeScript compilation doesn't catch
 */

const fs = require('fs');
const path = require('path');

class CircularDependencyChecker {
  constructor(srcDir = 'src') {
    this.srcDir = srcDir;
    this.dependencyGraph = new Map();
    this.visited = new Set();
    this.recursionStack = new Set();
    this.cycles = [];
  }

  /**
   * Extract imports from a file
   */
  extractImports(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const imports = [];
      
      // Match various import patterns
      const importPatterns = [
        /import\s+.*?\s+from\s+['"](\.{1,2}\/[^'"]*)['"]/g,
        /import\s*\(\s*['"](\.{1,2}\/[^'"]*)['"]\s*\)/g,
        /require\s*\(\s*['"](\.{1,2}\/[^'"]*)['"]\s*\)/g
      ];

      for (const pattern of importPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const importPath = match[1];
          // Resolve to absolute path
          const resolvedPath = this.resolveImportPath(filePath, importPath);
          if (resolvedPath) {
            imports.push(resolvedPath);
          }
        }
      }

      return imports;
    } catch (error) {
      console.warn(`Warning: Could not read file ${filePath}`);
      return [];
    }
  }

  /**
   * Resolve relative import path to absolute path
   */
  resolveImportPath(fromFile, importPath) {
    const fromDir = path.dirname(fromFile);
    let resolvedPath = path.resolve(fromDir, importPath);
    
    // Try different extensions
    const extensions = ['.ts', '.js', '.tsx', '.jsx'];
    for (const ext of extensions) {
      const fullPath = resolvedPath + ext;
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
    
    // Try index files
    for (const ext of extensions) {
      const indexPath = path.join(resolvedPath, 'index' + ext);
      if (fs.existsSync(indexPath)) {
        return indexPath;
      }
    }
    
    return null;
  }

  /**
   * Build dependency graph from source directory
   */
  buildDependencyGraph() {
    const srcPath = path.resolve(this.srcDir);
    
    const scanDirectory = (dir) => {
      const entries = fs.readdirSync(dir);
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip node_modules and dist directories
          if (!['node_modules', 'dist', '.git'].includes(entry)) {
            scanDirectory(fullPath);
          }
        } else if (stat.isFile() && /\.(ts|js|tsx|jsx)$/.test(entry)) {
          const imports = this.extractImports(fullPath);
          this.dependencyGraph.set(fullPath, imports);
        }
      }
    };

    scanDirectory(srcPath);
  }

  /**
   * Detect circular dependencies using DFS
   */
  detectCycles(node, path = []) {
    if (this.recursionStack.has(node)) {
      // Found a cycle
      const cycleStart = path.indexOf(node);
      const cycle = path.slice(cycleStart).concat([node]);
      this.cycles.push(cycle);
      return;
    }

    if (this.visited.has(node)) {
      return;
    }

    this.visited.add(node);
    this.recursionStack.add(node);
    path.push(node);

    const dependencies = this.dependencyGraph.get(node) || [];
    for (const dep of dependencies) {
      if (this.dependencyGraph.has(dep)) {
        this.detectCycles(dep, [...path]);
      }
    }

    this.recursionStack.delete(node);
    path.pop();
  }

  /**
   * Check all files for circular dependencies
   */
  checkCircularDependencies() {
    this.buildDependencyGraph();
    
    for (const node of this.dependencyGraph.keys()) {
      if (!this.visited.has(node)) {
        this.detectCycles(node);
      }
    }

    return this.cycles;
  }

  /**
   * Format cycle for display
   */
  formatCycle(cycle) {
    const relativePaths = cycle.map(filePath => 
      path.relative(process.cwd(), filePath)
    );
    return relativePaths.join(' → ');
  }

  /**
   * Run the check and display results
   */
  run() {
    console.log('🔍 Checking for circular dependencies...\n');
    
    const cycles = this.checkCircularDependencies();
    
    if (cycles.length === 0) {
      console.log('✅ No circular dependencies found!');
      return 0;
    } else {
      console.log(`❌ Found ${cycles.length} circular dependencies:\n`);
      
      cycles.forEach((cycle, index) => {
        console.log(`${index + 1}. ${this.formatCycle(cycle)}`);
      });
      
      console.log('\n💡 Fix these circular dependencies to prevent runtime errors.');
      console.log('   Consider extracting shared code to separate files or using dependency inversion.');
      
      return 1;
    }
  }
}

// Run the checker
if (require.main === module) {
  const checker = new CircularDependencyChecker();
  const exitCode = checker.run();
  process.exit(exitCode);
}

module.exports = CircularDependencyChecker;