import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  // Use our own sign-in page instead of NextAuth's default one. Errors show up there too.
  pages: { signIn: "/signin", error: "/signin" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    // Re-read the role from the database so that upgrading to CHEF
    // or being made ADMIN takes effect without signing out.
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, chefProfile: { select: { id: true } } },
        });
        // The account no longer exists (it was deleted): drop the login instead of
        // letting a ghost session fail later with confusing errors.
        if (!dbUser) return {};
        token.role = dbUser.role;
        // Role is a single value, so an admin who also cooks has role ADMIN.
        // Having a chef profile is what makes someone a chef.
        token.isChef = dbUser.role === "CHEF" || dbUser.chefProfile !== null;
      }
      return token;
    },
    async session({ session, token }) {
      // No user id means the login was dropped above. Return a session with no user,
      // which every page and API route already treats as "signed out".
      if (!token.id) {
        const { user: _removed, ...rest } = session;
        void _removed;
        return rest as unknown as typeof session;
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "CUSTOMER" | "CHEF" | "ADMIN";
        session.user.isChef = Boolean(token.isChef);
      }
      return session;
    },
  },
};