import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

// How much of the screen the software keyboard currently covers, or 0.
//
// KeyboardAvoidingView on its own is enough for a short form, but on a long one
// the ScrollView's content still runs underneath the keyboard and the fields
// below the focused one cannot be scrolled to. Long forms render a spacer of
// this height at the end of their scroll content so everything stays reachable.
//
// A spacer rather than contentContainerStyle: NativeWind compiles
// contentContainerClassName into that same prop, so passing both lets one
// silently overwrite the other.
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    // iOS reports the keyboard before it animates in, Android only after.
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const show = Keyboard.addListener(showEvent, (e) =>
      setHeight(e.endCoordinates?.height ?? 0)
    );
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}

export default useKeyboardHeight;
