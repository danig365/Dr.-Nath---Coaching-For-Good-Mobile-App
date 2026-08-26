import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Linking, ActivityIndicator } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { Screen, Card, Input } from "@/components/ui";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/CoachClients.jsx.
//
// Everyone who has signed up — including people who haven't booked yet. The web
// renders a four-column table; on a phone each client becomes a card.
export default function CoachClients() {
  const { isAuthenticated, isCoach, logout } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!isAuthenticated || !isCoach()) {
      logout();
      return;
    }
    api
      .get("/clients/")
      .then((res) => setClients(Array.isArray(res.data) ? res.data : []))
      .catch(() => setClients([]))
      .finally(() => setLoading(false));
  }, [isAuthenticated, isCoach, logout]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.organisation || "").toLowerCase().includes(q)
    );
  }, [clients, query]);

  const fmtDate = (d) =>
    d
      ? new Date(`${d}T00:00:00`).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  return (
    <Screen>
      <Text className="font-sans text-base text-slate">
        Everyone who has signed up — including people who haven't booked yet.
      </Text>

      <View className="mt-8">
        <Input
          placeholder="Search by name, email or organisation…"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
      </View>

      <View className="mb-5 flex-row items-center gap-1 self-start rounded-full bg-gold/15 px-3 py-2">
        <Feather name="users" size={12} color={colors.goldDeep} />
        <Text className="text-xs font-sans-semibold uppercase tracking-wider text-gold-deep">
          {filtered.length} {filtered.length === 1 ? "client" : "clients"}
        </Text>
      </View>

      {loading ? (
        <View className="items-center py-20">
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : filtered.length === 0 ? (
        <Card className="items-center py-20">
          <Text className="mb-3 text-5xl">👥</Text>
          <Text className="text-center font-sans text-sm text-slate">
            {clients.length === 0
              ? "No clients have signed up yet."
              : "No clients match your search."}
          </Text>
        </Card>
      ) : (
        <View className="gap-3">
          {filtered.map((c) => (
            <Card key={c.user_id}>
              <View className="flex-row items-center gap-3">
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-gold">
                  <Text className="font-sans-bold text-sm text-navy-deep">
                    {(c.name || "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="font-sans-semibold text-sm text-navy" numberOfLines={1}>
                    {c.name}
                  </Text>
                  {c.organisation || c.job_title ? (
                    <Text className="font-sans text-xs text-slate" numberOfLines={1}>
                      {[c.job_title, c.organisation].filter(Boolean).join(" · ")}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View className="mt-3 gap-1.5">
                <Pressable
                  onPress={() => Linking.openURL(`mailto:${c.email}`)}
                  className="flex-row items-center gap-1.5"
                >
                  <Feather name="mail" size={12} color={colors.goldDeep} />
                  <Text
                    className="flex-1 font-sans text-sm text-gold-deep underline"
                    numberOfLines={1}
                  >
                    {c.email}
                  </Text>
                </Pressable>

                <View className="flex-row items-center gap-1.5">
                  <Feather name="calendar" size={12} color={colors.slate} />
                  <Text className="font-sans text-sm text-slate">{fmtDate(c.joined)}</Text>
                </View>

                <Text className="font-sans text-sm text-slate">
                  <Text className="font-sans-bold text-navy">{c.bookings_with_me}</Text>
                  <Text className="text-xs"> with you</Text>
                </Text>
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
