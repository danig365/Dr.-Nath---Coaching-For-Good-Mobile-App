import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { colors } from "@/theme/colors";

// The tab bar holds five destinations; the web navbar holds roughly ten per
// role. These tiles carry the overflow, so nothing is unreachable.
//
// `actions` is [{ icon, label, href }].
export default function QuickActions({ title = "Quick actions", actions }) {
  const router = useRouter();

  return (
    <View className="mt-6">
      <Text className="mb-3 text-xs font-sans-semibold uppercase tracking-[2px] text-gold-deep">
        {title}
      </Text>

      <View className="flex-row flex-wrap gap-3">
        {actions.map((a) => (
          <Pressable
            key={a.href}
            onPress={() => router.push(a.href)}
            className="min-w-[30%] flex-1 items-center rounded-2xl border border-gold/15 bg-white px-3 py-4"
          >
            <View className="mb-2 h-10 w-10 items-center justify-center rounded-full bg-gold/15">
              <Feather name={a.icon} size={18} color={colors.goldDeep} />
            </View>
            <Text
              className="text-center font-sans-medium text-xs text-navy"
              numberOfLines={2}
            >
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
