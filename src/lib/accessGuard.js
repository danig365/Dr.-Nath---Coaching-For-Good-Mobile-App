import { useCallback } from "react";
import { useRouter } from "expo-router";

import { useAuth } from "@/context/AuthContext";
import { homeHrefFor } from "@/lib/appMenu";

/**
 * Guards for screens only some roles may open — the mobile counterpart of
 * frontend/src/utils/accessGuard.js.
 *
 * These screens used to call `logout()` when the visitor was the wrong role,
 * so a client who reached a coach screen was signed out of the app entirely,
 * losing a valid session with no explanation. Being on the wrong screen is not
 * a reason to end someone's session.
 *
 * Each guard returns true when the caller should stop:
 *
 *   const { requireCoach } = useAccessGuard();
 *   if (requireCoach()) return;
 */
export function useAccessGuard() {
  const router = useRouter();
  const { isAuthenticated, role } = useAuth();
  const isCoach = role === "coach" || role === "mentor";

  const requireSignedIn = useCallback(() => {
    if (isAuthenticated) return false;
    router.replace("/login");
    return true;
  }, [isAuthenticated, router]);

  const requireCoach = useCallback(() => {
    if (requireSignedIn()) return true;
    if (isCoach) return false;
    router.replace(homeHrefFor(role));
    return true;
  }, [requireSignedIn, isCoach, role, router]);

  return { requireSignedIn, requireCoach };
}

export default useAccessGuard;
