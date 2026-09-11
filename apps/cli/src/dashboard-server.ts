import http from 'node:http';
import { HistoryManager, BaselineManager, escapeHtml } from '@ai-eval/core';
import pc from 'picocolors';

export function startDashboardServer(port = 3000, cwd: string = process.cwd(), host = '127.0.0.1'): http.Server {
  const history = new HistoryManager(cwd);
  const baselineManager = new BaselineManager(cwd);

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);

    // API: List runs
    if (url.pathname === '/api/runs' || url.pathname === '/api/history') {
      const runs = history.listRuns();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(runs));
      return;
    }

    // API: Get specific run
    if (url.pathname.startsWith('/api/runs/')) {
      const id = url.pathname.replace('/api/runs/', '');
      const run = history.getRun(id);
      if (!run) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Run not found' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(run));
      return;
    }

    // API: Baseline
    if (url.pathname === '/api/baseline') {
      const baseline = baselineManager.getBaseline();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(baseline ?? null));
      return;
    }

    // Serve Dashboard SPA HTML
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const runs = history.listRuns();
      const latestRun = runs.length > 0 && runs[0]?.id ? history.getRun(runs[0].id) : null;
      const baseline = baselineManager.getBaseline();

      const html = generateDashboardHtml(runs, latestRun, baseline);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  server.listen(port, host, () => {
    console.log(pc.green(`✓ AI Eval Kit Dashboard running at http://${host}:${port}`));
    if (host === '0.0.0.0') {
      console.log(pc.yellow('⚠ Warning: Dashboard is bound to all network interfaces (0.0.0.0).'));
    }
    console.log(pc.dim('Press Ctrl+C to stop.'));
  });

  return server;
}

function generateDashboardHtml(runs: any[], latestRun: any, baseline: any): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Eval Kit - Local Dashboard</title>
  <style>
    :root {
      --bg: #090d16;
      --card: #131b2e;
      --border: #1e293b;
      --text: #94a3b8;
      --heading: #f8fafc;
      --primary: #3b82f6;
      --green: #10b981;
      --red: #ef4444;
      --yellow: #f59e0b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 32px;
    }
    .container { max-width: 1280px; margin: 0 auto; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }
    h1 { color: var(--heading); font-size: 26px; display: flex; align-items: center; gap: 10px; }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-pass { background: rgba(16, 185, 129, 0.15); color: var(--green); border: 1px solid var(--green); }
    .badge-fail { background: rgba(239, 68, 68, 0.15); color: var(--red); border: 1px solid var(--red); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 28px; }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 20px;
    }
    .card-label { font-size: 13px; color: #64748b; font-weight: 500; text-transform: uppercase; }
    .card-val { font-size: 32px; font-weight: 700; color: var(--heading); margin: 6px 0; }
    .card-sub { font-size: 13px; color: #64748b; }
    
    .layout-split { display: grid; grid-template-columns: 320px 1fr; gap: 24px; }
    @media (max-width: 900px) { .layout-split { grid-template-columns: 1fr; } }
    
    .history-list {
      max-height: 580px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .history-item {
      background: rgba(255,255,255,0.02);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 14px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .history-item:hover, .history-item.active {
      background: rgba(59, 130, 246, 0.1);
      border-color: var(--primary);
    }
    .history-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .history-name { font-weight: 600; color: var(--heading); font-size: 14px; }
    .history-score { font-weight: 700; font-size: 14px; }

    .eval-row { display: flex; align-items: center; margin-bottom: 12px; font-size: 14px; }
    .eval-label { width: 220px; color: var(--heading); font-weight: 500; }
    .eval-bar { flex: 1; height: 8px; background: #0f172a; border-radius: 4px; overflow: hidden; margin: 0 16px; }
    .eval-fill { height: 100%; border-radius: 4px; }
    .eval-score { width: 60px; text-align: right; font-weight: 600; }

    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; }
    th { background: #0f172a; padding: 12px 16px; border-bottom: 1px solid var(--border); color: #64748b; font-weight: 600; }
    td { padding: 12px 16px; border-bottom: 1px solid var(--border); vertical-align: top; }
    tr:hover td { background: rgba(255,255,255,0.02); }
    .search-box {
      background: #090d16;
      border: 1px solid var(--border);
      color: var(--heading);
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 14px;
      width: 100%;
      margin-bottom: 16px;
      outline: none;
    }
    .search-box:focus { border-color: var(--primary); }
    .case-details {
      background: #090d16;
      padding: 12px;
      border-radius: 6px;
      margin-top: 8px;
      font-size: 13px;
      display: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>⚡ AI Eval Kit Dashboard</h1>
        <div style="font-size: 13px; color: #64748b; margin-top: 4px;">
          Local Evaluation Runs, Benchmarks & Regression Monitor
        </div>
      </div>
      <div>
        ${latestRun ? `<span class="badge ${latestRun.passedCases === latestRun.totalCases ? 'badge-pass' : 'badge-fail'}">Latest: ${latestRun.passedCases === latestRun.totalCases ? 'Passed' : 'Failures Detected'}</span>` : ''}
      </div>
    </header>

    ${latestRun ? `
    <div class="grid">
      <div class="card">
        <div class="card-label">Latest Overall Score</div>
        <div class="card-val" style="color: ${latestRun.overallScore >= 0.8 ? 'var(--green)' : 'var(--red)'};">
          ${(latestRun.overallScore * 100).toFixed(1)}%
        </div>
        <div class="card-sub">${latestRun.passedCases}/${latestRun.totalCases} cases passed</div>
      </div>
      <div class="card">
        <div class="card-label">Latency (Avg / P95)</div>
        <div class="card-val">${latestRun.latencyStats.avgMs}ms</div>
        <div class="card-sub">p95: ${latestRun.latencyStats.p95Ms}ms</div>
      </div>
      <div class="card">
        <div class="card-label">Cost & Tokens</div>
        <div class="card-val">$${latestRun.totalCost.toFixed(4)}</div>
        <div class="card-sub">${latestRun.totalTokens.totalTokens.toLocaleString()} tokens</div>
      </div>
      <div class="card">
        <div class="card-label">Baseline Status</div>
        <div class="card-val" style="font-size: 22px; color: ${baseline ? 'var(--green)' : '#64748b'};">
          ${baseline ? `${(baseline.overallScore * 100).toFixed(1)}%` : 'No baseline'}
        </div>
        <div class="card-sub">${baseline ? `Baseline ID: ${baseline.id.slice(0, 12)}...` : 'Run `ai-eval baseline`'}</div>
      </div>
    </div>
    ` : `
    <div class="card" style="text-align: center; padding: 48px 24px; margin-bottom: 24px;">
      <h2>No Evaluation Runs Recorded Yet</h2>
      <p style="margin-top: 8px; color: #64748b;">Run <code>ai-eval test</code> to execute evaluations and see results here.</p>
    </div>
    `}

    <div class="layout-split">
      <!-- Runs sidebar -->
      <div>
        <div class="card">
          <div class="card-label" style="margin-bottom: 14px;">Evaluation History (${runs.length})</div>
          <div class="history-list">
            ${runs.map((r, i) => `
              <div class="history-item ${i === 0 ? 'active' : ''}" onclick="selectRun('${escapeHtml(r.id)}')">
                <div class="history-item-header">
                  <span class="history-name">${escapeHtml(r.evaluationName || r.projectName)}</span>
                  <span class="history-score" style="color: ${r.overallScore >= 0.8 ? 'var(--green)' : 'var(--red)'};">
                    ${(r.overallScore * 100).toFixed(1)}%
                  </span>
                </div>
                <div style="font-size: 12px; color: #64748b;">
                  ${new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; ${r.totalCases} cases &bull; ${r.avgLatencyMs}ms
                </div>
              </div>
            `).join('')}
            ${runs.length === 0 ? '<div style="color: #64748b; font-size: 13px;">No runs found</div>' : ''}
          </div>
        </div>
      </div>

      <!-- Run Details Main View -->
      <div>
        ${latestRun ? `
        <div class="card" style="margin-bottom: 20px;">
          <div class="card-label" style="margin-bottom: 16px;">Evaluator Breakdown</div>
          ${Object.entries(latestRun.evaluatorScores).map(([name, score]: [string, any]) => {
            const pct = (score * 100).toFixed(1);
            const color = score >= 0.8 ? 'var(--green)' : score >= 0.5 ? 'var(--yellow)' : 'var(--red)';
            return `
            <div class="eval-row">
              <span class="eval-label">${escapeHtml(name)}</span>
              <div class="eval-bar">
                <div class="eval-fill" style="width: ${pct}%; background: ${color};"></div>
              </div>
              <span class="eval-score" style="color: ${color};">${pct}%</span>
            </div>`;
          }).join('')}
        </div>

        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div class="card-label">Test Case Explorer (${latestRun.cases.length})</div>
          </div>
          <input type="text" class="search-box" placeholder="Search test cases..." oninput="filterCases(this.value)">
          <table>
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Input</th>
                <th>Score</th>
                <th>Latency</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${latestRun.cases.map((c: any) => {
                const inputStr = typeof c.case.input === 'string' ? c.case.input : c.case.input.message ?? JSON.stringify(c.case.input);
                return `
                <tr class="case-row" data-text="${escapeHtml(c.id.toLowerCase() + ' ' + inputStr.toLowerCase())}">
                  <td>
                    <strong>${escapeHtml(c.id)}</strong>
                  </td>
                  <td>
                    <div style="max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      ${escapeHtml(inputStr)}
                    </div>
                    <div id="details-${escapeHtml(c.id)}" class="case-details">
                      <p><strong>Input:</strong> ${escapeHtml(inputStr)}</p>
                      ${c.case.expected ? `<p><strong>Expected:</strong> ${escapeHtml(JSON.stringify(c.case.expected))}</p>` : ''}
                      <p><strong>Actual:</strong> ${escapeHtml(c.output?.output ?? 'none')}</p>
                      <p style="margin-top: 6px;"><strong>Evaluators:</strong></p>
                      <ul style="padding-left: 18px;">
                        ${Object.entries(c.evaluatorResults).map(([ev, res]: [string, any]) => `
                          <li>${res.passed ? '✓' : '✗'} ${escapeHtml(ev)}: ${(res.score * 100).toFixed(1)}% - ${escapeHtml(res.reason ?? '')}</li>
                        `).join('')}
                      </ul>
                    </div>
                  </td>
                  <td style="color: ${c.passed ? 'var(--green)' : 'var(--red)'}; font-weight: 600;">
                    ${(c.score * 100).toFixed(1)}%
                  </td>
                  <td>${c.latencyMs}ms</td>
                  <td>
                    <a href="javascript:void(0)" style="color: var(--primary); font-size: 13px;" onclick="toggleDetails('${escapeHtml(c.id)}')">Inspect</a>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}
      </div>
    </div>
  </div>

  <script>
    function toggleDetails(id) {
      const el = document.getElementById('details-' + id);
      if (el) el.style.display = el.style.display === 'block' ? 'none' : 'block';
    }

    function filterCases(query) {
      const q = query.toLowerCase();
      document.querySelectorAll('.case-row').forEach(row => {
        const text = row.getAttribute('data-text') || '';
        row.style.display = text.includes(q) ? '' : 'none';
      });
    }

    function selectRun(id) {
      // Refresh with specific run parameter if desired
      window.location.href = '/?run=' + id;
    }
  </script>
</body>
</html>`;
}
