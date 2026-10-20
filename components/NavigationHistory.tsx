"use client";
import { useEffect } from "react";
import { trackNavigationHistory } from "@/lib/navigationHistory";
export default function NavigationHistory() {
  useEffect(() => { trackNavigationHistory(); }, []);
  return null;
}
