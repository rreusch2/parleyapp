#!/usr/bin/env ts-node

/**
 * Production Build Validation Script
 * 
 * This script validates that your Predictive Play is ready for production build
 * and App Store submission by checking for common issues.
 */

import * as fs from 'fs';
import * as path from 'path';
import { validateProductionConfig, APP_STORE_CHECKLIST } from '../app/config/production';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  criticalErrors: string[];
}

class ProductionValidator {
  private errors: string[] = [];
  private warnings: string[] = [];
  private criticalErrors: string[] = [];

  async validate(): Promise<ValidationResult> {
    console.log('🔍 Validating Predictive Play for production build...\n');

    // Check environment variables
    this.checkEnvironmentVariables();
    
    // Check for localhost references in code
    this.checkForLocalhostReferences();
    
    // Check configuration files
    this.checkConfigurationFiles();
    
    // Check app.config.js
    this.checkAppConfig();
    
    // Use the production config validator
    const configValidation = validateProductionConfig();
    this.errors.push(...configValidation.errors);
    this.warnings.push(...configValidation.warnings);
    this.criticalErrors.push(...configValidation.criticalErrors);

    return {
      isValid: this.criticalErrors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      criticalErrors: this.criticalErrors
    };
  }

  private checkEnvironmentVariables() {
    console.log('📋 Checking environment variables...');
    
    const requiredEnvVars = [
      'EXPO_PUBLIC_SUPABASE_URL',
      'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      'EXPO_PUBLIC_BACKEND_URL',
      'EXPO_PUBLIC_PYTHON_API_URL'
    ];

    requiredEnvVars.forEach(envVar => {
      if (!process.env[envVar]) {
        this.criticalErrors.push(`❌ Missing required environment variable: ${envVar}`);
      } else if (process.env[envVar]?.includes('localhost')) {
        this.criticalErrors.push(`❌ Environment variable ${envVar} contains localhost: ${process.env[envVar]}`);
      } else if (process.env[envVar]?.includes('your-') || process.env[envVar]?.includes('placeholder')) {
        this.warnings.push(`⚠️  Environment variable ${envVar} appears to be a placeholder`);
      }
    });
  }

  private checkForLocalhostReferences() {
    console.log('🔍 Scanning for localhost references...');
    
    const filesToCheck = [
      'app/services/api/aiService.ts',
      'app/(tabs)/settings.tsx',
      'app/services/api/sportsApi.ts',
      'app/services/api/supabaseClient.ts'
    ];

    filesToCheck.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for localhost references
        if (content.includes('localhost') && !content.includes('// localhost OK for development')) {
          const lines = content.split('\n');
          lines.forEach((line, index) => {
            if (line.includes('localhost') && !line.includes('//')) {
              this.criticalErrors.push(`❌ localhost reference found in ${filePath}:${index + 1}`);
            }
          });
        }
      }
    });

    // Check for console.log statements in production code
    this.checkForConsoleLogStatements();
  }

  private checkForConsoleLogStatements() {
    console.log('🧹 Checking for console.log statements...');
    
    const appDir = 'app';
    if (!fs.existsSync(appDir)) {
      return;
    }

    let consoleLogsFound = 0;

    const checkDirectory = (dirPath: string) => {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory() && !entry.name.includes('node_modules')) {
          checkDirectory(fullPath);
        } else if (entry.name.match(/\.(ts|tsx|js|jsx)$/)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split('\n');
          
          lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            // Skip commented lines and __DEV__ wrapped console.logs
            if (!trimmedLine.startsWith('//') && 
                !trimmedLine.startsWith('*') &&
                /console\.(log|error|warn|info|debug)\s*\(/.test(line) &&
                !line.includes('__DEV__')) {
              consoleLogsFound++;
              this.warnings.push(`⚠️  Console.log found in ${fullPath}:${index + 1} - ${trimmedLine}`);
            }
          });
        }
      }
    };

    checkDirectory(appDir);

    if (consoleLogsFound > 0) {
      this.warnings.push(`⚠️  Found ${consoleLogsFound} unwrapped console.log statements. Run 'npm run cleanup-console-logs' to fix.`);
    } else {
      console.log('✅ No unwrapped console.log statements found');
    }
  }

  private checkConfigurationFiles() {
    console.log('⚙️  Checking configuration files...');
    
    // Check if development config is properly set
    const devConfigPath = 'app/config/development.ts';
    if (fs.existsSync(devConfigPath)) {
      const content = fs.readFileSync(devConfigPath, 'utf8');
      if (content.includes('FORCE_PRO_STATUS: true')) {
        this.warnings.push('⚠️  Development config has FORCE_PRO_STATUS: true - ensure production build uses correct config');
      }
    }

    // Check package.json for production scripts
    const packageJsonPath = 'package.json';
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (!packageJson.scripts?.build) {
        this.warnings.push('⚠️  No build script found in package.json');
      }
    }
  }

  private checkAppConfig() {
    console.log('📱 Checking app.config.js...');
    
    const appConfigPath = 'app.config.js';
    if (fs.existsSync(appConfigPath)) {
      const content = fs.readFileSync(appConfigPath, 'utf8');
      
      // Check for proper bundle identifier
      if (content.includes('com.predictai.app')) {
        this.warnings.push('⚠️  App bundle identifier is still using default "com.predictai.app" - consider updating for production');
      }
      
      // Check for environment variable usage
      if (!content.includes('process.env.EXPO_PUBLIC_')) {
        this.warnings.push('⚠️  app.config.js may not be using environment variables');
      }
    }
  }

  printResults(result: ValidationResult) {
    console.log('\n📊 VALIDATION RESULTS\n');
    
    if (result.criticalErrors.length > 0) {
      console.log('🚨 CRITICAL ERRORS (Must Fix Before Production):');
      result.criticalErrors.forEach(error => console.log(`   ${error}`));
      console.log('');
    }
    
    if (result.warnings.length > 0) {
      console.log('⚠️  WARNINGS (Recommended to Fix):');
      result.warnings.forEach(warning => console.log(`   ${warning}`));
      console.log('');
    }
    
    if (result.errors.length > 0) {
      console.log('❗ OTHER ISSUES:');
      result.errors.forEach(error => console.log(`   ${error}`));
      console.log('');
    }
    
    console.log('📋 APP STORE SUBMISSION CHECKLIST:');
    APP_STORE_CHECKLIST.forEach(item => console.log(`   ${item}`));
    console.log('');
    
    if (result.isValid) {
      console.log('✅ VALIDATION PASSED! Your app appears ready for production build.');
      console.log('   Next steps:');
      console.log('   1. Run: expo build:ios or eas build --platform ios');
      console.log('   2. Test on physical device');
      console.log('   3. Submit to App Store Connect');
    } else {
      console.log('❌ VALIDATION FAILED! Please fix the critical errors above.');
      console.log('   Critical errors must be resolved before building for production.');
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new ProductionValidator();
  validator.validate().then(result => {
    validator.printResults(result);
    process.exit(result.isValid ? 0 : 1);
  }).catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

export { ProductionValidator }; 