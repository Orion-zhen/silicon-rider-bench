import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebServer } from './web-server';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as fc from 'fast-check';

/**
 * Feature: web-visualization, Property 15: 404 error for missing resources
 * Validates: Requirements 6.4
 */
describe('WebServer Property Tests', () => {
  let server: WebServer;
  const testPort = 13580; // Different port from unit tests
  const testHost = 'localhost';
  const testStaticDir = path.join(__dirname, 'test-static-pbt');

  beforeEach(async () => {
    // Create test static directory
    if (!fs.existsSync(testStaticDir)) {
      fs.mkdirSync(testStaticDir, { recursive: true });
    }
    
    // Create a test file
    fs.writeFileSync(path.join(testStaticDir, 'exists.html'), '<html>Exists</html>');

    server = new WebServer({
      host: testHost,
      port: testPort,
      staticDir: testStaticDir,
    });

    await server.start();
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

  /**
   * Feature: web-visualization, Property 15: 404 error for missing resources
   * Validates: Requirements 6.4
   */
  it('should return 404 for any non-existent file path', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => {
          // Filter out paths that might exist or be problematic
          return !s.includes('exists.html') && 
                 !s.includes('\0') && 
                 s.trim().length > 0;
        }),
        async (randomPath) => {
          const fullPath = path.join(testStaticDir, randomPath);
          
          // Only test if the file doesn't exist
          if (fs.existsSync(fullPath)) {
            return true; // Skip this case
          }

          const response = await makeHttpRequest(testPort, `/${randomPath}`);
          expect(response.statusCode).toBe(404);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: web-visualization, Property 16: MIME type correctness
   * Validates: Requirements 6.5
   */
  it('should return correct MIME type for any file extension', async () => {
    const mimeTypeMap: Record<string, string> = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
    };

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...Object.keys(mimeTypeMap)),
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => {
          // Filter out problematic characters for filenames
          const invalidChars = ['/', '\\', '\0', '"', '<', '>', '|', '?', '*', ':'];
          return !invalidChars.some(char => s.includes(char)) && s.trim().length > 0;
        }),
        async (extension, filename) => {
          const testFile = `${filename}${extension}`;
          const testFilePath = path.join(testStaticDir, testFile);
          
          // Create the test file
          fs.writeFileSync(testFilePath, 'test content');

          try {
            const response = await makeHttpRequest(testPort, `/${encodeURIComponent(testFile)}`);
            
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toBe(mimeTypeMap[extension]);
          } finally {
            // Clean up
            if (fs.existsSync(testFilePath)) {
              fs.unlinkSync(testFilePath);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
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
