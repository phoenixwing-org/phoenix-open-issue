CREATE TABLE IF NOT EXISTS oip_repair_ledger (
  id varchar(36) PRIMARY KEY,
  task varchar(16) NOT NULL,
  "planFingerprint" varchar(64) NOT NULL,
  "actorId" varchar(64) NOT NULL,
  status varchar(16) NOT NULL,
  "planSnapshot" jsonb NOT NULL,
  "resultSnapshot" jsonb,
  error text,
  "startedAt" varchar(32) NOT NULL,
  "finishedAt" varchar(32),
  CONSTRAINT "CHK_oip_repair_ledger_status"
    CHECK (status IN ('running', 'succeeded', 'failed'))
);

CREATE INDEX IF NOT EXISTS "IDX_oip_repair_ledger_task"
  ON oip_repair_ledger (task);
CREATE INDEX IF NOT EXISTS "IDX_oip_repair_ledger_fingerprint"
  ON oip_repair_ledger ("planFingerprint");
CREATE INDEX IF NOT EXISTS "IDX_oip_repair_ledger_actor"
  ON oip_repair_ledger ("actorId");
CREATE INDEX IF NOT EXISTS "IDX_oip_repair_ledger_started"
  ON oip_repair_ledger ("startedAt");
