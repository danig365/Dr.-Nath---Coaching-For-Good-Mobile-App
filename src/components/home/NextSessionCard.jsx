import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { useAuth } from "@/context/AuthContext";
import { Card, Button } from "@/components/ui";
import { isSessionLive, sessionStartDate } from "@/lib/sessionTiming";
import { colors } from "@/theme/colors";

// The next upcoming session, shown at the top of both Home screens.
//
// "Join" appears from 15 minutes before the start until the rejoin window
// closes — the same rule the rest of the app uses (see @/lib/sessionTiming), so
// a session that has already begun stays joinable.
const JOIN_LEAD_MS = 15 * 60 * 1000;

export default function NextSessionCard({ session, emptyLabel, emptyHref, emptyCta }) {
  const router = useRouter();
  const { timezone, isCoach } = useAuth();

  if (!session) {
    return (
      <Card className="mt-6 items-center py-8">
        <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-gold/15">
          <Feather name="calendar" size={20} color={colors.gold} />
        </View>
        <Text className="mb-4 text-center font-sans text-sm text-slate">{emptyLabel}</Text>
        {emptyCta ? (
          <Button variant="gold" onPress={() => router.push(emptyHref)}>
            {emptyCta}
          </Button>
        ) : null}
      </Card>
    );
  }

  const start = sessionStartDate(session);
  const when = start.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone || undefined,
  });

  const canJoin =
    session.status === "accepted" &&
    isSessionLive(session) &&
    Date.now() >= start.getTime() - JOIN_LEAD_MS;

  const withWhom = isCoach()
    ? session.learner_name || session.learner_username
    : session.mentor_name || session.mentor_username;

  return (
    <Card className="mt-6 overflow-hidden p-0">
      <View className="h-1 bg-gold" />
      <View className="p-5">
        <Text className="mb-1 text-xs font-sans-semibold uppercase tracking-[2px] text-gold-deep">
          Next session
        </Text>
        <Text className="font-display text-xl text-navy">{session.skill_title}</Text>
        <Text className="mt-0.5 font-sans text-sm text-slate">with {withWhom}</Text>

        <View className="mt-3 flex-row items-center gap-2">
          <Feather name="clock" size={13} color={colors.gold} />
          <Text className="font-sans text-sm text-slate">{when}</Text>
        </View>

        <View className="mt-4 flex-row gap-2">
          {canJoin ? (
            <Button
              variant="gold"
              onPress={() => router.push(`/session/${session.id}`)}
              className="flex-1"
            >
              Join now
            </Button>
          ) : null}
          <Button
            variant="outline"
            onPress={() => router.push(`/chat/${session.id}`)}
            className="flex-1"
          >
            Message
          </Button>
        </View>
      </View>
    </Card>
  );
}
