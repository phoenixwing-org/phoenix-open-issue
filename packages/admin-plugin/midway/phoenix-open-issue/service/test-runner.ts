import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import * as path from "node:path";
import { Provide } from "@midwayjs/core";
import { CoolCommException } from "@cool-midway/core";
import {
  countDeclaredTestCases,
  OPEN_ISSUE_CONTROLLED_TEST_CASE_COUNT,
  OPEN_ISSUE_CONTROLLED_TEST_CONFIG_PATH,
  OPEN_ISSUE_CONTROLLED_TEST_DECLARATION_PATH,
  OPEN_ISSUE_CONTROLLED_TEST_FILE_COUNT,
  OPEN_ISSUE_CONTROLLED_TEST_FILES,
  OPEN_ISSUE_CONTROLLED_TEST_SUITE_ID,
  OPEN_ISSUE_CONTROLLED_TEST_TOOL_VERSION_RANGE,
  summarizeVitestOutput,
  type OpenIssueDeclaredTestFile,
  type OpenIssueTestSummary,
} from "../domain/test-runner";

export const OPEN_ISSUE_CONTROLLED_TOOL_PROFILE_ENV =
  "PHOENIX_HUB_CONTROLLED_TOOL_PROFILE";
export const OPEN_ISSUE_CONTROLLED_TOOL_PROFILE_MAX_BYTES = 16_384;
export const OPEN_ISSUE_CONTROLLED_TOOL_PROFILE_ID =
  "pnh.controlled.vitest";
export const OPEN_ISSUE_CONTROLLED_TOOL_ID = "vitest";
export const OPEN_ISSUE_CONTROLLED_TOOL_VERSION = "3.2.7";
export const OPEN_ISSUE_CONTROLLED_TOOL_PACKAGE_HASH_FORMAT =
  "pnh-package-sha256-v1";

export const OPEN_ISSUE_TEST_RUNNER_MAX_CONCURRENCY = 1;
export const OPEN_ISSUE_TEST_RUNNER_MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
export const OPEN_ISSUE_TEST_RUNNER_TIMEOUT_MS = 180_000;
const TERMINATE_GRACE_MS = 2_000;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export type OpenIssueTestRunnerReasonCode =
  | "PRODUCTION_DISABLED"
  | "PRODUCT_ROOT_UNAVAILABLE"
  | "PROFILE_MISSING"
  | "PROFILE_TOO_LARGE"
  | "PROFILE_NOT_SINGLE_LINE"
  | "PROFILE_JSON_INVALID"
  | "PROFILE_SCHEMA_INVALID"
  | "PROFILE_IDENTITY_MISMATCH"
  | "PROFILE_VERSION_UNSUPPORTED"
  | "PROFILE_HOST_UNAVAILABLE"
  | "PROFILE_PATH_INVALID"
  | "PROFILE_PACKAGE_IDENTITY_MISMATCH"
  | "PROFILE_LOCK_IDENTITY_MISMATCH"
  | "PROFILE_LOCK_INTEGRITY_MISMATCH"
  | "PROFILE_LOCKFILE_SHA_MISMATCH"
  | "PROFILE_ENTRYPOINT_SHA_MISMATCH"
  | "PROFILE_PACKAGE_SHA_MISMATCH"
  | "DECLARATION_UNAVAILABLE"
  | "DECLARATION_INVALID"
  | "DECLARATION_IDENTITY_MISMATCH"
  | "DECLARATION_CONFIG_SHA_MISMATCH"
  | "DECLARATION_TEST_SHA_MISMATCH"
  | "DECLARATION_TEST_COUNT_MISMATCH";

interface AvailableControlledToolProfile {
  schemaVersion: 1;
  profileId: typeof OPEN_ISSUE_CONTROLLED_TOOL_PROFILE_ID;
  toolId: typeof OPEN_ISSUE_CONTROLLED_TOOL_ID;
  toolVersion: typeof OPEN_ISSUE_CONTROLLED_TOOL_VERSION;
  availability: "available";
  hostRootRealpath: string;
  packageRootRealpath: string;
  entrypointRealpath: string;
  lockfileRealpath: string;
  lockSpecifier: string;
  lockIntegrity: string;
  lockfileSha256: string;
  entrypointSha256: string;
  packageSha256: string;
  packageHashFormat: typeof OPEN_ISSUE_CONTROLLED_TOOL_PACKAGE_HASH_FORMAT;
  packageFileCount: number;
}

interface DeclaredTestFile extends OpenIssueDeclaredTestFile {
  sha256: string;
}

interface ControlledTestDeclaration {
  schemaVersion: 1;
  suiteId: typeof OPEN_ISSUE_CONTROLLED_TEST_SUITE_ID;
  pluginId: "phoenix-open-issue";
  toolId: typeof OPEN_ISSUE_CONTROLLED_TOOL_ID;
  toolVersionRange: typeof OPEN_ISSUE_CONTROLLED_TEST_TOOL_VERSION_RANGE;
  config: {
    path: typeof OPEN_ISSUE_CONTROLLED_TEST_CONFIG_PATH;
    sha256: string;
  };
  expectedFileCount: number;
  expectedCaseCount: number;
  tests: DeclaredTestFile[];
}

export interface OpenIssueTestCatalogSnapshot {
  files: readonly OpenIssueDeclaredTestFile[];
  fileCount: number;
  caseCount: number;
  available: boolean;
  reasonCode: OpenIssueTestRunnerReasonCode | string | null;
  profileFingerprint: string;
  declarationFingerprint: string | null;
}

interface AvailableTestRunnerContext extends OpenIssueTestCatalogSnapshot {
  available: true;
  reasonCode: null;
  declarationFingerprint: string;
  productRoot: string;
  profile: AvailableControlledToolProfile;
  declaration: ControlledTestDeclaration;
  configPath: string;
  testPaths: string[];
}

interface UnavailableTestRunnerContext extends OpenIssueTestCatalogSnapshot {
  available: false;
  reasonCode: OpenIssueTestRunnerReasonCode | string;
}

export type OpenIssueTestRunnerContext =
  | AvailableTestRunnerContext
  | UnavailableTestRunnerContext;

export interface OpenIssueTestExecutionPlan {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  shell: false;
  profileFingerprint: string;
  declarationFingerprint: string;
}

interface TestRunResult {
  exitCode: number;
  summary: OpenIssueTestSummary;
  reportUrl: string;
  ranAt: string;
  runId: string;
  message: string;
  profileFingerprint: string;
  declarationFingerprint: string;
}

class RunnerValidationError extends Error {
  constructor(readonly code: OpenIssueTestRunnerReasonCode | string) {
    super(code);
  }
}

function fail(code: OpenIssueTestRunnerReasonCode | string): never {
  throw new RunnerValidationError(code);
}

function sha256(content: Buffer | string): string {
  return createHash("sha256").update(content).digest("hex");
}

function profileFingerprint(rawProfile: string | undefined): string {
  return sha256(
    Buffer.from(
      rawProfile === undefined
        ? "open-issue-controlled-profile:missing"
        : `open-issue-controlled-profile:${rawProfile}`,
      "utf8"
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[]
): boolean {
  const actual = Object.keys(value).sort();
  return (
    actual.length === expected.length &&
    [...expected].sort().every((key, index) => actual[index] === key)
  );
}

function contained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

function realDirectory(candidate: string): string {
  if (!path.isAbsolute(candidate) || path.resolve(candidate) !== candidate)
    return fail("PROFILE_PATH_INVALID");
  try {
    const resolved = realpathSync(candidate);
    if (resolved !== candidate || !lstatSync(resolved).isDirectory())
      return fail("PROFILE_PATH_INVALID");
    return resolved;
  } catch {
    return fail("PROFILE_PATH_INVALID");
  }
}

function realRegularFile(candidate: string): string {
  if (!path.isAbsolute(candidate) || path.resolve(candidate) !== candidate)
    return fail("PROFILE_PATH_INVALID");
  try {
    const resolved = realpathSync(candidate);
    if (resolved !== candidate || !lstatSync(resolved).isFile())
      return fail("PROFILE_PATH_INVALID");
    return resolved;
  } catch {
    return fail("PROFILE_PATH_INVALID");
  }
}

function packageHash(packageRoot: string): { sha256: string; fileCount: number } {
  const files: string[] = [];
  const visit = (directory: string): void => {
    const entries = readdirSync(directory, { withFileTypes: true }).sort(
      (left, right) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0
    );
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) return fail("PROFILE_PACKAGE_SHA_MISMATCH");
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push(absolute);
      else return fail("PROFILE_PACKAGE_SHA_MISMATCH");
    }
  };
  visit(packageRoot);
  const hash = createHash("sha256");
  for (const file of files) {
    const relative = path.relative(packageRoot, file).split(path.sep).join("/");
    hash.update(Buffer.from(relative, "utf8"));
    hash.update(Buffer.from([0]));
    hash.update(readFileSync(file));
    hash.update(Buffer.from([0]));
  }
  return { sha256: hash.digest("hex"), fileCount: files.length };
}

function indentation(line: string): number {
  return line.length - line.trimStart().length;
}

function childBlock(
  lines: readonly string[],
  startIndex: number,
  parentIndent: number
): readonly string[] {
  const result: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (line.trim() && indentation(line) <= parentIndent) break;
    result.push(line);
  }
  return result;
}

function findLine(
  lines: readonly string[],
  exactTrimmed: string,
  indent: number
): number {
  return lines.findIndex(
    (line) => indentation(line) === indent && line.trim() === exactTrimmed
  );
}

function lockEvidence(lockfile: string): {
  specifier: string;
  integrity: string;
} {
  const lines = lockfile.split(/\r?\n/);
  const importersIndex = findLine(lines, "importers:", 0);
  if (importersIndex < 0) return fail("PROFILE_LOCK_IDENTITY_MISMATCH");
  const importers = childBlock(lines, importersIndex, 0);
  const rootImporterIndex = findLine(importers, ".:", 2);
  if (rootImporterIndex < 0)
    return fail("PROFILE_LOCK_IDENTITY_MISMATCH");
  const rootImporter = childBlock(importers, rootImporterIndex, 2);
  const toolIndex = findLine(rootImporter, "vitest:", 6);
  if (toolIndex < 0) return fail("PROFILE_LOCK_IDENTITY_MISMATCH");
  const toolBlock = childBlock(rootImporter, toolIndex, 6);
  const specifierLine = toolBlock.find(
    (line) =>
      indentation(line) === 8 && line.trimStart().startsWith("specifier:")
  );
  const versionLine = toolBlock.find(
    (line) =>
      indentation(line) === 8 && line.trimStart().startsWith("version:")
  );
  const specifier = specifierLine
    ?.slice(specifierLine.indexOf(":") + 1)
    .trim();
  const version = versionLine?.slice(versionLine.indexOf(":") + 1).trim();
  if (
    !specifier ||
    !version ||
    (version !== OPEN_ISSUE_CONTROLLED_TOOL_VERSION &&
      !version.startsWith(`${OPEN_ISSUE_CONTROLLED_TOOL_VERSION}(`))
  )
    return fail("PROFILE_LOCK_IDENTITY_MISMATCH");

  const packagesIndex = findLine(lines, "packages:", 0);
  if (packagesIndex < 0) return fail("PROFILE_LOCK_IDENTITY_MISMATCH");
  const packages = childBlock(lines, packagesIndex, 0);
  const packageIndex = packages.findIndex((line) => {
    if (indentation(line) !== 2) return false;
    const key = line.trim().replace(/:$/, "").replace(/^['"]|['"]$/g, "");
    return key === `vitest@${OPEN_ISSUE_CONTROLLED_TOOL_VERSION}`;
  });
  if (packageIndex < 0) return fail("PROFILE_LOCK_IDENTITY_MISMATCH");
  const packageBlock = childBlock(packages, packageIndex, 2);
  const resolution = packageBlock.find(
    (line) =>
      indentation(line) === 4 && line.trimStart().startsWith("resolution:")
  );
  const integrity = resolution?.match(/integrity:\s*([^,}\s]+)/)?.[1];
  if (!integrity || !/^sha512-[A-Za-z0-9+/=]+$/.test(integrity))
    return fail("PROFILE_LOCK_INTEGRITY_MISMATCH");
  return { specifier, integrity };
}

function parseAvailableProfile(rawProfile: string): AvailableControlledToolProfile {
  if (Buffer.byteLength(rawProfile, "utf8") > OPEN_ISSUE_CONTROLLED_TOOL_PROFILE_MAX_BYTES)
    return fail("PROFILE_TOO_LARGE");
  if (/\r|\n/.test(rawProfile)) return fail("PROFILE_NOT_SINGLE_LINE");

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawProfile);
  } catch {
    return fail("PROFILE_JSON_INVALID");
  }
  if (!isRecord(parsed)) return fail("PROFILE_SCHEMA_INVALID");

  const baseKeys = [
    "schemaVersion",
    "profileId",
    "toolId",
    "toolVersion",
    "availability",
  ];
  if (parsed.availability === "unavailable") {
    if (
      !hasExactKeys(parsed, [...baseKeys, "unavailableReason"]) ||
      !isRecord(parsed.unavailableReason) ||
      !hasExactKeys(parsed.unavailableReason, ["code", "message"]) ||
      typeof parsed.unavailableReason.code !== "string" ||
      !/^[A-Z][A-Z0-9_]{1,63}$/.test(parsed.unavailableReason.code) ||
      typeof parsed.unavailableReason.message !== "string"
    )
      return fail("PROFILE_SCHEMA_INVALID");
    if (
      parsed.schemaVersion !== 1 ||
      parsed.profileId !== OPEN_ISSUE_CONTROLLED_TOOL_PROFILE_ID ||
      parsed.toolId !== OPEN_ISSUE_CONTROLLED_TOOL_ID ||
      parsed.toolVersion !== OPEN_ISSUE_CONTROLLED_TOOL_VERSION
    )
      return fail("PROFILE_IDENTITY_MISMATCH");
    return fail(`PROFILE_HOST_UNAVAILABLE:${parsed.unavailableReason.code}`);
  }

  const availableKeys = [
    ...baseKeys,
    "hostRootRealpath",
    "packageRootRealpath",
    "entrypointRealpath",
    "lockfileRealpath",
    "lockSpecifier",
    "lockIntegrity",
    "lockfileSha256",
    "entrypointSha256",
    "packageSha256",
    "packageHashFormat",
    "packageFileCount",
  ];
  if (!hasExactKeys(parsed, availableKeys) || parsed.availability !== "available")
    return fail("PROFILE_SCHEMA_INVALID");
  if (
    parsed.schemaVersion !== 1 ||
    parsed.profileId !== OPEN_ISSUE_CONTROLLED_TOOL_PROFILE_ID ||
    parsed.toolId !== OPEN_ISSUE_CONTROLLED_TOOL_ID
  )
    return fail("PROFILE_IDENTITY_MISMATCH");
  if (parsed.toolVersion !== OPEN_ISSUE_CONTROLLED_TOOL_VERSION)
    return fail("PROFILE_VERSION_UNSUPPORTED");
  if (
    typeof parsed.hostRootRealpath !== "string" ||
    typeof parsed.packageRootRealpath !== "string" ||
    typeof parsed.entrypointRealpath !== "string" ||
    typeof parsed.lockfileRealpath !== "string" ||
    typeof parsed.lockSpecifier !== "string" ||
    typeof parsed.lockIntegrity !== "string" ||
    typeof parsed.lockfileSha256 !== "string" ||
    typeof parsed.entrypointSha256 !== "string" ||
    typeof parsed.packageSha256 !== "string" ||
    parsed.packageHashFormat !==
      OPEN_ISSUE_CONTROLLED_TOOL_PACKAGE_HASH_FORMAT ||
    !Number.isSafeInteger(parsed.packageFileCount) ||
    (parsed.packageFileCount as number) <= 0 ||
    !SHA256_PATTERN.test(parsed.lockfileSha256) ||
    !SHA256_PATTERN.test(parsed.entrypointSha256) ||
    !SHA256_PATTERN.test(parsed.packageSha256)
  )
    return fail("PROFILE_SCHEMA_INVALID");
  return parsed as unknown as AvailableControlledToolProfile;
}

function validateProfileIdentity(
  profile: AvailableControlledToolProfile
): AvailableControlledToolProfile {
  const hostRoot = realDirectory(profile.hostRootRealpath);
  const packageRoot = realDirectory(profile.packageRootRealpath);
  const entrypoint = realRegularFile(profile.entrypointRealpath);
  const lockfile = realRegularFile(profile.lockfileRealpath);
  if (
    !contained(hostRoot, packageRoot) ||
    !contained(packageRoot, entrypoint) ||
    !contained(hostRoot, lockfile)
  )
    return fail("PROFILE_PATH_INVALID");

  try {
    if (realpathSync(path.join(hostRoot, "node_modules/vitest")) !== packageRoot)
      return fail("PROFILE_PACKAGE_IDENTITY_MISMATCH");
    if (realpathSync(path.join(hostRoot, "pnpm-lock.yaml")) !== lockfile)
      return fail("PROFILE_LOCK_IDENTITY_MISMATCH");
  } catch {
    return fail("PROFILE_PATH_INVALID");
  }

  let packageJson: {
    name?: unknown;
    version?: unknown;
    type?: unknown;
    bin?: unknown;
  };
  try {
    packageJson = JSON.parse(
      readFileSync(path.join(packageRoot, "package.json"), "utf8")
    );
  } catch {
    return fail("PROFILE_PACKAGE_IDENTITY_MISMATCH");
  }
  const bin = isRecord(packageJson.bin) ? packageJson.bin.vitest : undefined;
  if (
    packageJson.name !== OPEN_ISSUE_CONTROLLED_TOOL_ID ||
    packageJson.version !== OPEN_ISSUE_CONTROLLED_TOOL_VERSION ||
    packageJson.type !== "module" ||
    typeof bin !== "string" ||
    path.isAbsolute(bin) ||
    bin.split(/[\\/]/).includes("..")
  )
    return fail("PROFILE_PACKAGE_IDENTITY_MISMATCH");
  try {
    if (realpathSync(path.resolve(packageRoot, bin)) !== entrypoint)
      return fail("PROFILE_PACKAGE_IDENTITY_MISMATCH");
  } catch {
    return fail("PROFILE_PACKAGE_IDENTITY_MISMATCH");
  }

  const lockfileBytes = readFileSync(lockfile);
  const evidence = lockEvidence(lockfileBytes.toString("utf8"));
  if (evidence.specifier !== profile.lockSpecifier)
    return fail("PROFILE_LOCK_IDENTITY_MISMATCH");
  if (evidence.integrity !== profile.lockIntegrity)
    return fail("PROFILE_LOCK_INTEGRITY_MISMATCH");
  if (sha256(lockfileBytes) !== profile.lockfileSha256)
    return fail("PROFILE_LOCKFILE_SHA_MISMATCH");
  if (sha256(readFileSync(entrypoint)) !== profile.entrypointSha256)
    return fail("PROFILE_ENTRYPOINT_SHA_MISMATCH");
  const contentHash = packageHash(packageRoot);
  if (
    contentHash.sha256 !== profile.packageSha256 ||
    contentHash.fileCount !== profile.packageFileCount
  )
    return fail("PROFILE_PACKAGE_SHA_MISMATCH");
  return profile;
}

function readJsonRecord(file: string): Record<string, unknown> {
  try {
    const value = JSON.parse(readFileSync(file, "utf8"));
    if (!isRecord(value)) return fail("DECLARATION_INVALID");
    return value;
  } catch (error) {
    if (error instanceof RunnerValidationError) throw error;
    return fail("DECLARATION_INVALID");
  }
}

function validateSourceFile(
  productRoot: string,
  relativePath: string,
  expectedSha256: string,
  shaReason: OpenIssueTestRunnerReasonCode
): string {
  if (
    !relativePath ||
    path.isAbsolute(relativePath) ||
    relativePath.split(/[\\/]/).includes("..") ||
    !SHA256_PATTERN.test(expectedSha256)
  )
    return fail("DECLARATION_INVALID");
  const target = path.resolve(productRoot, relativePath);
  if (!contained(productRoot, target)) return fail("DECLARATION_INVALID");
  try {
    if (realpathSync(target) !== target || !lstatSync(target).isFile())
      return fail("DECLARATION_INVALID");
  } catch {
    return fail("DECLARATION_UNAVAILABLE");
  }
  if (sha256(readFileSync(target)) !== expectedSha256) return fail(shaReason);
  return target;
}

function validateDeclaration(productRoot: string): {
  declaration: ControlledTestDeclaration;
  declarationFingerprint: string;
  configPath: string;
  testPaths: string[];
} {
  let packageJson: Record<string, unknown>;
  try {
    packageJson = readJsonRecord(path.join(productRoot, "package.json"));
  } catch {
    return fail("PRODUCT_ROOT_UNAVAILABLE");
  }
  if (packageJson.name !== "phoenix-open-issue")
    return fail("PRODUCT_ROOT_UNAVAILABLE");

  const declarationPath = path.resolve(
    productRoot,
    OPEN_ISSUE_CONTROLLED_TEST_DECLARATION_PATH
  );
  let rawDeclaration: Buffer;
  try {
    if (
      !contained(productRoot, declarationPath) ||
      realpathSync(declarationPath) !== declarationPath ||
      !lstatSync(declarationPath).isFile()
    )
      return fail("DECLARATION_UNAVAILABLE");
    rawDeclaration = readFileSync(declarationPath);
  } catch {
    return fail("DECLARATION_UNAVAILABLE");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawDeclaration.toString("utf8"));
  } catch {
    return fail("DECLARATION_INVALID");
  }
  if (
    !isRecord(parsed) ||
    !hasExactKeys(parsed, [
      "schemaVersion",
      "suiteId",
      "pluginId",
      "toolId",
      "toolVersionRange",
      "config",
      "expectedFileCount",
      "expectedCaseCount",
      "tests",
    ]) ||
    parsed.schemaVersion !== 1 ||
    parsed.suiteId !== OPEN_ISSUE_CONTROLLED_TEST_SUITE_ID ||
    parsed.pluginId !== "phoenix-open-issue" ||
    parsed.toolId !== OPEN_ISSUE_CONTROLLED_TOOL_ID ||
    parsed.toolVersionRange !== OPEN_ISSUE_CONTROLLED_TEST_TOOL_VERSION_RANGE ||
    parsed.expectedFileCount !== OPEN_ISSUE_CONTROLLED_TEST_FILE_COUNT ||
    parsed.expectedCaseCount !== OPEN_ISSUE_CONTROLLED_TEST_CASE_COUNT ||
    !isRecord(parsed.config) ||
    !hasExactKeys(parsed.config, ["path", "sha256"]) ||
    parsed.config.path !== OPEN_ISSUE_CONTROLLED_TEST_CONFIG_PATH ||
    typeof parsed.config.sha256 !== "string" ||
    !Array.isArray(parsed.tests) ||
    parsed.tests.length !== OPEN_ISSUE_CONTROLLED_TEST_FILE_COUNT
  )
    return fail("DECLARATION_IDENTITY_MISMATCH");

  const tests: DeclaredTestFile[] = [];
  for (let index = 0; index < parsed.tests.length; index += 1) {
    const item = parsed.tests[index];
    const catalog = OPEN_ISSUE_CONTROLLED_TEST_FILES[index];
    if (
      !isRecord(item) ||
      !hasExactKeys(item, [
        "id",
        "filePath",
        "packageName",
        "caseCount",
        "sha256",
      ]) ||
      item.id !== catalog.id ||
      item.filePath !== catalog.filePath ||
      item.packageName !== catalog.packageName ||
      item.caseCount !== catalog.caseCount ||
      typeof item.sha256 !== "string" ||
      !SHA256_PATTERN.test(item.sha256)
    )
      return fail("DECLARATION_IDENTITY_MISMATCH");
    tests.push(item as unknown as DeclaredTestFile);
  }

  const configPath = validateSourceFile(
    productRoot,
    parsed.config.path as string,
    parsed.config.sha256 as string,
    "DECLARATION_CONFIG_SHA_MISMATCH"
  );
  const testPaths = tests.map((item) => {
    const testPath = validateSourceFile(
      productRoot,
      item.filePath,
      item.sha256,
      "DECLARATION_TEST_SHA_MISMATCH"
    );
    if (
      countDeclaredTestCases(readFileSync(testPath, "utf8")) !== item.caseCount
    )
      return fail("DECLARATION_TEST_COUNT_MISMATCH");
    return testPath;
  });
  if (
    tests.reduce((total, item) => total + item.caseCount, 0) !==
    OPEN_ISSUE_CONTROLLED_TEST_CASE_COUNT
  )
    return fail("DECLARATION_TEST_COUNT_MISMATCH");

  return {
    declaration: parsed as unknown as ControlledTestDeclaration,
    declarationFingerprint: sha256(rawDeclaration),
    configPath,
    testPaths,
  };
}

function publicCatalog(
  available: boolean,
  reasonCode: OpenIssueTestRunnerReasonCode | string | null,
  fingerprint: string,
  declarationFingerprint: string | null = null
): OpenIssueTestCatalogSnapshot {
  return {
    files: OPEN_ISSUE_CONTROLLED_TEST_FILES,
    fileCount: OPEN_ISSUE_CONTROLLED_TEST_FILE_COUNT,
    caseCount: OPEN_ISSUE_CONTROLLED_TEST_CASE_COUNT,
    available,
    reasonCode,
    profileFingerprint: fingerprint,
    declarationFingerprint,
  };
}

export function resolveOpenIssueTestRunnerContext(options: {
  productRoot: string | null;
  rawProfile: string | undefined;
  nodeEnv: string | undefined;
}): OpenIssueTestRunnerContext {
  const fingerprint = profileFingerprint(options.rawProfile);
  if (options.nodeEnv === "production")
    return publicCatalog(false, "PRODUCTION_DISABLED", fingerprint) as UnavailableTestRunnerContext;
  if (options.rawProfile === undefined || options.rawProfile === "")
    return publicCatalog(false, "PROFILE_MISSING", fingerprint) as UnavailableTestRunnerContext;
  if (!options.productRoot)
    return publicCatalog(false, "PRODUCT_ROOT_UNAVAILABLE", fingerprint) as UnavailableTestRunnerContext;

  try {
    const profile = validateProfileIdentity(
      parseAvailableProfile(options.rawProfile)
    );
    const source = validateDeclaration(options.productRoot);
    return {
      ...publicCatalog(
        true,
        null,
        fingerprint,
        source.declarationFingerprint
      ),
      available: true,
      reasonCode: null,
      productRoot: options.productRoot,
      profile,
      declaration: source.declaration,
      configPath: source.configPath,
      testPaths: source.testPaths,
    };
  } catch (error) {
    const code =
      error instanceof RunnerValidationError
        ? error.code
        : "PROFILE_SCHEMA_INVALID";
    return publicCatalog(false, code, fingerprint) as UnavailableTestRunnerContext;
  }
}

export function buildOpenIssueTestExecutionPlan(
  context: AvailableTestRunnerContext,
  sourceEnv: NodeJS.ProcessEnv = process.env
): OpenIssueTestExecutionPlan {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(sourceEnv)) {
    if (
      value === undefined ||
      key === "NODE_OPTIONS" ||
      key === "NODE_PATH" ||
      key === OPEN_ISSUE_CONTROLLED_TOOL_PROFILE_ENV ||
      key.startsWith("VITEST_")
    )
      continue;
    env[key] = value;
  }
  env.CI = "1";
  env.FORCE_COLOR = "0";
  env.NO_COLOR = "1";
  return {
    command: process.execPath,
    args: [
      context.profile.entrypointRealpath,
      "run",
      "--config",
      context.configPath,
      "--reporter=basic",
      ...context.testPaths,
    ],
    cwd: context.productRoot,
    env,
    shell: false,
    profileFingerprint: context.profileFingerprint,
    declarationFingerprint: context.declarationFingerprint,
  };
}

export async function executeOpenIssueTestExecutionPlan(
  plan: OpenIssueTestExecutionPlan
): Promise<{ code: number; output: string; durationMs: number }> {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(plan.command, plan.args, {
      cwd: plan.cwd,
      env: plan.env,
      shell: plan.shell,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let outputBytes = 0;
    let overflow = false;
    let timedOut = false;
    let settled = false;
    const append = (chunk: Buffer) => {
      if (overflow) return;
      outputBytes += chunk.byteLength;
      if (outputBytes > OPEN_ISSUE_TEST_RUNNER_MAX_OUTPUT_BYTES) {
        overflow = true;
        child.kill("SIGTERM");
        return;
      }
      output += chunk.toString("utf8");
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    const forceTimer = { current: undefined as NodeJS.Timeout | undefined };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      forceTimer.current = setTimeout(
        () => child.kill("SIGKILL"),
        TERMINATE_GRACE_MS
      );
    }, OPEN_ISSUE_TEST_RUNNER_TIMEOUT_MS);
    child.once("close", (code) => {
      clearTimeout(timer);
      if (forceTimer.current) clearTimeout(forceTimer.current);
      if (settled) return;
      settled = true;
      if (overflow) return reject(new Error("OUTPUT_LIMIT_EXCEEDED"));
      if (timedOut) return reject(new Error("EXECUTION_TIMEOUT"));
      resolve({
        code: code ?? 1,
        output,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}

@Provide()
export class OpenIssueTestRunnerService {
  private running = false;
  private lastResult: TestRunResult | null = null;

  private productRoot(): string | null {
    try {
      const linkedModule = realpathSync(
        path.join(process.cwd(), "src/modules/phoenix-open-issue")
      );
      const root = path.resolve(linkedModule, "../../../..");
      const relativeModule = path
        .relative(root, linkedModule)
        .split(path.sep)
        .join("/");
      if (
        relativeModule !==
        "packages/admin-plugin/midway/phoenix-open-issue"
      )
        return null;
      return root;
    } catch {
      return null;
    }
  }

  private context(): OpenIssueTestRunnerContext {
    return resolveOpenIssueTestRunnerContext({
      productRoot: this.productRoot(),
      rawProfile: process.env[OPEN_ISSUE_CONTROLLED_TOOL_PROFILE_ENV],
      nodeEnv: process.env.NODE_ENV,
    });
  }

  async catalog(): Promise<OpenIssueTestCatalogSnapshot> {
    const context = this.context();
    return publicCatalog(
      context.available,
      context.reasonCode,
      context.profileFingerprint,
      context.declarationFingerprint
    );
  }

  async isAvailable(): Promise<boolean> {
    return this.context().available;
  }

  async listFiles(): Promise<readonly OpenIssueDeclaredTestFile[]> {
    return OPEN_ISSUE_CONTROLLED_TEST_FILES;
  }

  async status() {
    const catalog = await this.catalog();
    return {
      running: this.running,
      ...catalog,
      lastResult: this.lastResult,
    };
  }

  async runAll(): Promise<TestRunResult> {
    if (this.running) throw new CoolCommException("测试正在运行中", 409);
    const context = this.context();
    if (!context.available)
      throw new CoolCommException(
        `当前环境拒绝运行 Open Issue 测试（${context.reasonCode}）`,
        503
      );

    this.running = true;
    const runId = randomUUID();
    try {
      const plan = buildOpenIssueTestExecutionPlan(context);
      const execution = await executeOpenIssueTestExecutionPlan(plan);
      const parsed = summarizeVitestOutput(
        execution.output,
        execution.code,
        execution.durationMs
      );
      const expectedCounts =
        parsed.filesTotal === OPEN_ISSUE_CONTROLLED_TEST_FILE_COUNT &&
        parsed.total === OPEN_ISSUE_CONTROLLED_TEST_CASE_COUNT;
      const summary: OpenIssueTestSummary = {
        ...parsed,
        success: parsed.success && expectedCounts,
      };
      this.lastResult = {
        exitCode: execution.code,
        summary,
        reportUrl: "",
        ranAt: new Date().toISOString(),
        runId,
        message: !expectedCounts
          ? `测试数量不匹配，期望 ${OPEN_ISSUE_CONTROLLED_TEST_FILE_COUNT} 文件 / ${OPEN_ISSUE_CONTROLLED_TEST_CASE_COUNT} 用例`
          : summary.success
          ? "全部通过"
          : "存在失败用例",
        profileFingerprint: plan.profileFingerprint,
        declarationFingerprint: plan.declarationFingerprint,
      };
      return this.lastResult;
    } catch {
      throw new CoolCommException(
        "受控测试进程执行失败（EXECUTION_FAILED）",
        500
      );
    } finally {
      this.running = false;
    }
  }
}
