import { Stack } from "expo-router";

import { colors } from "@/theme/colors";
import RequireAuth from "@/components/RequireAuth";

// A client navigates entirely from the bottom menu (AppMenu, mounted globally
// in app/_layout.jsx), so this group is a plain Stack — no tab bar, matching
// the coach side.
export default function ClientLayout() {
  return (
    <RequireAuth>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.navy },
          headerTintColor: colors.cream,
          headerTitleStyle: { fontFamily: "PlayfairDisplay_400Regular" },
          contentStyle: { backgroundColor: colors.cream },
        }}
      >
        <Stack.Screen name="book" options={{ title: "Book a Session" }} />
        <Stack.Screen name="dashboard" options={{ title: "Home" }} />
        <Stack.Screen name="learning" options={{ title: "My Learning Journey" }} />
        <Stack.Screen name="resources" options={{ title: "Resources" }} />
        <Stack.Screen name="agreements" options={{ title: "Agreements" }} />
        <Stack.Screen name="forms" options={{ title: "Forms & Surveys" }} />
        <Stack.Screen name="profile" options={{ title: "My Profile" }} />
      </Stack>
    </RequireAuth>
  );
}
