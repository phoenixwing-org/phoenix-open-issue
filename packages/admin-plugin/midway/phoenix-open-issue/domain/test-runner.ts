export interface OpenIssueTestSummary {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  success: boolean;
  durationMs: number;
}

export function countDeclaredTestCases(source: string): number {
  return [...source.matchAll(/\b(?:it|test)\s*\(/g)].length;
}

function count(line: string, label: string): number {
  return Number(line.match(new RegExp(`(\\d+)\\s+${label}`))?.[1] ?? 0);
}

export function summarizeVitestOutput(
  output: string,
  exitCode: number,
  durationMs: number
): OpenIssueTestSummary {
  const plain = output.replace(/\u001b\[[0-9;]*m/g, "");
  const testsLine = plain
    .split(/\r?\n/)
    .reverse()
    .find((line) => /^\s*Tests\s+/i.test(line));
  const passed = testsLine ? count(testsLine, "passed") : 0;
  const failed = testsLine
    ? count(testsLine, "failed")
    : exitCode === 0
    ? 0
    : 1;
  const pending = testsLine
    ? count(testsLine, "skipped") + count(testsLine, "todo")
    : 0;
  const total = passed + failed + pending;
  return {
    total,
    passed,
    failed,
    pending,
    success: exitCode === 0 && failed === 0,
    durationMs: Math.max(0, Math.round(durationMs)),
  };
}
