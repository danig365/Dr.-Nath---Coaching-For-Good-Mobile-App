import { useCallback, useEffect, useState } from "react";
import { View, Text } from "react-native";

import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { Screen } from "@/components/ui";
import NextSessionCard from "@/components/home/NextSessionCard";
import QuickActions from "@/components/home/QuickActions";
import { isUpcomingSession, sessionStartDate } from "@/lib/sessionTiming";

// Client home.
//
// The web has no equivalent page — clients land straight on My Learning. On
// mobile the tab bar only holds five destinations, so this screen carries the
// overflow (Milestones, Habits, Group Sessions, Find a Coach) that would
// otherwise be unreachable.
const ACTIONS = [
  { icon: "target", label: "Milestones", href: "/milestones" },
  { icon: "activity", label: "Habits", href: "/habits" },
  { icon: "users", label: "Group Sessions", href: "/group-sessions" },
  { icon: "search", label: "Find a Coach", href: "/match" },
  { icon: "user-check", label: "Browse Coaches", href: "/coaches" },
  { icon: "mail", label: "Contact", href: "/contact" },
];

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

      <QuickActions actions={ACTIONS} />
    </Screen>
  );
}
