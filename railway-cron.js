const { spawn } = require('child_process');
const path = require('path');

/**
 * Railway Cron Service for ParleyApp Daily Predictions
 * Executes the daily automation script with proper error handling and logging
 */

async function runDailyAutomation() {
    console.log(`[${new Date().toISOString()}] Starting ParleyApp Daily Automation...`);
    
    const scriptPath = path.join(__dirname, 'daily-automation.sh');
    
    return new Promise((resolve, reject) => {
        const process = spawn('bash', [scriptPath], {
            cwd: __dirname,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let stdout = '';
        let stderr = '';
        
        process.stdout.on('data', (data) => {
            const output = data.toString();
            stdout += output;
            console.log(output.trim());
        });
        
        process.stderr.on('data', (data) => {
            const error = data.toString();
            stderr += error;
            console.error(`STDERR: ${error.trim()}`);
        });
        
        process.on('close', (code) => {
            console.log(`[${new Date().toISOString()}] Daily automation process exited with code: ${code}`);
            
            if (code === 0) {
                console.log('✅ Daily automation completed successfully');
                resolve({ success: true, stdout, stderr });
            } else {
                console.error('❌ Daily automation failed');
                reject(new Error(`Process exited with code ${code}`));
            }
        });
        
        process.on('error', (error) => {
            console.error(`[${new Date().toISOString()}] Failed to start daily automation:`, error);
            reject(error);
        });
    });
}

// For Railway Cron - this will be triggered by Railway's cron scheduler
async function handler() {
    try {
        await runDailyAutomation();
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Daily automation completed successfully',
                timestamp: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('Daily automation failed:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Daily automation failed',
                message: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
}

// Export for Railway
module.exports = { handler };

// For local testing
if (require.main === module) {
    runDailyAutomation()
        .then(() => {
            console.log('Local test completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Local test failed:', error);
            process.exit(1);
        });
}
