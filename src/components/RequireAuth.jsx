import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";

import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/colors";

// Route guard for the authenticated tab groups. Mirrors the web app's
// RequireProfileComplete wrapper plus its role checks (frontend/src/App.jsx).
//
// This is a client-side convenience only — every endpoint is permission-checked
// server-side. Never treat passing this guard as authorisation.
export default function RequireAuth({ children, coachOnly = false }) {
  const { loading, isAuthenticated, profileComplete, role } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-cream">
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!profileComplete) return <Redirect href="/complete-profile" />;

  const isCoach = role === "coach" || role === "mentor";
  if (coachOnly && !isCoach) return <Redirect href="/(client)/dashboard" />;
  if (!coachOnly && isCoach) return <Redirect href="/(coach)/dashboard" />;

  return children;
}
