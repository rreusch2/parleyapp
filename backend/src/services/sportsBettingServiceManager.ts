import { spawn, ChildProcess } from 'child_process';
import { logger } from '../utils/logger';
import path from 'path';
import axios from 'axios';

class SportsBettingServiceManager {
  private pythonProcess: ChildProcess | null = null;
  private readonly apiUrl = process.env.SPORTS_BETTING_API_URL || 'http://localhost:8001';
  private readonly pythonServicePath = path.join(process.cwd(), 'python-services', 'sports-betting-api');
  private isStarting = false;

  /**
   * Check if the Python API is running
   */
  async isApiRunning(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.apiUrl}/health`, {
        timeout: 3000
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Start the Python sports betting API if it's not already running
   */
  async ensureApiRunning(): Promise<boolean> {
    // Check if already running
    if (await this.isApiRunning()) {
      logger.info('Sports betting API is already running');
      return true;
    }

    // Don't start multiple instances
    if (this.isStarting) {
      logger.info('Sports betting API is currently starting');
      return await this.waitForApi();
    }

    logger.info('Starting sports betting API...');
    this.isStarting = true;

    try {
      // Check if virtual environment exists
      const venvPath = path.join(this.pythonServicePath, 'venv');
      const activateScript = process.platform === 'win32' 
        ? path.join(venvPath, 'Scripts', 'activate.bat')
        : path.join(venvPath, 'bin', 'activate');

      // Python command with virtual environment activation
      let command: string;
      let args: string[];

      if (process.platform === 'win32') {
        command = 'cmd';
        args = ['/c', `"${activateScript}" && python app.py`];
      } else {
        command = 'bash';
        args = ['-c', `source "${activateScript}" && python app.py`];
      }

      // Spawn the Python process
      this.pythonProcess = spawn(command, args, {
        cwd: this.pythonServicePath,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
      });

      // Handle process output
      this.pythonProcess.stdout?.on('data', (data) => {
        logger.info(`Sports betting API stdout: ${data.toString().trim()}`);
      });

      this.pythonProcess.stderr?.on('data', (data) => {
        logger.warn(`Sports betting API stderr: ${data.toString().trim()}`);
      });

      this.pythonProcess.on('close', (code) => {
        logger.info(`Sports betting API process exited with code ${code}`);
        this.pythonProcess = null;
        this.isStarting = false;
      });

      this.pythonProcess.on('error', (error) => {
        logger.error(`Failed to start sports betting API: ${error.message}`);
        this.pythonProcess = null;
        this.isStarting = false;
      });

      // Wait for the API to be ready
      const isReady = await this.waitForApi();
      this.isStarting = false;
      return isReady;

    } catch (error) {
      logger.error(`Error starting sports betting API: ${error instanceof Error ? error.message : String(error)}`);
      this.isStarting = false;
      return false;
    }
  }

  /**
   * Wait for the API to become available
   */
  private async waitForApi(maxAttempts: number = 30): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      if (await this.isApiRunning()) {
        logger.info('Sports betting API is now running');
        return true;
      }
      
      // Wait 2 seconds between attempts
      await new Promise(resolve => setTimeout(resolve, 2000));
      logger.info(`Waiting for sports betting API... (attempt ${i + 1}/${maxAttempts})`);
    }
    
    logger.error('Sports betting API failed to start within timeout period');
    return false;
  }

  /**
   * Stop the Python API process
   */
  stopApi(): void {
    if (this.pythonProcess) {
      logger.info('Stopping sports betting API...');
      this.pythonProcess.kill();
      this.pythonProcess = null;
    }
  }

  /**
   * Get the status of the Python API
   */
  async getApiStatus(): Promise<{
    running: boolean;
    processId?: number;
    url: string;
  }> {
    const running = await this.isApiRunning();
    return {
      running,
      processId: this.pythonProcess?.pid,
      url: this.apiUrl
    };
  }
}

// Export singleton instance
export const sportsBettingServiceManager = new SportsBettingServiceManager();

// Graceful shutdown
process.on('SIGINT', () => {
  sportsBettingServiceManager.stopApi();
  process.exit(0);
});

process.on('SIGTERM', () => {
  sportsBettingServiceManager.stopApi();
  process.exit(0);
}); 