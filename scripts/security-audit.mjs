import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const convexDir = path.join(root, "convex");
const failures = [];
const notes = [];

function fail(message) {
  failures.push(message);
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

// This is intentionally a small project-specific regression guard, not a
// replacement for Convex/Vercel/Tauri security tooling.
for (const entry of fs.readdirSync(convexDir, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
  if (["schema.ts", "date.ts", "security.ts", "auth.config.ts", "http.ts"].includes(entry.name)) continue;

  const rel = `convex/${entry.name}`;
  const source = read(rel);
  const exportRegex = /export const\s+(\w+)\s*=\s*(query|mutation|action)\s*\(\{/g;
  const matches = [...source.matchAll(exportRegex)];

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const name = match[1];
    const start = match.index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? source.length) : source.length;
    const block = source.slice(start, end);

    if (!block.includes("args:")) {
      fail(`${rel}:${name} is public but has no Convex args validator`);
    }
    if (!block.includes("getAuthUserId(ctx)")) {
      fail(`${rel}:${name} is public but has no authenticated-user check`);
    }
    if (/migrat|backfill|cleanup|admin/i.test(name)) {
      fail(`${rel}:${name} looks like maintenance code but is client-callable`);
    }
  }
}

// Guard against accidentally introducing common script-injection sinks. React's
// normal text rendering escapes user content; these APIs bypass that protection.
const srcDir = path.join(root, "src");
const sourceFiles = [];
function collectSourceFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectSourceFiles(full);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) sourceFiles.push(full);
  }
}
collectSourceFiles(srcDir);
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, "utf8");
  if (/dangerouslySetInnerHTML|\beval\s*\(|new\s+Function\s*\(|document\.write\s*\(/.test(source)) {
    fail(`${path.relative(root, file)} contains a high-risk dynamic HTML/code execution sink`);
  }
}

// Desktop client env files must contain public VITE_* configuration only.
const desktopEnv = path.join(root, ".env.desktop");
if (fs.existsSync(desktopEnv)) {
  const lines = fs.readFileSync(desktopEnv, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const key = line.slice(0, line.indexOf("=")).trim();
    if (!key.startsWith("VITE_")) fail(`.env.desktop contains non-public variable ${key}`);
  }
}

const migrations = read("convex/migrations.ts");
if (!migrations.includes("internalMutation")) {
  fail("convex/migrations.ts must expose maintenance work only as internal functions");
}

const workouts = read("convex/workouts.ts");
if (/export const\s+backfill\w*\s*=\s*mutation\s*\(/i.test(workouts)) {
  fail("Workout backfill must not be a public mutation");
}

const vercel = JSON.parse(read("vercel.json"));
const serializedHeaders = JSON.stringify(vercel.headers ?? []);
for (const required of [
  "Content-Security-Policy",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
]) {
  if (!serializedHeaders.includes(required)) fail(`vercel.json is missing ${required}`);
}

const tauri = JSON.parse(read("src-tauri/tauri.conf.json"));
const csp = tauri?.app?.security?.csp;
if (!csp || csp === null) fail("Tauri CSP must not be disabled");

if (!fs.existsSync(path.join(root, "package-lock.json"))) {
  notes.push("package-lock.json is not committed yet; generate it once on a machine with npm registry access.");
}

if (failures.length) {
  console.error("\nSecurity audit failed:\n");
  for (const message of failures) console.error(`  - ${message}`);
  process.exit(1);
}

console.log("Security audit passed: public Convex functions are auth-scoped and security policies are present.");
for (const note of notes) console.log(`Note: ${note}`);
