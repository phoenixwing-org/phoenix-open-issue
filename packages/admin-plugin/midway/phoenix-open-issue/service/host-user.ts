import { InjectDataSource } from "@midwayjs/typeorm";
import { CoolCommException } from "@cool-midway/core";
import { Provide } from "@midwayjs/core";
import { DataSource } from "typeorm";

export interface HostUserRow {
  id: string | number;
  username: string;
  name: string | null;
  nickName: string | null;
  status: number;
}

export interface HostUserIdentity {
  id: string;
  username: string;
  displayName: string | null;
  status: number;
}

function nonBlank(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function toHostUserIdentity(user: HostUserRow): HostUserIdentity {
  const username = nonBlank(user.username) || String(user.id);
  return {
    id: String(user.id),
    username,
    displayName: nonBlank(user.name) || nonBlank(user.nickName) || null,
    status: user.status,
  };
}

export function hostUserLabel(user: HostUserRow): string {
  const identity = toHostUserIdentity(user);
  return identity.displayName && identity.displayName !== identity.username
    ? `${identity.displayName}（${identity.username}）`
    : identity.displayName || identity.username;
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

  async identities(
    ids: Array<string | null | undefined>
  ): Promise<Map<string, HostUserIdentity>> {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (!unique.length) return new Map();
    const rows = (await this.dataSource.query(
      `SELECT id, username, name, "nickName", status
         FROM base_sys_user WHERE id = ANY($1::bigint[])`,
      [unique]
    )) as HostUserRow[];
    return new Map(rows.map(user => {
      const identity = toHostUserIdentity(user);
      return [identity.id, identity];
    }));
  }

  async names(ids: Array<string | null | undefined>): Promise<Map<string, string>> {
    const identities = await this.identities(ids);
    return new Map(
      [...identities.values()].map(user => [
        user.id,
        user.displayName && user.displayName !== user.username
          ? `${user.displayName}（${user.username}）`
          : user.displayName || user.username,
      ])
    );
  }
}
