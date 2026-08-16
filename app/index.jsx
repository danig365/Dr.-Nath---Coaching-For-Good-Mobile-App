import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";

import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/colors";

// Entry gate. Decides where a launch lands, mirroring the web app's HomeGate +
// RequireProfileComplete wrappers (frontend/src/App.jsx).
//
//   not signed in        -> /login
//   profile incomplete   -> /complete-profile
//   coach / mentor       -> /(coach)/dashboard
//   everyone else        -> /(client)/dashboard
export default function Index() {
  const { loading, isAuthenticated, profileComplete, role } = useAuth();

  // Waiting on SecureStore hydration and a possible token refresh.
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
  return <Redirect href={isCoach ? "/(coach)/dashboard" : "/(client)/dashboard"} />;
}
