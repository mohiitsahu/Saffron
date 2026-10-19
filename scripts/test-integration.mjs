import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";

const root = fileURLToPath(new URL("..", import.meta.url));
const container = `saffron-test-${randomUUID()}`;
const scratch = mkdtempSync(path.join(tmpdir(), "saffron-integration-"));
let started = false;
let linked = false;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 120_000, ...options });
  if (result.error || result.status !== 0) {
    // Avoid printing connection strings or inherited environment variables.
    throw new Error(`${path.basename(command)} ${args[0]} failed. ${result.error?.code ?? "Check Docker and the test configuration."}`);
  }
  return result.stdout.trim();
}

try {
  run("docker", ["info", "--format", "{{.ServerVersion}}"]);
  console.log("Starting temporary PostgreSQL (postgres:16-alpine)...");
  run("docker", ["run", "--detach", "--rm", "--name", container,
    "-e", "POSTGRES_PASSWORD=saffron_test", "-e", "POSTGRES_DB=saffron_test",
    "-p", "127.0.0.1::5432", "postgres:16-alpine"]);
  started = true;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const result = spawnSync("docker", ["exec", container, "pg_isready", "-U", "postgres", "-d", "saffron_test"], { stdio: "ignore", timeout: 5_000 });
    if (result.status === 0) { ready = true; break; }
    await setTimeout(500);
  }
  if (!ready) throw new Error("Temporary PostgreSQL did not become ready.");
  const binding = run("docker", ["port", container, "5432/tcp"]);
  if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error("Unexpected PostgreSQL port binding.");
  const url = `postgresql://postgres:saffron_test@${binding}/saffron_test?connection_limit=20`;

  // Copy only the schema and migrations. Prisma runs outside the project so it
  // cannot discover the application's .env, including during client generation.
  const schema = readFileSync(path.join(root, "prisma/schema.prisma"), "utf8")
    .replace('provider      = "prisma-client-js"', 'provider = "prisma-client-js"\n  output = "./client"');
  writeFileSync(path.join(scratch, "schema.prisma"), schema);
  writeFileSync(path.join(scratch, "package.json"), JSON.stringify({ name: "saffron-integration", private: true }));
  symlinkSync(path.join(root, "node_modules"), path.join(scratch, "node_modules"), "junction");
  linked = true;
  cpSync(path.join(root, "prisma/migrations"), path.join(scratch, "migrations"), { recursive: true });
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
  const cli = path.join(root, "node_modules/prisma/build/index.js");
  run(process.execPath, [cli, "generate", "--schema", "schema.prisma"], { cwd: scratch, env });
  run(process.execPath, [cli, "migrate", "deploy", "--schema", "schema.prisma"], { cwd: scratch, env });
  if (process.argv.includes("--browser")) {
    const { preview } = await import("./browser-preview.mjs");
    await preview({ root, scratch, env });
  } else {
    console.log("Migrations applied. Running booking concurrency tests...");
    const result = spawnSync(process.execPath,
      [path.join(root, "node_modules/vitest/vitest.mjs"), "run", "--config", "vitest.integration.config.ts"],
      { cwd: root, stdio: "inherit", env: { ...env, SAFFRON_TEST_CLIENT: path.join(scratch, "client/index.js") } });
    process.exitCode = result.status ?? 1;
  }
} catch (error) {
  console.error(error.message);
  console.error("Start Docker Desktop, then run npm run test:integration again.");
  process.exitCode = 1;
} finally {
  if (started) {
    const result = spawnSync("docker", ["rm", "--force", container], { stdio: "ignore", timeout: 30_000 });
    if (result.status !== 0) {
      console.error(`Could not remove temporary container ${container}. Remove it with docker rm --force ${container}.`);
      process.exitCode = 1;
    }
  }
  // Only the fresh directory returned by mkdtempSync is removed.
  // Unlink the dependency junction first so recursive cleanup cannot traverse it.
  if (linked) unlinkSync(path.join(scratch, "node_modules"));
  rmSync(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
