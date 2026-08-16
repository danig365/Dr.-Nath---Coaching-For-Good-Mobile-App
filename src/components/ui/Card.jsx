import { View, Pressable } from "react-native";

// Content card on a cream background. Pass `onPress` to make the whole card
// tappable (the common pattern for list rows: a session, a client, a resource).
export default function Card({ children, onPress, className = "", ...rest }) {
  const base = `rounded-2xl border border-cream-warm bg-white p-4 ${className}`;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        className={({ pressed }) => `${base} ${pressed ? "opacity-70" : ""}`}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View className={base} {...rest}>
      {children}
    </View>
  );
}
