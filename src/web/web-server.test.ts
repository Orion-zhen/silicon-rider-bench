import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebServer } from './web-server';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { WebSocket } from 'ws';

describe('WebServer', () => {
  let server: WebServer;
  const testPort = 13579; // Use a specific port for testing
  const testHost = 'localhost';
  const testStaticDir = path.join(__dirname, 'test-static');

  beforeEach(async () => {
    // Create test static directory and files
    if (!fs.existsSync(testStaticDir)) {
      fs.mkdirSync(testStaticDir, { recursive: true });
    }
    
    fs.writeFileSync(path.join(testStaticDir, 'index.html'), '<html><body>Test</body></html>');
    fs.writeFileSync(path.join(testStaticDir, 'style.css'), 'body { color: red; }');
    fs.writeFileSync(path.join(testStaticDir, 'script.js'), 'console.log("test");');
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
    
    // Clean up test files
    if (fs.existsSync(testStaticDir)) {
      const files = fs.readdirSync(testStaticDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(testStaticDir, file));
      });
      fs.rmdirSync(testStaticDir);
    }
  });

  describe('Server Lifecycle', () => {
    it('should start and stop the server', async () => {
      server = new WebServer({
        host: testHost,
        port: testPort,
        staticDir: testStaticDir,
      });

      await server.start();
      expect(server).toBeDefined();

      await server.stop();
    });

    it('should reject when port is already in use', async () => {
      server = new WebServer({
        host: testHost,
        port: testPort,
        staticDir: testStaticDir,
      });

      await server.start();

      // Try to start another server on the same port
      const server2 = new WebServer({
        host: testHost,
        port: testPort,
        staticDir: testStaticDir,
      });

      await expect(server2.start()).rejects.toThrow();
      
      // Clean up server2 to prevent port conflicts
      await server2.stop();
    });
  });

  describe('Static File Serving', () => {
    beforeEach(async () => {
      server = new WebServer({
        host: testHost,
        port: testPort,
        staticDir: testStaticDir,
      });
      await server.start();
    });

    it('should serve HTML files', async () => {
      const response = await makeHttpRequest(testPort, '/index.html');
      
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('text/html');
      expect(response.body).toContain('<html>');
    });

    it('should serve CSS files', async () => {
      const response = await makeHttpRequest(testPort, '/style.css');
      
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('text/css');
      expect(response.body).toContain('body');
    });

    it('should serve JavaScript files', async () => {
      const response = await makeHttpRequest(testPort, '/script.js');
      
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/javascript');
      expect(response.body).toContain('console.log');
    });

    it('should serve index.html for root path', async () => {
      const response = await makeHttpRequest(testPort, '/');
      
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('text/html');
      expect(response.body).toContain('<html>');
    });
  });

  describe('404 Error Handling', () => {
    beforeEach(async () => {
      server = new WebServer({
        host: testHost,
        port: testPort,
        staticDir: testStaticDir,
      });
      await server.start();
    });

    it('should return 404 for non-existent files', async () => {
      const response = await makeHttpRequest(testPort, '/nonexistent.html');
      
      expect(response.statusCode).toBe(404);
      expect(response.body).toContain('404');
    });

    it('should return 404 for directory requests', async () => {
      // Create a subdirectory
      const subDir = path.join(testStaticDir, 'subdir');
      fs.mkdirSync(subDir);

      const response = await makeHttpRequest(testPort, '/subdir');
      
      expect(response.statusCode).toBe(404);

      // Clean up
      fs.rmdirSync(subDir);
    });
  });

  describe('MIME Type Setting', () => {
    beforeEach(async () => {
      server = new WebServer({
        host: testHost,
        port: testPort,
        staticDir: testStaticDir,
      });
      await server.start();
    });

    it('should set correct MIME type for HTML', async () => {
      const response = await makeHttpRequest(testPort, '/index.html');
      expect(response.headers['content-type']).toBe('text/html');
    });

    it('should set correct MIME type for CSS', async () => {
      const response = await makeHttpRequest(testPort, '/style.css');
      expect(response.headers['content-type']).toBe('text/css');
    });

    it('should set correct MIME type for JavaScript', async () => {
      const response = await makeHttpRequest(testPort, '/script.js');
      expect(response.headers['content-type']).toBe('application/javascript');
    });
  });

  describe('WebSocket Connection Management', () => {
    beforeEach(async () => {
      server = new WebServer({
        host: testHost,
        port: testPort,
        staticDir: testStaticDir,
      });
      await server.start();
    });

    it('should track connected clients', async () => {
      expect(server.getClientCount()).toBe(0);

      const ws = new WebSocket(`ws://${testHost}:${testPort}`);
      
      await new Promise<void>((resolve) => {
        ws.on('open', () => {
          expect(server.getClientCount()).toBe(1);
          ws.close();
          resolve();
        });
      });

      // Wait for close to be processed
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(server.getClientCount()).toBe(0);
    });

    it('should broadcast messages to all clients', async () => {
      const ws1 = new WebSocket(`ws://${testHost}:${testPort}`);
      const ws2 = new WebSocket(`ws://${testHost}:${testPort}`);

      await Promise.all([
        new Promise<void>((resolve) => ws1.on('open', () => resolve())),
        new Promise<void>((resolve) => ws2.on('open', () => resolve())),
      ]);

      const testMessage = {
        type: 'test' as const,
        timestamp: Date.now(),
        data: { message: 'Hello' },
      };

      const received1 = new Promise<string>((resolve) => {
        ws1.on('message', (data) => resolve(data.toString()));
      });

      const received2 = new Promise<string>((resolve) => {
        ws2.on('message', (data) => resolve(data.toString()));
      });

      server.broadcast(testMessage);

      const [msg1, msg2] = await Promise.all([received1, received2]);
      
      expect(JSON.parse(msg1)).toEqual(testMessage);
      expect(JSON.parse(msg2)).toEqual(testMessage);

      ws1.close();
      ws2.close();
    });
  });
});

// Helper function to make HTTP requests
function makeHttpRequest(port: number, path: string): Promise<{
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}${path}`, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body,
        });
      });
    }).on('error', reject);
  });
}
