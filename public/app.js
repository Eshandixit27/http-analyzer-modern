// public/app.js

// ======================
// UTILITY FUNCTIONS
// ======================

async function postJson(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return response.json();
}

async function getJson(path) {
  const response = await fetch(path);
  return response.json();
}

async function deleteRequest(path) {
  const response = await fetch(path, { method: 'DELETE' });
  return response.json();
}

function showNotification(message, type = 'info') {
  const container = document.getElementById('notification-container');
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  container.appendChild(notification);
  
  setTimeout(() => notification.classList.add('show'), 10);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function formatTimestamp(iso) {
  const date = new Date(iso);
  return date.toLocaleTimeString();
}

function setLoading(buttonId, loading) {
  const btn = document.getElementById(buttonId);
  const text = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.spinner');
  
  if (loading) {
    btn.disabled = true;
    if (text) text.style.display = 'none';
    if (spinner) spinner.style.display = 'inline-block';
  } else {
    btn.disabled = false;
    if (text) text.style.display = 'inline';
    if (spinner) spinner.style.display = 'none';
  }
}

// ======================
// TAB MANAGEMENT
// ======================

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetTab = btn.dataset.tab;
    
    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Update active tab pane
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    document.getElementById(`${targetTab}-tab`).classList.add('active');
    
    // Load history when history tab is opened
    if (targetTab === 'history') {
      loadHistory();
    }
  });
});

// ======================
// SAMPLE SERVER CONTROL
// ======================

let serverRunning = false;

document.getElementById('start-server-btn').addEventListener('click', async () => {
  const mode = document.getElementById('server-mode').value;
  const port = parseInt(document.getElementById('server-port').value);
  
  try {
    const result = await postJson('/api/sample-server/start', { port, mode });
    showNotification(`✅ Server started on port ${port} (${mode} mode)`, 'success');
    serverRunning = true;
    updateServerUI(true, mode, port);
  } catch (error) {
    showNotification(`❌ Failed to start server: ${error.message}`, 'error');
  }
});

document.getElementById('stop-server-btn').addEventListener('click', async () => {
  try {
    await postJson('/api/sample-server/stop', {});
    showNotification('⏹️ Server stopped', 'info');
    serverRunning = false;
    updateServerUI(false);
  } catch (error) {
    showNotification(`❌ Failed to stop server: ${error.message}`, 'error');
  }
});

function updateServerUI(running, mode = '', port = '') {
  const startBtn = document.getElementById('start-server-btn');
  const stopBtn = document.getElementById('stop-server-btn');
  const serverInfo = document.getElementById('server-info');
  
  if (running) {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    serverInfo.style.display = 'block';
    document.getElementById('running-mode').textContent = mode;
    document.getElementById('running-port').textContent = port;
    document.getElementById('running-url').textContent = `http://127.0.0.1:${port}`;
  } else {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    serverInfo.style.display = 'none';
  }
}

// ======================
// RAW REQUEST
// ======================

document.getElementById('send-raw-btn').addEventListener('click', async () => {
  const host = document.getElementById('raw-host').value;
  const port = parseInt(document.getElementById('raw-port').value);
  let rawRequest = document.getElementById('raw-request').value;
  
  // Convert literal \r\n to actual carriage return + line feed
  rawRequest = rawRequest.replace(/\\r\\n/g, '\r\n');
  
  setLoading('send-raw-btn', true);
  
  try {
    const result = await postJson('/api/send-raw', { host, port, rawRequest });
    displayResult(result, 'RAW HTTP');
    showNotification(`✅ Request completed in ${result.rttMs.toFixed(2)}ms`, 'success');
  } catch (error) {
    showNotification(`❌ Request failed: ${error.message}`, 'error');
  } finally {
    setLoading('send-raw-btn', false);
  }
});

// ======================
// HTTP/2 REQUEST
// ======================

document.getElementById('send-h2-btn').addEventListener('click', async () => {
  const url = document.getElementById('h2-url').value;
  const path = document.getElementById('h2-path').value;
  const method = document.getElementById('h2-method').value;
  const body = document.getElementById('h2-body').value;
  
  setLoading('send-h2-btn', true);
  
  try {
    const result = await postJson('/api/http2', { url, path, method, body, headers: {} });
    displayResult(result, 'HTTP/2');
    showNotification(`✅ HTTP/2 request completed in ${result.rttMs.toFixed(2)}ms`, 'success');
  } catch (error) {
    showNotification(`❌ HTTP/2 request failed: ${error.message}`, 'error');
  } finally {
    setLoading('send-h2-btn', false);
  }
});

// ======================
// RESULT DISPLAY
// ======================

function displayResult(result, type) {
  const section = document.getElementById('result-section');
  const output = document.getElementById('result-output');
  const rttSpan = document.getElementById('result-rtt');
  const sizeSpan = document.getElementById('result-size');
  
  section.style.display = 'block';
  rttSpan.textContent = `RTT: ${result.rttMs.toFixed(2)} ms`;
  
  if (type === 'RAW HTTP') {
    output.textContent = result.rawResponse || 'No response';
    sizeSpan.textContent = `Size: ${result.bytesReceived || 0} bytes`;
  } else {
    output.textContent = JSON.stringify(result.response, null, 2);
    sizeSpan.textContent = `Size: ${result.response?.size || 0} bytes`;
  }
  
  // Scroll to result
  section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ======================
// HISTORY MANAGEMENT
// ======================

async function loadHistory() {
  try {
    const history = await getJson('/api/history');
    renderHistory(history);
    updateChart(history);
  } catch (error) {
    showNotification('Failed to load history', 'error');
  }
}

function renderHistory(history) {
  const tbody = document.getElementById('history-tbody');
  
  if (!history || history.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="no-data">No requests yet.</td></tr>';
    return;
  }
  
  tbody.innerHTML = history.reverse().map(item => `
    <tr class="${item.success ? '' : 'error-row'}">
      <td>${formatTimestamp(item.timestamp)}</td>
      <td><span class="badge badge-${item.type === 'HTTP/2' ? 'success' : 'primary'}">${item.type}</span></td>
      <td>${item.host ? `${item.host}:${item.port}` : item.url || 'N/A'}</td>
      <td>${item.success ? item.rttMs.toFixed(2) : '--'}</td>
      <td>${item.success ? '✅ Success' : '❌ ' + (item.error || 'Failed')}</td>
    </tr>
  `).join('');
}

document.getElementById('refresh-history-btn').addEventListener('click', loadHistory);

document.getElementById('clear-history-btn').addEventListener('click', async () => {
  if (confirm('Clear all request history?')) {
    try {
      await deleteRequest('/api/history');
      showNotification('History cleared', 'info');
      loadHistory();
    } catch (error) {
      showNotification('Failed to clear history', 'error');
    }
  }
});

document.getElementById('export-csv-btn').addEventListener('click', async () => {
  try {
    const history = await getJson('/api/history');
    const csv = convertToCSV(history);
    downloadCSV(csv, `http-analyzer-history-${Date.now()}.csv`);
    showNotification('CSV downloaded', 'success');
  } catch (error) {
    showNotification('Failed to export CSV', 'error');
  }
});

function convertToCSV(data) {
  const headers = ['Timestamp', 'Type', 'Target', 'RTT (ms)', 'Success', 'Error'];
  const rows = data.map(item => [
    item.timestamp,
    item.type,
    item.host ? `${item.host}:${item.port}` : item.url || 'N/A',
    item.rttMs || '',
    item.success,
    item.error || ''
  ]);
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

// ======================
// CHART VISUALIZATION
// ======================

let rttChart = null;

function updateChart(history) {
  const ctx = document.getElementById('rtt-chart');
  if (!ctx) return;
  
  const successfulRequests = history.filter(h => h.success && h.rttMs);
  
  if (successfulRequests.length === 0) return;
  
  const labels = successfulRequests.map((_, i) => `Request ${i + 1}`);
  const rawData = successfulRequests.filter(h => h.type === 'RAW').map(h => h.rttMs);
  const h2Data = successfulRequests.filter(h => h.type === 'HTTP/2').map(h => h.rttMs);
  
  if (rttChart) rttChart.destroy();
  
  rttChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.slice(-20), // Last 20 requests
      datasets: [
        {
          label: 'RAW HTTP',
          data: rawData.slice(-20),
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          tension: 0.4
        },
        {
          label: 'HTTP/2',
          data: h2Data.slice(-20),
          borderColor: '#48bb78',
          backgroundColor: 'rgba(72, 187, 120, 0.1)',
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true },
        title: { display: true, text: 'RTT Comparison (Last 20 Requests)' }
      },
      scales: {
        y: { 
          beginAtZero: true,
          title: { display: true, text: 'RTT (ms)' }
        }
      }
    }
  });
}

// ======================
// INIT
// ======================

window.addEventListener('DOMContentLoaded', () => {
  showNotification('🚀 HTTP Analyzer ready!', 'info');
});
