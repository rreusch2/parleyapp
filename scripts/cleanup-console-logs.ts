#!/usr/bin/env ts-node

/**
 * Console.log Cleanup Script for Production Builds
 * 
 * This script removes console.log statements from the codebase for production builds
 * while preserving them for development. Required for App Store approval.
 */

import * as fs from 'fs';
import * as path from 'path';

interface CleanupOptions {
  mode: 'remove' | 'conditional' | 'dry-run';
  directories: string[];
  excludePatterns: string[];
}

class ConsoleLogCleanup {
  private options: CleanupOptions;
  private filesProcessed = 0;
  private logsFound = 0;
  private logsProcessed = 0;

  constructor(options: Partial<CleanupOptions> = {}) {
    this.options = {
      mode: 'conditional',
      directories: ['app'],
      excludePatterns: [
        'node_modules',
        '.git',
        'dist',
        'build',
        '*.test.*',
        '*.spec.*'
      ],
      ...options
    };
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Starting console.log cleanup for production build...\n');
    console.log(`Mode: ${this.options.mode}`);
    console.log(`Directories: ${this.options.directories.join(', ')}`);
    console.log('');

    for (const directory of this.options.directories) {
      await this.processDirectory(directory);
    }

    this.printSummary();
  }

  private async processDirectory(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      console.log(`⚠️  Directory not found: ${dirPath}`);
      return;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Skip excluded patterns
      if (this.shouldExclude(fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.processDirectory(fullPath);
      } else if (this.isTargetFile(entry.name)) {
        await this.processFile(fullPath);
      }
    }
  }

  private shouldExclude(filePath: string): boolean {
    return this.options.excludePatterns.some(pattern => 
      filePath.includes(pattern)
    );
  }

  private isTargetFile(fileName: string): boolean {
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    return extensions.some(ext => fileName.endsWith(ext));
  }

  private async processFile(filePath: string): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const modifiedLines: string[] = [];
    let fileChanged = false;
    let fileLogsFound = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Skip lines that are comments
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*')) {
        modifiedLines.push(line);
        continue;
      }

      // Check for console.log statements
      if (this.containsConsoleLog(line)) {
        fileLogsFound++;
        this.logsFound++;
        
        const processedLine = this.processConsoleLog(line, filePath, i + 1);
        
        if (processedLine !== line) {
          fileChanged = true;
          this.logsProcessed++;
        }
        
        modifiedLines.push(processedLine);
      } else {
        modifiedLines.push(line);
      }
    }

    if (fileLogsFound > 0) {
      console.log(`📄 ${filePath}: ${fileLogsFound} console.log statements found`);
    }

    // Write file if changed and not in dry-run mode
    if (fileChanged && this.options.mode !== 'dry-run') {
      fs.writeFileSync(filePath, modifiedLines.join('\n'), 'utf8');
      console.log(`✅ Updated: ${filePath}`);
    }

    if (fileLogsFound > 0) {
      this.filesProcessed++;
    }
  }

  private containsConsoleLog(line: string): boolean {
    // Match console.log, console.error, console.warn, etc.
    return /console\.(log|error|warn|info|debug)\s*\(/.test(line);
  }

  private processConsoleLog(line: string, filePath: string, lineNumber: number): string {
    const indentation = line.match(/^(\s*)/)?.[1] || '';
    
    switch (this.options.mode) {
      case 'remove':
        // Comment out the line
        return `${indentation}// ${line.trim()} // Removed for production`;
        
      case 'conditional':
        // Wrap in development condition
        const logStatement = line.trim();
        return `${indentation}if (__DEV__) { ${logStatement} }`;
        
      case 'dry-run':
        console.log(`   📍 ${filePath}:${lineNumber} - ${line.trim()}`);
        return line;
        
      default:
        return line;
    }
  }

  private printSummary(): void {
    console.log('\n📊 CLEANUP SUMMARY\n');
    console.log(`Files processed: ${this.filesProcessed}`);
    console.log(`Console.log statements found: ${this.logsFound}`);
    
    if (this.options.mode !== 'dry-run') {
      console.log(`Console.log statements processed: ${this.logsProcessed}`);
    }
    
    console.log('');
    
    switch (this.options.mode) {
      case 'remove':
        console.log('✅ Console.log statements have been commented out for production');
        break;
      case 'conditional':
        console.log('✅ Console.log statements have been wrapped in __DEV__ conditions');
        break;
      case 'dry-run':
        console.log('ℹ️  Dry run completed - no files were modified');
        break;
    }

    if (this.logsFound > 0 && this.options.mode !== 'dry-run') {
      console.log('\n🎯 Next Steps:');
      console.log('1. Review the changes to ensure they look correct');
      console.log('2. Test your app to ensure no functionality was broken');
      console.log('3. Run your production build to verify no console.log statements remain');
    }

    if (this.logsFound === 0) {
      console.log('🎉 No console.log statements found! Your code is production-ready.');
    }
  }
}

// CLI interface
const args = process.argv.slice(2);
const mode = args.includes('--remove') ? 'remove' 
           : args.includes('--dry-run') ? 'dry-run' 
           : 'conditional';

const directories = args.includes('--all') ? ['app', 'backend/src'] : ['app'];

// Run cleanup
const cleanup = new ConsoleLogCleanup({ mode, directories });
cleanup.cleanup().catch(error => {
  console.error('❌ Cleanup failed:', error);
  process.exit(1);
});

export { ConsoleLogCleanup }; 