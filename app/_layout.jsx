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
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(client)" options={{ headerShown: false }} />
            <Stack.Screen name="(coach)" options={{ headerShown: false }} />
          </Stack>
          {/* Global overlays, mirroring frontend/src/App.jsx. Each decides for
              itself whether to render (auth state / current route). */}
          <SessionStartBanner />
          <AssistantWidget />

          {/* Mounted last so toasts sit above the banner. */}
          <ToastHost />
        </AuthProvider>
        </StripeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
