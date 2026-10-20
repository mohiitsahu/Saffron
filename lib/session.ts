import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// React shares this only within one server render, never between users or requests.
// Navbar and page can otherwise repeat the JWT callback's database lookup.
export const getAppSession = cache(() => getServerSession(authOptions));
