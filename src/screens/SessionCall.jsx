import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Modal, AppState } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { getBookingCallToken } from "@/api/livekit";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui";
import { LocalTile, RemoteTile } from "@/components/call/CallTiles";
import { useCallRoom } from "@/hooks/useCallRoom";
import { toast } from "@/lib/toast";
import { SESSION_REJOIN_MS } from "@/lib/sessionTiming";
import { colors } from "@/theme/colors";

// Mobile port of frontend/src/pages/SessionCallLiveKit.jsx.
//
// Not a markup conversion — the LiveKit web SDK renders into <video> elements
// and uses browser-only APIs, so the room lifecycle lives in @/hooks/useCallRoom
// and rendering uses the native <VideoTrack>. All booking-side logic (waiting
// room, admit, timer, completion rules) is ported exactly.
//
// Deliberately NOT ported, with reasons:
//   • Virtual backgrounds — @livekit/track-processors is web-only (canvas/WebGL).
//   • Screen share — needs an iOS broadcast extension / Android MediaProjection
//     setup; a separate native task, not a port.
//   • Browser speech-to-text AI notes — the web already disables these on mobile
//     devices via its own user-agent check, so there is nothing to port. When
//     TRANSCRIPTION_ENABLED is on, the server-side worker produces the
//     transcript from the LiveKit stream for every platform.

const fmtClock = (secs) => {
  if (secs == null) return "--:--";
  const s = Math.max(0, secs);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export default function SessionCall() {
  const { bookingId } = useLocalSearchParams();
  const router = useRouter();
  const { user, isCoach } = useAuth();
  const host = isCoach();

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

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null);
  const [overtime, setOvertime] = useState(false);
  const [needsResume, setNeedsResume] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [waiting, setWaiting] = useState(false); // client: awaiting admission
  const [coachPresent, setCoachPresent] = useState(false);
  const [pendingJoin, setPendingJoin] = useState(null); // coach: client waiting
  const [admitBusy, setAdmitBusy] = useState(false);
  const [endConfirm, setEndConfirm] = useState(false);

  const durationRef = useRef(0);
  const scheduledEndRef = useRef(null);
  const capRef = useRef(null);
  const timerRef = useRef(null);
  const endedRef = useRef(false);

  // ── Fetch booking ──────────────────────────────────────────────────────────
  useEffect(() => {
    api
      .get(`/bookings/${bookingId}/`)
      .then((res) => {
        // Use the slot's absolute UTC end. Fall back to session_date/time
        // treated as UTC ("Z") for legacy bookings.
        const sessionEnd = res.data.slot_end
          ? new Date(res.data.slot_end).getTime()
          : new Date(`${res.data.session_date}T${res.data.session_time}Z`).getTime() +
            res.data.duration * 60 * 1000;
        const withinWindow = sessionEnd + SESSION_REJOIN_MS >= Date.now();
        const status = res.data.status;

        const seed = () => {
          setBooking(res.data);
          durationRef.current = res.data.duration * 60;
          scheduledEndRef.current = sessionEnd;
          capRef.current = sessionEnd + SESSION_REJOIN_MS;
          setTimeLeft(res.data.duration * 60);
        };

        if (status !== "accepted") {
          // A finalised session can still be RESUMED on the same link while the
          // rejoin window is open (N3) — offer that instead of bouncing out.
          if ((status === "completed" || status === "no_show") && withinWindow) {
            seed();
            setNeedsResume(true);
            return;
          }
          toast.error("This session is not active.");
          router.back();
          return;
        }
        // The link stays live through the whole rejoin window (N3) so people can
        // run over or reconnect and continue — not just the short grace.
        if (!withinWindow) {
          toast.error("This session's time has already passed.");
          router.back();
          return;
        }
        seed();
      })
      .catch(() => {
        toast.error("Could not load session.");
        router.back();
      })
      .finally(() => setLoading(false));
  }, [bookingId, router]);

  // ── Finish / leave ─────────────────────────────────────────────────────────
  const finishSession = useCallback(
    async (reason) => {
      if (endedRef.current) return;
      endedRef.current = true;
      clearInterval(timerRef.current);
      await disconnect();

      // Complete the booking when its time is up, OR when the coach deliberately
      // ends it early ("complete"). Merely leaving/dropping while the window is
      // still running does NOT complete it — it stays 'accepted' so either side
      // can reconnect and continue on the same link (N3).
      const finish =
        reason === "timeout" ||
        reason === "complete" ||
        (capRef.current != null && Date.now() >= capRef.current);

      if (finish) {
        if (reason === "timeout") toast.info("Session time is up.");
        let completed = false;
        try {
          await api.patch(
            `/bookings/${bookingId}/complete/`,
            reason === "complete" ? { force: true } : {}
          );
          completed = true;
        } catch (err) {
          // A deliberate early end the server refused (e.g. not started yet) —
          // tell the coach honestly and keep it open.
          if (reason === "complete") {
            toast.info(
              err?.response?.data?.detail ||
                "This session can't be completed yet — it stays open."
            );
            setTimeout(() => router.replace("/"), 1600);
            return;
          }
        }
        if (reason === "complete" && completed)
          toast.success("Session ended — preparing your AI summary…");
        // No local transcript on mobile (see the header note); the server-side
        // worker posts the summary when transcription is enabled.
        setTimeout(() => router.replace(`/chat/${bookingId}`), 1800);
      } else {
        toast.info(
          "You've left the session. It stays open — you can rejoin any time before it ends."
        );
        setTimeout(() => router.back(), 1200);
      }
    },
    [bookingId, disconnect, router]
  );

  // ── Timer ──────────────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const now = Date.now();
      if (scheduledEndRef.current != null) {
        const left = Math.floor((scheduledEndRef.current - now) / 1000);
        setTimeLeft(left);
        setOvertime(left <= 0);
      }
      if (capRef.current != null && now >= capRef.current) finishSession("timeout");
    }, 1000);
  }, [finishSession]);

  // ── Join ───────────────────────────────────────────────────────────────────
  const doConnect = useCallback(async () => {
    try {
      const creds = await getBookingCallToken(bookingId);
      await connect(creds);
      api.post(`/bookings/${bookingId}/mark-joined/`).catch(() => {});
      startTimer();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Couldn't join the session.");
    }
  }, [bookingId, connect, startTimer]);

  // Client: ask the coach to let them in, then poll until admitted.
  const requestJoin = useCallback(async () => {
    try {
      const res = await api.post(`/bookings/${bookingId}/request-join/`);
      setCoachPresent(!!res.data.coach_present);
      setWaiting(true);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Couldn't ask to join.");
    }
  }, [bookingId]);

  // While waiting for admission, poll until the coach admits (or denies) us.
  useEffect(() => {
    if (!waiting) return undefined;
    let active = true;
    const t = setInterval(async () => {
      try {
        const res = await api.get(`/bookings/${bookingId}/join-status/`);
        if (!active) return;
        setCoachPresent(!!res.data.coach_present);
        if (res.data.status === "admitted") {
          active = false;
          setWaiting(false);
          doConnect();
        } else if (res.data.status === "denied") {
          active = false;
          setWaiting(false);
          toast.error("The coach didn't admit you to this session.");
        }
      } catch {
        /* keep polling */
      }
    }, 3000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [waiting, bookingId, doConnect]);

  // Coach (host): while in the call, poll for a client waiting to be admitted.
  useEffect(() => {
    if (!host || state !== "connected") return undefined;
    const t = setInterval(async () => {
      try {
        const res = await api.get(`/bookings/${bookingId}/pending-joins/`);
        setPendingJoin(res.data?.pending ? res.data : null);
      } catch {
        /* noop */
      }
    }, 4000);
    return () => clearInterval(t);
  }, [host, state, bookingId]);

  const handleAdmit = async () => {
    setAdmitBusy(true);
    try {
      await api.post(`/bookings/${bookingId}/admit/`);
      setPendingJoin(null);
      toast.success("Admitted — they're joining now.");
    } catch {
      toast.error("Couldn't admit. Please try again.");
    } finally {
      setAdmitBusy(false);
    }
  };

  const handleDeny = async () => {
    setAdmitBusy(true);
    try {
      await api.post(`/bookings/${bookingId}/deny/`);
      setPendingJoin(null);
    } catch {
      toast.error("Couldn't decline. Please try again.");
    } finally {
      setAdmitBusy(false);
    }
  };

  const handleResume = async () => {
    setResuming(true);
    try {
      await api.post(`/bookings/${bookingId}/reopen/`);
      setNeedsResume(false);
      if (host) doConnect();
      else requestJoin();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Couldn't resume this session.");
    } finally {
      setResuming(false);
    }
  };

  // Keep the timer honest across backgrounding — JS timers throttle when the
  // app is not foregrounded, so re-evaluate the cap on resume.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") return;
      if (capRef.current != null && Date.now() >= capRef.current && state === "connected") {
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
  if (!booking) return null;

  const remotes = Object.entries(participants);
  const partnerName = host ? booking.learner_username : booking.mentor_username;

  // ── Resume prompt (finalised but still within the rejoin window) ──
  if (needsResume) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-navy-deep px-6">
        <Feather name="rotate-ccw" size={40} color={colors.gold} />
        <Text className="mt-4 text-center font-display text-2xl text-cream">
          This session was closed
        </Text>
        <Text className="mb-6 mt-2 text-center font-sans text-sm text-slate-light">
          It's still within the rejoin window, so you can reopen and continue on the same
          link.
        </Text>
        <Button variant="gold" onPress={handleResume} loading={resuming}>
          Resume session
        </Button>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="font-sans text-sm text-slate-light">Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ── Lobby / waiting room ──
  if (state !== "connected") {
    return (
      <SafeAreaView className="flex-1 bg-navy-deep px-6">
        <Pressable onPress={() => router.back()} className="py-3">
          <Feather name="arrow-left" size={20} color={colors.cream} />
        </Pressable>

        <View className="flex-1 items-center justify-center">
          <Text className="mb-1 text-xs font-sans-semibold uppercase tracking-[2px] text-gold">
            {booking.skill_title}
          </Text>
          <Text className="mb-8 text-center font-display text-3xl text-cream">
            {waiting ? "Waiting to be let in" : `Session with ${partnerName}`}
          </Text>

          {waiting ? (
            <>
              <ActivityIndicator size="large" color={colors.gold} />
              <Text className="mt-5 text-center font-sans text-sm text-slate-light">
                {coachPresent
                  ? "The coach has been notified. You'll join as soon as they admit you."
                  : "You'll be let in once the coach joins and admits you."}
              </Text>
            </>
          ) : state === "connecting" ? (
            <>
              <ActivityIndicator size="large" color={colors.gold} />
              <Text className="mt-5 font-sans text-sm text-slate-light">Connecting…</Text>
            </>
          ) : (
            <>
              <Text className="mb-8 text-center font-sans text-sm text-slate-light">
                {host
                  ? "You're the host — join, then admit your client when they ask."
                  : "You'll ask to join and the coach will let you in."}
              </Text>
              <Button
                variant="gold"
                onPress={host ? doConnect : requestJoin}
                fullWidth
              >
                {host ? "Start session" : "Ask to join"}
              </Button>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── In call ──
  return (
    <SafeAreaView className="flex-1 bg-navy-deep">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-2">
        <View className="min-w-0 flex-1">
          <Text className="font-sans-semibold text-sm text-cream" numberOfLines={1}>
            {booking.skill_title}
          </Text>
          <Text className="font-sans text-xs text-slate-light">{partnerName}</Text>
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

      {(netPoor || reconnecting) ? (
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

      {/* Video area */}
      <View className="flex-1 gap-3 px-4">
        {remotes.length === 0 ? (
          <View className="flex-1 items-center justify-center rounded-2xl border border-gold/20 bg-navy">
            <Feather name="user" size={32} color={colors.slateLight} />
            <Text className="mt-3 font-sans text-sm text-slate-light">
              Waiting for {partnerName} to join…
            </Text>
          </View>
        ) : (
          remotes.map(([sid, entry]) => (
            <RemoteTile key={sid} entry={entry} style={{ flex: 1 }} />
          ))
        )}
      </View>

      {/* Local preview */}
      <View className="absolute right-5 top-24 h-40 w-28">
        <LocalTile
          trackRef={localVideoRef}
          camOn={camOn}
          micOn={micOn}
          name={user?.first_name || user?.username}
          style={{ flex: 1 }}
        />
      </View>

      {/* Controls */}
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
          onPress={() => router.push(`/chat/${bookingId}`)}
          className="h-14 w-14 items-center justify-center rounded-full bg-white/15"
        >
          <Feather name="message-square" size={22} color={colors.cream} />
        </Pressable>

        <Pressable
          onPress={() => (host ? setEndConfirm(true) : finishSession("manual"))}
          className="h-14 w-14 items-center justify-center rounded-full bg-red-600"
        >
          <Feather name="phone-off" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* Coach: admit a waiting client */}
      <Modal visible={!!pendingJoin} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-navy-deep/70 p-6">
          <View className="w-full max-w-sm rounded-2xl bg-cream p-6">
            <Text className="mb-2 font-display text-xl text-navy">
              {pendingJoin?.name || "Your client"} wants to join
            </Text>
            <Text className="mb-5 font-sans text-sm text-slate">
              Let them into the session when you're ready.
            </Text>
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                onPress={handleDeny}
                disabled={admitBusy}
                className="flex-1"
              >
                Not yet
              </Button>
              <Button
                variant="gold"
                onPress={handleAdmit}
                loading={admitBusy}
                className="flex-1"
              >
                Admit
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Coach: end-early confirmation */}
      <Modal visible={endConfirm} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-navy-deep/70 p-6">
          <View className="w-full max-w-sm rounded-2xl bg-cream p-6">
            <Text className="mb-2 font-display text-xl text-navy">End this session?</Text>
            <Text className="mb-5 font-sans text-sm text-slate">
              Ending it completes the booking. Leaving instead keeps it open so either of
              you can rejoin.
            </Text>
            <View className="gap-2">
              <Button
                variant="navy"
                onPress={() => {
                  setEndConfirm(false);
                  finishSession("complete");
                }}
                fullWidth
              >
                End & complete session
              </Button>
              <Button
                variant="outline"
                onPress={() => {
                  setEndConfirm(false);
                  finishSession("manual");
                }}
                fullWidth
              >
                Just leave (keep open)
              </Button>
              <Button variant="ghost" onPress={() => setEndConfirm(false)} fullWidth>
                Cancel
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
