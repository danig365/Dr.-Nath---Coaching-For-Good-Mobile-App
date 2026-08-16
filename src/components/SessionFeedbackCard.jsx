import { View, Text } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { colors } from "@/theme/colors";

// Port of frontend/src/components/SessionFeedbackCard.jsx.
//
// The web version uses a gradient background; RN has no CSS gradients without an
// extra dependency, so each tone uses its flat base colour instead.
const TONES = {
  gold: {
    outer: "border-gold/25 bg-cream",
    header: "border-gold/15",
    label: "text-gold-deep",
    badge: "bg-gold/15",
    badgeText: "text-gold-deep",
    icon: "bg-gold/15",
    iconColor: colors.goldDeep,
  },
  emerald: {
    outer: "border-emerald-200 bg-emerald-50",
    header: "border-emerald-100",
    label: "text-emerald-700",
    badge: "bg-emerald-100",
    badgeText: "text-emerald-800",
    icon: "bg-emerald-100",
    iconColor: "#047857",
  },
};

export default function SessionFeedbackCard({
  title,
  subtitle,
  badgeLabel,
  rating,
  comment,
  date,
  tone = "gold",
}) {
  const s = TONES[tone] || TONES.gold;

  return (
    <View className={`w-full overflow-hidden rounded-2xl border ${s.outer}`}>
      <View className={`flex-row items-start justify-between gap-3 border-b px-4 py-3 ${s.header}`}>
        <View className="min-w-0 flex-1 flex-row items-start gap-3">
          <View className={`h-10 w-10 items-center justify-center rounded-full ${s.icon}`}>
            <Feather name="message-square" size={16} color={s.iconColor} />
          </View>
          <View className="min-w-0 flex-1">
            <Text
              className={`text-[11px] font-sans-semibold uppercase tracking-[1.5px] ${s.label}`}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text className="mt-1 font-sans text-sm text-slate">{subtitle}</Text>
            ) : null}
          </View>
        </View>

        {badgeLabel ? (
          <View className={`self-start rounded-full px-3 py-1 ${s.badge}`}>
            <Text className={`text-[11px] font-sans-semibold ${s.badgeText}`}>
              {badgeLabel}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="px-4 py-4">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <View className="flex-row items-center gap-1">
            {Array.from({ length: 5 }).map((_, index) => (
              <Feather
                key={index}
                name="star"
                size={15}
                color={index < rating ? colors.gold : "rgba(27,43,74,0.18)"}
              />
            ))}
          </View>
          {date ? (
            <Text className="font-sans-medium text-xs text-slate-light">{date}</Text>
          ) : null}
        </View>

        <Text className="mt-3 font-sans text-sm leading-6 text-slate">{comment}</Text>
      </View>
    </View>
  );
}
