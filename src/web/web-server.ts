import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { WebSocket, WebSocketServer } from 'ws';
import type { WebSocketMessage } from './types';
import type { ToolRegistry } from '../tools/tool-registry';

export interface WebServerConfig {
  host: string;
  port: number;
  staticDir: string;
}

/**
 * Tool info returned by /api/tools endpoint
 */
export interface ToolInfo {
  name: string;
  description: string;
}

export class WebServer {
  private config: WebServerConfig;
  private httpServer: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private toolRegistry: ToolRegistry | null = null;
  
  // 定期清理断开连接的定时器
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL = 30000; // 30秒清理一次

  constructor(config: WebServerConfig) {
    this.config = config;
  }

  /**
   * Set the tool registry for /api/tools endpoint
   */
  setToolRegistry(registry: ToolRegistry): void {
    this.toolRegistry = registry;
  }

  /**
   * Get all registered tools info
   */
  getToolsInfo(): ToolInfo[] {
    if (!this.toolRegistry) {
      return [];
    }
    
    return this.toolRegistry.getAllTools().map(tool => ({
      name: tool.name,
      description: tool.description,
    }));
  }

  /**
   * Start the HTTP and WebSocket servers
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Create HTTP server
      this.httpServer = http.createServer((req, res) => {
        this.handleHttpRequest(req, res);
      });

      // Create WebSocket server
      this.wss = new WebSocketServer({ server: this.httpServer });

      // Handle WebSocket server errors
      this.wss.on('error', (err: Error) => {
        console.error('[WebSocket Server] Error:', err);
      });

      // Handle WebSocket connections
      this.wss.on('connection', (ws: WebSocket) => {
        this.handleWebSocketConnection(ws);
      });

      // Start listening
      this.httpServer.on('error', (err) => {
        reject(err);
      });

      this.httpServer.listen(this.config.port, this.config.host, () => {
        // 启动定期清理任务
        this.startCleanupTask();
        resolve();
      });
    });
  }
  
  /**
   * 启动定期清理断开连接的任务
   */
  private startCleanupTask(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupDeadConnections();
    }, this.CLEANUP_INTERVAL);
  }
  
  /**
   * 清理已断开的 WebSocket 连接
   */
  private cleanupDeadConnections(): void {
    const deadClients: Set<WebSocket> = new Set();
    
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.CLOSED || client.readyState === WebSocket.CLOSING) {
        deadClients.add(client);
      }
    });
    
    if (deadClients.size > 0) {
      deadClients.forEach((client) => {
        this.clients.delete(client);
      });
      console.log(`[WebSocket] Periodic cleanup: removed ${deadClients.size} dead connection(s). Active clients: ${this.clients.size}`);
    }
  }

  /**
   * Stop the servers
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // 停止清理任务
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }
      
      // Close all WebSocket connections
      this.clients.forEach((client) => {
        client.close();
      });
      this.clients.clear();

      // Close WebSocket server
      if (this.wss) {
        this.wss.close();
        this.wss = null;
      }

      // Close HTTP server
      if (this.httpServer) {
        this.httpServer.close(() => {
          this.httpServer = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(message: WebSocketMessage): void {
    if (this.clients.size === 0) {
      return; // No clients to broadcast to
    }

    let messageStr: string;
    try {
      messageStr = JSON.stringify(message);
    } catch (err) {
      console.error('[WebSocket] Failed to serialize message:', err);
      return;
    }

    const deadClients: Set<WebSocket> = new Set();

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
        } catch (err) {
          console.error('[WebSocket] Failed to send message to client:', err);
          deadClients.add(client);
        }
      } else if (client.readyState === WebSocket.CLOSED || client.readyState === WebSocket.CLOSING) {
        // Mark for removal
        deadClients.add(client);
      }
    });

    // Clean up dead connections
    if (deadClients.size > 0) {
      deadClients.forEach((client) => {
        this.clients.delete(client);
      });
      console.log(`[WebSocket] Cleaned up ${deadClients.size} dead connection(s). Active clients: ${this.clients.size}`);
    }
  }

  /**
   * Get the number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Handle HTTP requests for static files and API endpoints
   */
  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = req.url || '/';
    
    // Handle API endpoints
    if (url.startsWith('/api/')) {
      this.handleApiRequest(req, res);
      return;
    }
    
    let filePath = url === '/' ? '/index.html' : url;
    
    // Remove query string if present
    const queryIndex = filePath.indexOf('?');
    if (queryIndex !== -1) {
      filePath = filePath.substring(0, queryIndex);
    }
    
    // Decode URL
    try {
      filePath = decodeURIComponent(filePath);
    } catch (e) {
      // Invalid URL encoding
      console.error('[HTTP] Invalid URL encoding:', filePath);
      this.send404(res);
      return;
    }
    
    // Security: prevent directory traversal
    filePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    
    // Additional security: ensure path doesn't escape static directory
    const fullPath = path.join(this.config.staticDir, filePath);
    const resolvedPath = path.resolve(fullPath);
    const resolvedStaticDir = path.resolve(this.config.staticDir);
    
    if (!resolvedPath.startsWith(resolvedStaticDir)) {
      console.error('[HTTP] Path traversal attempt detected:', filePath);
      this.send404(res);
      return;
    }

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.log('[HTTP] File not found:', filePath);
      this.send404(res);
      return;
    }

    // Check if it's a file (not a directory)
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (err) {
      console.error('[HTTP] Error reading file stats:', err);
      this.send500(res, 'Error reading file');
      return;
    }
    
    if (!stat.isFile()) {
      console.log('[HTTP] Not a file:', filePath);
      this.send404(res);
      return;
    }

    // Read and serve the file
    fs.readFile(fullPath, (err, data) => {
      if (err) {
        console.error('[HTTP] Error reading file:', err);
        this.send500(res, 'Error reading file');
        return;
      }

      const mimeType = this.getMimeType(fullPath);
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(data);
    });
  }

  /**
   * Handle API requests
   */
  private handleApiRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = req.url || '';
    
    // CORS headers for API endpoints
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    
    // GET /api/tools - Return registered tools list
    if (url === '/api/tools' && req.method === 'GET') {
      const tools = this.getToolsInfo();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, tools }));
      return;
    }
    
    // 404 for unknown API endpoints
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'API endpoint not found' }));
  }

  /**
   * Send 404 Not Found response
   */
  private send404(res: http.ServerResponse): void {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<html><body><h1>404 Not Found</h1><p>The requested resource was not found on this server.</p></body></html>');
  }

  /**
   * Send 500 Internal Server Error response
   */
  private send500(res: http.ServerResponse, message: string = 'Internal Server Error'): void {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<html><body><h1>500 Internal Server Error</h1><p>${message}</p></body></html>`);
  }

  /**
   * Get MIME type based on file extension
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Handle new WebSocket connection
   */
  private handleWebSocketConnection(ws: WebSocket): void {
    // Add client to set
    this.clients.add(ws);
    console.log(`[WebSocket] Client connected. Total clients: ${this.clients.size}`);

    // Emit connection event for initialization
    this.emit('connection', ws);

    // Handle client disconnection
    ws.on('close', (code: number, reason: Buffer) => {
      this.clients.delete(ws);
      const reasonStr = reason.toString() || 'No reason provided';
      console.log(`[WebSocket] Client disconnected (code: ${code}, reason: ${reasonStr}). Total clients: ${this.clients.size}`);
    });

    // Handle errors
    ws.on('error', (err: Error) => {
      console.error('[WebSocket] Client error:', err.message);
      // Remove client from set on error
      this.clients.delete(ws);
      
      // Try to close the connection gracefully
      try {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close(1011, 'Internal server error');
        }
      } catch (closeErr) {
        // Ignore errors during close
        console.error('[WebSocket] Error closing connection:', closeErr);
      }
    });

    // Handle ping/pong for connection health
    ws.on('ping', () => {
      ws.pong();
    });
  }

  /**
   * Register a callback for new WebSocket connections
   */
  onConnection(callback: (ws: WebSocket) => void): void {
    this.connectionCallbacks.push(callback);
  }

  /**
   * Emit connection event to all registered callbacks
   */
  private emit(event: 'connection', ws: WebSocket): void {
    if (event === 'connection') {
      this.connectionCallbacks.forEach(callback => {
        try {
          callback(ws);
        } catch (err) {
          console.error('[WebSocket] Connection callback error:', err);
        }
      });
    }
  }

  private connectionCallbacks: Array<(ws: WebSocket) => void> = [];
}
