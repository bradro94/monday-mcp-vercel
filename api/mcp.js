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
      status: 'Monday MCP on Vercel', 
      timestamp: new Date().toISOString(),
      token_configured: !!process.env.MONDAY_TOKEN
    });
  }

  if (req.method === 'POST') {
    // For now, let's return a mock response to test the connection
    // We'll integrate the real MCP later
    return res.json({
      jsonrpc: "2.0",
      id: req.body?.id || "test",
      result: {
        tools: [
          {
            name: "create_board",
            description: "Create a new Monday.com board",
            inputSchema: {
              type: "object",
              properties: {
                board_name: { type: "string" },
                workspace_id: { type: "string" }
              }
            }
          },
          {
            name: "create_item", 
            description: "Create a new item in a board",
            inputSchema: {
              type: "object", 
              properties: {
                board_id: { type: "string" },
                item_name: { type: "string" }
              }
            }
          },
          {
            name: "get_boards",
            description: "Get all boards",
            inputSchema: { type: "object" }
          }
        ]
      }
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
