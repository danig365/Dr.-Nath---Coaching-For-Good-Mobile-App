import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";

import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/colors";

// Entry gate. Decides where a launch lands, mirroring the web app's HomeGate +
// RequireProfileComplete wrappers (frontend/src/App.jsx).
//
//   not signed in        -> /login
//   profile incomplete   -> /complete-profile
//   coach / mentor       -> /(coach)/skills   (as web: / redirects a coach there)
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

  // Not signed in -> the landing page, not straight to a login wall. Someone
  // who has just installed the app may not be a client yet, and needs a route
  // to the free chemistry session. Sign-in is one tap from there.
  if (!isAuthenticated) return <Redirect href="/landing" />;
  if (!profileComplete) return <Redirect href="/complete-profile" />;

  const isCoach = role === "coach" || role === "mentor";
  return <Redirect href={isCoach ? "/(coach)/skills" : "/(client)/book"} />;
}
