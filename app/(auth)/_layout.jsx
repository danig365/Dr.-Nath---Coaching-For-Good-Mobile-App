import { View } from "react-native";
import { Stack } from "expo-router";

import GuestHeader from "@/components/GuestHeader";
import { colors } from "@/theme/colors";

// The signed-out screens carry the guest navbar, as they do on web (App.jsx
// renders <Navbar /> above every route). It lives here rather than in each
// screen so it stays mounted across the login <-> register <-> forgot-password
// transitions instead of re-animating on every push.
//
// The header owns the top safe-area inset, so the screens below it use
// edges={["bottom"]} on their own SafeAreaView.
export default function AuthLayout() {
  return (
    <View className="flex-1 bg-navy-deep">
      <GuestHeader />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.navyDeep },
        }}
      />
    </View>
  );
}
