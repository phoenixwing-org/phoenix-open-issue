import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestFiles = [
  "package.json",
  "packages/core/package.json",
  "packages/server/package.json",
  "packages/web/package.json",
  "packages/admin-plugin/package.json",
];
const dependencySections = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];
const expectedWingVersion = "0.7.1";
const expectedPublishedDependencies = {
  "@phoenix-wing/code-core": "0.6.4",
  "@phoenix-wing/db-node": "0.6.3",
};
const wingDependencies = new Map();

for (const relative of manifestFiles) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
  for (const section of dependencySections) {
    for (const [name, specifier] of Object.entries(manifest[section] ?? {})) {
      if (name !== "phoenix-wing" && !name.startsWith("@phoenix-wing/")) continue;
      if (!/^\d+\.\d+\.\d+$/u.test(specifier)) {
        throw new Error(`${relative} ${section}.${name} must use an exact Registry version, got ${specifier}`);
      }
      wingDependencies.set(`${relative}:${name}`, { name, specifier });
    }
  }
  for (const [name, target] of Object.entries(manifest.pnpm?.overrides ?? {})) {
    if (name.includes("phoenix-wing") || String(target).includes("phoenix-wing")) {
      throw new Error(`${relative} must not override Wing through ${name}: ${target}`);
    }
  }
}

if (wingDependencies.size === 0) throw new Error("No Wing dependencies were found");
const versions = new Set([...wingDependencies.values()].map(({ specifier }) => specifier));
if (versions.size !== 1) {
  throw new Error(`Wing dependencies must be lockstep, got ${[...versions].join(", ")}`);
}
if (![...versions].every((version) => version === expectedWingVersion)) {
  throw new Error(`Wing dependencies must use Registry ${expectedWingVersion}, got ${[...versions].join(", ")}`);
}

const lockfile = fs.readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8");
const hasLockResolution = (name, version) =>
  lockfile.includes(`  '${name}@${version}':`) || lockfile.includes(`  ${name}@${version}:`);
if (/(?:link|file):[^\n]*phoenix-wing/iu.test(lockfile)) {
  throw new Error("pnpm-lock.yaml must not resolve Wing from a local path");
}
for (const { name, specifier } of wingDependencies.values()) {
  if (!hasLockResolution(name, specifier)) {
    throw new Error(`pnpm-lock.yaml is missing Registry resolution ${name}@${specifier}`);
  }
}

const installedWingManifestPath = path.join(
  root,
  "packages/web/node_modules/phoenix-wing/package.json",
);
const installedWingRealPath = fs.realpathSync(installedWingManifestPath);
const registryStoreRoot = `${path.join(root, "node_modules/.pnpm")}${path.sep}`;
if (!installedWingRealPath.startsWith(registryStoreRoot)) {
  throw new Error(`phoenix-wing must resolve through the pnpm Registry store, got ${installedWingRealPath}`);
}
const installedWingManifest = JSON.parse(fs.readFileSync(installedWingManifestPath, "utf8"));
if (installedWingManifest.version !== expectedWingVersion) {
  throw new Error(
    `Installed phoenix-wing must be ${expectedWingVersion}, got ${installedWingManifest.version ?? "missing"}`,
  );
}
for (const [name, expectedVersion] of Object.entries(expectedPublishedDependencies)) {
  const publishedVersion = installedWingManifest.dependencies?.[name];
  if (publishedVersion !== expectedVersion) {
    throw new Error(
      `phoenix-wing@${expectedWingVersion} must declare ${name}@${expectedVersion}, got ${publishedVersion ?? "missing"}`,
    );
  }
  if (!hasLockResolution(name, expectedVersion)) {
    throw new Error(`pnpm-lock.yaml is missing the published release dependency ${name}@${expectedVersion}`);
  }
  if (hasLockResolution(name, expectedWingVersion)) {
    throw new Error(`${name} must not be inferred as ${expectedWingVersion}`);
  }
}

const viteConfig = fs.readFileSync(path.join(root, "packages/web/vite.config.ts"), "utf8");
if (/exclude\s*:\s*\[[^\]]*["']phoenix-wing["']/su.test(viteConfig)) {
  throw new Error("packages/web/vite.config.ts must not restore the pre-0.4.2 phoenix-wing optimizeDeps workaround");
}

process.stdout.write(
  `[verify] ${wingDependencies.size} Wing manifest references use Registry ${[
    ...versions,
  ][0]}; published scoped dependencies remain ${Object.entries(expectedPublishedDependencies)
    .map(([name, version]) => `${name}@${version}`)
    .join(", ")}\n`,
);
