#!/usr/bin/env node

/**
 * Production Build Validation Script
 * 
 * This script validates that your Predictive Play is ready for production build
 * and App Store submission by checking for common issues.
 */

const fs = require('fs');
const path = require('path');

// Since we can't import the production config easily, let's define the checklist here
const APP_STORE_CHECKLIST = [
  '✅ Replace all localhost URLs with production URLs',
  '✅ Set NODE_ENV=production',
  '✅ Update EXPO_PUBLIC_BACKEND_URL environment variable',
  '✅ Update EXPO_PUBLIC_PYTHON_API_URL environment variable',
  '✅ Test all API endpoints from production URLs',
  '✅ Console.log statements automatically removed in production builds',
  '✅ Enable analytics and crash reporting',
  '✅ Update app.config.js with production bundle identifier',
  '✅ Test on physical device before submission',
  '✅ Run validateProductionConfig() to check for issues',
];

class ProductionValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.criticalErrors = [];
  }

  async validate() {
    console.log('🔍 Validating Predictive Play for production build...\n');

    // Check environment variables
    this.checkEnvironmentVariables();
    
    // Check for localhost references in code
    this.checkForLocalhostReferences();
    
    // Check configuration files
    this.checkConfigurationFiles();
    
    // Check app.config.js
    this.checkAppConfig();

    return {
      isValid: this.criticalErrors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      criticalErrors: this.criticalErrors
    };
  }

  checkEnvironmentVariables() {
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
      } else if (process.env[envVar].includes('localhost')) {
        this.criticalErrors.push(`❌ Environment variable ${envVar} contains localhost: ${process.env[envVar]}`);
      } else if (process.env[envVar].includes('your-') || process.env[envVar].includes('placeholder')) {
        this.warnings.push(`⚠️  Environment variable ${envVar} appears to be a placeholder`);
      }
    });
  }

  checkForLocalhostReferences() {
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

    // Check Metro configuration for console.log removal
    this.checkMetroConfig();
  }

  
  checkMetroConfig() {
    console.log('🏗️  Checking Metro configuration for production optimizations...');
    
    const metroConfigPath = 'metro.config.js';
    if (fs.existsSync(metroConfigPath)) {
      const content = fs.readFileSync(metroConfigPath, 'utf8');
      
      if (content.includes('NODE_ENV === \'production\'') && 
          content.includes('drop_console: true')) {
        console.log('✅ Metro config properly set up for console.log removal in production');
      } else {
        this.warnings.push('⚠️  Metro config may not be configured to remove console.log in production builds');
      }
    } else {
      this.warnings.push('⚠️  metro.config.js not found');
    }
  }

  checkConfigurationFiles() {
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

  checkAppConfig() {
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

      // Check if it's using Predictive Play branding
      if (content.includes('com.Predictive Play.mobile')) {
        console.log('✅ Bundle identifier updated to production-ready com.Predictive Play.mobile');
      }

      if (content.includes('Predictive Play')) {
        console.log('✅ App name updated to Predictive Play');
      }
    }
  }

  printResults(result) {
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

module.exports = { ProductionValidator }; 