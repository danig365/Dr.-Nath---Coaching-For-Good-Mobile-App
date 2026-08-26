import { usePathname } from "expo-router";

import { useAuth } from "@/context/AuthContext";

// Height a screen must leave clear at the bottom so its last row isn't sitting
// under the floating Menu button: the pill (~44) plus its 20 offset plus a
// little breathing room. Callers add the bottom safe-area inset on top.
export const MENU_CLEARANCE = 72;

// Screens that own the whole display, or that someone reaches before the menu
// means anything. A call in particular must not have a button floating over it.
const HIDE_ON = [
  "/session/",
  "/group-session/",
  "/join/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/landing",
  "/complete-profile",
];

// Single source of truth for "is the menu on screen right now?". Both the menu
// and Screen read it, so the clearance can never drift out of step with whether
// the button is actually there.
export function useAppMenuVisible() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

  return isAuthenticated && !HIDE_ON.some((p) => pathname.startsWith(p));
}
