import { InjectDataSource } from "@midwayjs/typeorm";
import { CoolCommException } from "@cool-midway/core";
import { Provide } from "@midwayjs/core";
import { DataSource } from "typeorm";

interface HostUserRow {
  id: string | number;
  username: string;
  name: string | null;
  nickName: string | null;
  status: number;
}

@Provide()
export class OpenIssueHostUserService {
  @InjectDataSource()
  dataSource: DataSource;

  async get(id: string): Promise<HostUserRow | null> {
    const rows = (await this.dataSource.query(
      `SELECT id, username, name, "nickName", status
         FROM base_sys_user WHERE id = $1 LIMIT 1`,
      [id]
    )) as HostUserRow[];
    return rows[0] ?? null;
  }

  async assertActive(id: string): Promise<HostUserRow> {
    const user = await this.get(id);
    if (!user || user.status !== 1)
      throw new CoolCommException("接收人不存在或已停用", 400);
    return user;
  }

  async names(ids: Array<string | null | undefined>): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (!unique.length) return new Map();
    const rows = (await this.dataSource.query(
      `SELECT id, username, name, "nickName", status
         FROM base_sys_user WHERE id = ANY($1::bigint[])`,
      [unique]
    )) as HostUserRow[];
    return new Map(
      rows.map(user => [
        String(user.id),
        user.nickName?.trim() || user.name?.trim() || user.username,
      ])
    );
  }
}
