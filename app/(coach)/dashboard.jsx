import { View, Text } from "react-native";
import { useRouter } from "expo-router";

import { useAuth } from "@/context/AuthContext";
import { Screen, Card, Button, Badge } from "@/components/ui";

// Phase 1 coach home — same purpose as the client one: prove the auth stack and
// give the coach tab bar a landing screen. Phase 3 replaces the body.
export default function CoachDashboard() {
  const router = useRouter();
  const { firstName, user, timezone, approvalStatus, logout } = useAuth();

  const onLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <Screen>
      <Text className="text-xs font-sans-semibold uppercase tracking-[3px] text-gold-deep">
        Coach
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
          <Row label="Approval" value={approvalStatus} />
        </View>
        <Badge tone="navy" className="mt-4">
          {user?.role ?? "coach"}
        </Badge>
      </Card>

      {/* Profile isn't a tab for coaches (Workspace takes that slot), so it is
          reachable from here. */}
      <Button
        variant="navy"
        onPress={() => router.push("/(coach)/profile")}
        className="mt-6"
        fullWidth
      >
        Edit profile
      </Button>

      <Button variant="outline" onPress={onLogout} className="mt-3" fullWidth>
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
