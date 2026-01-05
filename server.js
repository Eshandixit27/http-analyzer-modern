// server.js
const express = require('express');
const bodyParser = require('body-parser');
const analyzer = require('./analyzer');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Request history storage
let requestHistory = [];

// Send raw HTTP request (HTTP/1.0 or 1.1)
app.post('/api/send-raw', async (req, res) => {
  try {
    const { host, port, rawRequest } = req.body;
    if (!host || !rawRequest) {
      return res.status(400).json({ error: 'Host and rawRequest are required' });
    }
    const result = await analyzer.sendRawRequest(host, port || 80, rawRequest);
    
    // Add to history
    requestHistory.push({
      id: Date.now(),
      type: 'RAW',
      host,
      port: port || 80,
      timestamp: new Date().toISOString(),
      rttMs: result.rttMs,
      success: true
    });
    
    res.json(result);
  } catch (err) {
    requestHistory.push({
      id: Date.now(),
      type: 'RAW',
      timestamp: new Date().toISOString(),
      error: err.message,
      success: false
    });
    res.status(500).json({ error: err.message });
  }
});

// Send HTTP/2 request
app.post('/api/http2', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    const result = await analyzer.sendHttp2Request(req.body);
    
    requestHistory.push({
      id: Date.now(),
      type: 'HTTP/2',
      url,
      timestamp: new Date().toISOString(),
      rttMs: result.rttMs,
      success: true
    });
    
    res.json(result);
  } catch (err) {
    requestHistory.push({
      id: Date.now(),
      type: 'HTTP/2',
      timestamp: new Date().toISOString(),
      error: err.message,
      success: false
    });
    res.status(500).json({ error: err.message });
  }
});

// Get request history
app.get('/api/history', (req, res) => {
  res.json(requestHistory.slice(-50)); // Last 50 requests
});

// Clear history
app.delete('/api/history', (req, res) => {
  requestHistory = [];
  res.json({ message: 'History cleared' });
});

// Start/stop sample server
let sampleServer = null;
app.post('/api/sample-server/start', (req, res) => {
  const { port = 8080, mode = 'rest' } = req.body;
  if (sampleServer) {
    return res.status(400).json({ error: 'Sample server already running' });
  }
  try {
    sampleServer = require('./sample-server').start(port, mode);
    res.json({ status: 'started', port, mode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sample-server/stop', (req, res) => {
  if (!sampleServer) {
    return res.status(400).json({ error: 'Sample server not running' });
  }
  sampleServer.close(() => {
    sampleServer = null;
    res.json({ status: 'stopped' });
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    uptime: process.uptime(),
    sampleServerRunning: !!sampleServer 
  });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 HTTP Analyzer listening on http://localhost:${PORT}`);
  console.log(`📊 Access the UI at http://localhost:${PORT}`);
});
