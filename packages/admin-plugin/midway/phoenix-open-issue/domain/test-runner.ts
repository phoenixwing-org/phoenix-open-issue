export interface OpenIssueDeclaredTestFile {
  id: string;
  filePath: string;
  packageName: "domain" | "service" | "contract" | "core";
  caseCount: number;
}

export const OPEN_ISSUE_CONTROLLED_TEST_SUITE_ID =
  "phoenix-open-issue.admin-plugin.core";
export const OPEN_ISSUE_CONTROLLED_TEST_TOOL_VERSION_RANGE =
  ">=3.2.7 <3.3.0";
export const OPEN_ISSUE_CONTROLLED_TEST_CONFIG_PATH =
  "packages/admin-plugin/vue/vitest.config.ts";
export const OPEN_ISSUE_CONTROLLED_TEST_DECLARATION_PATH =
  "packages/admin-plugin/test/phoenix-open-issue/controlled-test-suite.json";

export const OPEN_ISSUE_CONTROLLED_TEST_FILES = Object.freeze([
  {
    id: "domain:function",
    filePath: "packages/admin-plugin/test/phoenix-open-issue/domain/function.test.ts",
    packageName: "domain",
    caseCount: 6,
  },
  {
    id: "domain:issue-list",
    filePath: "packages/admin-plugin/test/phoenix-open-issue/domain/issue-list.test.ts",
    packageName: "domain",
    caseCount: 5,
  },
  {
    id: "domain:issue",
    filePath: "packages/admin-plugin/test/phoenix-open-issue/domain/issue.test.ts",
    packageName: "domain",
    caseCount: 8,
  },
  {
    id: "domain:legacy-import",
    filePath:
      "packages/admin-plugin/test/phoenix-open-issue/domain/legacy-import.test.ts",
    packageName: "domain",
    caseCount: 5,
  },
  {
    id: "domain:maintenance",
    filePath: "packages/admin-plugin/test/phoenix-open-issue/domain/maintenance.test.ts",
    packageName: "domain",
    caseCount: 6,
  },
  {
    id: "domain:push-report",
    filePath: "packages/admin-plugin/test/phoenix-open-issue/domain/push-report.test.ts",
    packageName: "domain",
    caseCount: 3,
  },
  {
    id: "domain:test-runner",
    filePath: "packages/admin-plugin/test/phoenix-open-issue/domain/test-runner.test.ts",
    packageName: "domain",
    caseCount: 4,
  },
  {
    id: "service:access",
    filePath: "packages/admin-plugin/test/phoenix-open-issue/service/access.test.ts",
    packageName: "service",
    caseCount: 6,
  },
  {
    id: "service:legacy-import",
    filePath:
      "packages/admin-plugin/test/phoenix-open-issue/service/legacy-import.test.ts",
    packageName: "service",
    caseCount: 10,
  },
  {
    id: "service:maintenance",
    filePath: "packages/admin-plugin/test/phoenix-open-issue/service/maintenance.test.ts",
    packageName: "service",
    caseCount: 4,
  },
  {
    id: "contract:dictionary",
    filePath: "packages/admin-plugin/test/scripts/admin-plugin-dictionary-contract.test.ts",
    packageName: "contract",
    caseCount: 3,
  },
  {
    id: "contract:settings-boundary",
    filePath: "packages/admin-plugin/test/scripts/admin-plugin-settings-boundary.test.ts",
    packageName: "contract",
    caseCount: 3,
  },
  {
    id: "contract:view-layout",
    filePath: "packages/admin-plugin/test/scripts/admin-plugin-view-layout.test.ts",
    packageName: "contract",
    caseCount: 11,
  },
  {
    id: "core:dict-catalog",
    filePath: "packages/admin-plugin/vue/phoenix-open-issue/api/dict-catalog.test.ts",
    packageName: "core",
    caseCount: 2,
  },
  {
    id: "core:dict",
    filePath: "packages/admin-plugin/vue/phoenix-open-issue/api/dict.test.ts",
    packageName: "core",
    caseCount: 5,
  },
  {
    id: "core:dict-store",
    filePath:
      "packages/admin-plugin/vue/phoenix-open-issue/stores/dict.test.ts",
    packageName: "core",
    caseCount: 3,
  },
  {
    id: "core:host-capability",
    filePath:
      "packages/admin-plugin/vue/phoenix-open-issue/core/algorithms/host-capability.test.ts",
    packageName: "core",
    caseCount: 3,
  },
  {
    id: "core:legacy-dictionary",
    filePath:
      "packages/admin-plugin/vue/phoenix-open-issue/core/algorithms/legacy-dictionary.test.ts",
    packageName: "core",
    caseCount: 3,
  },
  {
    id: "core:legacy-import",
    filePath:
      "packages/admin-plugin/vue/phoenix-open-issue/core/algorithms/legacy-import.test.ts",
    packageName: "core",
    caseCount: 5,
  },
  {
    id: "core:permission",
    filePath:
      "packages/admin-plugin/vue/phoenix-open-issue/core/algorithms/permission.test.ts",
    packageName: "core",
    caseCount: 7,
  },
  {
    id: "core:push",
    filePath:
      "packages/admin-plugin/vue/phoenix-open-issue/core/algorithms/push.test.ts",
    packageName: "core",
    caseCount: 13,
  },
  {
    id: "core:scheduling",
    filePath:
      "packages/admin-plugin/vue/phoenix-open-issue/core/algorithms/scheduling.test.ts",
    packageName: "core",
    caseCount: 15,
  },
] satisfies readonly OpenIssueDeclaredTestFile[]);

export const OPEN_ISSUE_CONTROLLED_TEST_FILE_COUNT =
  OPEN_ISSUE_CONTROLLED_TEST_FILES.length;
export const OPEN_ISSUE_CONTROLLED_TEST_CASE_COUNT =
  OPEN_ISSUE_CONTROLLED_TEST_FILES.reduce(
    (total, file) => total + file.caseCount,
    0
  );

export interface OpenIssueTestSummary {
  filesTotal: number;
  filesPassed: number;
  filesFailed: number;
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
  const filesLine = plain
    .split(/\r?\n/)
    .reverse()
    .find((line) => /^\s*Test Files\s+/i.test(line));
  const filesPassed = filesLine ? count(filesLine, "passed") : 0;
  const filesFailed = filesLine
    ? count(filesLine, "failed")
    : exitCode === 0
    ? 0
    : 1;
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
    filesTotal: filesPassed + filesFailed,
    filesPassed,
    filesFailed,
    total,
    passed,
    failed,
    pending,
    success: exitCode === 0 && failed === 0,
    durationMs: Math.max(0, Math.round(durationMs)),
  };
}
