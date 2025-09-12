#!/usr/bin/env python3
"""
Test StatMuse server concurrent request handling
"""
import asyncio
import aiohttp
import time
import json

# Configuration
STATMUSE_URL = "https://web-production-f090e.up.railway.app"
# STATMUSE_URL = "http://localhost:5001"  # For local testing

# Test queries - mix of different and same queries
TEST_QUERIES = [
    "Aaron Judge home runs this season",
    "Bryce Harper batting average", 
    "Yankees record this season",
    "Aaron Judge home runs this season",  # Duplicate to test cache
    "NFL passing yards leaders",
    "NBA scoring leaders",
    "Yankees record this season",  # Another duplicate
    "Mike Trout hits this season",
    "Dodgers wins this season",
    "NFL rushing leaders"
]

async def send_query(session, query, user_id):
    """Send a single query to StatMuse server"""
    start_time = time.time()
    
    try:
        async with session.post(
            f"{STATMUSE_URL}/query",
            json={"query": query},
            timeout=aiohttp.ClientTimeout(total=30)
        ) as response:
            result = await response.json()
            end_time = time.time()
            
            return {
                "user_id": user_id,
                "query": query,
                "success": result.get("success", False),
                "cached": result.get("cached", False),
                "response_time": round(end_time - start_time, 2),
                "status_code": response.status
            }
    except Exception as e:
        end_time = time.time()
        return {
            "user_id": user_id,
            "query": query,
            "success": False,
            "error": str(e),
            "response_time": round(end_time - start_time, 2),
            "status_code": None
        }

async def test_concurrent_requests(num_concurrent=10):
    """Test multiple concurrent requests"""
    print(f"🚀 Testing {num_concurrent} concurrent requests to StatMuse server...")
    print(f"📊 Server: {STATMUSE_URL}")
    print("-" * 50)
    
    # Create query-user pairs
    requests = []
    for i in range(num_concurrent):
        query = TEST_QUERIES[i % len(TEST_QUERIES)]
        requests.append((query, f"user_{i+1}"))
    
    # Send all requests concurrently
    start_time = time.time()
    
    async with aiohttp.ClientSession() as session:
        tasks = [
            send_query(session, query, user_id) 
            for query, user_id in requests
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
    
    end_time = time.time()
    total_time = round(end_time - start_time, 2)
    
    # Analyze results
    successful = [r for r in results if isinstance(r, dict) and r.get("success")]
    failed = [r for r in results if isinstance(r, dict) and not r.get("success")]
    exceptions = [r for r in results if isinstance(r, Exception)]
    cached_responses = [r for r in successful if r.get("cached")]
    
    print(f"⏱️  Total test time: {total_time}s")
    print(f"✅ Successful requests: {len(successful)}/{num_concurrent}")
    print(f"❌ Failed requests: {len(failed)}")
    print(f"💥 Exceptions: {len(exceptions)}")
    print(f"💾 Cached responses: {len(cached_responses)}")
    print()
    
    # Response time analysis
    if successful:
        response_times = [r["response_time"] for r in successful]
        avg_response_time = round(sum(response_times) / len(response_times), 2)
        max_response_time = round(max(response_times), 2)
        min_response_time = round(min(response_times), 2)
        
        print(f"📈 Response time analysis:")
        print(f"   Average: {avg_response_time}s")
        print(f"   Min: {min_response_time}s") 
        print(f"   Max: {max_response_time}s")
        print()
    
    # Show individual results
    print("📋 Individual results:")
    for i, result in enumerate(results):
        if isinstance(result, dict):
            status = "✅" if result.get("success") else "❌"
            cached = "💾" if result.get("cached") else "🆕"
            query_short = result["query"][:40] + "..." if len(result["query"]) > 40 else result["query"]
            print(f"   {status} {cached} {result['user_id']}: {query_short} ({result['response_time']}s)")
        else:
            print(f"   💥 Exception: {result}")

async def test_health_endpoint():
    """Test the health endpoint first"""
    print("🏥 Testing health endpoint...")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{STATMUSE_URL}/health") as response:
                result = await response.json()
                print(f"   Status: {response.status}")
                print(f"   Response: {result}")
                return response.status == 200
    except Exception as e:
        print(f"   ❌ Health check failed: {e}")
        return False

if __name__ == "__main__":
    async def main():
        # Test health first
        if not await test_health_endpoint():
            print("❌ Server health check failed. Exiting.")
            return
        
        print()
        
        # Test different concurrency levels
        for num_requests in [5, 10, 20]:
            await test_concurrent_requests(num_requests)
            print("=" * 50)
            if num_requests < 20:  # Don't sleep after last test
                await asyncio.sleep(2)  # Brief pause between tests
    
    asyncio.run(main())
