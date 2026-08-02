import { describe, expect, it } from "vitest";
import {
  functionNaturalKey,
  normalizeFunctionEnabledFilter,
  normalizeFunctionEnabledValue,
  normalizeFunctionImportRows,
  normalizeFunctionInput,
  normalizeFunctionUpdate,
} from "../../../midway/phoenix-open-issue/domain/function";

describe("Open Issue 功能简表领域算法", () => {
  it("保留 legacy 字段并规范空白与可选值", () => {
    expect(
      normalizeFunctionInput({
        platform: "  Phoenix  ",
        externalId: "  0012  ",
        functionName: "  问题闭环  ",
        targetYear: "",
        clientGroup: "  汽车  ",
      })
    ).toEqual({
      platform: "Phoenix",
      externalId: "0012",
      functionName: "问题闭环",
      targetYear: null,
      clientGroup: "汽车",
      developGroup: null,
    });
  });

  it("拒绝缺少自然键或名称的记录", () => {
    expect(() =>
      normalizeFunctionInput({ externalId: "1", functionName: "A" })
    ).toThrow("平台");
    expect(() =>
      normalizeFunctionInput({
        platform: "P",
        externalId: "",
        functionName: "A",
      })
    ).toThrow("外部 ID");
  });

  it("更新允许显式清空可选字段但拒绝空更新", () => {
    expect(
      normalizeFunctionUpdate({ targetYear: "", developGroup: null })
    ).toEqual({
      targetYear: null,
      developGroup: null,
    });
    expect(() => normalizeFunctionUpdate({})).toThrow("没有可更新的字段");
  });

  it("批量导入限制为空和数量边界", () => {
    expect(() => normalizeFunctionImportRows([])).toThrow("非空数组");
    expect(() =>
      normalizeFunctionImportRows(
        [
          { platform: "P", externalId: "1", functionName: "A" },
          { platform: "P", externalId: "2", functionName: "B" },
        ],
        1
      )
    ).toThrow("最多导入 1 条");
  });

  it("自然键同时包含平台和外部 ID", () => {
    expect(functionNaturalKey({ platform: "A", externalId: "12" })).not.toBe(
      functionNaturalKey({ platform: "B", externalId: "12" })
    );
  });

  it("状态筛选默认只显示启用项并允许显式恢复停用项", () => {
    expect(normalizeFunctionEnabledFilter(undefined)).toBe(1);
    expect(normalizeFunctionEnabledFilter("disabled")).toBe(0);
    expect(normalizeFunctionEnabledFilter("all")).toBe("all");
    expect(normalizeFunctionEnabledValue(true)).toBe(1);
    expect(normalizeFunctionEnabledValue(false)).toBe(0);
    expect(() => normalizeFunctionEnabledValue("all")).toThrow("功能状态");
  });
});
