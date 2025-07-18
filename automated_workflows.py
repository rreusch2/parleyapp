#!/usr/bin/env python3
"""
Automated Data Collection Workflows for Enhanced Sports Betting AI
Manages scheduled data collection, processing, and system maintenance
"""

import os
import sys
import json
import logging
import asyncio
import schedule
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from dotenv import load_dotenv
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import our enhanced system components
try:
    from scrapy_integration_service import scrapy_service
    from enhanced_main_orchestrator import EnhancedSportsBettingOrchestrator
    from enhanced_teams_agent import EnhancedTeamsAgent
    from enhanced_props_agent import EnhancedPropsAgent
except ImportError as e:
    print(f"❌ Failed to import enhanced components: {e}")
    sys.exit(1)

# Load environment variables
load_dotenv('backend/.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('automated_workflows.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class WorkflowResult:
    workflow_name: str
    success: bool
    execution_time: float
    data_collected: int
    errors: List[str]
    timestamp: datetime
    metadata: Dict[str, Any]

class AutomatedWorkflowManager:
    """Manages all automated workflows for the enhanced sports betting AI system"""
    
    def __init__(self):
        self.orchestrator = None
        self.scrapy_service = scrapy_service
        self.workflow_results: List[WorkflowResult] = []
        self.email_notifications_enabled = os.getenv('EMAIL_NOTIFICATIONS_ENABLED', 'false').lower() == 'true'
        self.notification_email = os.getenv('NOTIFICATION_EMAIL')
        self.smtp_server = os.getenv('SMTP_SERVER')
        self.smtp_port = int(os.getenv('SMTP_PORT', '587'))
        self.smtp_username = os.getenv('SMTP_USERNAME')
        self.smtp_password = os.getenv('SMTP_PASSWORD')
        
        logger.info("🤖 Automated Workflow Manager initialized")
        logger.info(f"📧 Email notifications: {'ENABLED' if self.email_notifications_enabled else 'DISABLED'}")
    
    async def initialize_orchestrator(self):
        """Initialize the enhanced orchestrator"""
        try:
            self.orchestrator = EnhancedSportsBettingOrchestrator()
            logger.info("✅ Enhanced orchestrator initialized for workflows")
        except Exception as e:
            logger.error(f"❌ Failed to initialize orchestrator: {e}")
            raise
    
    async def workflow_scrapy_data_refresh(self) -> WorkflowResult:
        """Workflow: Refresh Scrapy web scraping data"""
        start_time = time.time()
        workflow_name = "Scrapy Data Refresh"
        errors = []
        data_collected = 0
        
        logger.info(f"🕷️ Starting {workflow_name}")
        
        try:
            # Force refresh of all Scrapy data
            refresh_result = await self.scrapy_service.refresh_all_data()
            
            data_collected = refresh_result.get('scraped_data_count', 0)
            execution_time = time.time() - start_time
            
            if refresh_result.get('status') == 'success':
                logger.info(f"✅ {workflow_name} completed: {data_collected} datasets refreshed in {execution_time:.1f}s")
                
                return WorkflowResult(
                    workflow_name=workflow_name,
                    success=True,
                    execution_time=execution_time,
                    data_collected=data_collected,
                    errors=errors,
                    timestamp=datetime.now(),
                    metadata={
                        'news_count': refresh_result.get('news_count', 0),
                        'player_stats_count': refresh_result.get('player_stats_count', 0),
                        'team_performance_count': refresh_result.get('team_performance_count', 0),
                        'spiders_run': refresh_result.get('spiders_run', [])
                    }
                )
            else:
                errors.append(f"Scrapy refresh failed: {refresh_result.get('error', 'Unknown error')}")
                raise Exception(f"Scrapy refresh failed: {refresh_result.get('error')}")
                
        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = f"Scrapy data refresh failed: {e}"
            errors.append(error_msg)
            logger.error(f"❌ {error_msg}")
            
            return WorkflowResult(
                workflow_name=workflow_name,
                success=False,
                execution_time=execution_time,
                data_collected=data_collected,
                errors=errors,
                timestamp=datetime.now(),
                metadata={}
            )
    
    async def workflow_generate_daily_picks(self, props_count: int = 10, teams_count: int = 10) -> WorkflowResult:
        """Workflow: Generate enhanced daily picks"""
        start_time = time.time()
        workflow_name = "Enhanced Daily Picks Generation"
        errors = []
        data_collected = 0
        
        logger.info(f"🎯 Starting {workflow_name}")
        
        try:
            if not self.orchestrator:
                await self.initialize_orchestrator()
            
            # Generate enhanced daily picks
            results = await self.orchestrator.generate_enhanced_daily_picks(
                props_count=props_count,
                teams_count=teams_count,
                test_mode=False,
                force_scrapy_refresh=False  # Use cached data from previous refresh
            )
            
            data_collected = results.get('total_picks', 0)
            execution_time = time.time() - start_time
            
            if results.get('success') and data_collected > 0:
                logger.info(f"✅ {workflow_name} completed: {data_collected} picks generated in {execution_time:.1f}s")
                
                return WorkflowResult(
                    workflow_name=workflow_name,
                    success=True,
                    execution_time=execution_time,
                    data_collected=data_collected,
                    errors=errors,
                    timestamp=datetime.now(),
                    metadata={
                        'props_picks': len(results.get('enhanced_props_picks', [])),
                        'team_picks': len(results.get('enhanced_team_picks', [])),
                        'scrapy_data_used': results.get('scrapy_data_used', False),
                        'performance_metrics': results.get('performance_metrics', {})
                    }
                )
            else:
                error_msg = f"Daily picks generation failed or produced no picks"
                errors.extend(results.get('errors', [error_msg]))
                raise Exception(error_msg)
                
        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = f"Daily picks generation failed: {e}"
            errors.append(error_msg)
            logger.error(f"❌ {error_msg}")
            
            return WorkflowResult(
                workflow_name=workflow_name,
                success=False,
                execution_time=execution_time,
                data_collected=data_collected,
                errors=errors,
                timestamp=datetime.now(),
                metadata={}
            )
    
    async def workflow_system_health_check(self) -> WorkflowResult:
        """Workflow: System health check and maintenance"""
        start_time = time.time()
        workflow_name = "System Health Check"
        errors = []
        data_collected = 0
        
        logger.info(f"🔧 Starting {workflow_name}")
        
        try:
            health_metrics = {
                'scrapy_service_status': 'unknown',
                'orchestrator_status': 'unknown',
                'database_connectivity': 'unknown',
                'recent_workflow_success_rate': 0.0,
                'disk_space_available': True,
                'memory_usage': 'normal'
            }
            
            # Check Scrapy service
            try:
                scrapy_status = await self.scrapy_service.get_service_status()
                health_metrics['scrapy_service_status'] = 'healthy' if scrapy_status.get('status') == 'ready' else 'unhealthy'
            except Exception as e:
                health_metrics['scrapy_service_status'] = 'error'
                errors.append(f"Scrapy service check failed: {e}")
            
            # Check orchestrator
            try:
                if not self.orchestrator:
                    await self.initialize_orchestrator()
                health_metrics['orchestrator_status'] = 'healthy'
            except Exception as e:
                health_metrics['orchestrator_status'] = 'error'
                errors.append(f"Orchestrator check failed: {e}")
            
            # Calculate recent workflow success rate
            if self.workflow_results:
                recent_results = [r for r in self.workflow_results if r.timestamp > datetime.now() - timedelta(hours=24)]
                if recent_results:
                    success_count = sum(1 for r in recent_results if r.success)
                    health_metrics['recent_workflow_success_rate'] = success_count / len(recent_results)
            
            # Check disk space (basic check)
            try:
                import shutil
                total, used, free = shutil.disk_usage('.')
                free_gb = free // (1024**3)
                health_metrics['disk_space_available'] = free_gb > 5  # At least 5GB free
                if not health_metrics['disk_space_available']:
                    errors.append(f"Low disk space: {free_gb}GB remaining")
            except Exception as e:
                errors.append(f"Disk space check failed: {e}")
            
            execution_time = time.time() - start_time
            overall_health = len(errors) == 0 and health_metrics['recent_workflow_success_rate'] > 0.8
            
            logger.info(f"{'✅' if overall_health else '⚠️'} {workflow_name} completed in {execution_time:.1f}s")
            logger.info(f"   Health Status: {'HEALTHY' if overall_health else 'ISSUES DETECTED'}")
            
            return WorkflowResult(
                workflow_name=workflow_name,
                success=overall_health,
                execution_time=execution_time,
                data_collected=len(health_metrics),
                errors=errors,
                timestamp=datetime.now(),
                metadata=health_metrics
            )
            
        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = f"System health check failed: {e}"
            errors.append(error_msg)
            logger.error(f"❌ {error_msg}")
            
            return WorkflowResult(
                workflow_name=workflow_name,
                success=False,
                execution_time=execution_time,
                data_collected=0,
                errors=errors,
                timestamp=datetime.now(),
                metadata={}
            )
    
    async def workflow_data_cleanup(self) -> WorkflowResult:
        """Workflow: Clean up old data and optimize storage"""
        start_time = time.time()
        workflow_name = "Data Cleanup"
        errors = []
        data_collected = 0
        
        logger.info(f"🧹 Starting {workflow_name}")
        
        try:
            cleanup_metrics = {
                'old_logs_removed': 0,
                'cache_files_cleaned': 0,
                'scrapy_data_archived': 0,
                'workflow_results_pruned': 0
            }
            
            # Clean up old log files (older than 7 days)
            try:
                import glob
                log_files = glob.glob('*.log')
                cutoff_date = datetime.now() - timedelta(days=7)
                
                for log_file in log_files:
                    try:
                        file_time = datetime.fromtimestamp(os.path.getmtime(log_file))
                        if file_time < cutoff_date:
                            os.remove(log_file)
                            cleanup_metrics['old_logs_removed'] += 1
                    except Exception as e:
                        logger.warning(f"Could not remove log file {log_file}: {e}")
            except Exception as e:
                errors.append(f"Log cleanup failed: {e}")
            
            # Clean up old workflow results (keep last 100)
            if len(self.workflow_results) > 100:
                old_count = len(self.workflow_results) - 100
                self.workflow_results = self.workflow_results[-100:]
                cleanup_metrics['workflow_results_pruned'] = old_count
            
            # Archive old Scrapy data if needed
            try:
                archive_result = await self.scrapy_service.archive_old_data(days_old=3)
                cleanup_metrics['scrapy_data_archived'] = archive_result.get('archived_count', 0)
            except Exception as e:
                errors.append(f"Scrapy data archival failed: {e}")
            
            execution_time = time.time() - start_time
            data_collected = sum(cleanup_metrics.values())
            
            logger.info(f"✅ {workflow_name} completed: {data_collected} items processed in {execution_time:.1f}s")
            
            return WorkflowResult(
                workflow_name=workflow_name,
                success=len(errors) == 0,
                execution_time=execution_time,
                data_collected=data_collected,
                errors=errors,
                timestamp=datetime.now(),
                metadata=cleanup_metrics
            )
            
        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = f"Data cleanup failed: {e}"
            errors.append(error_msg)
            logger.error(f"❌ {error_msg}")
            
            return WorkflowResult(
                workflow_name=workflow_name,
                success=False,
                execution_time=execution_time,
                data_collected=0,
                errors=errors,
                timestamp=datetime.now(),
                metadata={}
            )
    
    def send_notification_email(self, subject: str, body: str):
        """Send email notification if configured"""
        if not self.email_notifications_enabled or not all([
            self.notification_email, self.smtp_server, self.smtp_username, self.smtp_password
        ]):
            logger.info("📧 Email notifications not configured, skipping")
            return
        
        try:
            msg = MIMEMultipart()
            msg['From'] = self.smtp_username
            msg['To'] = self.notification_email
            msg['Subject'] = subject
            
            msg.attach(MIMEText(body, 'plain'))
            
            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            server.starttls()
            server.login(self.smtp_username, self.smtp_password)
            text = msg.as_string()
            server.sendmail(self.smtp_username, self.notification_email, text)
            server.quit()
            
            logger.info(f"📧 Notification email sent: {subject}")
            
        except Exception as e:
            logger.error(f"❌ Failed to send notification email: {e}")
    
    async def execute_workflow(self, workflow_func, *args, **kwargs) -> WorkflowResult:
        """Execute a workflow and handle results"""
        try:
            result = await workflow_func(*args, **kwargs)
            self.workflow_results.append(result)
            
            # Send notification for failures
            if not result.success and self.email_notifications_enabled:
                subject = f"🚨 Workflow Failed: {result.workflow_name}"
                body = f"""
Workflow: {result.workflow_name}
Status: FAILED
Execution Time: {result.execution_time:.1f}s
Errors: {', '.join(result.errors)}
Timestamp: {result.timestamp}

Please check the system logs for more details.
                """
                self.send_notification_email(subject, body)
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Workflow execution failed: {e}")
            error_result = WorkflowResult(
                workflow_name="Unknown",
                success=False,
                execution_time=0.0,
                data_collected=0,
                errors=[str(e)],
                timestamp=datetime.now(),
                metadata={}
            )
            self.workflow_results.append(error_result)
            return error_result
    
    def get_workflow_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Get summary of recent workflow executions"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        recent_results = [r for r in self.workflow_results if r.timestamp > cutoff_time]
        
        if not recent_results:
            return {
                'total_workflows': 0,
                'successful_workflows': 0,
                'failed_workflows': 0,
                'success_rate': 0.0,
                'total_data_collected': 0,
                'average_execution_time': 0.0,
                'recent_errors': []
            }
        
        successful = [r for r in recent_results if r.success]
        failed = [r for r in recent_results if not r.success]
        
        return {
            'total_workflows': len(recent_results),
            'successful_workflows': len(successful),
            'failed_workflows': len(failed),
            'success_rate': len(successful) / len(recent_results),
            'total_data_collected': sum(r.data_collected for r in recent_results),
            'average_execution_time': sum(r.execution_time for r in recent_results) / len(recent_results),
            'recent_errors': [error for r in failed for error in r.errors]
        }

# Workflow scheduling functions
workflow_manager = AutomatedWorkflowManager()

async def scheduled_scrapy_refresh():
    """Scheduled Scrapy data refresh"""
    logger.info("⏰ Executing scheduled Scrapy data refresh")
    await workflow_manager.execute_workflow(workflow_manager.workflow_scrapy_data_refresh)

async def scheduled_daily_picks():
    """Scheduled daily picks generation"""
    logger.info("⏰ Executing scheduled daily picks generation")
    await workflow_manager.execute_workflow(workflow_manager.workflow_generate_daily_picks, 10, 10)

async def scheduled_health_check():
    """Scheduled system health check"""
    logger.info("⏰ Executing scheduled system health check")
    await workflow_manager.execute_workflow(workflow_manager.workflow_system_health_check)

async def scheduled_data_cleanup():
    """Scheduled data cleanup"""
    logger.info("⏰ Executing scheduled data cleanup")
    await workflow_manager.execute_workflow(workflow_manager.workflow_data_cleanup)

def run_async_job(coro):
    """Helper to run async jobs in schedule"""
    asyncio.run(coro)

def setup_schedules():
    """Setup all scheduled workflows"""
    logger.info("📅 Setting up automated workflow schedules")
    
    # Scrapy data refresh - every 2 hours
    schedule.every(2).hours.do(lambda: run_async_job(scheduled_scrapy_refresh()))
    
    # Daily picks generation - every day at 6 AM
    schedule.every().day.at("06:00").do(lambda: run_async_job(scheduled_daily_picks()))
    
    # System health check - every 6 hours
    schedule.every(6).hours.do(lambda: run_async_job(scheduled_health_check()))
    
    # Data cleanup - every day at 2 AM
    schedule.every().day.at("02:00").do(lambda: run_async_job(scheduled_data_cleanup()))
    
    logger.info("✅ Automated workflow schedules configured:")
    logger.info("   🕷️ Scrapy refresh: Every 2 hours")
    logger.info("   🎯 Daily picks: Every day at 6:00 AM")
    logger.info("   🔧 Health check: Every 6 hours")
    logger.info("   🧹 Data cleanup: Every day at 2:00 AM")

async def run_manual_workflow(workflow_name: str):
    """Run a specific workflow manually"""
    logger.info(f"🔧 Running manual workflow: {workflow_name}")
    
    if workflow_name == "scrapy_refresh":
        result = await workflow_manager.execute_workflow(workflow_manager.workflow_scrapy_data_refresh)
    elif workflow_name == "daily_picks":
        result = await workflow_manager.execute_workflow(workflow_manager.workflow_generate_daily_picks, 10, 10)
    elif workflow_name == "health_check":
        result = await workflow_manager.execute_workflow(workflow_manager.workflow_system_health_check)
    elif workflow_name == "data_cleanup":
        result = await workflow_manager.execute_workflow(workflow_manager.workflow_data_cleanup)
    else:
        logger.error(f"❌ Unknown workflow: {workflow_name}")
        return
    
    logger.info(f"✅ Manual workflow completed: {result.workflow_name}")
    logger.info(f"   Success: {result.success}")
    logger.info(f"   Execution Time: {result.execution_time:.1f}s")
    logger.info(f"   Data Collected: {result.data_collected}")
    if result.errors:
        logger.info(f"   Errors: {', '.join(result.errors)}")

def main():
    """Main function for automated workflows"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Enhanced Sports Betting AI - Automated Workflows')
    parser.add_argument('--mode', choices=['daemon', 'manual'], default='daemon',
                       help='Run mode: daemon (scheduled) or manual (one-time)')
    parser.add_argument('--workflow', choices=['scrapy_refresh', 'daily_picks', 'health_check', 'data_cleanup'],
                       help='Specific workflow to run (manual mode only)')
    parser.add_argument('--summary', action='store_true',
                       help='Show workflow summary and exit')
    
    args = parser.parse_args()
    
    if args.summary:
        summary = workflow_manager.get_workflow_summary()
        logger.info("📊 Workflow Summary (Last 24 Hours):")
        logger.info(f"   Total Workflows: {summary['total_workflows']}")
        logger.info(f"   Successful: {summary['successful_workflows']}")
        logger.info(f"   Failed: {summary['failed_workflows']}")
        logger.info(f"   Success Rate: {summary['success_rate']:.1%}")
        logger.info(f"   Data Collected: {summary['total_data_collected']}")
        logger.info(f"   Avg Execution Time: {summary['average_execution_time']:.1f}s")
        if summary['recent_errors']:
            logger.info(f"   Recent Errors: {', '.join(summary['recent_errors'][:3])}")
        return
    
    if args.mode == 'manual':
        if not args.workflow:
            logger.error("❌ Manual mode requires --workflow argument")
            return
        
        logger.info(f"🔧 Running manual workflow: {args.workflow}")
        asyncio.run(run_manual_workflow(args.workflow))
        
    else:  # daemon mode
        logger.info("🤖 Starting Enhanced Sports Betting AI - Automated Workflows Daemon")
        
        # Setup schedules
        setup_schedules()
        
        # Run initial health check
        logger.info("🔧 Running initial system health check...")
        asyncio.run(scheduled_health_check())
        
        # Main scheduling loop
        logger.info("⏰ Starting workflow scheduler...")
        try:
            while True:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
        except KeyboardInterrupt:
            logger.info("⏹️ Automated workflows daemon stopped by user")
        except Exception as e:
            logger.error(f"❌ Automated workflows daemon failed: {e}")

if __name__ == "__main__":
    main()