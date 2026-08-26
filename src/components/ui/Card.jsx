import { View, Pressable } from "react-native";

// Content card on a cream background. Pass `onPress` to make the whole card
// tappable (the common pattern for list rows: a session, a client, a resource).
export default function Card({ children, onPress, className = "", ...rest }) {
  // A `p-*` passed in className has to win over the default. Tailwind resolves
  // conflicting utilities by stylesheet order rather than the order they appear
  // in the string, so `p-4` beat every `p-0` call site — leaving a white gutter
  // inside cards built to be full-bleed (a navy header, a photo, a gold rail).
  const hasPadding = /(^|\s)p-\d/.test(className);
  const base = `rounded-2xl border border-cream-warm bg-white ${
    hasPadding ? "" : "p-4"
  } ${className}`;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        className={`${base} active:opacity-70`}
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
