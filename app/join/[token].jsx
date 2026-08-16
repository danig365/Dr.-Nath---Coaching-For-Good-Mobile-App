import { useEffect, useRef, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { publicApi } from "@/api/client";
import { Button } from "@/components/ui";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/MagicJoin.jsx.
//
// Resolves an old email join link to its session and sends the client through
// the normal login flow — passwordless auto-join has been retired, so every
// client signs in with their own credentials.
//
// Reached via the app's deep-link scheme (drnath://join/<token>) or an https
// link once universal links are configured.
export default function MagicJoin() {
  const { token } = useLocalSearchParams();
  const router = useRouter();
  const [error, setError] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // guard against a double-run on remount
    ran.current = true;

    (async () => {
      try {
        const res = await publicApi.get(`/bookings/magic-join/${token}/`);
        const bookingId = res.data.booking_id;
        router.replace(`/login?next=${encodeURIComponent(`/session/${bookingId}`)}`);
      } catch (err) {
        setError(
          err.response?.data?.detail ||
            "This link isn't valid. Please sign in to join your session."
        );
      }
    })();
  }, [token, router]);

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="flex-1 items-center justify-center px-6">
        {!error ? (
          <>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text className="mt-5 text-center font-display text-lg text-navy">
              Getting you into your session…
            </Text>
            <Text className="mt-1 text-center font-sans text-sm text-slate">
              One moment.
            </Text>
          </>
        ) : (
          <>
            <Text className="mb-2 text-center font-display text-lg text-navy">
              Couldn't open your session
            </Text>
            <Text className="mb-5 max-w-sm text-center font-sans text-sm text-slate">
              {error}
            </Text>
            <Button variant="gold" onPress={() => router.replace("/login")}>
              Sign in
            </Button>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
