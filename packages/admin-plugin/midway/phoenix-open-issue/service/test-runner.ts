import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import * as path from "node:path";
import { Inject, Provide } from "@midwayjs/core";
import { CoolCommException } from "@cool-midway/core";
import {
  countDeclaredTestCases,
  summarizeVitestOutput,
  type OpenIssueTestSummary,
} from "../domain/test-runner";
import { OpenIssueAccessService } from "./access";

interface TestFileInfo {
  filePath: string;
  packageName: string;
  caseCount: number;
}

interface TestRunResult {
  exitCode: number;
  summary: OpenIssueTestSummary;
  reportUrl: string;
  ranAt: string;
  runId: string;
  message: string;
}

const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 180_000;

async function filesBelow(root: string): Promise<string[]> {
  const output: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...(await filesBelow(target)));
    else if (entry.isFile() && entry.name.endsWith(".test.ts"))
      output.push(target);
  }
  return output;
}

@Provide()
export class OpenIssueTestRunnerService {
  @Inject()
  access: OpenIssueAccessService;

  private running = false;
  private lastResult: TestRunResult | null = null;

  private assertAdmin() {
    if (!this.access.isSystemAdmin())
      throw new CoolCommException("仅 Host 系统管理员可运行单元测试", 403);
  }

  private async repoRoot(): Promise<string | null> {
    if (process.env.NODE_ENV === "production") return null;
    try {
      const linkedModule = await realpath(
        path.join(process.cwd(), "src/modules/phoenix-open-issue")
      );
      const root = path.resolve(linkedModule, "../../../..");
      const packageJson = JSON.parse(
        await readFile(path.join(root, "package.json"), "utf8")
      ) as { name?: string; scripts?: Record<string, string> };
      if (
        packageJson.name !== "phoenix-open-issue" ||
        !packageJson.scripts?.["admin-plugin:test-core"]
      )
        return null;
      await stat(path.join(root, "node_modules/.bin/vitest"));
      return root;
    } catch {
      return null;
    }
  }

  async isAvailable() {
    return Boolean(await this.repoRoot());
  }

  async listFiles(): Promise<TestFileInfo[]> {
    this.assertAdmin();
    const root = await this.repoRoot();
    if (!root) return [];
    const roots = [
      path.join(root, "packages/admin-plugin/test"),
      path.join(root, "packages/admin-plugin/vue/phoenix-open-issue"),
    ];
    const files: string[] = [];
    for (const candidate of roots) {
      try {
        files.push(...(await filesBelow(candidate)));
      } catch {
        // A package may legitimately have no test directory yet.
      }
    }
    return Promise.all(
      files.sort().map(async (file) => ({
        filePath: path.relative(root, file),
        packageName: file.includes("/midway/") ? "midway" : "core",
        caseCount: countDeclaredTestCases(await readFile(file, "utf8")),
      }))
    );
  }

  async status() {
    this.assertAdmin();
    return {
      running: this.running,
      available: await this.isAvailable(),
      lastResult: this.lastResult,
    };
  }

  async runAll(): Promise<TestRunResult> {
    this.assertAdmin();
    if (this.running) throw new CoolCommException("测试正在运行中", 409);
    const root = await this.repoRoot();
    if (!root)
      throw new CoolCommException("当前环境未提供 Open Issue 测试运行器", 503);

    this.running = true;
    const startedAt = Date.now();
    const runId = randomUUID();
    try {
      const execution = await new Promise<{ code: number; output: string }>(
        (resolve, reject) => {
          const child = spawn("pnpm", ["admin-plugin:test-core"], {
            cwd: root,
            env: { ...process.env, CI: "1", FORCE_COLOR: "0" },
            shell: false,
            stdio: ["ignore", "pipe", "pipe"],
          });
          let output = "";
          let overflow = false;
          const append = (chunk: Buffer) => {
            if (overflow) return;
            output += chunk.toString("utf8");
            if (Buffer.byteLength(output) > MAX_OUTPUT_BYTES) {
              overflow = true;
              child.kill("SIGTERM");
            }
          };
          child.stdout.on("data", append);
          child.stderr.on("data", append);
          child.once("error", reject);
          const timer = setTimeout(() => child.kill("SIGTERM"), TIMEOUT_MS);
          child.once("close", (code) => {
            clearTimeout(timer);
            if (overflow)
              return reject(new Error("测试输出超过 2 MiB，已终止"));
            resolve({ code: code ?? 1, output });
          });
        }
      );
      const summary = summarizeVitestOutput(
        execution.output,
        execution.code,
        Date.now() - startedAt
      );
      this.lastResult = {
        exitCode: execution.code,
        summary,
        reportUrl: "",
        ranAt: new Date().toISOString(),
        runId,
        message: summary.success ? "全部通过" : "存在失败用例",
      };
      return this.lastResult;
    } finally {
      this.running = false;
    }
  }
}
