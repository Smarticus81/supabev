const { spawn } = require('child_process');

let mcpProcess;

function getMcpProcess() {
    if (!mcpProcess) {
        mcpProcess = spawn('node', ['scripts/mcp-server.js'], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        mcpProcess.stderr.on('data', (data) => {
            console.error(`MCP Error: ${data}`);
        });
    }
    return mcpProcess;
}

async function invokeMcpTool(action, params) {
    const mcp = getMcpProcess();
    const request = { action: 'invoke_tool', name: action, params };

    return new Promise((resolve, reject) => {
        const onData = (data) => {
            try {
                const response = JSON.parse(data.toString());
                mcp.stdout.removeListener('data', onData);
                resolve(response.result);
            } catch (err) {
                // Ignore incomplete JSON
            }
        };
        mcp.stdout.on('data', onData);
        mcp.stdin.write(JSON.stringify(request) + '\n');
    });
}

module.exports = { invokeMcpTool }; 