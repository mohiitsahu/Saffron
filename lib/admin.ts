import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Returns the session only if the signed-in person is an admin. Roles are read from
// the database on every request (see lib/auth.ts), so removing someone's ADMIN role
// takes effect immediately.
export async function getAdminSession() {
  const session = await getServerSession(authOptions);
  return session?.user?.role === "ADMIN" ? session : null;
}
