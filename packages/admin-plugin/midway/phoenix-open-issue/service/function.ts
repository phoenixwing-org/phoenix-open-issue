import { randomUUID } from "node:crypto";
import { Inject, Provide } from "@midwayjs/core";
import { InjectDataSource, InjectEntityModel } from "@midwayjs/typeorm";
import { CoolCommException } from "@cool-midway/core";
import { DataSource, Repository } from "typeorm";
import {
  functionNaturalKey,
  normalizeFunctionImportRows,
  normalizeFunctionInput,
  normalizeFunctionUpdate,
  type OpenIssueFunctionInput,
} from "../domain/function";
import { OpenIssueFunctionEntity } from "../entity/function";
import { OpenIssueAccessService } from "./access";

@Provide()
export class OpenIssueFunctionService {
  @Inject()
  access: OpenIssueAccessService;

  @InjectEntityModel(OpenIssueFunctionEntity)
  repository: Repository<OpenIssueFunctionEntity>;

  @InjectDataSource()
  dataSource: DataSource;

  private failInput(error: unknown): never {
    throw new CoolCommException(
      error instanceof Error ? error.message : "功能数据无效",
      400
    );
  }

  private assertAdmin() {
    if (!this.access.isSystemAdmin())
      throw new CoolCommException("仅 Host 系统管理员可维护功能表", 403);
  }

  async list(query: Record<string, unknown>) {
    const builder = this.repository
      .createQueryBuilder("func")
      .where("func.enabled = 1");
    if (typeof query.search === "string" && query.search.trim()) {
      builder.andWhere(
        "(func.functionName ILIKE :search OR func.platform ILIKE :search OR func.externalId ILIKE :search)",
        { search: `%${query.search.trim()}%` }
      );
    }
    if (typeof query.platform === "string" && query.platform.trim()) {
      builder.andWhere("func.platform = :platform", {
        platform: query.platform.trim(),
      });
    }

    const [field, directionValue] =
      typeof query.sort === "string" ? query.sort.split(":") : [];
    const direction = directionValue === "asc" ? "ASC" : "DESC";
    const fields: Record<string, string> = {
      platform: "func.platform",
      externalId: "func.externalId",
      functionName: "func.functionName",
      targetYear: "func.targetYear",
      createdAt: "func.createdAt",
    };
    if (field && fields[field]) {
      if (field === "externalId" && String(query.numericSort) === "1") {
        builder
          .orderBy(
            "CASE WHEN func.externalId ~ '^[0-9]+$' THEN 0 ELSE 1 END",
            "ASC"
          )
          .addOrderBy(
            "CASE WHEN func.externalId ~ '^[0-9]+$' THEN CAST(func.externalId AS NUMERIC) END",
            direction
          )
          .addOrderBy("func.externalId", direction);
      } else {
        builder.orderBy(fields[field], direction);
      }
    } else {
      builder
        .orderBy("func.platform", "ASC")
        .addOrderBy("func.externalId", "ASC");
    }
    return builder.getMany();
  }

  async get(id: string) {
    const item = await this.repository.findOneBy({ id });
    if (!item) throw new CoolCommException("功能不存在", 404);
    return item;
  }

  async create(value: unknown) {
    this.assertAdmin();
    let input;
    try {
      input = normalizeFunctionInput(value);
    } catch (error) {
      this.failInput(error);
    }
    const existing = await this.repository.findOneBy({
      platform: input.platform,
      externalId: input.externalId,
    });
    const now = new Date().toISOString();
    if (existing) {
      if (existing.enabled === 1)
        throw new CoolCommException(
          `功能已存在：平台“${input.platform}”下的 ID“${input.externalId}”`,
          409
        );
      Object.assign(existing, input, { enabled: 1, updatedAt: now });
      return this.repository.save(existing);
    }
    return this.repository.save(
      this.repository.create({
        id: randomUUID(),
        ...input,
        enabled: 1,
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  async update(id: string, value: unknown) {
    this.assertAdmin();
    const item = await this.get(id);
    let input;
    try {
      input = normalizeFunctionUpdate(value);
    } catch (error) {
      this.failInput(error);
    }
    const platform = input.platform ?? item.platform;
    const externalId = input.externalId ?? item.externalId;
    const duplicate = await this.repository.findOneBy({ platform, externalId });
    if (duplicate && duplicate.id !== id)
      throw new CoolCommException(
        `功能已存在：平台“${platform}”下的 ID“${externalId}”`,
        409
      );
    Object.assign(item, input, { updatedAt: new Date().toISOString() });
    return this.repository.save(item);
  }

  async delete(id: string) {
    this.assertAdmin();
    const item = await this.get(id);
    item.enabled = 0;
    item.updatedAt = new Date().toISOString();
    await this.repository.save(item);
  }

  async import(value: unknown) {
    this.assertAdmin();
    let rows: OpenIssueFunctionInput[];
    try {
      rows = normalizeFunctionImportRows(
        (value as { rows?: unknown } | null)?.rows
      );
    } catch (error) {
      this.failInput(error);
    }
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(OpenIssueFunctionEntity);
      const existing = await repository.find();
      const byKey = new Map(
        existing.map((item) => [functionNaturalKey(item), item] as const)
      );
      const now = new Date().toISOString();
      let imported = 0;
      let updated = 0;
      for (const row of rows) {
        const key = functionNaturalKey(row);
        const current = byKey.get(key);
        if (current) {
          Object.assign(current, row, { enabled: 1, updatedAt: now });
          await repository.save(current);
          updated++;
        } else {
          const item = repository.create({
            id: randomUUID(),
            ...row,
            enabled: 1,
            createdAt: now,
            updatedAt: now,
          });
          await repository.save(item);
          byKey.set(key, item);
          imported++;
        }
      }
      return { imported, updated };
    });
  }

  async export() {
    return this.repository.find({
      order: { platform: "ASC", externalId: "ASC" },
    });
  }
}
