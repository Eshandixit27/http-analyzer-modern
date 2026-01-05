// analyzer.js
const net = require('net');
const { performance } = require('perf_hooks');
const http2 = require('http2');
const url = require('url');

// Raw TCP request (unchanged)
function sendRawRequest(host, port, rawRequest, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let responseBuffer = Buffer.alloc(0);
    let startTime;
    let timedOut = false;

    const cleanup = () => {
      if (!client.destroyed) {
        client.destroy();
      }
    };

    const timeoutId = setTimeout(() => {
      timedOut = true;
      cleanup();
      reject(new Error(`Request timeout after ${timeout}ms`));
    }, timeout);

    client.connect(port, host, () => {
      startTime = performance.now();
      try {
        client.write(rawRequest);
      } catch (err) {
        clearTimeout(timeoutId);
        cleanup();
        reject(new Error(`Write failed: ${err.message}`));
      }
    });

    client.on('data', (data) => {
      responseBuffer = Buffer.concat([responseBuffer, data]);
    });

    client.on('end', () => {
      if (!timedOut) {
        clearTimeout(timeoutId);
        const rtt = performance.now() - startTime;
        resolve({ 
          rawResponse: responseBuffer.toString('utf8'), 
          rttMs: rtt,
          bytesReceived: responseBuffer.length
        });
        cleanup();
      }
    });

    client.on('error', (err) => {
      clearTimeout(timeoutId);
      cleanup();
      reject(new Error(`Connection error: ${err.message}`));
    });
  });
}

// HTTP/2 request - FIXED VERSION
async function sendHttp2Request(opts) {
  return new Promise((resolve, reject) => {
    let client;
    const timeout = opts.timeout || 15000;
    
    try {
      const parsed = url.parse(opts.url);
      
      // HTTP/2 requires https or explicit h2c (cleartext)
      // Most servers don't support h2c, so we'll try but handle fallback
      const protocol = parsed.protocol || 'http:';
      
      const clientOptions = {
        rejectUnauthorized: false,
        timeout: timeout
      };

      client = http2.connect(`${protocol}//${parsed.host}`, clientOptions);

      const timeoutId = setTimeout(() => {
        if (client) client.destroy();
        reject(new Error('HTTP/2 request timeout'));
      }, timeout);

      client.on('error', (err) => {
        clearTimeout(timeoutId);
        // Provide helpful error message
        if (err.code === 'ERR_HTTP2_ERROR' || err.message.includes('PROTOCOL_ERROR')) {
          reject(new Error(`HTTP/2 not supported by server. Try using Raw HTTP/1.1 instead. Details: ${err.message}`));
        } else {
          reject(new Error(`HTTP/2 connection error: ${err.message}`));
        }
      });

      const start = performance.now();
      const headers = {
        ':path': opts.path || parsed.path || '/',
        ':method': opts.method || 'GET',
        ...opts.headers
      };

      const req = client.request(headers);
      let data = [];
      let responseHeaders = {};

      req.setEncoding('utf8');

      req.on('response', (headers) => {
        responseHeaders = headers;
      });

      req.on('data', chunk => data.push(chunk));

      req.on('end', () => {
        clearTimeout(timeoutId);
        const rtt = performance.now() - start;
        const body = data.join('');
        client.close();
        
        resolve({ 
          rttMs: rtt,
          response: { 
            headers: responseHeaders,
            body: body,  // Return raw body (could be HTML, JSON, etc)
            size: Buffer.byteLength(body),
            contentType: responseHeaders['content-type'] || 'unknown'
          }
        });
      });

      req.on('error', (err) => {
        clearTimeout(timeoutId);
        if (client) client.close();
        reject(new Error(`HTTP/2 request error: ${err.message}`));
      });

      if (opts.body) req.write(opts.body);
      req.end();

    } catch (e) {
      if (client) client.close();
      reject(new Error(`HTTP/2 setup error: ${e.message}`));
    }
  });
}

module.exports = { sendRawRequest, sendHttp2Request };
