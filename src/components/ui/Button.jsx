import { Pressable, Text, ActivityIndicator, View } from "react-native";

import { colors } from "@/theme/colors";

// Pill buttons, matching the web's .gold-btn / .navy-btn / .outline-btn
// (frontend/src/index.css). Buttons are rounded-full site-wide — keep it that way.
const VARIANTS = {
  gold: { container: "bg-gold", pressed: "bg-gold-light", label: "text-navy", spinner: colors.navy },
  navy: { container: "bg-navy", pressed: "bg-navy-soft", label: "text-cream", spinner: colors.cream },
  outline: {
    container: "border-2 border-navy bg-transparent",
    pressed: "border-2 border-gold bg-transparent",
    label: "text-navy",
    spinner: colors.navy,
  },
  ghost: { container: "bg-transparent", pressed: "bg-cream-warm", label: "text-navy", spinner: colors.navy },
};

const SIZES = {
  sm: { container: "px-4 py-2", label: "text-sm" },
  md: { container: "px-6 py-3", label: "text-base" },
  lg: { container: "px-8 py-4", label: "text-lg" },
};

export default function Button({
  children,
  onPress,
  variant = "gold",
  size = "md",
  loading = false,
  disabled = false,
  fullWidth = false,
  className = "",
  ...rest
}) {
  const v = VARIANTS[variant] ?? VARIANTS.gold;
  const s = SIZES[size] ?? SIZES.md;
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={inactive ? undefined : onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      className={({ pressed }) =>
        [
          "flex-row items-center justify-center rounded-full",
          s.container,
          pressed && !inactive ? v.pressed : v.container,
          inactive ? "opacity-50" : "",
          fullWidth ? "w-full" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")
      }
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.spinner} />
      ) : typeof children === "string" ? (
        <Text className={`font-sans-semibold ${s.label} ${v.label}`}>{children}</Text>
      ) : (
        <View className="flex-row items-center gap-2">{children}</View>
      )}
    </Pressable>
  );
}
