import { EvaluationRun, RegressionComparison, escapeHtml } from '@ai-eval/core';
import { Reporter, ReporterOutputOptions } from './types.js';

export class HtmlReporter implements Reporter {
  public readonly name = 'html';

  format(run: EvaluationRun, regression?: RegressionComparison, _options?: ReporterOutputOptions): string {
    const isPassed = run.failedCases === 0 && (!regression || !regression.hasRegression);
    const passRate = ((run.passedCases / (run.totalCases || 1)) * 100).toFixed(1);
    const overallPct = (run.overallScore * 100).toFixed(1);


    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Eval Kit Report - ${escapeHtml(run.evaluationName)}</title>
  <style>
    :root {
      --bg: #0d1117;
      --card-bg: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --heading: #f0f6fc;
      --accent: #58a6ff;
      --green: #3fb950;
      --red: #f85149;
      --yellow: #d29922;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 24px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
    }
    h1 { color: var(--heading); font-size: 24px; }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-passed { background: rgba(63, 185, 80, 0.15); color: var(--green); border: 1px solid var(--green); }
    .badge-failed { background: rgba(248, 81, 73, 0.15); color: var(--red); border: 1px solid var(--red); }
    
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
    }
    .card-title { font-size: 13px; color: #8b949e; text-transform: uppercase; margin-bottom: 8px; }
    .card-value { font-size: 28px; font-weight: 700; color: var(--heading); }
    .card-sub { font-size: 13px; color: #8b949e; margin-top: 4px; }

    .eval-bars { margin-bottom: 24px; }
    .bar-row { display: flex; align-items: center; margin-bottom: 10px; font-size: 14px; }
    .bar-label { width: 200px; color: var(--heading); }
    .bar-track { flex: 1; height: 10px; background: #21262d; border-radius: 5px; overflow: hidden; margin: 0 16px; }
    .bar-fill { height: 100%; border-radius: 5px; }
    .bar-pct { width: 60px; text-align: right; font-weight: 600; }

    .regression-box {
      background: rgba(248, 81, 73, 0.1);
      border: 1px solid var(--red);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .regression-title { color: var(--red); font-weight: 700; font-size: 16px; margin-bottom: 8px; }

    .table-container {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 24px;
    }
    .table-header {
      padding: 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .filter-btn {
      background: #21262d;
      border: 1px solid var(--border);
      color: var(--text);
      padding: 6px 14px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
    }
    .filter-btn.active {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
    }
    input.search {
      background: #0d1117;
      border: 1px solid var(--border);
      color: var(--heading);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 14px;
      outline: none;
      width: 250px;
    }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; }
    th { background: #1c2128; padding: 12px 16px; border-bottom: 1px solid var(--border); color: #8b949e; }
    td { padding: 12px 16px; border-bottom: 1px solid var(--border); vertical-align: top; }
    tr:hover { background: #1c2128; }
    .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; }
    .dot-pass { background: var(--green); }
    .dot-fail { background: var(--red); }
    .case-details {
      background: #0d1117;
      padding: 12px 16px;
      border-radius: 6px;
      margin-top: 8px;
      font-family: monospace;
      font-size: 13px;
      display: none;
    }
    .toggle-link { color: var(--accent); cursor: pointer; text-decoration: underline; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>AI Eval Kit - ${escapeHtml(run.evaluationName)}</h1>
        <div style="font-size: 13px; color: #8b949e; margin-top: 4px;">
          Project: ${escapeHtml(run.projectName)} &bull; Target: ${escapeHtml(run.targetName)}${run.modelName ? ` (${escapeHtml(run.modelName)})` : ''} &bull; ${new Date(run.timestamp).toLocaleString()}
        </div>
      </div>
      <div>
        <span class="badge ${isPassed ? 'badge-passed' : 'badge-failed'}">
          ${isPassed ? 'Passed' : 'Failed'}
        </span>
      </div>
    </header>

    ${
      regression && regression.hasRegression
        ? `
    <div class="regression-box">
      <div class="regression-title">⚠️ AI Regression Detected Against Baseline</div>
      <ul style="padding-left: 20px; font-size: 14px;">
        ${regression.violations.map((v) => `<li>${escapeHtml(v)}</li>`).join('')}
      </ul>
    </div>`
        : ''
    }

    <div class="grid">
      <div class="card">
        <div class="card-title">Overall Score</div>
        <div class="card-value" style="color: ${run.overallScore >= 0.8 ? 'var(--green)' : 'var(--red)'};">
          ${overallPct}%
        </div>
        <div class="card-sub">${run.passedCases} passed of ${run.totalCases} cases</div>
      </div>
      <div class="card">
        <div class="card-title">Pass Rate</div>
        <div class="card-value">${passRate}%</div>
        <div class="card-sub">${run.failedCases} failure(s)</div>
      </div>
      <div class="card">
        <div class="card-title">Latency (Avg / P95)</div>
        <div class="card-value">${run.latencyStats.avgMs}ms</div>
        <div class="card-sub">p95: ${run.latencyStats.p95Ms}ms | max: ${run.latencyStats.maxMs}ms</div>
      </div>
      <div class="card">
        <div class="card-title">Token Usage & Cost</div>
        <div class="card-value">$${run.totalCost.toFixed(4)}</div>
        <div class="card-sub">${run.totalTokens.totalTokens.toLocaleString()} tokens</div>
      </div>
    </div>

    <div class="card eval-bars">
      <div class="card-title" style="margin-bottom: 16px;">Evaluator Breakdown</div>
      ${Object.entries(run.evaluatorScores)
        .map(([name, score]) => {
          const pct = (score * 100).toFixed(1);
          const color = score >= 0.8 ? 'var(--green)' : score >= 0.5 ? 'var(--yellow)' : 'var(--red)';
          return `
        <div class="bar-row">
          <span class="bar-label">${escapeHtml(name)}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${pct}%; background: ${color};"></div>
          </div>
          <span class="bar-pct" style="color: ${color};">${pct}%</span>
        </div>`;
        })
        .join('')}
    </div>

    <div class="table-container">
      <div class="table-header">
        <div style="font-weight: 600; color: var(--heading);">Test Case Explorer (${run.totalCases} cases)</div>
        <div style="display: flex; gap: 8px;">
          <button class="filter-btn active" onclick="filterCases('all')">All (${run.totalCases})</button>
          <button class="filter-btn" onclick="filterCases('passed')">Passed (${run.passedCases})</button>
          <button class="filter-btn" onclick="filterCases('failed')">Failed (${run.failedCases})</button>
          <input type="text" class="search" placeholder="Search cases..." oninput="searchCases(this.value)">
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Case ID</th>
            <th>Input</th>
            <th>Score</th>
            <th>Latency</th>
            <th>Cost</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody id="case-table-body">
          ${run.cases
            .map((c) => {
              const inputStr =
                typeof c.case.input === 'string' ? c.case.input : c.case.input.message ?? JSON.stringify(c.case.input);
              const scorePct = (c.score * 100).toFixed(1);
              return `
            <tr class="case-row ${c.passed ? 'row-passed' : 'row-failed'}" data-id="${escapeHtml(c.id)}" data-text="${escapeHtml(inputStr.toLowerCase())}">
              <td>
                <span class="status-dot ${c.passed ? 'dot-pass' : 'dot-fail'}"></span>
                <strong>${escapeHtml(c.id)}</strong>
              </td>
              <td>
                <div style="max-width: 450px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${escapeHtml(inputStr)}
                </div>
                <div id="details-${escapeHtml(c.id)}" class="case-details">
                  <p><strong>Input:</strong> ${escapeHtml(inputStr)}</p>
                  ${c.case.expected ? `<p><strong>Expected:</strong> ${escapeHtml(JSON.stringify(c.case.expected))}</p>` : ''}
                  <p><strong>Actual:</strong> ${escapeHtml(c.output?.output ?? 'none')}</p>
                  <p style="margin-top: 6px;"><strong>Evaluator Results:</strong></p>
                  <ul style="padding-left: 18px;">
                    ${Object.entries(c.evaluatorResults)
                      .map(
                        ([ev, res]) =>
                          `<li>${res.passed ? '✅' : '❌'} <strong>${escapeHtml(ev)}</strong>: ${(res.score * 100).toFixed(1)}% - ${escapeHtml(res.reason ?? '')}</li>`
                      )
                      .join('')}
                  </ul>
                </div>
              </td>
              <td style="color: ${c.passed ? 'var(--green)' : 'var(--red)'}; font-weight: 600;">${scorePct}%</td>
              <td>${c.latencyMs}ms</td>
              <td>$${c.cost.toFixed(4)}</td>
              <td>
                <span class="toggle-link" onclick="toggleDetails('${escapeHtml(c.id)}')">Inspect</span>
              </td>
            </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </div>

    <footer style="text-align: center; color: #8b949e; font-size: 13px; margin-top: 32px;">
      AI Eval Kit &bull; Open-source evaluations, regression testing, and benchmarking
    </footer>
  </div>

  <script>
    let currentFilter = 'all';
    let searchQuery = '';

    function filterCases(filter) {
      currentFilter = filter;
      document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');
      applyFilters();
    }

    function searchCases(query) {
      searchQuery = query.toLowerCase();
      applyFilters();
    }

    function applyFilters() {
      const rows = document.querySelectorAll('.case-row');
      rows.forEach(row => {
        const isPassed = row.classList.contains('row-passed');
        const matchesFilter =
          currentFilter === 'all' ||
          (currentFilter === 'passed' && isPassed) ||
          (currentFilter === 'failed' && !isPassed);

        const text = row.getAttribute('data-text') + ' ' + row.getAttribute('data-id');
        const matchesSearch = !searchQuery || text.includes(searchQuery);

        row.style.display = matchesFilter && matchesSearch ? '' : 'none';
      });
    }

    function toggleDetails(id) {
      const el = document.getElementById('details-' + id);
      if (el) {
        el.style.display = el.style.display === 'block' ? 'none' : 'block';
      }
    }
  </script>
</body>
</html>`;
  }
}
