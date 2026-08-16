import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import * as WebBrowser from "expo-web-browser";

import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui";
import { toast } from "@/lib/toast";
import { colors } from "@/theme/colors";

// Port of frontend/src/components/GoogleCalendarCard.jsx.
//
// Connect / disconnect a Google Calendar for two-way sync. Sits on Availability
// (coach) and My Learning (client).
//
// The web version navigates the whole page to Google's authorize_url and reads
// ?google=connected off the redirect back. A native app can't do that, so the
// consent screen opens in an in-app browser instead and we re-check status when
// it closes. The backend's redirect URI still points at the website
// (GOOGLE_OAUTH_REDIRECT_URI), which is fine — the user completes consent there
// and we just re-read the result.
//
// TODO(mobile): once a mobile redirect URI is registered with Google, switch to
// openAuthSessionAsync with the drnath:// scheme so the browser closes itself.
export default function GoogleCalendarCard() {
  const [status, setStatus] = useState(null); // { connected, email, is_active, configured }
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const { isCoach } = useAuth();

  const coach = !!(isCoach && isCoach());
  const subtitle = coach
    ? "Sync your bookings and block busy times automatically."
    : "Automatically add your booked sessions to your calendar.";

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get("/integrations/google/status/");
      setStatus(res.data);
    } catch {
      setStatus({ connected: false, configured: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const connect = async () => {
    setBusy(true);
    try {
      const res = await api.get("/integrations/google/connect/");
      if (res.data.authorize_url) {
        await WebBrowser.openBrowserAsync(res.data.authorize_url);
        // The browser has closed — the user either finished consent or backed
        // out. Re-read the server's view either way.
        await fetchStatus();
      }
    } catch (err) {
      toast.error(
        err.response?.data?.detail || "Google Calendar isn't available right now."
      );
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await api.post("/integrations/google/disconnect/");
      toast.success("Google Calendar disconnected.");
      await fetchStatus();
    } catch {
      toast.error("Couldn't disconnect. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const patchSetting = async (field, value) => {
    setStatus((s) => ({ ...s, [field]: value })); // optimistic
    try {
      await api.patch("/integrations/google/settings/", { [field]: value });
    } catch {
      setStatus((s) => ({ ...s, [field]: !value })); // revert
      toast.error("Couldn't update that setting.");
    }
  };

  // Hide entirely if the server has no Google integration configured.
  if (loading) return null;
  if (status && status.configured === false && !status.connected) return null;

  const connected = status?.connected;
  const needsReconnect = connected && status?.is_active === false;

  const Toggle = ({ field, label }) => (
    <Pressable
      onPress={() => patchSetting(field, !status?.[field])}
      className="flex-row items-center gap-2"
      hitSlop={6}
    >
      <View
        className={`h-4 w-4 items-center justify-center rounded border ${
          status?.[field] ? "border-gold bg-gold" : "border-gold/40 bg-cream"
        }`}
      >
        {status?.[field] ? (
          <Feather name="check" size={11} color={colors.navyDeep} />
        ) : null}
      </View>
      <Text className="font-sans text-xs text-slate">{label}</Text>
    </Pressable>
  );

  return (
    <View className="mb-6 gap-3 rounded-2xl border border-gold/30 bg-white p-5">
      <View className="flex-row items-center justify-between gap-4">
        <View className="min-w-0 flex-1 flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-gold/15">
            <Feather name="calendar" size={20} color={colors.gold} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="font-sans-bold text-sm text-navy">Google Calendar</Text>

            {connected ? (
              needsReconnect ? (
                <View className="mt-0.5 flex-row items-center gap-1">
                  <Feather name="alert-triangle" size={12} color="#B45309" />
                  <Text className="font-sans text-xs text-amber-700">
                    Access expired — please reconnect.
                  </Text>
                </View>
              ) : (
                <View className="mt-0.5 flex-row items-center gap-1">
                  <Feather name="check-circle" size={12} color="#2E7D32" />
                  <Text className="font-sans text-xs text-green-800" numberOfLines={1}>
                    Connected{status.email ? ` · ${status.email}` : ""}
                  </Text>
                </View>
              )
            ) : (
              <Text className="mt-0.5 font-sans text-xs text-slate">{subtitle}</Text>
            )}
          </View>
        </View>
      </View>

      <View className="flex-row items-center gap-2">
        {connected && !needsReconnect ? (
          <Button variant="ghost" size="sm" onPress={disconnect} disabled={busy}>
            Disconnect
          </Button>
        ) : null}

        {!connected || needsReconnect ? (
          <Button variant="gold" size="sm" onPress={connect} loading={busy}>
            {needsReconnect ? "Reconnect" : "Connect Google Calendar"}
          </Button>
        ) : null}
      </View>

      {/* Preferences (connected only) */}
      {connected && !needsReconnect ? (
        <View className="flex-row flex-wrap items-center gap-5 border-t border-gold/20 pt-3">
          <Toggle field="sync_bookings_out" label="Add my sessions to this calendar" />
          {coach ? (
            <Toggle field="block_busy_times" label="Block my busy times from bookings" />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
