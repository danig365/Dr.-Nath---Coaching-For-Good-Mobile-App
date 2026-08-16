import { View, Text } from "react-native";

import { Screen } from "@/components/ui";

// Temporary body for a route that exists so navigation works, but whose real
// screen has not been converted yet (Phase 2/3).
//
// Replace the whole file with the converted screen — do not import this from
// production code once a screen is real.
export default function Placeholder({ title, webSource, note }) {
  return (
    <Screen>
      <View className="mt-10 items-center">
        <Text className="text-xs font-sans-semibold uppercase tracking-[3px] text-gold-deep">
          Not converted yet
        </Text>
        <Text className="mt-3 text-center font-display text-3xl text-navy">{title}</Text>
        {webSource ? (
          <Text className="mt-3 text-center font-sans text-sm text-slate">
            Convert from{"\n"}
            <Text className="font-sans-medium text-navy">{webSource}</Text>
          </Text>
        ) : null}
        {note ? (
          <Text className="mt-3 text-center font-sans text-sm text-slate-light">{note}</Text>
        ) : null}
      </View>
    </Screen>
  );
}
