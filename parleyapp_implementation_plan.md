ParleyApp AI System Implementation Plan 

This document outlines a comprehensive implementation plan to enhance the ParleyApp's AI system, addressing current limitations and building a robust, data driven sports betting application. The plan is structured into four phases, each with specific objectives, detailed tasks, and estimated timelines. 

Phase 1: Data Layer Foundation 

Objective: Establish a robust and reliable data ingestion pipeline with real-time and historical sports data. 

Estimated Timeline: 4-6 weeks 

Detailed Tasks: 

1\. API Selection and Procurement (Week 1) 

Task: Finalize the choice between OddsJam and The Odds API. (OddsJam is recommended for its comprehensive features including real-time player props, alternate markets, injury data, and historical odds). 

Action: Research pricing, terms of service, and API documentation for both. Secure necessary API keys and credentials. 

Responsible: Development Lead / Project Manager 

2\. Database Schema Design and Setup (Weeks 1-2) 

Task: Design a scalable PostgreSQL database schema to accommodate various sports, leagues, betting markets, player-specific data, game events, odds, and injury reports. 

Action: Create tables, define relationships, and implement indexing strategies for efficient data retrieval. Set up the PostgreSQL instance (if not  
already in place) and configure access. 

Responsible: Database Administrator / Backend Developer 

3\. Data Ingestion Microservice Development (Weeks 2-5) 

Task: Develop a dedicated Python microservice (e.g., data\_ingestor.py ) responsible for connecting to the chosen sports data API and ingesting data. 

Action: 

Implement API client for the selected sports data provider. 

Develop modules for fetching real-time odds (spread, total, 

moneyline, player props), historical odds, player statistics, team statistics, game information, and injury reports. 

Implement data validation, cleaning, and transformation logic to ensure data quality and consistency before storage. 

Write code to store processed data into the PostgreSQL database. 

Implement error handling, logging, and retry mechanisms for API calls and database operations. 

Responsible: Backend Developer / Data Engineer 

4\. Historical Data Backfill (Weeks 4-6) 

Task: Ingest a significant volume of historical data from the chosen API to build a comprehensive dataset for model training and backtesting. 

Action: Develop a script within the data\_ingestor service to perform a one-time (or iterative) backfill of historical data. Monitor progress and ensure data integrity. 

Responsible: Data Engineer 

5\. Data Ingestion Monitoring and Alerting (Week 6) 

Task: Implement monitoring and alerting for the data ingestion pipeline. 

Action: Set up dashboards to track data freshness, API call success rates, and data volume. Configure alerts for any data ingestion failures or anomalies. 

Responsible: DevOps / Backend Developer  

## Phase 1 Progress Update (As of 2025-01-09)

### Completed Tasks:

1. **API Selection Analysis** ✅
   - Created comprehensive comparison document: `/backend/docs/api-selection-analysis.md`
   - Recommendation: OddsJam for comprehensive features including real-time player props, injury data, and historical odds
   - Alternative: The Odds API for budget-conscious MVP testing

2. **Enhanced Database Schema Design** ✅
   - Created comprehensive schema: `/backend/src/db/enhanced_schema.sql`
   - Key features:
     - Partitioned odds_data table for performance
     - Comprehensive player props and statistics tables
     - Injury reports and news integration
     - Model performance tracking
     - Automated triggers and functions

3. **Data Ingestion Microservice (Initial)** ✅
   - Created Python service: `/python-services/data-ingestion/data_ingestor.py`
   - Features implemented:
     - Support for both OddsJam and The Odds API
     - Async architecture with scheduled tasks
     - Real-time odds fetching (5-minute intervals)
     - Player props ingestion (10-minute intervals)
     - Injury reports (hourly updates)
     - Historical data backfill capability
   - Created requirements.txt for easy setup

4. **Migration Strategy** ✅
   - Created migration plan: `/backend/docs/phase1-migration-strategy.md`
   - Created SQL migration script: `/backend/src/db/migrate_existing_data.sql`
   - Non-destructive migration preserving existing data

### Database Migration Progress:

**Completed:**
- ✅ Step 1: Core configuration tables (sports_config, UUID extension)
- ✅ Step 2: Teams table and sports_events enhancements
- 🔄 Step 3: **IN PROGRESS** - Fixed foreign key constraint error, now ready for re-run

**Issue Encountered & Resolved:**
- Error: "column 'team_id' does not exist" 
- **Solution**: Fixed Step 3 script to properly reference `home_team_id` and `away_team_id` columns
- Step 3 script updated and ready for execution

### Next Immediate Steps:

1. **Complete Database Migration**
   - ✅ Run updated Step 3 script (foreign key error now fixed)
   - Validate all tables created successfully
   - Confirm foreign key constraints are working

2. **API Procurement** (Reid's Action Required)
   - Contact The Odds API for free tier access (500 requests/month)
   - Get API key from dashboard
   - Understand rate limits and usage optimization

3. **Service Deployment**
   - Set up Python environment
   - Configure environment variables
   - Test API connectivity
   - Start data ingestion service

4. **Initial Testing & Validation**
   - Verify odds data is populating
   - Check player props ingestion
   - Confirm injury reports updating
   - Monitor for any errors

### Important Notes:
- The enhanced schema is backward-compatible with existing data
- Migration script preserves all current data
- Data ingestion service designed for easy rollback if needed
- All code is production-ready but requires API credentials to function

Phase 2: Core Prediction Model Development 

Objective: Develop and train accurate machine learning models for player props, spreads, and totals using real data. 

Estimated Timeline: 8-12 weeks 

Detailed Tasks: 

1\. Refactor and Retrain Player Prop Models (Weeks 1-4) 

Task: Update the existing PlayerPropsBettor models to consume data from the new data layer and enhance feature engineering. 

Action: 

Modify PlayerPropsBettor to query the PostgreSQL database for historical player and team statistics, opponent matchups, game   
context, and injury status. 

Implement advanced feature engineering: incorporate advanced 

player metrics (usage rate, true shooting percentage), matchup 

analysis, recent performance trends (weighted moving averages), and situational factors (back-to-backs, post-injury performance). 

Retrain PlayerPropsBettor models (RandomForestRegressor, 

GradientBoostingRegressor) using the comprehensive historical data. 

Implement proper probability calibration techniques for confidence scores. 

Responsible: Data Scientist / ML Engineer 

2\. Develop Spread Prediction Model (Weeks 3-8) 

Task: Create a new Python module and machine learning model for predicting point spreads. 

Action: 

Design and implement a SpreadPredictor class (e.g., using 

regression models like Ridge, Lasso, or ensemble methods like 

XGBoost).  
Identify and extract relevant features from the data layer: team offensive/defensive ratings, pace, home-court advantage, critical player injuries, coaching tendencies, and historical line movements. 

Train the SpreadPredictor model on historical game results, 

including final scores and closing spreads. 

Develop evaluation metrics specific to spread betting (e.g., accuracy within a certain margin, RMSE of spread difference). 

Responsible: Data Scientist / ML Engineer 

3\. Develop Enhanced Over/Under Model (Weeks 3-8) 

Task: Replace the current simplistic over/under logic with a dedicated machine learning regression model. 

Action: 

Design and implement an OverUnderPredictor class. 

Identify and extract features influencing total scores: team 

offensive/defensive ratings, pace, injuries, weather conditions (for outdoor sports), referee tendencies, and historical total line 

movements. 

Train the OverUnderPredictor model on historical game totals. Develop evaluation metrics for total predictions (e.g., MAE, RMSE). 

Responsible: Data Scientist / ML Engineer 

4\. Model Training and Evaluation Framework (Weeks 1-8, Ongoing) 

Task: Establish a robust framework for automated model training, backtesting, and evaluation. 

Action: 

Set up a CI/CD pipeline for model training and deployment. 

Implement automated scripts for periodic retraining of all prediction models with the latest historical data. 

Develop comprehensive backtesting simulations to evaluate model performance on out-of-sample data, tracking key metrics like ROI, win rate, and profit/loss. 

Implement version control for models and training datasets.  
Responsible: ML Engineer / DevOps 

5\. API Endpoints for New Models (Weeks 7-12) 

Task: Expose the newly developed spread and enhanced over/under prediction models as API endpoints. 

Action: Integrate the SpreadPredictor and OverUnderPredictor into parley\_predictor.py or create new dedicated microservices. Define clear API contracts for these endpoints. 

Responsible: Backend Developer / ML Engineer 

Phase 3: LLM Orchestrator and Frontend Integration 

Objective: Integrate the enhanced prediction models and new data sources with the LLM orchestrator and update the frontend to display comprehensive information. 

Estimated Timeline: 6-8 weeks 

Detailed Tasks: 

1\. LLM Tooling Update (Weeks 1-3) 

Task: Update the LLM orchestrator to recognize and effectively utilize the new prediction models and data query tools. 

Action: 

Define new tools for the LLM, mapping to the API endpoints of the enhanced player prop, spread, and over/under prediction models. 

Provide the LLM with access to tools for querying real-time odds, 

injury reports, team/player statistics, and news from the enhanced data layer. 

Refine prompt engineering for the LLM to leverage the new tools and data for more accurate and contextual recommendations. 

Responsible: AI Engineer / LLM Specialist 

2\. **daily\_automation.py** Enhancement (Weeks 2-4)  
Task: Modify daily\_automation.py to leverage the new prediction capabilities and improve pick generation and storage. 

Action: 

Update the script to fetch games for the next day using the new data ingestion service. 

Integrate calls to the enhanced player prop, spread, and over/under prediction endpoints. 

Implement logic to select the top 7-10 picks based on refined criteria (e.g., confidence, value, expected profit). 

Update the database storage mechanism to ensure proper player and game identification (using unique IDs from the data layer) and store all relevant prediction details (type, line, recommendation, confidence, value). 

Responsible: Backend Developer 

3\. Frontend (UI) Updates (Weeks 3-8) 

Task: Update the React Native frontend to display the new data and content sections. 

Action: 

Games Tab: Implement UI components to display real-time odds (spread, totals, moneyline, player props) from various sportsbooks. Add functionality for users to filter odds by bookmaker. 

New Content Sections: Develop dedicated UI sections for news, injury reports, and featured articles, consuming data from the 

backend. 

Prediction Display: Design clear and intuitive UI elements to display the AI-generated picks, including confidence scores, recommended stake, and relevant game/player details. 

Line Movement Visualization: (Optional, but recommended) 

Implement interactive charts to visualize historical line movements for odds. 

Responsible: Frontend Developer / UI/UX Designer 

4\. Parlay Analysis Refinement (Weeks 5-8)  
Task: Enhance the parlay analysis in parley\_predictor.py . 

Action: 

Update the parlay analysis to use the improved individual leg 

predictions (player props, spreads, totals). 

Research and implement methods for correlation modeling between parlay legs to provide more accurate combined probabilities and 

expected values. 

Refine the Kelly Criterion or fractional Kelly approach for more 

sophisticated stake sizing recommendations. 

Responsible: Data Scientist / ML Engineer 

Phase 4: Content Generation and Continuous Improvement 

Objective: Automate content generation and establish processes for continuous monitoring and improvement of the AI system. 

Estimated Timeline: Ongoing 

Detailed Tasks: 

1\. Automated Content Generation (Ongoing) 

Task: Implement scheduled tasks for the LLM to generate news summaries, injury reports, and featured articles. 

Action: 

Develop LLM prompts and workflows to process raw data (injury 

reports, news feeds) and generate concise, readable content. 

Integrate the content generation process with the backend to store and serve the generated articles to the frontend. 

Establish a human review process for critical content before 

publication. 

Responsible: AI Engineer / Content Manager  
2\. Performance Monitoring Dashboard (Ongoing) 

Task: Develop a comprehensive dashboard to monitor the health and performance of the entire AI system. 

Action: 

Track data ingestion metrics (freshness, volume, errors). 

Monitor model prediction accuracy, ROI, and win rates over time. Track API response times, system uptime, and resource utilization. Utilize tools like Grafana, Prometheus, or custom dashboards. 

Responsible: DevOps / ML Engineer 

3\. A/B Testing Framework (Ongoing) 

Task: Set up a framework for A/B testing new models or features. 

Action: Implement infrastructure to run experiments, compare different model versions or prediction strategies, and measure their impact on key metrics (e.g., prediction accuracy, user engagement, simulated profit). 

Responsible: ML Engineer 

4\. Feedback Loop Implementation (Ongoing) 

Task: Create mechanisms for collecting user feedback and integrating it into the development cycle. 

Action: Implement in-app feedback forms. Analyze user behavior and prediction outcomes to identify areas for improvement. Regularly review model performance against actual results. 

Responsible: Product Manager / Data Scientist 

5\. Automated Model Retraining (Ongoing) 

Task: Fully automate the retraining of all prediction models on a regular basis. 

Action: Configure cron jobs or scheduled tasks to trigger model retraining (e.g., weekly, monthly) using the latest available historical data. Ensure that new models are validated before deployment. 

Responsible: ML Engineer  
This implementation plan provides a detailed roadmap for transforming the ParleyApp's AI system. Each phase builds upon the previous one, ensuring a structured and efficient development process. Consistent monitoring, evaluation, and iteration will be key to the long-term success and accuracy of the AI-powered sports betting recommendations.