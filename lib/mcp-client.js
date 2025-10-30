// ============================================
// MCP CLIENT WRAPPER
// ============================================
// This code is from the research documentation (Section 2)
// It spawns Notion MCP server as child process and manages lifecycle

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

class MCPClient {
  constructor(config) {
    this.config = config;
    this.client = null;
    this.transport = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      // WHY THIS WORKS (Research Section 2):
      // "StdioClientTransport spawns child process automatically"
      // "You just provide command and args"
      // Command: 'npx' - Node package executor
      // Args: ['-y', '@notionhq/notion-mcp-server'] - Auto-approve npx prompt
      this.transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args,
        env: {
          // CRITICAL (Research Section 2): "Always include ...process.env"
          // WHY: Child process needs all env vars (PATH, HOME, etc.)
          ...process.env,
          ...this.config.env
        }
      });

      // WHY THIS WORKS (Research Section 2):
      // "Create MCP client with name and version"
      // Client negotiates capabilities with server via JSON-RPC
      this.client = new Client(
        {
          name: 'notion-mcp-client',
          version: '1.0.0'
        },
        {
          capabilities: {
            tools: {},      // We'll call tools
            resources: {},  // We can read resources
            prompts: {}     // We can use prompts
          }
        }
      );

      // WHY THIS WORKS (Research Section 2):
      // "Connect with timeout" - Prevents hanging forever
      // 30 second timeout for Render (first run may need to cache npm package)
      const connectPromise = this.client.connect(this.transport);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 30000)
      );

      await Promise.race([connectPromise, timeoutPromise]);
      this.isConnected = true;

      console.log('✅ MCP client connected to Notion server');
      
      // WHY THIS WORKS (Research Section 3):
      // "List available tools for debugging"
      // Confirms server is responding and shows what tools we can call
      const tools = await this.client.listTools();
      console.log(`Available tools: ${tools.tools.map(t => t.name).join(', ')}`);
      
    } catch (error) {
      console.error('❌ MCP client connection failed:', error);
      await this.cleanup();
      throw error;
    }
  }

  async callTool(toolName, args, timeout = 30000) {
    if (!this.isConnected || !this.client) {
      throw new Error('MCP client not connected');
    }

    try {
      // WHY THIS WORKS (Research Section 3):
      // "All tools return JSON responses in MCP's standard format"
      // Format: { name: string, arguments: object }
      const toolPromise = this.client.callTool({
        name: toolName,
        arguments: args || {}
      });
      
      // Add timeout wrapper (default 30s for complex API calls)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Tool call timeout after ${timeout}ms`)), timeout)
      );
      
      const result = await Promise.race([toolPromise, timeoutPromise]);

      // WHY THIS WORKS (Research Section 3):
      // "Check if result is error"
      // MCP protocol has isError flag for failed tool calls
      if (result.isError) {
        throw new Error(`Tool error: ${JSON.stringify(result.content)}`);
      }

      // WHY THIS WORKS (Research Section 3):
      // "Parse JSON response from content"
      // MCP wraps responses in content array with text field
      const contentText = result.content[0]?.text;
      return contentText ? JSON.parse(contentText) : result.content;
      
    } catch (error) {
      console.error(`Tool call failed for ${toolName}:`, error);
      throw error;
    }
  }

  async listTools() {
    if (!this.isConnected || !this.client) {
      throw new Error('MCP client not connected');
    }

    const result = await this.client.listTools();
    return result.tools;
  }

  async listResources() {
    if (!this.isConnected || !this.client) {
      throw new Error('MCP client not connected');
    }

    const result = await this.client.listResources();
    return result.resources;
  }

  isRunning() {
    return this.isConnected && this.client !== null;
  }

  getProcessPid() {
    // WHY THIS WORKS (Research Section 2):
    // "Transport holds reference to spawned child process"
    // Useful for health checks and monitoring
    return this.transport?.process?.pid || null;
  }

  getRestartCount() {
    return this.processManager?.restartCount || 0;
  }

  async cleanup() {
    console.log('Cleaning up MCP client...');
    
    // WHY THIS WORKS (Research Section 7):
    // "Graceful shutdown - close client before transport"
    // Order matters: client -> transport -> process
    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        console.error('Error closing client:', error);
      }
    }

    if (this.transport) {
      try {
        await this.transport.close();
      } catch (error) {
        console.error('Error closing transport:', error);
      }
    }

    this.client = null;
    this.transport = null;
    this.isConnected = false;
    
    console.log('✅ MCP client cleanup complete');
  }
}

module.exports = MCPClient;


