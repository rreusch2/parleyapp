const cron = require('node-cron');
const axios = require('axios');

/**
 * ParleyApp Daily Automation Cron Service
 * Runs at 6:00 AM EST daily to trigger the complete prediction pipeline
 */

// Configuration
const BACKEND_SERVICE_URL = process.env.BACKEND_SERVICE_URL || 'https://zooming-rebirth-production.up.railway.app';
const CRON_SCHEDULE = '0 6 * * *'; // 6:00 AM EST daily
const TIMEZONE = 'America/New_York';

console.log(`🚀 ParleyApp Cron Service Starting...`);
console.log(`📅 Schedule: ${CRON_SCHEDULE} (${TIMEZONE})`);
console.log(`🔗 Backend URL: ${BACKEND_SERVICE_URL}`);

// Health check endpoint
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        service: 'parleyapp-cron-service',
        nextRun: getNextRunTime(),
        timezone: TIMEZONE,
        schedule: CRON_SCHEDULE
    });
});

app.get('/', (req, res) => {
    res.json({ 
        message: 'ParleyApp Daily Automation Cron Service',
        status: 'running',
        nextRun: getNextRunTime(),
        schedule: '6:00 AM EST daily'
    });
});

function getNextRunTime() {
    const nextDate = new Date();
    nextDate.setHours(6, 0, 0, 0); // 6:00 AM
    if (nextDate <= new Date()) {
        nextDate.setDate(nextDate.getDate() + 1); // Tomorrow if 6 AM has passed
    }
    return nextDate.toISOString();
}

async function triggerDailyAutomation() {
    const timestamp = new Date().toISOString();
    console.log(`\n🔥 [${timestamp}] Triggering Daily Automation Pipeline...`);
    
    try {
        // Step 1: Trigger odds integration
        console.log('📊 Step 1: Setting up odds integration...');
        const oddsResponse = await axios.post(`${BACKEND_SERVICE_URL}/api/automation/odds-setup`, {
            timestamp: timestamp,
            source: 'railway-cron'
        }, {
            timeout: 300000, // 5 minutes
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'ParleyApp-Cron-Service'
            }
        });
        
        console.log('✅ Odds integration completed:', oddsResponse.data?.message || 'Success');
        
        // Wait 2 minutes before orchestrator
        console.log('⏳ Waiting 2 minutes before running orchestrator...');
        await new Promise(resolve => setTimeout(resolve, 120000));
        
        // Step 2: Trigger orchestrator for team predictions
        console.log('🤖 Step 2: Running team predictions orchestrator...');
        const orchestratorResponse = await axios.post(`${BACKEND_SERVICE_URL}/api/automation/run-orchestrator`, {
            timestamp: timestamp,
            source: 'railway-cron'
        }, {
            timeout: 600000, // 10 minutes
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'ParleyApp-Cron-Service'
            }
        });
        
        console.log('✅ Team predictions completed:', orchestratorResponse.data?.message || 'Success');
        
        // Step 3: Trigger player props agent
        console.log('🎯 Step 3: Running player props AI agent...');
        const propsResponse = await axios.post(`${BACKEND_SERVICE_URL}/api/automation/run-player-props`, {
            timestamp: timestamp,
            source: 'railway-cron'
        }, {
            timeout: 600000, // 10 minutes
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'ParleyApp-Cron-Service'
            }
        });
        
        console.log('✅ Player props completed:', propsResponse.data?.message || 'Success');
        
        console.log(`\n🎉 [${new Date().toISOString()}] Daily Automation Pipeline Completed Successfully!`);
        console.log(`📈 Expected: 20 total predictions (10 team + 10 player props)`);
        
    } catch (error) {
        console.error(`\n❌ [${new Date().toISOString()}] Daily Automation Failed:`, error.message);
        
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', error.response.data);
        }
        
        // You could add webhook notification here for failures
        console.error('🚨 Manual intervention may be required');
    }
}

// Schedule the daily automation
const task = cron.schedule(CRON_SCHEDULE, triggerDailyAutomation, {
    scheduled: true,
    timezone: TIMEZONE
});

console.log(`✅ Cron job scheduled successfully`);
console.log(`⏰ Next run: 6:00 AM EST daily`);

// Start the health check server
app.listen(PORT, () => {
    console.log(`🏥 Health check server running on port ${PORT}`);
    console.log(`🔗 Access: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully');
    task.stop();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down gracefully');
    task.stop();
    process.exit(0);
});

module.exports = { triggerDailyAutomation };
