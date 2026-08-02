CREATE TABLE IF NOT EXISTS oip_issue_list (
  id varchar(36) PRIMARY KEY,
  name varchar(120) NOT NULL,
  description text NOT NULL DEFAULT '',
  "listType" varchar(80) NOT NULL,
  "ownerId" varchar(64) NOT NULL,
  "orgUnitId" varchar(64),
  archived smallint NOT NULL DEFAULT 0,
  "isDeleted" smallint NOT NULL DEFAULT 0,
  "deletedAt" varchar(32),
  "createdAt" varchar(32) NOT NULL,
  "updatedAt" varchar(32) NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_1d3b8501dfe0af3fd09e831483"
  ON oip_issue_list ("listType");
CREATE INDEX IF NOT EXISTS "IDX_a467b1c8226d5eb8c30c8fa6b6"
  ON oip_issue_list ("ownerId");
CREATE INDEX IF NOT EXISTS "IDX_c4a50b0a975ea6528a55ce2ab3"
  ON oip_issue_list ("orgUnitId");
CREATE INDEX IF NOT EXISTS "IDX_9be516ad357d6fc1a484abc433"
  ON oip_issue_list (archived);
CREATE INDEX IF NOT EXISTS "IDX_b4925a39c93fdc6844fd069de2"
  ON oip_issue_list ("isDeleted");
CREATE INDEX IF NOT EXISTS "IDX_cd7a412ef3d6a9aa1b255520fa"
  ON oip_issue_list ("updatedAt");

CREATE TABLE IF NOT EXISTS oip_issue_list_member (
  id varchar(36) PRIMARY KEY,
  "listId" varchar(36) NOT NULL,
  "userId" varchar(64) NOT NULL,
  role varchar(16) NOT NULL DEFAULT 'editor',
  "joinedAt" varchar(32) NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_7fc8a53c26b767dfcaa280053c"
  ON oip_issue_list_member ("listId");
CREATE INDEX IF NOT EXISTS "IDX_51cacf6b9ad4bfd4becba10b3a"
  ON oip_issue_list_member ("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_69717e6a2da12772c184a89db1"
  ON oip_issue_list_member ("listId", "userId");

CREATE TABLE IF NOT EXISTS oip_function (
  id varchar(36) PRIMARY KEY,
  platform varchar(120) NOT NULL,
  "externalId" varchar(120) NOT NULL,
  "functionName" varchar(240) NOT NULL,
  "targetYear" varchar(32),
  "clientGroup" varchar(120),
  "developGroup" varchar(120),
  enabled integer NOT NULL DEFAULT 1,
  "createdAt" varchar(32) NOT NULL,
  "updatedAt" varchar(32) NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_9a150d421b93e86a7c061e7f7c"
  ON oip_function (platform);
CREATE INDEX IF NOT EXISTS "IDX_d1518125bcac4886466ffd5498"
  ON oip_function ("functionName");
CREATE INDEX IF NOT EXISTS "IDX_a9c3254d60224f098627687b0b"
  ON oip_function (enabled);
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_4cfdf517fd89328c6dbbb6f865"
  ON oip_function (platform, "externalId");

CREATE TABLE IF NOT EXISTS oip_issue (
  id varchar(36) PRIMARY KEY,
  "listId" varchar(36) NOT NULL,
  "issueNo" varchar(40) NOT NULL,
  title varchar(240) NOT NULL,
  description text NOT NULL DEFAULT '',
  status varchar(20) NOT NULL DEFAULT 'open',
  "closeReason" varchar(32),
  "closedBy" varchar(64),
  priority varchar(20) NOT NULL DEFAULT 'medium',
  severity varchar(20) NOT NULL DEFAULT 'minor',
  category varchar(24),
  "detectionPhase" varchar(24),
  "reporterId" varchar(64),
  "assigneeId" varchar(64),
  "dueDate" varchar(10),
  "completedAt" varchar(32),
  "sortOrder" integer NOT NULL DEFAULT 0,
  extensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  "listCount" integer NOT NULL DEFAULT 1,
  "createdBy" varchar(64) NOT NULL,
  "createdAt" varchar(32) NOT NULL,
  "updatedAt" varchar(32) NOT NULL,
  "functionId" varchar(36)
);

CREATE INDEX IF NOT EXISTS "IDX_5b93bd1abde5d7a2325db01736"
  ON oip_issue ("listId");
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_d22faa4e2c2d7ba2a343a5d75b"
  ON oip_issue ("issueNo");
CREATE INDEX IF NOT EXISTS "IDX_b3289dc04e6605b1c256d31273"
  ON oip_issue (status);
CREATE INDEX IF NOT EXISTS "IDX_200fc87555a7cac6661aa0b8f7"
  ON oip_issue ("updatedAt");
CREATE INDEX IF NOT EXISTS "IDX_4418c474f1a8dc93830349a46a"
  ON oip_issue ("functionId");

CREATE TABLE IF NOT EXISTS oip_issue_list_link (
  id varchar(36) PRIMARY KEY,
  "issueId" varchar(36) NOT NULL,
  "listId" varchar(36) NOT NULL,
  "attentionLevel" smallint NOT NULL DEFAULT 3,
  "attentionUpdatedAt" varchar(32),
  "attentionUpdatedBy" varchar(64),
  "linkedAt" varchar(32) NOT NULL,
  "linkedBy" varchar(64) NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_da9094d2dc5b9cb3675a100748"
  ON oip_issue_list_link ("issueId");
CREATE INDEX IF NOT EXISTS "IDX_a80795115ef80cab4109ce7527"
  ON oip_issue_list_link ("listId");
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_eb1d76009dd5fdc0ef63766134"
  ON oip_issue_list_link ("issueId", "listId");

CREATE TABLE IF NOT EXISTS oip_checkpoint (
  id varchar(36) PRIMARY KEY,
  "issueId" varchar(36) NOT NULL,
  "checkpointDate" varchar(10) NOT NULL,
  deadline varchar(10),
  description text NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'pending',
  "responsibleUserId" varchar(64),
  "sortOrder" integer NOT NULL DEFAULT 0,
  "createdAt" varchar(32) NOT NULL,
  "updatedAt" varchar(32) NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_7465afb0ece1bca72b741e8455"
  ON oip_checkpoint ("issueId");
CREATE INDEX IF NOT EXISTS "IDX_93595a4c7b6e7f85c0994849b5"
  ON oip_checkpoint ("checkpointDate");
CREATE INDEX IF NOT EXISTS "IDX_f4ec8304d03e4f329b3afb8ef0"
  ON oip_checkpoint (status);

CREATE TABLE IF NOT EXISTS oip_eight_d_report (
  id varchar(36) PRIMARY KEY,
  "relatedIssueId" varchar(36),
  title varchar(200) NOT NULL,
  containment text NOT NULL DEFAULT '',
  "rootCause" text NOT NULL DEFAULT '',
  "correctiveAction" text NOT NULL DEFAULT '',
  "createdBy" varchar(64) NOT NULL,
  "createdAt" varchar(32) NOT NULL,
  "updatedAt" varchar(32) NOT NULL,
  "isDeleted" smallint NOT NULL DEFAULT 0,
  "deletedAt" varchar(32)
);

CREATE INDEX IF NOT EXISTS "IDX_7034472a7933e56318203ad139"
  ON oip_eight_d_report ("relatedIssueId");
CREATE INDEX IF NOT EXISTS "IDX_8f8bcbd3e6d14f5ddb34d197fe"
  ON oip_eight_d_report ("createdBy");
CREATE INDEX IF NOT EXISTS "IDX_a432bae16db83feb790a87ea0a"
  ON oip_eight_d_report ("updatedAt");
CREATE INDEX IF NOT EXISTS "IDX_4b4c59c304658c8363789c80ab"
  ON oip_eight_d_report ("isDeleted");

CREATE TABLE IF NOT EXISTS oip_push_record (
  id varchar(36) PRIMARY KEY,
  "fromListId" varchar(36) NOT NULL,
  "targetType" varchar(12) NOT NULL DEFAULT 'list',
  "toListId" varchar(36),
  "toUserId" varchar(64),
  "issueId" varchar(36) NOT NULL,
  "pushedBy" varchar(64) NOT NULL,
  "pushedAt" varchar(32) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'pending',
  "handledBy" varchar(64),
  "handledAt" varchar(32),
  "rejectReason" text,
  note varchar(500) NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS "IDX_7cadfdbf18371efcd0e6375fdc"
  ON oip_push_record ("fromListId");
CREATE INDEX IF NOT EXISTS "IDX_b155e202e9aab617f20129e3a4"
  ON oip_push_record ("toListId");
CREATE INDEX IF NOT EXISTS "IDX_c6369c50fe2b087743af31d7ef"
  ON oip_push_record ("toUserId");
CREATE INDEX IF NOT EXISTS "IDX_51da9139f5a9c1bd6fc079b8bf"
  ON oip_push_record ("issueId");
CREATE INDEX IF NOT EXISTS "IDX_b030c2010ed0772b89596bd41e"
  ON oip_push_record ("pushedBy");
CREATE INDEX IF NOT EXISTS "IDX_d7ea175dcd53841748354f91ac"
  ON oip_push_record ("pushedAt");
CREATE INDEX IF NOT EXISTS "IDX_1f426c130a25319ab8f3172eff"
  ON oip_push_record (status);
