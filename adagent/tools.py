
from langchain_core.tools import tool

@tool
def get_meta_campaign_performance(campaign_id: str = None) -> str:
    """Use this tool to get the live performance metrics for active Meta (Facebook and Instagram) advertising campaigns. 
    You can optionally provide a campaign_id to get data for a specific campaign."""
    
    print(f"---TOOL CALLED: get_meta_campaign_performance with campaign_id: {campaign_id}---")
    
    # In a real-world scenario, this function would make an API call to the Meta Marketing API.
    # For now, it returns hardcoded dummy data.
    if campaign_id and "123" in campaign_id:
        return "Campaign 'Summer Splash' (ID: 123) has a CTR of 1.2% and has spent $500 so far."
    
    return "The 'Q3 User Acquisition' campaign has a CTR of 2.5% and has spent $1,200. The 'Fall Promo' campaign has a CTR of 0.9% and has spent $300."
