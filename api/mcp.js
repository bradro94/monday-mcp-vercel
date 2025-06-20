import { spawn } from 'child_process';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.json({ 
      status: 'Monday MCP Server Running', 
      timestamp: new Date().toISOString(),
      token_configured: !!process.env.MONDAY_TOKEN,
      version: '2.0.0'
    });
  }

  if (req.method === 'POST') {
    const MONDAY_TOKEN = process.env.MONDAY_TOKEN;
    
    if (!MONDAY_TOKEN) {
      return res.status(500).json({
        jsonrpc: "2.0",
        id: req.body?.id || null,
        error: {
          code: -32001,
          message: "Monday.com token not configured"
        }
      });
    }

    // Prepare the MCP request
    const mcpRequest = {
      jsonrpc: "2.0",
      method: req.body.method || "tools/list",
      id: req.body.id || "default",
      params: req.body.params || {}
    };

    console.log('Received MCP request:', mcpRequest);

    return new Promise((resolve) => {
      // Use the pre-installed Monday MCP package
      const mcp = spawn('node', ['-e', `
        const { spawn } = require('child_process');
        const proc = spawn('npx', ['@mondaydotcomorg/monday-api-mcp', '-t', '${MONDAY_TOKEN}'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        process.stdin.pipe(proc.stdin);
        proc.stdout.pipe(process.stdout);
        proc.stderr.pipe(process.stderr);
        
        proc.on('close', (code) => process.exit(code));
      `], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 25000
      });

      // Send the MCP request
      mcp.stdin.write(JSON.stringify(mcpRequest) + '\n');
      mcp.stdin.end();

      let stdout = '';
      let stderr = '';

      mcp.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      mcp.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error('MCP stderr:', data.toString());
      });

      mcp.on('close', (code) => {
        console.log('MCP process closed with code:', code);
        console.log('MCP stdout:', stdout);

        if (code !== 0) {
          res.status(500).json({
            jsonrpc: "2.0",
            id: mcpRequest.id,
            error: {
              code: -32603,
              message: "MCP server error",
              data: { 
                exit_code: code, 
                stderr: stderr.slice(-500) // Last 500 chars of error
              }
            }
          });
          return resolve();
        }

        try {
          // Parse the MCP response
          const lines = stdout.trim().split('\n');
          let jsonResponse = null;
          
          // Try to find a valid JSON response from the output
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith('{') && line.endsWith('}')) {
              try {
                jsonResponse = JSON.parse(line);
                break;
              } catch (e) {
                continue;
              }
            }
          }

          if (jsonResponse) {
            res.json(jsonResponse);
          } else {
            // If no valid JSON found, return the raw output
            res.json({
              jsonrpc: "2.0",
              id: mcpRequest.id,
              result: {
                message: "Command executed but no JSON response found",
                raw_output: stdout.slice(-1000) // Last 1000 chars
              }
            });
          }
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
          res.json({
            jsonrpc: "2.0",
            id: mcpRequest.id,
            result: {
              message: "Response received but could not parse JSON",
              raw_output: stdout.slice(-1000),
              parse_error: parseError.message
            }
          });
        }
        resolve();
      });

      mcp.on('error', (error) => {
        console.error('MCP spawn error:', error);
        res.status(500).json({
          jsonrpc: "2.0",
          id: mcpRequest.id,
          error: {
            code: -32603,
            message: "Failed to start MCP server",
            data: error.message
          }
        });
        resolve();
      });
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
