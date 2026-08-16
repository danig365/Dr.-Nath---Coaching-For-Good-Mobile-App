import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, AppState } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { getGroupCallToken } from "@/api/livekit";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui";
import { LocalTile, RemoteTile } from "@/components/call/CallTiles";
import { useCallRoom } from "@/hooks/useCallRoom";
import { toast } from "@/lib/toast";
import { SESSION_REJOIN_MS } from "@/lib/sessionTiming";
import { colors } from "@/theme/colors";

// Mobile port of frontend/src/pages/GroupCallLiveKit.jsx.
//
// Shares the room lifecycle with the 1:1 call via @/hooks/useCallRoom. Same
// deferrals as SessionCall: no virtual backgrounds, no screen share (see the
// note in SessionCall.jsx).
//
// Group calls have no waiting room — enrolment is the gate — so this is simpler
// than the 1:1 flow: load the session, join, run the timer, leave.

const fmtClock = (secs) => {
  if (secs == null) return "--:--";
  const s = Math.max(0, secs);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export default function GroupCall() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user, isCoach } = useAuth();
  const coach = isCoach();

  const {
    state,
    participants,
    localVideoRef,
    micOn,
    camOn,
    mediaError,
    netPoor,
    reconnecting,
    connect,
    disconnect,
    toggleMic,
    toggleCam,
    retryMedia,
  } = useCallRoom();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null);
  const [overtime, setOvertime] = useState(false);

  const endRef = useRef(null);
  const overtimeRef = useRef(false);
  const timerRef = useRef(null);
  const endedRef = useRef(false);

  // ── Load session ───────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        let found = null;
        if (coach) {
          const r = await api.get("/bookings/group-sessions/");
          found = r.data.find((s) => s.id === parseInt(id));
        } else {
          const r = await api.get("/bookings/group-sessions/mine/");
          const e = r.data.find((x) => x.group_session === parseInt(id));
          if (e)
            found = {
              id: e.group_session,
              title: e.title,
              coach_username: e.coach_username,
              start_datetime: e.start_datetime,
              end_datetime: e.end_datetime,
              status: e.session_status,
            };
        }

        if (!found) {
          toast.error("Session not found or you're not enrolled.");
          router.back();
          return;
        }
        if (found.status === "cancelled") {
          toast.error("This session was cancelled.");
          router.back();
          return;
        }
        // The same link stays live through the rejoin window (N3) so a group
        // session can run over / be reconnected and continued.
        if (new Date(found.end_datetime).getTime() + SESSION_REJOIN_MS < Date.now()) {
          toast.error("This session has already ended.");
          router.back();
          return;
        }

        endRef.current = new Date(found.end_datetime).getTime();
        setSession(found);
        setTimeLeft(Math.floor((endRef.current - Date.now()) / 1000));
      } catch {
        toast.error("Could not load session.");
        router.back();
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, coach, router]);

  const finishSession = useCallback(
    async (reason) => {
      if (endedRef.current) return;
      endedRef.current = true;
      clearInterval(timerRef.current);
      await disconnect();
      if (reason === "timeout") toast.info("Session time is up.");
      setTimeout(
        () => router.replace(coach ? "/(coach)/sessions" : "/(client)/learning"),
        1600
      );
    },
    [disconnect, router, coach]
  );

  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const now = Date.now();
      // Countdown to the scheduled end (shows 00:00 once reached). The scheduled
      // end is a SOFT boundary — an "overtime" notice shows and the call keeps
      // going until the rejoin window fully closes (N3).
      const remaining = Math.floor((endRef.current - now) / 1000);
      setTimeLeft(Math.max(remaining, 0));
      if (now >= endRef.current && !overtimeRef.current) {
        overtimeRef.current = true;
        setOvertime(true);
      }
      if (now > endRef.current + SESSION_REJOIN_MS) finishSession("timeout");
    }, 1000);
  }, [finishSession]);

  const handleJoin = useCallback(async () => {
    try {
      const creds = await getGroupCallToken(id);
      await connect(creds);
      startTimer();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Couldn't join the call.");
    }
  }, [id, connect, startTimer]);

  // JS timers throttle when backgrounded — re-check the hard cap on resume.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") return;
      if (
        endRef.current != null &&
        Date.now() > endRef.current + SESSION_REJOIN_MS &&
        state === "connected"
      ) {
        finishSession("timeout");
      }
    });
    return () => sub.remove();
  }, [state, finishSession]);

  useEffect(() => () => clearInterval(timerRef.current), []);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-navy-deep">
        <ActivityIndicator size="large" color={colors.gold} />
      </SafeAreaView>
    );
  }
  if (!session) return null;

  const remotes = Object.entries(participants);

  // ── Lobby ──
  if (state !== "connected") {
    return (
      <SafeAreaView className="flex-1 bg-navy-deep px-6">
        <Pressable onPress={() => router.back()} className="py-3">
          <Feather name="arrow-left" size={20} color={colors.cream} />
        </Pressable>

        <View className="flex-1 items-center justify-center">
          <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-gold/15">
            <Feather name="users" size={24} color={colors.gold} />
          </View>
          <Text className="mb-1 text-xs font-sans-semibold uppercase tracking-[2px] text-gold">
            Group session
          </Text>
          <Text className="mb-2 text-center font-display text-3xl text-cream">
            {session.title}
          </Text>
          <Text className="mb-8 font-sans text-sm text-slate-light">
            with {session.coach_username}
          </Text>

          {state === "connecting" ? (
            <>
              <ActivityIndicator size="large" color={colors.gold} />
              <Text className="mt-5 font-sans text-sm text-slate-light">Connecting…</Text>
            </>
          ) : (
            <Button variant="gold" onPress={handleJoin} fullWidth>
              Join call
            </Button>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── In call ──
  // Two columns once there are more than two other people, so a workshop with
  // several participants still fits a phone screen.
  const twoUp = remotes.length > 2;

  return (
    <SafeAreaView className="flex-1 bg-navy-deep">
      <View className="flex-row items-center justify-between px-4 py-2">
        <View className="min-w-0 flex-1">
          <Text className="font-sans-semibold text-sm text-cream" numberOfLines={1}>
            {session.title}
          </Text>
          <Text className="font-sans text-xs text-slate-light">
            {remotes.length + 1} in the call
          </Text>
        </View>

        <View
          className={`rounded-full px-3 py-1 ${overtime ? "bg-amber-500/20" : "bg-white/10"}`}
        >
          <Text
            className={`font-sans-semibold text-xs ${
              overtime ? "text-amber-300" : "text-cream"
            }`}
          >
            {overtime ? "Overtime" : fmtClock(timeLeft)}
          </Text>
        </View>
      </View>

      {netPoor || reconnecting ? (
        <View className="mx-4 mb-2 rounded-xl bg-amber-500/15 px-3 py-2">
          <Text className="font-sans text-xs text-amber-300">
            {reconnecting ? "Reconnecting…" : "Your connection looks unstable."}
          </Text>
        </View>
      ) : null}

      {mediaError ? (
        <View className="mx-4 mb-2 flex-row items-center gap-2 rounded-xl bg-red-500/15 px-3 py-2">
          <Text className="flex-1 font-sans text-xs text-red-300">{mediaError}</Text>
          <Pressable onPress={retryMedia} className="rounded-full bg-white/15 px-3 py-1">
            <Text className="font-sans-semibold text-xs text-cream">Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <View className="flex-1 flex-row flex-wrap gap-3 px-4">
        {remotes.length === 0 ? (
          <View className="flex-1 items-center justify-center rounded-2xl border border-gold/20 bg-navy">
            <Feather name="users" size={32} color={colors.slateLight} />
            <Text className="mt-3 font-sans text-sm text-slate-light">
              Waiting for others to join…
            </Text>
          </View>
        ) : (
          remotes.map(([sid, entry]) => (
            <RemoteTile
              key={sid}
              entry={entry}
              style={twoUp ? { width: "48%", height: "32%" } : { flex: 1, minHeight: 180 }}
            />
          ))
        )}
      </View>

      <View className="absolute right-5 top-24 h-40 w-28">
        <LocalTile
          trackRef={localVideoRef}
          camOn={camOn}
          micOn={micOn}
          name={user?.first_name || user?.username}
          style={{ flex: 1 }}
        />
      </View>

      <View className="flex-row items-center justify-center gap-6 px-4 py-5">
        <Pressable
          onPress={toggleMic}
          className={`h-14 w-14 items-center justify-center rounded-full ${
            micOn ? "bg-white/15" : "bg-white"
          }`}
        >
          <Feather
            name={micOn ? "mic" : "mic-off"}
            size={22}
            color={micOn ? colors.cream : colors.navyDeep}
          />
        </Pressable>

        <Pressable
          onPress={toggleCam}
          className={`h-14 w-14 items-center justify-center rounded-full ${
            camOn ? "bg-white/15" : "bg-white"
          }`}
        >
          <Feather
            name={camOn ? "video" : "video-off"}
            size={22}
            color={camOn ? colors.cream : colors.navyDeep}
          />
        </Pressable>

        <Pressable
          onPress={() => router.push(`/group-chat/${id}`)}
          className="h-14 w-14 items-center justify-center rounded-full bg-white/15"
        >
          <Feather name="message-square" size={22} color={colors.cream} />
        </Pressable>

        <Pressable
          onPress={() => finishSession("manual")}
          className="h-14 w-14 items-center justify-center rounded-full bg-red-600"
        >
          <Feather name="phone-off" size={22} color="#fff" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
