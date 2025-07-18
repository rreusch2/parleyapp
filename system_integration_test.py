#!/usr/bin/env python3
"""
System Integration Test for Enhanced Sports Betting AI
Tests all components working together with real data sources
"""

import os
import sys
import json
import logging
import asyncio
import time
from datetime import datetime
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from dotenv import load_dotenv

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import all enhanced system components
try:
    from scrapy_integration_service import scrapy_service, ScrapedData
    from enhanced_main_orchestrator import EnhancedSportsBettingOrchestrator
    from enhanced_teams_agent import EnhancedTeamsAgent
    from enhanced_props_agent import EnhancedPropsAgent
    from automated_workflows import AutomatedWorkflowManager
except ImportError as e:
    print(f"❌ Failed to import enhanced components: {e}")
    print("Make sure all enhanced components are available in the current directory")
    sys.exit(1)

# Load environment variables
load_dotenv('backend/.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class TestResult:
    test_name: str
    success: bool
    execution_time: float
    details: Dict[str, Any]
    errors: List[str]
    timestamp: datetime

class SystemIntegrationTester:
    """Comprehensive system integration tester for enhanced sports betting AI"""
    
    def __init__(self):
        self.test_results: List[TestResult] = []
        self.scrapy_service = scrapy_service
        self.orchestrator = None
        self.teams_agent = None
        self.props_agent = None
        self.workflow_manager = None
        
        logger.info("🧪 System Integration Tester initialized")
    
    async def test_scrapy_integration_service(self) -> TestResult:
        """Test Scrapy integration service functionality"""
        start_time = time.time()
        test_name = "Scrapy Integration Service"
        errors = []
        details = {}
        
        logger.info(f"🕷️ Testing {test_name}")
        
        try:
            # Test service status
            status = await self.scrapy_service.get_service_status()
            details['service_status'] = status
            
            if status.get('status') != 'ready':
                errors.append(f"Scrapy service not ready: {status}")
            
            # Test data refresh
            refresh_result = await self.scrapy_service.refresh_all_data()
            details['refresh_result'] = refresh_result
            
            if refresh_result.get('status') == 'failed':
                errors.append(f"Data refresh failed: {refresh_result.get('error')}")
            
            # Test enhanced insights
            insights = self.scrapy_service.get_enhanced_insights_for_ai(
                teams=['Yankees', 'Dodgers'],
                players=['Aaron Judge', 'Mookie Betts'],
                data_types=['news', 'player_stats', 'team_performance']
            )
            details['insights_test'] = {
                'news_count': len(insights.get('news', [])),
                'player_stats_count': len(insights.get('player_stats', [])),
                'team_performance_count': len(insights.get('team_performance', [])),
                'total_insights': insights.get('summary', {}).get('total_insights', 0)
            }
            
            # Test data loading
            scraped_data = self.scrapy_service.load_scraped_data(['news', 'player_stats'])
            details['data_loading_test'] = {
                'data_types_loaded': len(scraped_data),
                'total_items': sum(len(data) for data in scraped_data.values())
            }
            
            execution_time = time.time() - start_time
            success = len(errors) == 0
            
            logger.info(f"{'✅' if success else '❌'} {test_name} completed in {execution_time:.1f}s")
            
            return TestResult(
                test_name=test_name,
                success=success,
                execution_time=execution_time,
                details=details,
                errors=errors,
                timestamp=datetime.now()
            )
            
        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = f"Scrapy integration service test failed: {e}"
            errors.append(error_msg)
            logger.error(f"❌ {error_msg}")
            
            return TestResult(
                test_name=test_name,
                success=False,
                execution_time=execution_time,
                details=details,
                errors=errors,
                timestamp=datetime.now()
            )
    
    async def test_enhanced_teams_agent(self) -> TestResult:
        """Test enhanced teams agent functionality"""
        start_time = time.time()
        test_name = "Enhanced Teams Agent"
        errors = []
        details = {}
        
        logger.info(f"🏈 Testing {test_name}")
        
        try:
            # Initialize teams agent
            self.teams_agent = EnhancedTeamsAgent()
            details['agent_initialized'] = True
            
            # Test daily picks generation
            picks = await self.teams_agent.generate_daily_picks(target_picks=5)
            details['picks_generated'] = len(picks)
            
            if len(picks) == 0:
                errors.append("No team picks generated")
            else:
                # Validate pick structure
                sample_pick = picks[0]
                required_fields = ['pick', 'odds', 'confidence', 'match_teams', 'metadata']
                missing_fields = [field for field in required_fields if field not in sample_pick]
                
                if missing_fields:
                    errors.append(f"Missing required fields in picks: {missing_fields}")
                
                # Check for enhanced features
                metadata = sample_pick.get('metadata', {})
                details['enhanced_features'] = {
                    'scrapy_insights_used': metadata.get('scrapy_insights_used', False),
                    'research_insights_count': metadata.get('research_insights_count', 0),
                    'ai_generated': metadata.get('ai_generated', False),
                    'enhanced_system': metadata.get('enhanced_system', False)
                }
                
                # Check confidence levels
                confidences = [pick['confidence'] for pick in picks]
                details['confidence_stats'] = {
                    'min_confidence': min(confidences),
                    'max_confidence': max(confidences),
                    'avg_confidence': sum(confidences) / len(confidences)
                }
            
            execution_time = time.time() - start_time
            success = len(errors) == 0 and len(picks) > 0
            
            logger.info(f"{'✅' if success else '❌'} {test_name} completed in {execution_time:.1f}s")
            
            return TestResult(
                test_name=test_name,
                success=success,
                execution_time=execution_time,
                details=details,
                errors=errors,
                timestamp=datetime.now()
            )
            
        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = f"Enhanced teams agent test failed: {e}"
            errors.append(error_msg)
            logger.error(f"❌ {error_msg}")
            
            return TestResult(
                test_name=test_name,
                success=False,
                execution_time=execution_time,
                details=details,
                errors=errors,
                timestamp=datetime.now()
            )
    
    async def test_enhanced_props_agent(self) -> TestResult:
        """Test enhanced props agent functionality"""
        start_time = time.time()
        test_name = "Enhanced Props Agent"
        errors = []
        details = {}
        
        logger.info(f"🎲 Testing {test_name}")
        
        try:
            # Initialize props agent
            self.props_agent = EnhancedPropsAgent()
            details['agent_initialized'] = True
            
            # Test daily picks generation
            picks = await self.props_agent.generate_daily_picks(target_picks=5)
            details['picks_generated'] = len(picks)
            
            if len(picks) == 0:
                errors.append("No player props picks generated")
            else:
                # Validate pick structure
                sample_pick = picks[0]
                required_fields = ['pick', 'odds', 'confidence', 'match_teams', 'metadata']
                missing_fields = [field for field in required_fields if field not in sample_pick]
                
                if missing_fields:
                    errors.append(f"Missing required fields in picks: {missing_fields}")
                
                # Check for enhanced features
                metadata = sample_pick.get('metadata', {})
                details['enhanced_features'] = {
                    'scrapy_insights_used': metadata.get('scrapy_insights_used', False),
                    'scrapy_edge': metadata.get('scrapy_edge', 'Not specified'),
                    'research_insights_count': metadata.get('research_insights_count', 0),
                    'enhanced_system': metadata.get('enhanced_system', False)
                }
                
                # Check prop-specific fields
                prop_fields = ['player_name', 'prop_type', 'recommendation', 'line']
                missing_prop_fields = [field for field in prop_fields if field not in metadata]
                
                if missing_prop_fields:
                    errors.append(f"Missing prop-specific fields: {missing_prop_fields}")
                
                details['prop_types'] = list(set(pick['metadata'].get('prop_type', 'unknown') for pick in picks))
            
            execution_time = time.time() - start_time
            success = len(errors) == 0 and len(picks) > 0
            
            logger.info(f"{'✅' if success else '❌'} {test_name} completed in {execution_time:.1f}s")
            
            return TestResult(
                test_name=test_name,
                success=success,
                execution_time=execution_time,
                details=details,
                errors=errors,
                timestamp=datetime.now()
            )
            
        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = f"Enhanced props agent test failed: {e}"
            errors.append(error_msg)
            logger.error(f"❌ {error_msg}")
            
            return TestResult(
                test_name=test_name,
                success=False,
                execution_time=execution_time,
                details=details,
                errors=errors,
                timestamp=datetime.now()
            )
    
    async def test_enhanced_orchestrator(self) -> TestResult:
        """Test enhanced main orchestrator functionality"""
        start_time = time.time()
        test_name = "Enhanced Main Orchestrator"
        errors = []
        details = {}
        
        logger.info(f"🤖 Testing {test_name}")
        
        try:
            # Initialize orchestrator
            self.orchestrator = EnhancedSportsBettingOrchestrator()
            details['orchestrator_initialized'] = True
            
            # Test Scrapy data refresh
            scrapy_result = await self.orchestrator.refresh_scrapy_data(force_refresh=True)
            details['scrapy_refresh'] = scrapy_result
            
            if scrapy_result.get('status') == 'failed':
                errors.append(f"Scrapy refresh failed: {scrapy_result.get('error')}")
            
            # Test enhanced daily picks generation
            results = await self.orchestrator.generate_enhanced_daily_picks(
                props_count=3,
                teams_count=3,
                test_mode=True,
                force_scrapy_refresh=False
            )
            
            details['daily_picks_result'] = {
                'total_picks': results.get('total_picks', 0),
                'props_picks': len(results.get('enhanced_props_picks', [])),
                'team_picks': len(results.get('enhanced_team_picks', [])),
                'scrapy_data_used': results.get('scrapy_data_used', False),
                'success': results.get('success', False),
                'performance_metrics': results.get('performance_metrics', {})
            }
            
            if not results.get('success'):
                errors.extend(results.get('errors', ['Unknown orchestrator error']))
            
            # Test individual agent runs
            if results.get('success'):
                props_only = await self.orchestrator.run_enhanced_props_only(count=2, test_mode=True)
                teams_only = await self.orchestrator.run_enhanced_teams_only(count=2, test_mode=True)
                
                details['individual_runs'] = {
                    'props_only_count': len(props_only),
                    'teams_only_count': len(teams_only)
                }
            
            execution_time = time.time() - start_time
            success = len(errors) == 0 and results.get('success', False)
            
            logger.info(f"{'✅' if success else '❌'} {test_name} completed in {execution_time:.1f}s")
            
            return TestResult(
                test_name=test_name,
                success=success,
                execution_time=execution_time,
                details=details,
                errors=errors,
                timestamp=datetime.now()
            )
            
        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = f"Enhanced orchestrator test failed: {e}"
            errors.append(error_msg)
            logger.error(f"❌ {error_msg}")
            
            return TestResult(
                test_name=test_name,
                success=False,
                execution_time=execution_time,
                details=details,
                errors=errors,
                timestamp=datetime.now()
            )
    
    async def test_automated_workflows(self) -> TestResult:
        """Test automated workflows functionality"""
        start_time = time.time()
        test_name = "Automated Workflows"
        errors = []
        details = {}
        
        logger.info(f"⚙️ Testing {test_name}")
        
        try:
            # Initialize workflow manager
            self.workflow_manager = AutomatedWorkflowManager()
            details['workflow_manager_initialized'] = True
            
            # Test individual workflows
            workflows_to_test = [
                ('scrapy_refresh', self.workflow_manager.workflow_scrapy_data_refresh),
                ('health_check', self.workflow_manager.workflow_system_health_check),
                ('data_cleanup', self.workflow_manager.workflow_data_cleanup)
            ]
            
            workflow_results = {}
            
            for workflow_name, workflow_func in workflows_to_test:
                try:
                    logger.info(f"   Testing workflow: {workflow_name}")
                    result = await self.workflow_manager.execute_workflow(workflow_func)
                    
                    workflow_results[workflow_name] = {
                        'success': result.success,
                        'execution_time': result.execution_time,
                        'data_collected': result.data_collected,
                        'errors': result.errors
                    }
                    
                    if not result.success:
                        errors.extend([f"{workflow_name}: {error}" for error in result.errors])
                        
                except Exception as e:
                    error_msg = f"Workflow {workflow_name} failed: {e}"
                    errors.append(error_msg)
                    workflow_results[workflow_name] = {'success': False, 'error': str(e)}
            
            details['workflow_results'] = workflow_results
            
            # Test workflow summary
            summary = self.workflow_manager.get_workflow_summary(hours=1)
            details['workflow_summary'] = summary
            
            execution_time = time.time() - start_time
            success = len(errors) == 0
            
            logger.info(f"{'✅' if success else '❌'} {test_name} completed in {execution_time:.1f}s")
            
            return TestResult(
                test_name=test_name,
                success=success,
                execution_time=execution_time,
                details=details,
                errors=errors,
                timestamp=datetime.now()
            )
            
        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = f"Automated workflows test failed: {e}"
            errors.append(error_msg)
            logger.error(f"❌ {error_msg}")
            
            return TestResult(
                test_name=test_name,
                success=False,
                execution_time=execution_time,
                details=details,
                errors=errors,
                timestamp=datetime.now()
            )
    
    async def test_end_to_end_integration(self) -> TestResult:
        """Test complete end-to-end system integration"""
        start_time = time.time()
        test_name = "End-to-End Integration"
        errors = []
        details = {}
        
        logger.info(f"🔄 Testing {test_name}")
        
        try:
            # Step 1: Refresh Scrapy data
            logger.info("   Step 1: Refreshing Scrapy data...")
            scrapy_result = await self.scrapy_service.refresh_all_data()
            details['step1_scrapy_refresh'] = scrapy_result
            
            if scrapy_result.get('status') == 'failed':
                errors.append(f"Step 1 failed: {scrapy_result.get('error')}")
            
            # Step 2: Generate enhanced insights
            logger.info("   Step 2: Generating enhanced insights...")
            insights = self.scrapy_service.get_enhanced_insights_for_ai(
                teams=['all'],
                players=['all'],
                data_types=['news', 'player_stats', 'team_performance']
            )
            details['step2_insights'] = {
                'total_insights': insights.get('summary', {}).get('total_insights', 0),
                'teams_covered': len(insights.get('summary', {}).get('teams_covered', []))
            }
            
            # Step 3: Generate picks with both agents
            logger.info("   Step 3: Generating picks with enhanced agents...")
            if not self.orchestrator:
                self.orchestrator = EnhancedSportsBettingOrchestrator()
            
            picks_result = await self.orchestrator.generate_enhanced_daily_picks(
                props_count=5,
                teams_count=5,
                test_mode=True,
                force_scrapy_refresh=False
            )
            
            details['step3_picks'] = {
                'total_picks': picks_result.get('total_picks', 0),
                'scrapy_data_used': picks_result.get('scrapy_data_used', False),
                'success': picks_result.get('success', False)
            }
            
            if not picks_result.get('success'):
                errors.extend([f"Step 3: {error}" for error in picks_result.get('errors', [])])
            
            # Step 4: Validate data flow
            logger.info("   Step 4: Validating data flow...")
            all_picks = picks_result.get('enhanced_props_picks', []) + picks_result.get('enhanced_team_picks', [])
            
            if all_picks:
                scrapy_enhanced_count = sum(1 for pick in all_picks if pick.get('metadata', {}).get('scrapy_insights_used'))
                details['step4_validation'] = {
                    'total_picks': len(all_picks),
                    'scrapy_enhanced_picks': scrapy_enhanced_count,
                    'scrapy_enhancement_rate': scrapy_enhanced_count / len(all_picks) if all_picks else 0
                }
                
                # Check for required enhanced features
                sample_pick = all_picks[0]
                enhanced_features = sample_pick.get('metadata', {})
                
                required_enhanced_fields = ['enhanced_system', 'research_insights_count', 'model_used']
                missing_enhanced_fields = [field for field in required_enhanced_fields if field not in enhanced_features]
                
                if missing_enhanced_fields:
                    errors.append(f"Step 4: Missing enhanced fields: {missing_enhanced_fields}")
            else:
                errors.append("Step 4: No picks generated for validation")
            
            # Step 5: Test system health
            logger.info("   Step 5: Testing system health...")
            if not self.workflow_manager:
                self.workflow_manager = AutomatedWorkflowManager()
            
            health_result = await self.workflow_manager.workflow_system_health_check()
            details['step5_health'] = {
                'success': health_result.success,
                'health_metrics': health_result.metadata
            }
            
            if not health_result.success:
                errors.extend([f"Step 5: {error}" for error in health_result.errors])
            
            execution_time = time.time() - start_time
            success = len(errors) == 0
            
            logger.info(f"{'✅' if success else '❌'} {test_name} completed in {execution_time:.1f}s")
            
            return TestResult(
                test_name=test_name,
                success=success,
                execution_time=execution_time,
                details=details,
                errors=errors,
                timestamp=datetime.now()
            )
            
        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = f"End-to-end integration test failed: {e}"
            errors.append(error_msg)
            logger.error(f"❌ {error_msg}")
            
            return TestResult(
                test_name=test_name,
                success=False,
                execution_time=execution_time,
                details=details,
                errors=errors,
                timestamp=datetime.now()
            )
    
    async def run_all_tests(self) -> Dict[str, Any]:
        """Run all system integration tests"""
        logger.info("🧪 Starting comprehensive system integration tests")
        start_time = time.time()
        
        # Define test sequence
        tests = [
            ("Scrapy Integration Service", self.test_scrapy_integration_service),
            ("Enhanced Teams Agent", self.test_enhanced_teams_agent),
            ("Enhanced Props Agent", self.test_enhanced_props_agent),
            ("Enhanced Main Orchestrator", self.test_enhanced_orchestrator),
            ("Automated Workflows", self.test_automated_workflows),
            ("End-to-End Integration", self.test_end_to_end_integration)
        ]
        
        # Run tests sequentially
        for test_name, test_func in tests:
            logger.info(f"🔍 Running test: {test_name}")
            result = await test_func()
            self.test_results.append(result)
            
            if result.success:
                logger.info(f"✅ {test_name} PASSED")
            else:
                logger.error(f"❌ {test_name} FAILED: {', '.join(result.errors)}")
        
        # Generate summary
        total_time = time.time() - start_time
        passed_tests = [r for r in self.test_results if r.success]
        failed_tests = [r for r in self.test_results if not r.success]
        
        summary = {
            'total_tests': len(self.test_results),
            'passed_tests': len(passed_tests),
            'failed_tests': len(failed_tests),
            'success_rate': len(passed_tests) / len(self.test_results) if self.test_results else 0,
            'total_execution_time': total_time,
            'overall_success': len(failed_tests) == 0,
            'test_results': [
                {
                    'test_name': r.test_name,
                    'success': r.success,
                    'execution_time': r.execution_time,
                    'errors': r.errors
                } for r in self.test_results
            ]
        }
        
        # Log summary
        logger.info("=" * 80)
        logger.info("🧪 SYSTEM INTEGRATION TEST SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Total Tests: {summary['total_tests']}")
        logger.info(f"Passed: {summary['passed_tests']}")
        logger.info(f"Failed: {summary['failed_tests']}")
        logger.info(f"Success Rate: {summary['success_rate']:.1%}")
        logger.info(f"Total Time: {summary['total_execution_time']:.1f}s")
        logger.info(f"Overall Result: {'✅ ALL TESTS PASSED' if summary['overall_success'] else '❌ SOME TESTS FAILED'}")
        
        if failed_tests:
            logger.info("\n❌ FAILED TESTS:")
            for test in failed_tests:
                logger.info(f"   {test.test_name}: {', '.join(test.errors)}")
        
        logger.info("=" * 80)
        
        return summary

async def main():
    """Main function for system integration testing"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Enhanced Sports Betting AI - System Integration Tests')
    parser.add_argument('--test', choices=[
        'scrapy', 'teams', 'props', 'orchestrator', 'workflows', 'e2e', 'all'
    ], default='all', help='Specific test to run')
    parser.add_argument('--output', help='Output file for test results (JSON)')
    
    args = parser.parse_args()
    
    tester = SystemIntegrationTester()
    
    if args.test == 'all':
        results = await tester.run_all_tests()
    else:
        # Run specific test
        test_map = {
            'scrapy': tester.test_scrapy_integration_service,
            'teams': tester.test_enhanced_teams_agent,
            'props': tester.test_enhanced_props_agent,
            'orchestrator': tester.test_enhanced_orchestrator,
            'workflows': tester.test_automated_workflows,
            'e2e': tester.test_end_to_end_integration
        }
        
        if args.test in test_map:
            result = await test_map[args.test]()
            tester.test_results.append(result)
            
            results = {
                'total_tests': 1,
                'passed_tests': 1 if result.success else 0,
                'failed_tests': 0 if result.success else 1,
                'success_rate': 1.0 if result.success else 0.0,
                'total_execution_time': result.execution_time,
                'overall_success': result.success,
                'test_results': [{
                    'test_name': result.test_name,
                    'success': result.success,
                    'execution_time': result.execution_time,
                    'errors': result.errors,
                    'details': result.details
                }]
            }
            
            logger.info(f"{'✅' if result.success else '❌'} {result.test_name}: {'PASSED' if result.success else 'FAILED'}")
    
    # Save results if output file specified
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        logger.info(f"📄 Test results saved to {args.output}")
    
    # Exit with appropriate code
    sys.exit(0 if results['overall_success'] else 1)

if __name__ == "__main__":
    asyncio.run(main())