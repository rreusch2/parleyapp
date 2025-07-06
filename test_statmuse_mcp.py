#!/usr/bin/env python3
"""
Test script for StatMuse MCP Server
Verifies all tools work correctly
"""

import asyncio
import json
import logging
from typing import Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class StatMuseMCPClient:
    """Test client for StatMuse MCP Server"""
    
    def __init__(self):
        self.server_process = None
        self.reader = None
        self.writer = None
        self.request_id = 0
    
    async def start_server(self):
        """Start the MCP server process"""
        logger.info("🚀 Starting StatMuse MCP Server...")
        
        # Start the server process
        self.server_process = await asyncio.create_subprocess_exec(
            'python', 'statmuse_mcp_server.py',
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        self.reader = self.server_process.stdout
        self.writer = self.server_process.stdin
        
        # Initialize the connection
        await self.initialize()
        logger.info("✅ MCP Server started successfully")
    
    async def send_request(self, method: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """Send a JSON-RPC request to the server"""
        self.request_id += 1
        
        request = {
            "jsonrpc": "2.0",
            "id": self.request_id,
            "method": method
        }
        
        if params:
            request["params"] = params
        
        # Send request
        request_json = json.dumps(request) + '\n'
        self.writer.write(request_json.encode())
        await self.writer.drain()
        
        # Read response
        response_line = await self.reader.readline()
        response = json.loads(response_line.decode())
        
        return response
    
    async def initialize(self):
        """Initialize the MCP connection"""
        response = await self.send_request("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {}
            },
            "clientInfo": {
                "name": "statmuse-test-client",
                "version": "1.0.0"
            }
        })
        
        if response.get("error"):
            raise Exception(f"Failed to initialize: {response['error']}")
        
        # Send initialized notification
        await self.send_request("notifications/initialized")
    
    async def list_tools(self):
        """List available tools"""
        response = await self.send_request("tools/list")
        return response.get("result", {}).get("tools", [])
    
    async def call_tool(self, name: str, arguments: Dict[str, Any]):
        """Call a specific tool"""
        response = await self.send_request("tools/call", {
            "name": name,
            "arguments": arguments
        })
        
        if response.get("error"):
            raise Exception(f"Tool call failed: {response['error']}")
        
        return response.get("result", {})
    
    async def stop_server(self):
        """Stop the MCP server"""
        if self.server_process:
            self.server_process.terminate()
            await self.server_process.wait()
            logger.info("🛑 MCP Server stopped")

async def test_statmuse_mcp_server():
    """Test all StatMuse MCP Server functionality"""
    
    client = StatMuseMCPClient()
    
    try:
        # Start server
        await client.start_server()
        
        # Test 1: List tools
        logger.info("🧰 Testing tool listing...")
        tools = await client.list_tools()
        logger.info(f"✅ Found {len(tools)} tools: {[tool['name'] for tool in tools]}")
        
        # Test 2: Query StatMuse
        logger.info("🔍 Testing StatMuse query...")
        result = await client.call_tool("query_statmuse", {
            "query": "Yankees vs Red Sox last 5 meetings"
        })
        logger.info(f"✅ Query result: {result['content'][0]['text'][:100]}...")
        
        # Test 3: Get team head-to-head
        logger.info("⚔️ Testing team head-to-head...")
        result = await client.call_tool("get_team_head_to_head", {
            "team1": "Dodgers",
            "team2": "Padres",
            "games": 5
        })
        logger.info(f"✅ Head-to-head result: {result['content'][0]['text'][:100]}...")
        
        # Test 4: Get team record
        logger.info("📊 Testing team record...")
        result = await client.call_tool("get_team_record", {
            "team": "Yankees",
            "record_type": "home"
        })
        logger.info(f"✅ Team record result: {result['content'][0]['text'][:100]}...")
        
        # Test 5: Get recent performance
        logger.info("📈 Testing recent performance...")
        result = await client.call_tool("get_team_recent_performance", {
            "team": "Dodgers",
            "games": 10
        })
        logger.info(f"✅ Recent performance result: {result['content'][0]['text'][:100]}...")
        
        # Test 6: Get player stats
        logger.info("🏃 Testing player stats...")
        result = await client.call_tool("get_player_stats", {
            "player": "Aaron Judge",
            "stat_type": "hitting"
        })
        logger.info(f"✅ Player stats result: {result['content'][0]['text'][:100]}...")
        
        logger.info("🎉 All tests passed! StatMuse MCP Server is working correctly!")
        
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        raise
    
    finally:
        await client.stop_server()

if __name__ == "__main__":
    asyncio.run(test_statmuse_mcp_server()) 