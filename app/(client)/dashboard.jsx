import { useCallback, useEffect, useState } from "react";
import { View, Text } from "react-native";

import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { Screen } from "@/components/ui";
import NextSessionCard from "@/components/home/NextSessionCard";
import { isUpcomingSession, sessionStartDate } from "@/lib/sessionTiming";

// Client home — a dashboard, not a menu. Every page now lives in AppMenu,
// so this screen only answers "where am I up to?". The website has no
// equivalent: it sends a client straight to the skills list, which is where
// the app lands too, leaving this one menu tap away.

export default function ClientHome() {
  const { firstName, user } = useAuth();
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/bookings/");
      const all = Array.isArray(res.data) ? res.data : (res.data.results ?? []);
      // Soonest upcoming session — same definition the sessions list uses.
      const upcoming = all
        .filter(isUpcomingSession)
        .sort((a, b) => sessionStartDate(a) - sessionStartDate(b));
      setNext(upcoming[0] || null);
    } catch {
      setNext(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Screen loading />;

  return (
    <Screen onRefresh={load} refreshing={false}>
      <Text className="text-xs font-sans-semibold uppercase tracking-[2px] text-gold-deep">
        Welcome back
      </Text>
      <Text className="mt-2 font-display text-4xl text-navy">
        {firstName || user?.username || "Hello"}
      </Text>

      <NextSessionCard
        session={next}
        emptyLabel="You have no upcoming sessions."
        emptyHref="/(client)/book"
        emptyCta="Book a session"
      />

    </Screen>
  );
}
