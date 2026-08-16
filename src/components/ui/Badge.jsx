import { View, Text } from "react-native";

// Small status pill. `tone` covers the booking/session statuses used across the
// app (see SessionBooking.STATUS_CHOICES in backend/bookings/models.py).
const TONES = {
  neutral: "bg-cream-warm",
  navy: "bg-navy",
  gold: "bg-gold",
  success: "bg-green-100",
  danger: "bg-red-100",
  muted: "bg-slate-100",
};

const TEXT_TONES = {
  neutral: "text-slate",
  navy: "text-cream",
  gold: "text-navy",
  success: "text-green-900",
  danger: "text-red-900",
  muted: "text-slate",
};

export default function Badge({ children, tone = "neutral", className = "" }) {
  return (
    <View className={`self-start rounded-full px-3 py-1 ${TONES[tone] ?? TONES.neutral} ${className}`}>
      <Text className={`font-sans-medium text-xs ${TEXT_TONES[tone] ?? TEXT_TONES.neutral}`}>
        {children}
      </Text>
    </View>
  );
}
