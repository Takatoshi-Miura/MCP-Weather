#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  InitializedNotificationSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const fetch = require('node-fetch');

const REMOTE_SERVER_URL = process.env.MCP_WEATHER_URL || 'https://mcp-weather.get-weather.workers.dev';
const ACCESS_TOKEN = process.env.MCP_WEATHER_TOKEN || 'token_f8b1b2ef-724b-48e1-bbc5-b24b2dd1c60b';

class WeatherMCPClient {
  constructor() {
    this.server = new Server(
      {
        name: 'mcp-weather-remote',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {
            listChanged: true,
          },
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  async makeRemoteRequest(method, params = {}) {
    console.error(`[DEBUG] Making remote request: ${method}`, JSON.stringify(params));
    try {
      const response = await fetch(REMOTE_SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params,
        }),
      });

      if (!response.ok) {
        console.error(`[DEBUG] HTTP Error: ${response.status} ${response.statusText}`);
        throw new McpError(ErrorCode.InternalError, `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.error(`[DEBUG] Remote response:`, JSON.stringify(data, null, 2));
      
      if (data.error) {
        console.error(`[DEBUG] Remote error:`, data.error);
        throw new McpError(ErrorCode.InternalError, data.error);
      }

      return data.result;
    } catch (error) {
      console.error(`[DEBUG] Request failed:`, error);
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(ErrorCode.InternalError, `Remote request failed: ${error.message}`);
    }
  }

  setupToolHandlers() {
    console.error('[DEBUG] Setting up tool handlers');
    
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      console.error('[DEBUG] tools/list request received');
      const result = await this.makeRemoteRequest('tools/list');
      console.error('[DEBUG] tools/list result:', JSON.stringify(result, null, 2));
      return result;
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      console.error('[DEBUG] tools/call request received:', JSON.stringify(request.params));
      const { name, arguments: args } = request.params;
      
      const result = await this.makeRemoteRequest('tools/call', {
        name,
        arguments: args,
      });
      
      console.error('[DEBUG] tools/call result:', JSON.stringify(result, null, 2));
      return result;
    });
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      console.error('[DEBUG] Received SIGINT, shutting down');
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    console.error('[DEBUG] Starting MCP Weather Remote Server');
    const transport = new StdioServerTransport();
    
    // Handle the initialized notification
    this.server.setNotificationHandler(InitializedNotificationSchema, async () => {
      console.error('[DEBUG] Initialized notification received');
    });

    await this.server.connect(transport);
    console.error('[DEBUG] MCP Weather Remote Server running on stdio');
  }
}

const client = new WeatherMCPClient();
client.run().catch(console.error); 