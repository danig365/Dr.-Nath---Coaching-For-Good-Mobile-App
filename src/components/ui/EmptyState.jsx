import { View, Text } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { colors } from "@/theme/colors";
import Button from "./Button";

// Shown when a list has no rows. Mirrors the web EmptyState component so the
// copy and tone stay the same across platforms.
export default function EmptyState({
  icon = "inbox",
  title,
  message,
  actionLabel,
  onAction,
  className = "",
}) {
  return (
    <View className={`items-center justify-center px-6 py-12 ${className}`}>
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-cream-warm">
        <Feather name={icon} size={28} color={colors.goldDeep} />
      </View>

      {title ? (
        <Text className="text-center font-display text-2xl text-navy">{title}</Text>
      ) : null}

      {message ? (
        <Text className="mt-2 text-center font-sans text-base text-slate">{message}</Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button onPress={onAction} variant="gold" size="md" className="mt-5">
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}
