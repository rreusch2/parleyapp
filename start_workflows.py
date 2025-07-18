#!/usr/bin/env python3
import asyncio
import sys
import os
sys.path.append('/home/reid/Desktop/parleyapp')

from automated_workflows import AutomatedWorkflowManager

async def main():
    workflow_manager = AutomatedWorkflowManager()
    await workflow_manager.start_all_workflows()

if __name__ == "__main__":
    asyncio.run(main())
