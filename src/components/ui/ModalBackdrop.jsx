import { View } from "react-native";

import { useKeyboardHeight } from "@/lib/useKeyboardHeight";

// The dimmed ground behind a centred modal card.
//
// Every modal in the app hand-rolled this same View, and none of them allowed
// for the keyboard — so opening a field inside a milestone, habit, form or
// agreement editor put the keyboard straight over the card. Giving it one owner
// means the inset is applied once and cannot drift between screens.
export default function ModalBackdrop({ children, className = "", ...rest }) {
  const keyboardHeight = useKeyboardHeight();

  return (
    <View
      style={{ paddingBottom: keyboardHeight }}
      className={`flex-1 items-center justify-center bg-navy-deep/60 p-4 ${className}`}
      {...rest}
    >
      {children}
    </View>
  );
}
