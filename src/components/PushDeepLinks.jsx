import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { useLastNotificationResponse } from "expo-notifications";

import { useAuth } from "@/context/AuthContext";

// Opens the screen a push notification points at.
//
// The backend sends a path in the notification's `data.url` (a session, say),
// but nothing was reading it — so tapping a notification only opened the app on
// whatever screen it was last on. `useLastNotificationResponse` covers both
// cases: a tap while the app is running, and a cold start where the tap
// launched it.
//
// Navigation waits for auth to resolve: routing to /session/42 before the token
// is loaded would bounce the user to the login wall and lose the destination.
export default function PushDeepLinks() {
  const router = useRouter();
  const response = useLastNotificationResponse();
  const { loading, isAuthenticated } = useAuth();
  const handled = useRef(null);

  useEffect(() => {
    if (loading || !isAuthenticated || !response) return;

    const url = response.notification?.request?.content?.data?.url;
    if (typeof url !== "string" || !url.startsWith("/")) return;

    // The hook keeps returning the same response; act on each one once.
    const id = response.notification?.request?.identifier ?? url;
    if (handled.current === id) return;
    handled.current = id;

    router.push(url);
  }, [response, loading, isAuthenticated, router]);

  return null;
}
