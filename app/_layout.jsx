import "../global.css";

import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { PlayfairDisplay_400Regular } from "@expo-google-fonts/playfair-display";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";

import { registerGlobals as registerLiveKitGlobals } from "@livekit/react-native";
import { StripeProvider } from "@stripe/stripe-react-native";

import { STRIPE_PUBLISHABLE_KEY } from "@/api/config";
import { AuthProvider } from "@/context/AuthContext";
import ToastHost from "@/components/ToastHost";
import SessionStartBanner from "@/components/SessionStartBanner";
import AppMenu from "@/components/AppMenu";
import PushDeepLinks from "@/components/PushDeepLinks";
import AssistantWidget from "@/components/AssistantWidget";
import { colors } from "@/theme/colors";

// Installs the WebRTC globals LiveKit needs. Must run once, before any room is
// created — module scope here guarantees that regardless of which route opens
// first. Requires a development build; this does not work in Expo Go.
registerLiveKitGlobals();

// Hold the splash until fonts are ready, so headings never flash in a fallback
// face before Playfair Display loads.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
        <AuthProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.navy },
              headerTintColor: colors.cream,
              headerTitleStyle: { fontFamily: "PlayfairDisplay_400Regular" },
              contentStyle: { backgroundColor: colors.cream },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="landing" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(client)" options={{ headerShown: false }} />
            <Stack.Screen name="(coach)" options={{ headerShown: false }} />

            {/* Everything below is pushed on top of a tab bar (or opened from a
                deep link) and uses the Stack's own header. Without an explicit
                title expo-router falls back to the route name, so these would
                otherwise read "contact", "book/[id]", "[bookingId]". */}
            <Stack.Screen name="add-skill" options={{ title: "Add Skill" }} />
            <Stack.Screen name="book/[id]" options={{ title: "Book a Session" }} />
            <Stack.Screen name="chat/[bookingId]" options={{ title: "Session Chat" }} />
            <Stack.Screen name="chemistry" options={{ title: "Chemistry Session" }} />
            <Stack.Screen name="coaches/index" options={{ title: "Coaches" }} />
            <Stack.Screen name="coaches/[id]" options={{ title: "Coach Profile" }} />
            <Stack.Screen name="complete-profile" options={{ title: "Complete Your Profile" }} />
            <Stack.Screen name="contact" options={{ title: "Contact" }} />
            <Stack.Screen name="group-chat/[id]" options={{ title: "Group Chat" }} />
            <Stack.Screen name="group-session/[id]/call" options={{ title: "Group Session" }} />
            <Stack.Screen name="group-sessions" options={{ title: "Group Sessions" }} />
            <Stack.Screen name="habits" options={{ title: "Habits" }} />
            <Stack.Screen name="join/[token]" options={{ title: "Joining Session" }} />
            <Stack.Screen name="match" options={{ title: "Smart Match" }} />
            <Stack.Screen name="milestones" options={{ title: "Milestones & Goals" }} />
            <Stack.Screen name="programme/[skillId]" options={{ title: "Programme" }} />
            <Stack.Screen name="session/[bookingId]/index" options={{ title: "Session" }} />
            <Stack.Screen name="session/[bookingId]/guest" options={{ title: "Join Session" }} />
            <Stack.Screen name="skills/index" options={{ title: "Skills" }} />
            <Stack.Screen name="skills/edit/[id]" options={{ title: "Edit Skill" }} />
          </Stack>
          {/* Global overlays, mirroring frontend/src/App.jsx. Each decides for
              itself whether to render (auth state / current route). */}
          <SessionStartBanner />
          <AssistantWidget />

          {/* The entire signed-in navigation, for both roles. Mounted at the
              root rather than inside a group so it stays reachable on the
              shared routes it points at — /milestones, /habits, /coaches,
              /contact — which live outside both groups. */}
          <AppMenu />

          {/* Routes a tapped notification to the screen it names. */}
          <PushDeepLinks />

          {/* Mounted last so toasts sit above the banner. */}
          <ToastHost />
        </AuthProvider>
        </StripeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
