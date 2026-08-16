import { View, Text } from "react-native";
import { useRouter } from "expo-router";

import { useAuth } from "@/context/AuthContext";
import { Screen, Card, Button, Badge } from "@/components/ui";

// Phase 1 client home. Intentionally minimal: it proves the auth stack works
// end to end (SecureStore -> JWT claims -> UI -> logout) and gives the tab bar a
// landing screen. Phase 3 replaces the body with the converted dashboard.
export default function ClientDashboard() {
  const router = useRouter();
  const { firstName, user, timezone, logout } = useAuth();

  const onLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <Screen>
      <Text className="text-xs font-sans-semibold uppercase tracking-[3px] text-gold-deep">
        Welcome back
      </Text>
      <Text className="mt-2 font-display text-4xl text-navy">
        {firstName || user?.username || "Hello"}
      </Text>

      <Card className="mt-6">
        <Text className="font-sans-semibold text-navy">Your session</Text>
        <View className="mt-3 gap-2">
          <Row label="Signed in as" value={user?.username} />
          <Row label="Email" value={user?.email} />
          <Row label="Timezone" value={timezone || "resolving…"} />
        </View>
        <Badge tone="gold" className="mt-4">
          {user?.role ?? "client"}
        </Badge>
      </Card>

      <Button variant="outline" onPress={onLogout} className="mt-8" fullWidth>
        Sign out
      </Button>
    </Screen>
  );
}

function Row({ label, value }) {
  return (
    <View className="flex-row justify-between">
      <Text className="font-sans text-sm text-slate-light">{label}</Text>
      <Text className="font-sans-medium text-sm text-navy">{value ?? "—"}</Text>
    </View>
  );
}
