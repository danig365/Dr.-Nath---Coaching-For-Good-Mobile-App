import { View, Text } from "react-native";

// Port of frontend/src/components/SessionStatusBadge.jsx.
const STATUS_CONFIG = {
  confirmed: { text: "Confirmed", bg: "bg-gold/15", fg: "text-gold-deep", icon: "✓" },
  pending: {
    text: "Pending Confirmation",
    bg: "bg-amber-100",
    fg: "text-amber-800",
    icon: "⏱",
  },
  completed: { text: "Completed", bg: "bg-green-100", fg: "text-green-800", icon: "✓" },
  cancelled: { text: "Cancelled", bg: "bg-red-100", fg: "text-red-800", icon: "✕" },
};

export default function SessionStatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || {
    text: status,
    bg: "bg-cream-warm",
    fg: "text-slate",
    icon: "?",
  };

  return (
    <View className={`self-end rounded-full px-3 py-1 ${config.bg}`}>
      <Text className={`font-sans-medium text-xs ${config.fg}`}>
        {config.icon} {config.text}
      </Text>
    </View>
  );
}
