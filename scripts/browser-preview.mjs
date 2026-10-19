// Test-only preview. All authentication changes are made in a temporary copy,
// never in the production app. Uses the disposable database from the test runner.
import { spawn, spawnSync } from "node:child_process";
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";

export async function preview({ root, scratch, env }) {
  for (const name of ["app", "components", "lib", "public", "types"]) {
    cpSync(path.join(root, name), path.join(scratch, name), { recursive: true,
      filter: (file) => !path.basename(file).startsWith(".env") });
  }
  for (const name of ["tsconfig.json", "next-env.d.ts", "next.config.mjs", "tailwind.config.ts", "postcss.config.mjs"]) {
    cpSync(path.join(root, name), path.join(scratch, name));
  }
  // Use the isolated client even in the two routes that inspect Prisma errors.
  for (const name of ["lib/prisma.ts", "app/api/bookings/route.ts", "app/api/reviews/route.ts"]) {
    const file = path.join(scratch, name);
    writeFileSync(file, readFileSync(file, "utf8").replace('from "@prisma/client"', 'from "@/client"'));
  }
  const authFile = path.join(scratch, "lib/auth.ts");
  const auth = readFileSync(authFile, "utf8")
    .replace('import { PrismaAdapter } from "@next-auth/prisma-adapter";', "")
    .replace('import GoogleProvider from "next-auth/providers/google";', 'import CredentialsProvider from "next-auth/providers/credentials";')
    .replace("  adapter: PrismaAdapter(prisma),", "")
    .replace(/GoogleProvider\(\{[\s\S]*?\}\)/, `CredentialsProvider({
      name: "Disposable test account",
      credentials: { account: { type: "text" } },
      async authorize(credentials) {
        if (!["smoke-customer", "smoke-chef", "smoke-admin"].includes(credentials?.account ?? "")) return null;
        return prisma.user.findUnique({ where: { id: credentials!.account } });
      },
    })`);
  writeFileSync(authFile, auth);
  writeFileSync(path.join(scratch, "app/signin/page.tsx"), `"use client";
import { signIn } from "next-auth/react";
export default function TestSignIn() {
  return <div className="mx-auto max-w-lg px-4 py-12 space-y-4">
    <h1 className="text-3xl font-bold">Disposable test accounts</h1>
    <p>Only this temporary preview uses test sign-in.</p>
    <button className="block rounded bg-leaf p-4 text-white" onClick={() => signIn("credentials", {account:"smoke-customer", callbackUrl:"/chefs"})}>Test customer</button>
    <button className="block rounded bg-leaf p-4 text-white" onClick={() => signIn("credentials", {account:"smoke-chef", callbackUrl:"/bookings"})}>Test chef</button>
    <button className="block rounded bg-leaf p-4 text-white" onClick={() => signIn("credentials", {account:"smoke-admin", callbackUrl:"/admin"})}>Test admin</button>
  </div>;
}`);

  // Seed in a child process: Windows holds the Prisma engine DLL open until
  // process exit, even after $disconnect, preventing removal of the temp client.
  const seed = spawnSync(process.execPath, [path.join(root, "scripts/seed-browser-preview.mjs")], {
    cwd: scratch, env: { ...env, SAFFRON_TEST_CLIENT: path.join(scratch, "client/index.js") }, stdio: "inherit",
  });
  if (seed.status !== 0) throw new Error("Could not seed the temporary preview.");

  const port = await new Promise((resolve, reject) => {
    const socket = createServer();
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", () => {
      const selected = socket.address().port;
      socket.close(() => resolve(selected));
    });
  });
  const testEnv = { ...env, NEXTAUTH_URL: `http://localhost:${port}`,
    NEXTAUTH_SECRET: "disposable-preview-session-secret", RESEND_API_KEY: "", NEXT_TELEMETRY_DISABLED: "1" };
  if (process.argv.includes("--build")) {
    const result = spawnSync(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "build", scratch],
      { cwd: scratch, env: testEnv, stdio: "inherit" });
    if (result.status !== 0) throw new Error("Isolated production build failed.");
    return;
  }
  console.log(`Temporary preview: http://localhost:${port}`);
  console.log(`Temporary source: ${scratch}`);
  console.log("Use /signin for test accounts. Press Enter here to stop and clean up the preview.");
  const child = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"),
    "dev", scratch, "--hostname", "127.0.0.1", "--port", String(port)],
    { cwd: scratch, env: testEnv, stdio: "inherit" });
  const stop = () => {
    if (process.platform === "win32") {
      // Next dev forks a server process; stop only this preview's process tree.
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    } else child.kill("SIGINT");
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  process.stdin.once("data", stop);
  process.stdin.resume();
  try {
    await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", () => resolve());
    });
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    process.stdin.removeListener("data", stop);
    process.stdin.pause();
  }
}
