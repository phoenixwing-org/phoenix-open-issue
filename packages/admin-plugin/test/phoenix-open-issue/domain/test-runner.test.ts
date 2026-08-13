import { createHash } from "node:crypto";
import {
  appendFileSync,
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  countDeclaredTestCases,
  OPEN_ISSUE_CONTROLLED_TEST_CASE_COUNT,
  OPEN_ISSUE_CONTROLLED_TEST_CONFIG_PATH,
  OPEN_ISSUE_CONTROLLED_TEST_DECLARATION_PATH,
  OPEN_ISSUE_CONTROLLED_TEST_FILE_COUNT,
  OPEN_ISSUE_CONTROLLED_TEST_FILES,
  summarizeVitestOutput,
} from "../../../midway/phoenix-open-issue/domain/test-runner";
import {
  buildOpenIssueTestExecutionPlan,
  executeOpenIssueTestExecutionPlan,
  OPEN_ISSUE_CONTROLLED_TOOL_PROFILE_ENV,
  OPEN_ISSUE_TEST_RUNNER_MAX_CONCURRENCY,
  OPEN_ISSUE_TEST_RUNNER_MAX_OUTPUT_BYTES,
  OPEN_ISSUE_TEST_RUNNER_TIMEOUT_MS,
  resolveOpenIssueTestRunnerContext,
} from "../../../midway/phoenix-open-issue/service/test-runner";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../.."
);
const LOCK_INTEGRITY =
  "sha512-KrxIJ62Fd89gfysR4WotlgZABiz2dqFPgqGzX7s+CwsqLFomRH7777ZcrOD6+WVAh7khPQP41A+BKbpcJFrdEg==";

interface RunnerFixture {
  root: string;
  productRoot: string;
  hostRoot: string;
  packageRoot: string;
  entrypoint: string;
  lockfile: string;
  declarationPath: string;
  configPath: string;
  testPaths: string[];
  profile: Record<string, unknown>;
}

function sha256(content: Buffer | string): string {
  return createHash("sha256").update(content).digest("hex");
}

function packageHash(packageRoot: string): { sha256: string; fileCount: number } {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
      (left, right) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0
    )) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile()) files.push(target);
      else throw new Error(`unexpected fixture entry: ${target}`);
    }
  };
  visit(packageRoot);
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(
      Buffer.from(path.relative(packageRoot, file).split(path.sep).join("/"))
    );
    hash.update(Buffer.from([0]));
    hash.update(readFileSync(file));
    hash.update(Buffer.from([0]));
  }
  return { sha256: hash.digest("hex"), fileCount: files.length };
}

function writeJson(target: string, value: unknown): void {
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function copySource(productRoot: string, relativePath: string): string {
  const source = path.join(REPO_ROOT, relativePath);
  const target = path.join(productRoot, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(source, target);
  return target;
}

function createRunnerFixture(): RunnerFixture {
  const root = path.join(
    tmpdir(),
    `open-issue-test-runner-${process.pid}-${Math.random()
      .toString(16)
      .slice(2)}`
  );
  const productRoot = path.join(root, "product");
  const hostRoot = path.join(root, "host");
  const packageRoot = path.join(
    hostRoot,
    "node_modules/.pnpm/vitest@3.2.7/node_modules/vitest"
  );
  mkdirSync(packageRoot, { recursive: true });
  mkdirSync(productRoot, { recursive: true });
  writeJson(path.join(productRoot, "package.json"), {
    name: "phoenix-open-issue",
  });

  const declarationPath = copySource(
    productRoot,
    OPEN_ISSUE_CONTROLLED_TEST_DECLARATION_PATH
  );
  const declaration = JSON.parse(readFileSync(declarationPath, "utf8")) as {
    config: { path: string };
    tests: Array<{ filePath: string }>;
  };
  const configPath = copySource(productRoot, declaration.config.path);
  const testPaths = declaration.tests.map((item) =>
    copySource(productRoot, item.filePath)
  );

  const entrypoint = path.join(packageRoot, "vitest.mjs");
  writeFileSync(
    entrypoint,
    [
      "const forbidden = process.env.NODE_OPTIONS || process.env.NODE_PATH ||",
      `  process.env.${OPEN_ISSUE_CONTROLLED_TOOL_PROFILE_ENV} ||`,
      "  Object.keys(process.env).some(key => key.startsWith('VITEST_'));",
      "if (forbidden) process.exit(41);",
      "if (process.argv[2] !== 'run' || process.argv[3] !== '--config' ||",
      "    process.argv[5] !== '--reporter=basic' || process.argv.slice(6).length !== 23) process.exit(42);",
      "process.stdout.write(' Test Files  23 passed (23)\\n Tests  134 passed (134)\\n');",
      "",
    ].join("\n"),
    "utf8"
  );
  writeJson(path.join(packageRoot, "package.json"), {
    name: "vitest",
    version: "3.2.7",
    type: "module",
    bin: { vitest: "./vitest.mjs" },
  });
  mkdirSync(path.join(hostRoot, "node_modules"), { recursive: true });
  symlinkSync(packageRoot, path.join(hostRoot, "node_modules/vitest"), "dir");

  const lockfile = path.join(hostRoot, "pnpm-lock.yaml");
  writeFileSync(
    lockfile,
    [
      "lockfileVersion: '9.0'",
      "",
      "importers:",
      "",
      "  .:",
      "    devDependencies:",
      "      vitest:",
      "        specifier: ^3.2.7",
      "        version: 3.2.7",
      "",
      "packages:",
      "",
      "  vitest@3.2.7:",
      `    resolution: {integrity: ${LOCK_INTEGRITY}}`,
      "    hasBin: true",
      "",
    ].join("\n"),
    "utf8"
  );
  const contentHash = packageHash(packageRoot);
  const profile = {
    schemaVersion: 1,
    profileId: "pdh.controlled.vitest",
    toolId: "vitest",
    toolVersion: "3.2.7",
    availability: "available",
    hostRootRealpath: realpathSync(hostRoot),
    packageRootRealpath: realpathSync(packageRoot),
    entrypointRealpath: realpathSync(entrypoint),
    lockfileRealpath: realpathSync(lockfile),
    lockSpecifier: "^3.2.7",
    lockIntegrity: LOCK_INTEGRITY,
    lockfileSha256: sha256(readFileSync(lockfile)),
    entrypointSha256: sha256(readFileSync(entrypoint)),
    packageSha256: contentHash.sha256,
    packageHashFormat: "pdh-package-sha256-v1",
    packageFileCount: contentHash.fileCount,
  };
  return {
    root,
    productRoot: realpathSync(productRoot),
    hostRoot: realpathSync(hostRoot),
    packageRoot: realpathSync(packageRoot),
    entrypoint: realpathSync(entrypoint),
    lockfile: realpathSync(lockfile),
    declarationPath: realpathSync(declarationPath),
    configPath: realpathSync(configPath),
    testPaths: testPaths.map((item) => realpathSync(item)),
    profile,
  };
}

function withFixture<T>(run: (fixture: RunnerFixture) => T): T {
  const fixture = createRunnerFixture();
  try {
    return run(fixture);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
}

async function withFixtureAsync<T>(
  run: (fixture: RunnerFixture) => Promise<T>
): Promise<T> {
  const fixture = createRunnerFixture();
  try {
    return await run(fixture);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
}

function resolveFixture(
  fixture: RunnerFixture,
  rawProfile = JSON.stringify(fixture.profile),
  nodeEnv = "local"
) {
  return resolveOpenIssueTestRunnerContext({
    productRoot: fixture.productRoot,
    rawProfile,
    nodeEnv,
  });
}

describe("Open Issue 受控测试运行器算法", () => {
  it("只统计固定 23 文件 / 134 用例且无 Profile 与 production 均 fail-closed", () => {
    const source =
      "describe('x', () => { " +
      "it" +
      "('a', () => {}); " +
      "test" +
      "('b', () => {}) })";
    expect(countDeclaredTestCases(source)).toBe(2);
    expect(OPEN_ISSUE_CONTROLLED_TEST_FILE_COUNT).toBe(23);
    expect(OPEN_ISSUE_CONTROLLED_TEST_CASE_COUNT).toBe(134);
    expect(OPEN_ISSUE_TEST_RUNNER_MAX_CONCURRENCY).toBe(1);
    expect(OPEN_ISSUE_TEST_RUNNER_TIMEOUT_MS).toBe(180_000);
    expect(OPEN_ISSUE_TEST_RUNNER_MAX_OUTPUT_BYTES).toBe(2 * 1024 * 1024);
    expect(new Set(OPEN_ISSUE_CONTROLLED_TEST_FILES.map((item) => item.id)).size).toBe(23);
    expect(
      OPEN_ISSUE_CONTROLLED_TEST_FILES.every(
        (item) =>
          item.filePath.endsWith(".test.ts") &&
          !path.isAbsolute(item.filePath) &&
          !item.filePath.includes("..")
      )
    ).toBe(true);

    const missing = resolveOpenIssueTestRunnerContext({
      productRoot: REPO_ROOT,
      rawProfile: undefined,
      nodeEnv: "local",
    });
    expect(missing).toMatchObject({
      available: false,
      reasonCode: "PROFILE_MISSING",
      fileCount: 23,
      caseCount: 134,
    });
    const production = resolveOpenIssueTestRunnerContext({
      productRoot: REPO_ROOT,
      rawProfile: "not-even-json",
      nodeEnv: "production",
    });
    expect(production).toMatchObject({
      available: false,
      reasonCode: "PRODUCTION_DISABLED",
      fileCount: 23,
      caseCount: 134,
    });
  });

  it("消费合法 DevHub Profile 并用 Node 固定 argv 执行精确白名单", async () => {
    await withFixtureAsync(async (fixture) => {
      const context = resolveFixture(fixture);
      expect(context).toMatchObject({
        available: true,
        reasonCode: null,
        fileCount: 23,
        caseCount: 134,
      });
      if (!context.available) throw new Error(context.reasonCode);
      const plan = buildOpenIssueTestExecutionPlan(context, {
        PATH: process.env.PATH,
        NODE_OPTIONS: "--require=/tmp/untrusted.cjs",
        NODE_PATH: "/tmp/untrusted-node-path",
        VITEST_FOO: "untrusted",
        [OPEN_ISSUE_CONTROLLED_TOOL_PROFILE_ENV]: "untrusted",
      });
      expect(plan.command).toBe(process.execPath);
      expect(plan.shell).toBe(false);
      expect(plan.cwd).toBe(fixture.productRoot);
      expect(plan.args).toEqual([
        fixture.entrypoint,
        "run",
        "--config",
        fixture.configPath,
        "--reporter=basic",
        ...fixture.testPaths,
      ]);
      expect(plan.env).not.toHaveProperty("NODE_OPTIONS");
      expect(plan.env).not.toHaveProperty("NODE_PATH");
      expect(plan.env).not.toHaveProperty("VITEST_FOO");
      expect(plan.env).not.toHaveProperty(
        OPEN_ISSUE_CONTROLLED_TOOL_PROFILE_ENV
      );
      const execution = await executeOpenIssueTestExecutionPlan(plan);
      expect(execution.code).toBe(0);
      expect(
        summarizeVitestOutput(
          execution.output,
          execution.code,
          execution.durationMs
        )
      ).toMatchObject({
        filesTotal: 23,
        filesPassed: 23,
        total: 134,
        passed: 134,
        success: true,
      });
    });
  });

  it("严格拒绝 Profile schema、身份、路径、lock 与三组 SHA 漂移", () => {
    const reasonFor = (
      mutate: (fixture: RunnerFixture) => string | undefined
    ) =>
      withFixture((fixture) => {
        const raw = mutate(fixture) ?? JSON.stringify(fixture.profile);
        return resolveFixture(fixture, raw).reasonCode;
      });

    expect(reasonFor((fixture) => `${JSON.stringify(fixture.profile)}\n`)).toBe(
      "PROFILE_NOT_SINGLE_LINE"
    );
    expect(
      reasonFor((fixture) => `${JSON.stringify(fixture.profile)}${" ".repeat(17_000)}`)
    ).toBe("PROFILE_TOO_LARGE");
    expect(
      reasonFor((fixture) =>
        JSON.stringify({ ...fixture.profile, unexpected: true })
      )
    ).toBe("PROFILE_SCHEMA_INVALID");
    expect(
      reasonFor((fixture) =>
        JSON.stringify({ ...fixture.profile, profileId: "other.profile" })
      )
    ).toBe("PROFILE_IDENTITY_MISMATCH");
    expect(
      reasonFor((fixture) =>
        JSON.stringify({ ...fixture.profile, toolVersion: "3.3.0" })
      )
    ).toBe("PROFILE_VERSION_UNSUPPORTED");
    expect(
      reasonFor((fixture) =>
        JSON.stringify({
          schemaVersion: 1,
          profileId: "pdh.controlled.vitest",
          toolId: "vitest",
          toolVersion: "3.2.7",
          availability: "unavailable",
          unavailableReason: {
            code: "PACKAGE_UNAVAILABLE",
            message: "not exposed to UI",
          },
        })
      )
    ).toBe("PROFILE_HOST_UNAVAILABLE:PACKAGE_UNAVAILABLE");
    expect(
      reasonFor((fixture) =>
        JSON.stringify({
          ...fixture.profile,
          hostRootRealpath: `${fixture.hostRoot}${path.sep}.`,
        })
      )
    ).toBe("PROFILE_PATH_INVALID");
    expect(
      reasonFor((fixture) => {
        const packageJson = path.join(fixture.packageRoot, "package.json");
        writeJson(packageJson, {
          name: "not-vitest",
          version: "3.2.7",
          type: "module",
          bin: { vitest: "./vitest.mjs" },
        });
        return undefined;
      })
    ).toBe("PROFILE_PACKAGE_IDENTITY_MISMATCH");
    expect(
      reasonFor((fixture) =>
        JSON.stringify({ ...fixture.profile, lockIntegrity: "sha512-AAAA" })
      )
    ).toBe("PROFILE_LOCK_INTEGRITY_MISMATCH");
    expect(
      reasonFor((fixture) => {
        appendFileSync(fixture.lockfile, "# drift\n");
        return undefined;
      })
    ).toBe("PROFILE_LOCKFILE_SHA_MISMATCH");
    expect(
      reasonFor((fixture) => {
        appendFileSync(fixture.entrypoint, "// drift\n");
        return undefined;
      })
    ).toBe("PROFILE_ENTRYPOINT_SHA_MISMATCH");
    expect(
      reasonFor((fixture) => {
        writeFileSync(path.join(fixture.packageRoot, "drift.txt"), "drift");
        return undefined;
      })
    ).toBe("PROFILE_PACKAGE_SHA_MISMATCH");
  });

  it("严格拒绝声明、config 与测试源码漂移并保留 Vitest 失败汇总", () => {
    expect(
      summarizeVitestOutput(
        " Test Files  1 failed | 2 passed (3)\n Tests  2 failed | 5 passed | 1 skipped (8)",
        1,
        10
      )
    ).toEqual(
      expect.objectContaining({
        filesTotal: 3,
        filesPassed: 2,
        filesFailed: 1,
        total: 8,
        passed: 5,
        failed: 2,
        pending: 1,
        success: false,
      })
    );
    expect(
      summarizeVitestOutput("spawn failed", 2, 1)
    ).toEqual(
      expect.objectContaining({
        filesTotal: 1,
        filesFailed: 1,
        total: 1,
        failed: 1,
        success: false,
      })
    );

    expect(
      withFixture((fixture) => {
        appendFileSync(fixture.configPath, "// drift\n");
        return resolveFixture(fixture).reasonCode;
      })
    ).toBe("DECLARATION_CONFIG_SHA_MISMATCH");
    expect(
      withFixture((fixture) => {
        appendFileSync(fixture.testPaths[0], "// drift\n");
        return resolveFixture(fixture).reasonCode;
      })
    ).toBe("DECLARATION_TEST_SHA_MISMATCH");
    expect(
      withFixture((fixture) => {
        const declaration = JSON.parse(
          readFileSync(fixture.declarationPath, "utf8")
        );
        declaration.expectedCaseCount = 100;
        writeJson(fixture.declarationPath, declaration);
        return resolveFixture(fixture).reasonCode;
      })
    ).toBe("DECLARATION_IDENTITY_MISMATCH");
    expect(
      withFixture((fixture) => {
        const declaration = JSON.parse(
          readFileSync(fixture.declarationPath, "utf8")
        );
        appendFileSync(
          fixture.testPaths[0],
          `\n${"i" + "t"}('undeclared', () => {})\n`
        );
        declaration.tests[0].sha256 = sha256(
          readFileSync(fixture.testPaths[0])
        );
        writeJson(fixture.declarationPath, declaration);
        return resolveFixture(fixture).reasonCode;
      })
    ).toBe("DECLARATION_TEST_COUNT_MISMATCH");
    expect(OPEN_ISSUE_CONTROLLED_TEST_CONFIG_PATH).toBe(
      "packages/admin-plugin/vue/vitest.config.ts"
    );
  });
});
