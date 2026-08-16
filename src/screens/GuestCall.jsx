import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import {
  requestGuestJoin,
  getGuestJoinStatus,
  getGuestCallToken,
} from "@/api/livekit";
import { Button, Input } from "@/components/ui";
import { LocalTile, RemoteTile } from "@/components/call/CallTiles";
import { useCallRoom } from "@/hooks/useCallRoom";
import { toast } from "@/lib/toast";
import { colors } from "@/theme/colors";

// Mobile port of frontend/src/pages/GuestCall.jsx.
//
// The public, no-account path into a 1:1 call (N4): a guest opens the shared
// link, enters a name, asks to join, and — once the coach admits them — joins
// the room. Reached via the deep link drnath://session/<id>/guest?t=<token>.
//
// This screen is deliberately outside the auth gate: guests have no account, so
// every call here uses the unauthenticated guest endpoints.

export default function GuestCall() {
  const { bookingId, t: linkToken } = useLocalSearchParams();
  const router = useRouter();

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

  const [stage, setStage] = useState("lobby"); // lobby | waiting | connected | error
  const [name, setName] = useState("");
  const [coachPresent, setCoachPresent] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [asking, setAsking] = useState(false);

  const guestUidRef = useRef(null);

  const join = useCallback(async () => {
    try {
      const { url, token } = await getGuestCallToken(
        bookingId,
        guestUidRef.current,
        linkToken
      );
      await connect({ url, token });
      setStage("connected");
    } catch (err) {
      setErrorMsg(
        err?.response?.data?.detail || "Couldn't join the session. Please try again."
      );
      setStage("error");
    }
  }, [bookingId, linkToken, connect]);

  const ask = useCallback(async () => {
    if (!name.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    setAsking(true);
    try {
      const { guest_uid } = await requestGuestJoin(bookingId, linkToken, name.trim());
      guestUidRef.current = guest_uid;
      setStage("waiting");
    } catch (err) {
      setErrorMsg(
        err?.response?.data?.detail ||
          "This invite link isn't valid or has been turned off."
      );
      setStage("error");
    } finally {
      setAsking(false);
    }
  }, [bookingId, linkToken, name]);

  // While waiting, poll until the coach admits (or denies) us.
  useEffect(() => {
    if (stage !== "waiting") return undefined;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const res = await getGuestJoinStatus(bookingId, guestUidRef.current);
        if (!active) return;
        setCoachPresent(!!res.coach_present);
        if (res.status === "admitted") {
          active = false;
          join();
        } else if (res.status === "denied") {
          active = false;
          setErrorMsg("The coach didn't admit you to this session.");
          setStage("error");
        }
      } catch {
        /* keep polling */
      }
    }, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [stage, bookingId, join]);

  const leave = async () => {
    await disconnect();
    setStage("lobby");
    guestUidRef.current = null;
    router.back();
  };

  const remotes = Object.entries(participants);

  // ── Error ──
  if (stage === "error") {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-navy-deep px-6">
        <Feather name="alert-circle" size={40} color={colors.gold} />
        <Text className="mt-4 text-center font-display text-2xl text-cream">
          Can't join this session
        </Text>
        <Text className="mb-6 mt-2 text-center font-sans text-sm text-slate-light">
          {errorMsg}
        </Text>
        <Button variant="gold" onPress={() => router.replace("/")}>
          Go to Dr. Nath
        </Button>
      </SafeAreaView>
    );
  }

  // ── Connected ──
  if (stage === "connected" && state === "connected") {
    return (
      <SafeAreaView className="flex-1 bg-navy-deep">
        <View className="flex-row items-center justify-between px-4 py-2">
          <Text className="font-sans-semibold text-sm text-cream">Guest — in session</Text>
          {netPoor || reconnecting ? (
            <Text className="font-sans text-xs text-amber-300">
              {reconnecting ? "Reconnecting…" : "Unstable connection"}
            </Text>
          ) : null}
        </View>

        {mediaError ? (
          <View className="mx-4 mb-2 flex-row items-center gap-2 rounded-xl bg-red-500/15 px-3 py-2">
            <Text className="flex-1 font-sans text-xs text-red-300">{mediaError}</Text>
            <Pressable onPress={retryMedia} className="rounded-full bg-white/15 px-3 py-1">
              <Text className="font-sans-semibold text-xs text-cream">Retry</Text>
            </Pressable>
          </View>
        ) : null}

        <View className="flex-1 gap-3 px-4">
          {remotes.length === 0 ? (
            <View className="flex-1 items-center justify-center rounded-2xl border border-gold/20 bg-navy">
              <Text className="font-sans text-sm text-slate-light">
                Waiting for others…
              </Text>
            </View>
          ) : (
            remotes.map(([sid, entry]) => (
              <RemoteTile key={sid} entry={entry} style={{ flex: 1 }} />
            ))
          )}
        </View>

        <View className="absolute right-5 top-20 h-40 w-28">
          <LocalTile
            trackRef={localVideoRef}
            camOn={camOn}
            micOn={micOn}
            name={name}
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
            onPress={leave}
            className="h-14 w-14 items-center justify-center rounded-full bg-red-600"
          >
            <Feather name="phone-off" size={22} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Lobby / waiting ──
  return (
    <SafeAreaView className="flex-1 bg-navy-deep px-6">
      <View className="flex-1 justify-center">
        <Text className="mb-2 text-xs font-sans-semibold uppercase tracking-[2px] text-gold">
          Dr. Nath · Coaching for Impact
        </Text>
        <Text className="mb-2 font-display text-3xl text-cream">
          {stage === "waiting" ? "Waiting to be let in" : "Join this session"}
        </Text>

        {stage === "waiting" ? (
          <>
            <Text className="mb-8 font-sans text-sm text-slate-light">
              {coachPresent
                ? "The coach has been notified. You'll join as soon as they admit you."
                : "You'll be let in once the coach joins and admits you."}
            </Text>
            <ActivityIndicator size="large" color={colors.gold} />
          </>
        ) : (
          <>
            <Text className="mb-8 font-sans text-sm text-slate-light">
              No account needed — enter your name and the coach will let you in.
            </Text>

            <View className="rounded-2xl bg-cream p-5">
              <Input
                label="Your name"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Alex Morgan"
                autoCapitalize="words"
                returnKeyType="go"
                onSubmitEditing={ask}
              />
              <Button variant="gold" onPress={ask} loading={asking} fullWidth>
                Ask to join
              </Button>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
