import { View, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/theme/colors";
import { MENU_CLEARANCE, useAppMenuVisible } from "@/lib/appMenu";
import { useKeyboardHeight } from "@/lib/useKeyboardHeight";

// Standard screen shell: cream background, safe-area aware, optional scrolling,
// pull-to-refresh and a centred loading state.
//
//   <Screen loading={loading} onRefresh={load}>
//     ...content...
//   </Screen>
export default function Screen({
  children,
  scroll = true,
  loading = false,
  onRefresh,
  refreshing = false,
  padded = true,
  edges = ["left", "right"],
  className = "",
  contentClassName = "",
}) {
  // Two things can sit over the bottom of a screen. The Menu button floats
  // there (positioned at insets.bottom + 20, so the clearance includes that
  // inset), and the software keyboard covers it while a field is focused —
  // which otherwise leaves the fields below the focused one unreachable.
  //
  // These must stay above the `loading` early return: a hook that only runs on
  // some renders changes the hook order between them, which React 19 reports as
  // "Internal React error: Expected static flag was missing".
  const insets = useSafeAreaInsets();
  const menuVisible = useAppMenuVisible();
  const keyboardHeight = useKeyboardHeight();
  const bottomInset =
    (menuVisible ? insets.bottom + MENU_CLEARANCE : 0) + keyboardHeight;

  if (loading) {
    return (
      <SafeAreaView edges={edges} className="flex-1 bg-cream">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      </SafeAreaView>
    );
  }

  const padding = padded ? "p-5" : "";

  return (
    <SafeAreaView edges={edges} className={`flex-1 bg-cream ${className}`}>
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName={`${padding} ${contentClassName}`}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.gold}
                colors={[colors.gold]}
              />
            ) : undefined
          }
        >
          {children}
          {bottomInset ? <View style={{ height: bottomInset }} /> : null}
        </ScrollView>
      ) : (
        <View
          style={{ paddingBottom: bottomInset }}
          className={`flex-1 ${padding} ${contentClassName}`}
        >
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
