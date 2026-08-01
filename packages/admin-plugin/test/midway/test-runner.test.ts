import { describe, expect, it } from "vitest";
import {
  countDeclaredTestCases,
  summarizeVitestOutput,
} from "../../midway/phoenix-open-issue/domain/test-runner";

describe("Open Issue 受控测试运行器算法", () => {
  it("只统计 it/test 调用，不依赖测试框架运行时", () => {
    const source =
      "describe('x', () => { " +
      "it" +
      "('a', () => {}); " +
      "test" +
      "('b', () => {}) })";
    expect(
      countDeclaredTestCases(source)
    ).toBe(2);
  });

  it("解析 Vitest 通过汇总并去除 ANSI", () => {
    expect(
      summarizeVitestOutput(
        "\u001b[32m Tests  75 passed (75)\u001b[0m",
        0,
        123.7
      )
    ).toEqual({
      total: 75,
      passed: 75,
      failed: 0,
      pending: 0,
      success: true,
      durationMs: 124,
    });
  });

  it("同时统计失败和跳过用例", () => {
    expect(
      summarizeVitestOutput(
        " Tests  2 failed | 5 passed | 1 skipped (8)",
        1,
        10
      )
    ).toEqual(
      expect.objectContaining({
        total: 8,
        passed: 5,
        failed: 2,
        pending: 1,
        success: false,
      })
    );
  });

  it("异常退出且无汇总时保留失败证据", () => {
    expect(summarizeVitestOutput("spawn failed", 2, 1)).toEqual(
      expect.objectContaining({ total: 1, failed: 1, success: false })
    );
  });
});
