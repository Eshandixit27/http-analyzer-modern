// sample-server.js - WITH HTTP/2 SUPPORT
const http2 = require('http2');
const fs = require('fs');
const path = require('path');

function start(port = 8080, mode = 'simple') {
  // Create HTTP/2 server with cleartext (h2c) - no TLS required for local testing
  const server = http2.createServer();

  server.on('stream', (stream, headers) => {
    const method = headers[':method'];
    const requestPath = headers[':path'];

    console.log(`[HTTP/2] ${method} ${requestPath}`);

    // Add artificial delay to simulate real server
    setTimeout(() => {
      if (mode === 'simple') {
        handleSimpleMode(stream, requestPath);
      } else {
        handleRestMode(stream, requestPath);
      }
    }, Math.random() * 50);
  });

  function handleSimpleMode(stream, requestPath) {
    if (requestPath === '/' || requestPath === '') {
      stream.respond({
        ':status': 200,
        'content-type': 'text/html'
      });
      stream.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Simple Test Server</title></head>
        <body>
          <h1>Simple HTTP/2 Test Server</h1>
          <p>Server Time: ${new Date().toISOString()}</p>
          <p>Protocol: HTTP/2</p>
        </body>
        </html>
      `);
    } else if (requestPath === '/api/data') {
      stream.respond({
        ':status': 200,
        'content-type': 'application/json'
      });
      stream.end(JSON.stringify({ 
        message: 'Hello from HTTP/2 server',
        timestamp: Date.now(),
        protocol: 'HTTP/2'
      }));
    } else {
      stream.respond({ ':status': 404, 'content-type': 'application/json' });
      stream.end(JSON.stringify({ error: 'Not found', path: requestPath }));
    }
  }

  function handleRestMode(stream, requestPath) {
    if (requestPath === '/StudentInformationSystem') {
      stream.respond({
        ':status': 200,
        'content-type': 'text/html'
      });
      stream.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Student Information System</title>
        </head>
        <body>
          <h1>Student Information System (HTTP/2)</h1>
          <p>Protocol: HTTP/2</p>
        </body>
        </html>
      `);
    } else if (requestPath === '/api/students') {
      stream.respond({
        ':status': 200,
        'content-type': 'application/json'
      });
      stream.end(JSON.stringify([
        { id: 1, name: 'Alice Johnson', grade: 'A', major: 'Computer Science' },
        { id: 2, name: 'Bob Smith', grade: 'B+', major: 'Information Technology' }
      ]));
    } else if (requestPath.startsWith('/lib/') || requestPath.startsWith('/js/')) {
      stream.respond({
        ':status': 200,
        'content-type': 'application/javascript'
      });
      stream.end('// JavaScript resource loaded via HTTP/2');
    } else if (requestPath.startsWith('/img/')) {
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      stream.respond({
        ':status': 200,
        'content-type': 'image/gif'
      });
      stream.end(pixel);
    } else {
      stream.respond({ ':status': 404, 'content-type': 'application/json' });
      stream.end(JSON.stringify({ error: 'Not found', path: requestPath }));
    }
  }

  server.listen(port, '127.0.0.1', () => {
    console.log(`✅ HTTP/2 Sample server (${mode} mode) running on http://127.0.0.1:${port}`);
    console.log(`   Protocol: HTTP/2 (cleartext/h2c)`);
  });

  return server;
}

module.exports = { start };
