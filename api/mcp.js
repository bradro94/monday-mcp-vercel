const { exec } = require('child_process');

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.json({ status: 'Monday MCP on Vercel', timestamp: new Date() });
  }

  if (req.method === 'POST') {
    const command = `echo '${JSON.stringify(req.body)}' | npx @mondaydotcomorg/monday-api-mcp -t "${process.env.MONDAY_TOKEN}"`;
    
    exec(command, { timeout: 25000 }, (error, stdout) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      
      try {
        const lines = stdout.trim().split('\n');
        res.json(JSON.parse(lines[lines.length - 1]));
      } catch (e) {
        res.json({ result: stdout });
      }
    });
  }
}
