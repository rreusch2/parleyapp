#!/usr/bin/env python3
"""
StatMuse MCP Client
Easy-to-use client for accessing the StatMuse MCP Server from other AI systems
"""

import asyncio
import json
import logging
import subprocess
import time
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class StatMuseResponse:
    """Response from StatMuse MCP Server"""
    success: bool
    data: str
    cached: bool = False
    error: Optional[str] = None

class StatMuseMCPClient:
    """Client for StatMuse MCP Server - Use this in your AI systems"""
    
    def __init__(self, auto_start_server: bool = True):
        self.auto_start_server = auto_start_server
        self.server_process = None
        self.reader = None
        self.writer = None
        self.request_id = 0
        self.connected = False
    
    async def __aenter__(self):
        """Async context manager entry"""
        await self.connect()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.disconnect()
    
    async def connect(self):
        """Connect to the StatMuse MCP Server"""
        if self.connected:
            return
        
        if self.auto_start_server:
            try:
                logger.info("🚀 Starting StatMuse MCP Server...")
                self.server_process = await asyncio.create_subprocess_exec(
                    'python', 'statmuse_mcp_server.py',
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                self.reader = self.server_process.stdout
                self.writer = self.server_process.stdin
                
                # Wait a moment for server to start
                await asyncio.sleep(2)
                
                # Check if server process is still running
                if self.server_process.returncode is not None:
                    stderr_output = await self.server_process.stderr.read()
                    raise Exception(f"Server process exited with code {self.server_process.returncode}: {stderr_output.decode()}")
                
                # Initialize connection
                await self._initialize()
                self.connected = True
                logger.info("✅ Connected to StatMuse MCP Server")
                
            except Exception as e:
                logger.error(f"❌ Failed to connect to StatMuse MCP Server: {e}")
                if self.server_process:
                    self.server_process.terminate()
                    await self.server_process.wait()
                    self.server_process = None
                raise e
    
    async def disconnect(self):
        """Disconnect from the server"""
        if self.server_process and self.auto_start_server:
            self.server_process.terminate()
            await self.server_process.wait()
            logger.info("🛑 StatMuse MCP Server stopped")
        
        self.connected = False
    
    async def _send_request(self, method: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """Send request to MCP server"""
        try:
            if not self.connected:
                await self.connect()
            
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
            if not response_line:
                raise Exception("Server closed connection")
            
            response = json.loads(response_line.decode())
            return response
            
        except Exception as e:
            logger.error(f"Request failed: {e}")
            # Reset connection state so future requests can try again
            self.connected = False
            raise e
    
    async def _initialize(self):
        """Initialize MCP connection"""
        try:
            # Use a direct send/receive for initialization to avoid recursion
            self.request_id += 1
            
            request = {
                "jsonrpc": "2.0",
                "id": self.request_id,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {"tools": {}},
                    "clientInfo": {
                        "name": "statmuse-ai-client",
                        "version": "1.0.0"
                    }
                }
            }
            
            # Send request
            request_json = json.dumps(request) + '\n'
            self.writer.write(request_json.encode())
            await self.writer.drain()
            
            # Read response with timeout
            response_line = await asyncio.wait_for(
                self.reader.readline(), 
                timeout=10.0
            )
            
            if not response_line:
                raise Exception("Server closed connection during initialization")
            
            response = json.loads(response_line.decode())
            
            if response.get("error"):
                raise Exception(f"Failed to initialize MCP: {response['error']}")
                
            logger.info("✅ MCP connection initialized successfully")
            
        except asyncio.TimeoutError:
            raise Exception("Timeout waiting for server initialization response")
        except Exception as e:
            logger.error(f"Initialization failed: {e}")
            raise e
    
    async def query_statmuse(self, query: str) -> StatMuseResponse:
        """
        Query StatMuse with natural language
        
        Examples:
        - "Yankees vs Red Sox last 5 meetings"
        - "Dodgers home record 2025"
        - "Aaron Judge batting average last 10 games"
        """
        try:
            response = await self._send_request("tools/call", {
                "name": "query_statmuse",
                "arguments": {"query": query}
            })
            
            if response.get("error"):
                return StatMuseResponse(
                    success=False,
                    data="",
                    error=response["error"]["message"]
                )
            
            result_text = response["result"]["content"][0]["text"]
            cached = "Cached: Yes" in result_text
            
            return StatMuseResponse(
                success=True,
                data=result_text,
                cached=cached
            )
            
        except Exception as e:
            logger.error(f"Error querying StatMuse: {e}")
            return StatMuseResponse(
                success=False,
                data="",
                error=str(e)
            )
    
    async def get_head_to_head(self, team1: str, team2: str, games: int = 5) -> StatMuseResponse:
        """Get head-to-head record between two teams"""
        try:
            response = await self._send_request("tools/call", {
                "name": "get_team_head_to_head",
                "arguments": {
                    "team1": team1,
                    "team2": team2,
                    "games": games
                }
            })
            
            if response.get("error"):
                return StatMuseResponse(
                    success=False,
                    data="",
                    error=response["error"]["message"]
                )
            
            return StatMuseResponse(
                success=True,
                data=response["result"]["content"][0]["text"]
            )
            
        except Exception as e:
            return StatMuseResponse(
                success=False,
                data="",
                error=str(e)
            )
    
    async def get_team_record(self, team: str, record_type: str = "overall", season: str = "2025") -> StatMuseResponse:
        """
        Get team record
        
        record_type options: 'home', 'away', 'overall', 'last_10'
        """
        try:
            response = await self._send_request("tools/call", {
                "name": "get_team_record",
                "arguments": {
                    "team": team,
                    "record_type": record_type,
                    "season": season
                }
            })
            
            if response.get("error"):
                return StatMuseResponse(
                    success=False,
                    data="",
                    error=response["error"]["message"]
                )
            
            return StatMuseResponse(
                success=True,
                data=response["result"]["content"][0]["text"]
            )
            
        except Exception as e:
            return StatMuseResponse(
                success=False,
                data="",
                error=str(e)
            )
    
    async def get_recent_performance(self, team: str, games: int = 10) -> StatMuseResponse:
        """Get team's recent performance"""
        try:
            response = await self._send_request("tools/call", {
                "name": "get_team_recent_performance",
                "arguments": {
                    "team": team,
                    "games": games
                }
            })
            
            if response.get("error"):
                return StatMuseResponse(
                    success=False,
                    data="",
                    error=response["error"]["message"]
                )
            
            return StatMuseResponse(
                success=True,
                data=response["result"]["content"][0]["text"]
            )
            
        except Exception as e:
            return StatMuseResponse(
                success=False,
                data="",
                error=str(e)
            )
    
    async def get_player_stats(self, player: str, stat_type: str = "season", timeframe: str = "season") -> StatMuseResponse:
        """
        Get player statistics
        
        stat_type options: 'hitting', 'pitching', 'recent', 'season'
        timeframe options: 'last_10', 'last_30', 'season', '2025'
        """
        try:
            response = await self._send_request("tools/call", {
                "name": "get_player_stats",
                "arguments": {
                    "player": player,
                    "stat_type": stat_type,
                    "timeframe": timeframe
                }
            })
            
            if response.get("error"):
                return StatMuseResponse(
                    success=False,
                    data="",
                    error=response["error"]["message"]
                )
            
            return StatMuseResponse(
                success=True,
                data=response["result"]["content"][0]["text"]
            )
            
        except Exception as e:
            return StatMuseResponse(
                success=False,
                data="",
                error=str(e)
            )

# Synchronous wrapper functions for easy use in existing code
class StatMuseSync:
    """Synchronous wrapper for StatMuse MCP Client"""
    
    @staticmethod
    def query(query: str) -> StatMuseResponse:
        """Synchronous query to StatMuse"""
        return asyncio.run(StatMuseSync._async_query(query))
    
    @staticmethod
    async def _async_query(query: str) -> StatMuseResponse:
        async with StatMuseMCPClient() as client:
            return await client.query_statmuse(query)
    
    @staticmethod
    def get_head_to_head(team1: str, team2: str, games: int = 5) -> StatMuseResponse:
        """Synchronous head-to-head query"""
        return asyncio.run(StatMuseSync._async_head_to_head(team1, team2, games))
    
    @staticmethod
    async def _async_head_to_head(team1: str, team2: str, games: int) -> StatMuseResponse:
        async with StatMuseMCPClient() as client:
            return await client.get_head_to_head(team1, team2, games)
    
    @staticmethod
    def get_team_record(team: str, record_type: str = "overall") -> StatMuseResponse:
        """Synchronous team record query"""
        return asyncio.run(StatMuseSync._async_team_record(team, record_type))
    
    @staticmethod
    async def _async_team_record(team: str, record_type: str) -> StatMuseResponse:
        async with StatMuseMCPClient() as client:
            return await client.get_team_record(team, record_type)

# Example usage functions
async def example_usage():
    """Example of how to use the StatMuse MCP Client"""
    
    async with StatMuseMCPClient() as client:
        # Query StatMuse with natural language
        result = await client.query_statmuse("Yankees vs Red Sox last 5 meetings")
        print(f"Query Result: {result.data}")
        
        # Get head-to-head data
        h2h = await client.get_head_to_head("Dodgers", "Padres", 5)
        print(f"Head-to-Head: {h2h.data}")
        
        # Get team record
        record = await client.get_team_record("Yankees", "home")
        print(f"Team Record: {record.data}")
        
        # Get recent performance
        performance = await client.get_recent_performance("Dodgers", 10)
        print(f"Recent Performance: {performance.data}")
        
        # Get player stats
        stats = await client.get_player_stats("Aaron Judge", "hitting")
        print(f"Player Stats: {stats.data}")

if __name__ == "__main__":
    # Run example
    asyncio.run(example_usage()) 