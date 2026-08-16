import { useEffect, useState } from "react";
import { View, Text, Pressable, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { Screen, Card, Button } from "@/components/ui";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/CoachProfile.jsx.

function TagSection({ icon, title, items }) {
  if (!items?.length) return null;
  return (
    <Card className="rounded-3xl p-6">
      <View className="mb-4 flex-row items-center gap-2">
        <Feather name={icon} size={14} color={colors.goldDeep} />
        <Text className="text-sm font-sans-semibold uppercase tracking-wider text-gold-deep">
          {title}
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {items.map((it) => (
          <View
            key={it}
            className="rounded-full border border-gold/20 bg-gold/10 px-3 py-1.5"
          >
            <Text className="font-sans-medium text-xs text-gold-deep">{it}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

export default function CoachProfile() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [coach, setCoach] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/coaches/${id}/`)
      .then((res) => setCoach(res.data))
      .catch(() => setCoach(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Screen loading />;

  if (!coach) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <Text className="mb-4 text-5xl">🔍</Text>
          <Text className="mb-2 font-display text-2xl text-navy">Coach not found</Text>
          <Text className="mb-6 font-sans text-sm text-slate">
            This coach profile is unavailable.
          </Text>
          <Button variant="gold" onPress={() => router.push("/coaches")}>
            Back to Directory
          </Button>
        </View>
      </Screen>
    );
  }

  const name = coach.display_name || coach.username;

  return (
    <Screen>
      <Pressable
        onPress={() => router.push("/coaches")}
        className="mb-6 flex-row items-center gap-2"
      >
        <Feather name="arrow-left" size={16} color={colors.slate} />
        <Text className="font-sans-medium text-sm text-slate">Back to Directory</Text>
      </Pressable>

      {/* ── Profile card ───────────────────────────── */}
      <Card className="mb-6 rounded-3xl p-6">
        <View className="flex-row items-start gap-5">
          <View className="h-20 w-20 items-center justify-center rounded-2xl bg-gold">
            <Text className="font-display text-3xl text-navy-deep">
              {name?.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View className="min-w-0 flex-1">
            <View className="mb-2 flex-row flex-wrap items-center gap-2">
              {coach.linkedin_url ? (
                <Pressable onPress={() => Linking.openURL(coach.linkedin_url)}>
                  <Text className="font-display text-2xl text-navy underline">{name}</Text>
                </Pressable>
              ) : (
                <Text className="font-display text-2xl text-navy">{name}</Text>
              )}

              {coach.is_verified ? (
                <View className="flex-row items-center gap-1 rounded-full border border-green-200 bg-green-100 px-2.5 py-1">
                  <Feather name="check-circle" size={11} color="#2E7D32" />
                  <Text className="font-sans-semibold text-xs text-green-900">Verified</Text>
                </View>
              ) : null}

              {coach.linkedin_url ? (
                <Pressable
                  onPress={() => Linking.openURL(coach.linkedin_url)}
                  className="flex-row items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1"
                >
                  <Feather name="linkedin" size={11} color="#0A66C2" />
                  <Text className="font-sans-semibold text-xs text-blue-700">LinkedIn</Text>
                </Pressable>
              ) : null}
            </View>

            <View className="flex-row flex-wrap items-center gap-4">
              {coach.avg_rating ? (
                <View className="flex-row items-center gap-1">
                  <Feather name="star" size={14} color={colors.gold} />
                  <Text className="font-sans-semibold text-sm text-gold-deep">
                    {parseFloat(coach.avg_rating).toFixed(1)}
                  </Text>
                </View>
              ) : null}
              {coach.years_experience ? (
                <Text className="font-sans text-sm text-slate">
                  {coach.years_experience} yrs experience
                </Text>
              ) : null}
              {coach.hourly_rate ? (
                <Text className="font-sans-semibold text-sm text-navy">
                  ${coach.hourly_rate}
                  <Text className="font-sans text-slate">/hr</Text>
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <Text className="mt-6 font-sans text-base leading-6 text-slate">
          {coach.bio || "This coach hasn't added a bio yet."}
        </Text>

        <Button variant="gold" onPress={() => router.push("/skills")} className="mt-7">
          Browse Sessions →
        </Button>
      </Card>

      {/* ── Detail sections ────────────────────────── */}
      <View className="gap-6">
        <TagSection icon="zap" title="Specialties" items={coach.specialties} />
        <TagSection icon="award" title="Certifications" items={coach.certifications} />
        <TagSection icon="briefcase" title="Industries" items={coach.industries} />
        <TagSection icon="globe" title="Languages" items={coach.languages} />
      </View>
    </Screen>
  );
}
