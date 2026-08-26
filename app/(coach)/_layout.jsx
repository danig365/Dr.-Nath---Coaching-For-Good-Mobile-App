import { Stack } from "expo-router";

import { colors } from "@/theme/colors";
import RequireAuth from "@/components/RequireAuth";

// A coach navigates entirely from the bottom menu (AppMenu, mounted globally
// in app/_layout.jsx), so this group is a plain Stack — no tab bar. Sixteen
// destinations in five categories never fitted five tab slots honestly, and the
// four that did were an arbitrary subset of a longer list.
//
// Admin tools are deliberately not in the mobile app — they stay on the web,
// where the big screen suits them.
export default function CoachLayout() {
  return (
    <RequireAuth coachOnly>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.navy },
          headerTintColor: colors.cream,
          headerTitleStyle: { fontFamily: "PlayfairDisplay_400Regular" },
          contentStyle: { backgroundColor: colors.cream },
        }}
      >
        <Stack.Screen name="skills" options={{ title: "My Skills" }} />
        <Stack.Screen name="sessions" options={{ title: "My Sessions" }} />
        <Stack.Screen name="clients" options={{ title: "My Clients" }} />
        <Stack.Screen name="availability" options={{ title: "My Availability" }} />
        <Stack.Screen name="resources" options={{ title: "Resources" }} />
        <Stack.Screen name="agreements" options={{ title: "Agreements" }} />
        <Stack.Screen name="forms" options={{ title: "Forms & Surveys" }} />
        <Stack.Screen name="profile" options={{ title: "My Profile" }} />
      </Stack>
    </RequireAuth>
  );
}
