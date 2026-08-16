import { View, Text } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { Card, Button } from "@/components/ui";
import { colors } from "@/theme/colors";

// Port of frontend/src/components/BookingCard.jsx — a pending booking request
// with accept / decline actions.
export default function BookingCard({ request, onAccept, onDecline }) {
  const formattedDate = new Date(request.session_date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const formattedTime = new Date(
    `2000-01-01T${request.session_time}`
  ).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const accepted = request.status === "accepted";

  return (
    <Card className={accepted ? "border-green-200" : "border-gold/20"}>
      <View className="flex-row items-start justify-between gap-3">
        <Text className="flex-1 font-display text-xl text-navy">
          {request.skill_title}
        </Text>
        {accepted ? (
          <View className="rounded bg-green-100 px-2 py-1">
            <Text className="font-sans text-xs text-green-800">Accepted</Text>
          </View>
        ) : null}
      </View>

      <View className="mt-4 flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-gold">
          <Text className="font-sans-bold text-lg text-navy-deep">
            {request.learner_username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-sans-medium text-navy">{request.learner_username}</Text>
          <Text className="font-sans text-sm text-slate-light">
            Skill level: {request.skill_level}
          </Text>
        </View>
      </View>

      <View className="mt-4 gap-2">
        <View className="flex-row items-center gap-2">
          <Feather name="calendar" size={14} color={colors.gold} />
          <Text className="font-sans text-sm text-slate">{formattedDate}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Feather name="clock" size={14} color={colors.gold} />
          <Text className="font-sans text-sm text-slate">
            {formattedTime} ({request.duration} mins)
          </Text>
        </View>
      </View>

      {request.message ? (
        <View className="mt-4">
          <View className="mb-1 flex-row items-center gap-2">
            <Feather name="message-square" size={14} color={colors.navy} />
            <Text className="font-sans-semibold text-sm text-navy">
              Learner's Message
            </Text>
          </View>
          <Text className="font-sans text-sm text-slate">{request.message}</Text>
        </View>
      ) : null}

      {request.status === "pending" ? (
        <View className="mt-4 gap-2">
          <Button variant="gold" onPress={() => onAccept(request.id)} fullWidth>
            Accept
          </Button>
          <Button variant="outline" onPress={() => onDecline(request.id)} fullWidth>
            Decline
          </Button>
        </View>
      ) : null}
    </Card>
  );
}
