import { useEffect, useState } from "react";
import { Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";

import { subscribe, dismiss } from "@/lib/toast";

// Renders whatever `@/lib/toast` currently holds. Mounted once in the root
// layout; screens never render this themselves.
const STYLES = {
  success: "bg-navy border-gold",
  error: "bg-red-800 border-red-500",
  info: "bg-navy-soft border-gold",
  warn: "bg-gold-deep border-gold-light",
};

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);
  const insets = useSafeAreaInsets();

  useEffect(() => subscribe(setToasts), []);

  if (!toasts.length) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      className="absolute left-0 right-0 z-50 px-4"
      style={{ top: insets.top + 8 }}
    >
      {toasts.map((t) => (
        <Animated.View key={t.id} entering={FadeInUp} exiting={FadeOutUp}>
          <Pressable
            onPress={() => dismiss(t.id)}
            className={`mb-2 rounded-2xl border px-4 py-3 ${STYLES[t.type] ?? STYLES.info}`}
          >
            <Text className="font-sans-medium text-cream">{t.message}</Text>
          </Pressable>
        </Animated.View>
      ))}
    </Animated.View>
  );
}
