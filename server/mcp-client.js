const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class MCPClient {
    constructor() {
        this.mcpProcess = null;
        this.isConnected = false;
        this.requestQueue = [];
        this.pendingRequests = new Map();
        this.requestId = 0;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.responseBuffer = '';
        this.connectionTimeout = null;
    }

    getMcpProcess() {
        if (!this.mcpProcess || this.mcpProcess.killed) {
            this.startMcpProcess();
        }
        return this.mcpProcess;
    }

    startMcpProcess() {
        try {
            function findProjectRoot(currentDir) {
                let dir = currentDir;
                const root = path.parse(dir).root;
                while (dir !== root) {
                    const candidate = path.join(dir, 'scripts', 'mcp-server.js');
                    if (fs.existsSync(candidate)) {
                        return dir;
                    }
                    dir = path.dirname(dir);
                }
                throw new Error('scripts/mcp-server.js not found in parent directories');
            }
            const projectRoot = findProjectRoot(__dirname);
            const mcpServerPath = path.join(projectRoot, 'scripts', 'mcp-server.js');
            console.log('Starting MCP server at:', mcpServerPath);
            
            this.mcpProcess = spawn('node', [mcpServerPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env, NODE_ENV: 'production' }
            });

            this.setupEventHandlers();
            this.waitForConnection();
        } catch (error) {
            console.error('Failed to start MCP process:', error);
            this.handleConnectionError(error);
        }
    }

    setupEventHandlers() {
        if (!this.mcpProcess) return;

        // Handle stdout data with better parsing
        this.mcpProcess.stdout.on('data', (data) => {
            this.handleStdoutData(data);
        });

        // Enhanced stderr handling
        this.mcpProcess.stderr.on('data', (data) => {
            const errorMsg = data.toString();
            console.error(`MCP Error: ${errorMsg}`);
            
            // Check for specific error types
            if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('connection refused')) {
                this.handleConnectionError(new Error('Database connection refused'));
            } else if (errorMsg.includes('SQLITE_BUSY') || errorMsg.includes('database is locked')) {
                this.handleDatabaseLockError();
            }
        });

        // Handle process exit
        this.mcpProcess.on('exit', (code, signal) => {
            console.log(`MCP process exited with code ${code}, signal ${signal}`);
            this.isConnected = false;
            this.handleProcessExit(code);
        });

        // Handle process errors
        this.mcpProcess.on('error', (error) => {
            console.error('MCP process error:', error);
            this.handleConnectionError(error);
        });
    }

    handleStdoutData(data) {
        this.responseBuffer += data.toString();
        
        // Process complete JSON responses (delimited by newlines)
        const lines = this.responseBuffer.split('\n');
        this.responseBuffer = lines.pop(); // Keep incomplete line for next data chunk
        
        lines.forEach(line => {
            if (line.trim()) {
                this.processResponse(line.trim());
            }
        });
    }

    processResponse(responseStr) {
        try {
            const response = JSON.parse(responseStr);
            console.log('MCP Response received:', response);
            
            // Handle initialization response
            if (response.type === 'ready') {
                this.isConnected = true;
                this.reconnectAttempts = 0;
                console.log('MCP server is ready');
                this.processRequestQueue();
                return;
            }
            
            // Handle tool responses
            if (response.requestId !== undefined) {
                const pendingRequest = this.pendingRequests.get(response.requestId);
                if (pendingRequest) {
                    this.pendingRequests.delete(response.requestId);
                    clearTimeout(pendingRequest.timeout);
                    
                    if (response.error) {
                        pendingRequest.reject(new Error(response.error));
                    } else {
                        pendingRequest.resolve(response.result);
                    }
                }
            }
        } catch (error) {
            console.error('Error parsing MCP response:', error);
            console.error('Raw response:', responseStr);
        }
    }

    waitForConnection() {
        this.connectionTimeout = setTimeout(() => {
            if (!this.isConnected) {
                console.error('MCP connection timeout');
                this.handleConnectionError(new Error('Connection timeout'));
            }
        }, 5000);
    }

    handleConnectionError(error) {
        this.isConnected = false;
        console.error('MCP connection error:', error);
        
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
        }
        
        // Reject all pending requests
        this.pendingRequests.forEach((request, requestId) => {
            clearTimeout(request.timeout);
            request.reject(new Error('MCP connection lost'));
        });
        this.pendingRequests.clear();
        
        // Attempt reconnection if under limit
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting MCP reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
            setTimeout(() => {
                this.startMcpProcess();
            }, 2000 * this.reconnectAttempts); // Exponential backoff
        } else {
            console.error('Max MCP reconnection attempts reached');
        }
    }

    handleDatabaseLockError() {
        console.warn('Database lock detected, retrying requests after delay');
        // Add delay before processing queue
        setTimeout(() => {
            this.processRequestQueue();
        }, 1000);
    }

    handleProcessExit(code) {
        this.isConnected = false;
        
        if (code !== 0 && this.reconnectAttempts < this.maxReconnectAttempts) {
            console.log('MCP process crashed, attempting restart');
            this.reconnectAttempts++;
            setTimeout(() => {
                this.startMcpProcess();
            }, 1000);
        }
    }

    processRequestQueue() {
        while (this.requestQueue.length > 0 && this.isConnected) {
            const queuedRequest = this.requestQueue.shift();
            this.sendRequest(queuedRequest.request, queuedRequest.resolve, queuedRequest.reject);
        }
    }

    async invokeMcpTool(action, params = {}, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const requestId = ++this.requestId;
            const request = { 
                action: 'invoke_tool', 
                name: action, 
                params,
                requestId 
            };

            console.log(`Invoking MCP tool: ${action} with params:`, params);

            if (!this.isConnected) {
                console.log('MCP not connected, queueing request');
                this.requestQueue.push({ request, resolve, reject });
                
                // Start connection if not already started
                if (!this.mcpProcess || this.mcpProcess.killed) {
                    this.startMcpProcess();
                }
                return;
            }

            this.sendRequest(request, resolve, reject, timeout);
        });
    }

    sendRequest(request, resolve, reject, timeout = 10000) {
        try {
            const mcp = this.getMcpProcess();
            
            if (!mcp || mcp.killed) {
                reject(new Error('MCP process not available'));
                return;
            }

            // Set up timeout for this specific request
            const timeoutHandle = setTimeout(() => {
                this.pendingRequests.delete(request.requestId);
                reject(new Error(`MCP request timeout for action: ${request.name}`));
            }, timeout);

            // Store the pending request
            this.pendingRequests.set(request.requestId, {
                resolve,
                reject,
                timeout: timeoutHandle,
                timestamp: Date.now()
            });

            // Send the request
            const requestStr = JSON.stringify(request) + '\n';
            mcp.stdin.write(requestStr);
            
        } catch (error) {
            console.error('Error sending MCP request:', error);
            reject(error);
        }
    }

    // Enhanced tool methods with better error handling
    async checkInventory(drinkName) {
        try {
            const result = await this.invokeMcpTool('check_inventory', { drink_name: drinkName });
            return result;
        } catch (error) {
            console.error('Error checking inventory:', error);
            return { error: `Failed to check inventory for ${drinkName}: ${error.message}` };
        }
    }

    async addToCart(clientId, drinkName, quantity = 1, servingName = 'bottle') {
        try {
            const result = await this.invokeMcpTool('cart_add', { 
                clientId, 
                drink_name: drinkName, 
                quantity, 
                serving_name: servingName 
            });
            return result;
        } catch (error) {
            console.error('Error adding to cart:', error);
            return { error: `Failed to add ${drinkName} to cart: ${error.message}` };
        }
    }

    async viewCart(clientId) {
        try {
            const result = await this.invokeMcpTool('cart_view', { clientId });
            return result;
        } catch (error) {
            console.error('Error viewing cart:', error);
            return { error: `Failed to view cart: ${error.message}`, cart: [] };
        }
    }

    async addInventory(drinkName, quantity) {
        try {
            const result = await this.invokeMcpTool('add_inventory', { 
                drink_name: drinkName, 
                quantity 
            });
            return result;
        } catch (error) {
            console.error('Error adding inventory:', error);
            return { error: `Failed to add inventory for ${drinkName}: ${error.message}` };
        }
    }

    async viewMenu() {
        try {
            const result = await this.invokeMcpTool('view_menu', {});
            return result;
        } catch (error) {
            console.error('Error viewing menu:', error);
            return { error: `Failed to view menu: ${error.message}` };
        }
    }

    // Cleanup method
    cleanup() {
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
        }
        
        this.pendingRequests.forEach((request) => {
            clearTimeout(request.timeout);
        });
        this.pendingRequests.clear();
        
        if (this.mcpProcess && !this.mcpProcess.killed) {
            this.mcpProcess.kill();
        }
        
        this.isConnected = false;
    }

    // Health check method
    async healthCheck() {
        try {
            const result = await this.invokeMcpTool('health_check', {}, 3000);
            return { healthy: true, result };
        } catch (error) {
            console.error('MCP health check failed:', error);
            return { healthy: false, error: error.message };
        }
    }
}

// Singleton instance
const mcpClient = new MCPClient();

// Legacy function for backward compatibility
async function invokeMcpTool(action, params) {
    return mcpClient.invokeMcpTool(action, params);
}

// Handle process cleanup
process.on('exit', () => {
    mcpClient.cleanup();
});

process.on('SIGINT', () => {
    mcpClient.cleanup();
    process.exit(0);
});

process.on('SIGTERM', () => {
    mcpClient.cleanup();
    process.exit(0);
});

module.exports = { 
    invokeMcpTool, 
    mcpClient,
    MCPClient 
};