import { View, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/theme/colors";
import { MENU_CLEARANCE, useAppMenuVisible } from "@/lib/appMenu";

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
  // There is no tab bar — the Menu button floats over the bottom instead, so
  // the last row of content needs room to clear it. The button is positioned at
  // insets.bottom + 20, so the clearance has to include that inset too.
  //
  // These must stay above the `loading` early return: a hook that only runs on
  // some renders changes the hook order between them, which React 19 reports as
  // "Internal React error: Expected static flag was missing".
  const insets = useSafeAreaInsets();
  const menuVisible = useAppMenuVisible();
  const bottomInset = menuVisible ? insets.bottom + MENU_CLEARANCE : 0;

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
