/** 由 Vitest JSON 报告生成独立 HTML（新标签页打开，不依赖 SPA） */

interface VitestAssertion {
  ancestorTitles: string[]
  fullName: string
  status: string
  title: string
  duration: number
  failureMessages: string[]
}

interface VitestFileResult {
  name: string
  status: string
  assertionResults: VitestAssertion[]
}

export interface VitestJsonReport {
  numTotalTests: number
  numPassedTests: number
  numFailedTests: number
  numPendingTests: number
  success: boolean
  startTime: number
  testResults: VitestFileResult[]
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function relPath(absPath: string, repoRoot: string): string {
  const norm = absPath.replace(/\\/g, '/')
  const root = repoRoot.replace(/\\/g, '/')
  if (norm.startsWith(root)) return norm.slice(root.length + 1)
  return norm
}

export function buildTestReportHtml(report: VitestJsonReport, repoRoot: string, ranAt: string): string {
  const durationMs = report.testResults.reduce((sum, f) => {
    return sum + f.assertionResults.reduce((s, a) => s + (a.duration || 0), 0)
  }, 0)

  const fileSections = report.testResults.map((file) => {
    const filePath = relPath(file.name, repoRoot)
    const passed = file.assertionResults.filter(a => a.status === 'passed').length
    const failed = file.assertionResults.filter(a => a.status === 'failed').length
    const fileStatus = file.status === 'passed' ? 'pass' : 'fail'

    const rows = file.assertionResults.map((a) => {
      const suite = a.ancestorTitles.join(' › ')
      const statusClass = a.status === 'passed' ? 'pass' : a.status === 'failed' ? 'fail' : 'skip'
      const failBlock = a.failureMessages?.length
        ? `<pre class="fail-msg">${esc(a.failureMessages.join('\n'))}</pre>`
        : ''
      return `<tr class="${statusClass}">
        <td class="status">${esc(a.status)}</td>
        <td>${esc(suite)}</td>
        <td>${esc(a.title)}</td>
        <td class="num">${a.duration.toFixed(1)}ms</td>
      </tr>${failBlock ? `<tr class="fail-detail"><td colspan="4">${failBlock}</td></tr>` : ''}`
    }).join('')

    return `<section class="file ${fileStatus}">
      <h2><span class="badge ${fileStatus}">${fileStatus === 'pass' ? 'PASS' : 'FAIL'}</span> ${esc(filePath)}</h2>
      <p class="file-meta">${passed} 通过${failed ? ` · ${failed} 失败` : ''} · ${file.assertionResults.length} 条</p>
      <table><thead><tr><th>状态</th><th>套件</th><th>用例</th><th>耗时</th></tr></thead><tbody>${rows}</tbody></table>
    </section>`
  }).join('')

  const overallClass = report.success ? 'pass' : 'fail'

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>单元测试报告 · ${esc(ranAt)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; padding: 24px 32px 48px; background: #f5f7fa; color: #303133; line-height: 1.5; }
    h1 { margin: 0 0 8px; font-size: 1.5rem; }
    .summary { display: flex; flex-wrap: wrap; gap: 16px; margin: 16px 0 24px; padding: 16px 20px; background: #fff; border-radius: 8px; border: 1px solid #ebeef5; }
    .summary .item { font-size: 0.95rem; }
    .summary .item strong { font-size: 1.25rem; display: block; }
    .summary .pass strong { color: #67c23a; }
    .summary .fail strong { color: #f56c6c; }
    .summary .total strong { color: #409eff; }
    .overall { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 600; font-size: 0.85rem; margin-bottom: 8px; }
    .overall.pass { background: #e1f3d8; color: #529b2e; }
    .overall.fail { background: #fde2e2; color: #c45656; }
    .meta { color: #909399; font-size: 0.85rem; margin-bottom: 20px; }
    section.file { background: #fff; border: 1px solid #ebeef5; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px; }
    section.file h2 { margin: 0 0 4px; font-size: 1rem; font-weight: 600; word-break: break-all; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; margin-right: 8px; vertical-align: middle; }
    .badge.pass { background: #e1f3d8; color: #529b2e; }
    .badge.fail { background: #fde2e2; color: #c45656; }
    .file-meta { margin: 0 0 12px; color: #909399; font-size: 0.82rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #f0f0f0; }
    th { color: #909399; font-weight: 500; }
    tr.pass td.status { color: #67c23a; }
    tr.fail td.status { color: #f56c6c; font-weight: 600; }
    tr.fail-detail td { padding-top: 0; border: none; }
    pre.fail-msg { margin: 0 0 12px; padding: 10px 12px; background: #fef0f0; border-radius: 4px; font-size: 0.78rem; overflow-x: auto; white-space: pre-wrap; color: #c45656; }
    td.num { color: #909399; white-space: nowrap; }
  </style>
</head>
<body>
  <span class="overall ${overallClass}">${report.success ? '全部通过' : '存在失败'}</span>
  <h1>单元测试报告</h1>
  <p class="meta">运行时间：${esc(ranAt)} · 总耗时约 ${Math.round(durationMs)}ms</p>
  <div class="summary">
    <div class="item total"><strong>${report.numTotalTests}</strong>总计</div>
    <div class="item pass"><strong>${report.numPassedTests}</strong>通过</div>
    <div class="item fail"><strong>${report.numFailedTests}</strong>失败</div>
    <div class="item"><strong>${report.numPendingTests}</strong>跳过/待定</div>
    <div class="item"><strong>${report.testResults.length}</strong>文件</div>
  </div>
  ${fileSections}
</body>
</html>`
}
