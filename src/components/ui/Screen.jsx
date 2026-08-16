import { View, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/theme/colors";

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
  edges = ["top", "left", "right"],
  className = "",
  contentClassName = "",
}) {
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
        </ScrollView>
      ) : (
        <View className={`flex-1 ${padding} ${contentClassName}`}>{children}</View>
      )}
    </SafeAreaView>
  );
}
