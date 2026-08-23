import { useCallback, useEffect, useState } from "react";
import { View, Text } from "react-native";

import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { Screen, Card } from "@/components/ui";
import NextSessionCard from "@/components/home/NextSessionCard";
import QuickActions from "@/components/home/QuickActions";
import { isUpcomingSession, sessionStartDate } from "@/lib/sessionTiming";

// Coach home.
//
// Carries the destinations that don't fit the five tab slots — Profile lives
// here rather than in the tab bar, because a coach reaches client documents
// constantly and edits their profile rarely.
const ACTIONS = [
  { icon: "target", label: "Milestones", href: "/milestones" },
  { icon: "activity", label: "Habits", href: "/habits" },
  { icon: "award", label: "My Skills", href: "/(coach)/skills" },
  { icon: "plus-circle", label: "Add Skill", href: "/add-skill" },
  { icon: "users", label: "Group Sessions", href: "/group-sessions" },
  { icon: "user", label: "Profile", href: "/(coach)/profile" },
];

export default function CoachHome() {
  const { firstName, user, approvalStatus } = useAuth();
  const [next, setNext] = useState(null);
  const [todayCount, setTodayCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/bookings/");
      const all = Array.isArray(res.data) ? res.data : (res.data.results ?? []);
      const upcoming = all
        .filter(isUpcomingSession)
        .sort((a, b) => sessionStartDate(a) - sessionStartDate(b));
      setNext(upcoming[0] || null);

      const today = new Date().toDateString();
      setTodayCount(
        upcoming.filter((s) => sessionStartDate(s).toDateString() === today).length
      );
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
        Coach
      </Text>
      <Text className="mt-2 font-display text-4xl text-navy">
        {firstName || user?.username || "Hello"}
      </Text>

      {approvalStatus && approvalStatus !== "approved" ? (
        <Card className="mt-4 border-amber-200 bg-amber-50">
          <Text className="font-sans-semibold text-sm text-amber-900">
            Your coach profile is {approvalStatus}.
          </Text>
        </Card>
      ) : null}

      <Card className="mt-6">
        <Text className="font-sans text-sm text-slate">
          <Text className="font-display text-2xl text-navy">{todayCount}</Text>
          {todayCount === 1 ? " session today" : " sessions today"}
        </Text>
      </Card>

      <NextSessionCard
        session={next}
        emptyLabel="No upcoming sessions booked."
        emptyHref="/(coach)/availability"
        emptyCta="Open availability"
      />

      <QuickActions actions={ACTIONS} />
    </Screen>
  );
}
