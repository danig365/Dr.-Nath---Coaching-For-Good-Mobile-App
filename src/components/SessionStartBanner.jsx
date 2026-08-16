import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { SESSION_GRACE_MS } from "@/lib/sessionTiming";
import { colors } from "@/theme/colors";

// Port of frontend/src/components/SessionStartBanner.jsx.
//
// A global, always-visible nudge: when a session is about to start (or is live),
// show a "Join now" bar with a live countdown — so even a non-technical user on
// any screen can jump straight in, without hunting for the session.

const LEAD_MS = 15 * 60 * 1000; // surface the banner from 15 min before start

const startMs = (s) =>
  new Date(s.slot_start || `${s.session_date}T${s.session_time}Z`).getTime();

const endMs = (s) => {
  const start = startMs(s);
  return s.slot_end ? new Date(s.slot_end).getTime() : start + (s.duration || 60) * 60000;
};

export default function SessionStartBanner() {
  const { isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const [sessions, setSessions] = useState([]);
  const [dismissed, setDismissed] = useState({});
  const [, setTick] = useState(0);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || isAdmin()) {
      setSessions([]);
      return undefined;
    }
    const load = () =>
      api
        .get("/bookings/")
        .then((res) => {
          const all = Array.isArray(res.data) ? res.data : (res.data.results ?? []);
          setSessions(all.filter((b) => b.status === "accepted"));
        })
        .catch(() => {});
    load();
    pollRef.current = setInterval(load, 30000);
    return () => clearInterval(pollRef.current);
  }, [isAuthenticated, isAdmin]);

  // 1s tick drives the live countdown.
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!isAuthenticated) return null;
  // Don't cover the actual call screen.
  if (pathname.startsWith("/session/") || pathname.startsWith("/join/")) return null;

  const now = Date.now();
  const active = sessions
    .filter(
      (s) =>
        !dismissed[s.id] && now >= startMs(s) - LEAD_MS && now < endMs(s) + SESSION_GRACE_MS
    )
    .sort((a, b) => startMs(a) - startMs(b))[0];
  if (!active) return null;

  const start = startMs(active);
  const live = now >= start;
  const remaining = Math.max(0, Math.floor((start - now) / 1000));
  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const when = live ? "is live now" : `starts in ${mm}:${String(ss).padStart(2, "0")}`;

  return (
    <View
      pointerEvents="box-none"
      className="absolute left-0 right-0 z-40 px-4"
      style={{ top: insets.top + 8 }}
    >
      <View className="flex-row items-center gap-3 rounded-2xl border border-gold/40 bg-navy px-4 py-2.5">
        <View
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: live ? "#34A853" : colors.gold }}
        />

        <View className="min-w-0 flex-1">
          <Text className="font-sans-semibold text-sm text-cream" numberOfLines={1}>
            {active.skill_title || "Your session"} {when}
          </Text>
        </View>

        <Pressable
          onPress={() => router.push(`/session/${active.id}`)}
          className="flex-row items-center gap-1.5 rounded-full bg-gold px-4 py-1.5"
        >
          <Feather name="video" size={14} color={colors.navyDeep} />
          <Text className="font-sans-bold text-sm text-navy-deep">Join now</Text>
        </Pressable>

        <Pressable
          onPress={() => setDismissed((d) => ({ ...d, [active.id]: true }))}
          hitSlop={8}
          className="rounded-full p-1"
        >
          <Feather name="x" size={16} color={colors.slateLight} />
        </Pressable>
      </View>
    </View>
  );
}
