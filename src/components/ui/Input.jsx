import { forwardRef } from "react";
import { View, Text, TextInput } from "react-native";

import { colors } from "@/theme/colors";

// Labelled text field with optional error text. `error` renders the message and
// switches the border, so form screens don't each reinvent validation styling.
const Input = forwardRef(function Input(
  { label, error, hint, className = "", multiline = false, ...rest },
  ref
) {
  return (
    <View className={`mb-4 ${className}`}>
      {label ? (
        <Text className="mb-1.5 font-sans-medium text-sm text-navy">{label}</Text>
      ) : null}

      <TextInput
        ref={ref}
        placeholderTextColor={colors.slateLight}
        multiline={multiline}
        className={[
          "rounded-2xl border bg-white px-4 py-3 font-sans text-base text-ink",
          error ? "border-red-600" : "border-cream-warm",
          multiline ? "min-h-[96px]" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={multiline ? { textAlignVertical: "top" } : undefined}
        {...rest}
      />

      {error ? (
        <Text className="mt-1 font-sans text-xs text-red-700">{error}</Text>
      ) : hint ? (
        <Text className="mt-1 font-sans text-xs text-slate-light">{hint}</Text>
      ) : null}
    </View>
  );
});

export default Input;
