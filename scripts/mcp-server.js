#!/usr/bin/env node
// Minimal MCP-compatible server for Beverage POS
// Implements just enough of the spec for Claude / other agents to interact.
// Supported actions:
// 1. list_tools – returns an array of tool metadata
// 2. invoke_tool – executes a tool by name with params

const readline = require('readline');
const { tools, invoke } = require('../lib/tools');

// Setup stdio interface
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', async (line) => {
  if (!line.trim()) return;
  try {
    const req = JSON.parse(line);
    if (req.action === 'list_tools') {
      process.stdout.write(JSON.stringify({ tools }) + '\n');
    } else if (req.action === 'invoke_tool') {
      const { name, params = {} } = req;
      const result = await invoke(name, params);
      process.stdout.write(JSON.stringify({ result }) + '\n');
    } else {
      process.stdout.write(JSON.stringify({ error: 'unknown_action' }) + '\n');
    }
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
  }
}); 