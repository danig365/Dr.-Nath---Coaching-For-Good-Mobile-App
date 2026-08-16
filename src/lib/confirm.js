import { Alert } from "react-native";

// Replacement for window.confirm(), which doesn't exist in React Native.
//
// The web calls are synchronous (`if (!window.confirm(...)) return;`); this
// returns a promise, so call sites become `if (!(await confirm(...))) return;`.
//
//   const ok = await confirm("Delete this milestone?");
export function confirm(message, { title = "", confirmLabel = "OK", destructive = true } = {}) {
  return new Promise((resolve) => {
    Alert.alert(title || message, title ? message : undefined, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: destructive ? "destructive" : "default",
        onPress: () => resolve(true),
      },
    ]);
  });
}

export default confirm;
