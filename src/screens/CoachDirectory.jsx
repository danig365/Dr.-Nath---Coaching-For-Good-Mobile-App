import { useEffect, useState } from "react";
import { View, Text, Pressable, Linking, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { Screen, Card, Button, Input } from "@/components/ui";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/CoachDirectory.jsx.

function CoachCard({ coach, onView }) {
  const name = coach.display_name || coach.username;

  return (
    <Card className="overflow-hidden p-0">
      <View className="h-1 bg-gold" />

      <View className="p-6">
        {/* Header row */}
        <View className="mb-4 flex-row items-start gap-4">
          <View className="h-12 w-12 items-center justify-center rounded-xl bg-gold">
            <Text className="font-sans-bold text-lg text-navy-deep">
              {name?.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View className="min-w-0 flex-1">
            <View className="mb-1 flex-row flex-wrap items-center gap-2">
              <Text className="font-display text-lg text-navy">{name}</Text>

              {coach.is_verified ? (
                <View className="flex-row items-center gap-1 rounded-full border border-green-200 bg-green-100 px-2 py-0.5">
                  <Feather name="check-circle" size={10} color="#2E7D32" />
                  <Text className="font-sans-semibold text-xs text-green-900">Verified</Text>
                </View>
              ) : null}

              {coach.linkedin_url ? (
                <Pressable onPress={() => Linking.openURL(coach.linkedin_url)} hitSlop={6}>
                  <Feather name="linkedin" size={15} color="#0A66C2" />
                </Pressable>
              ) : null}
            </View>

            {coach.avg_rating ? (
              <View className="flex-row items-center gap-1">
                <Feather name="star" size={11} color={colors.gold} />
                <Text className="font-sans-semibold text-xs text-gold-deep">
                  {parseFloat(coach.avg_rating).toFixed(1)}
                </Text>
              </View>
            ) : null}
          </View>

          {coach.hourly_rate ? (
            <View className="items-end">
              <Text className="font-sans text-xs text-slate">from</Text>
              <Text className="font-display text-base text-navy">
                ${coach.hourly_rate}
                <Text className="font-sans text-xs text-slate">/hr</Text>
              </Text>
            </View>
          ) : null}
        </View>

        {/* Bio */}
        <Text className="mb-4 font-sans text-sm leading-6 text-slate" numberOfLines={2}>
          {coach.bio || "Experienced coach ready to help you grow."}
        </Text>

        {/* Specialties */}
        {coach.specialties?.length > 0 ? (
          <View className="mb-5 flex-row flex-wrap gap-1.5">
            {coach.specialties.slice(0, 4).map((s) => (
              <View
                key={s}
                className="rounded-full border border-gold/20 bg-gold/10 px-2.5 py-1"
              >
                <Text className="font-sans-medium text-xs text-gold-deep">{s}</Text>
              </View>
            ))}
            {coach.specialties.length > 4 ? (
              <View className="px-2 py-1">
                <Text className="font-sans text-xs text-slate-light">
                  +{coach.specialties.length - 4} more
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Button variant="gold" onPress={onView} fullWidth>
          View Profile →
        </Button>
      </View>
    </Card>
  );
}

export default function CoachDirectory() {
  const router = useRouter();
  const [filters, setFilters] = useState({ specialty: "", industry: "", verified: false });
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Debounced refetch — the filters are free-text, so this avoids a request per
  // keystroke. Same 400ms window as the web.
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCoaches();
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const fetchCoaches = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.specialty) params.specialty = filters.specialty;
      if (filters.industry) params.industry = filters.industry;
      if (filters.verified) params.verified = true;
      const res = await api.get("/coaches/", { params });
      setCoaches(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const hasFilters = filters.specialty || filters.industry || filters.verified;
  const clearFilters = () => setFilters({ specialty: "", industry: "", verified: false });

  return (
    <Screen>
      <Text className="mb-8 font-sans text-base text-slate">
        Browse our community of verified coaches and find the right guide for your journey.
      </Text>

      {/* ── Search & Filter Bar ──────────────────────── */}
      <View className="mb-2 flex-row items-start gap-3">
        <View className="flex-1">
          <Input
            placeholder="Search by specialty..."
            value={filters.specialty}
            onChangeText={(v) => setFilters((f) => ({ ...f, specialty: v }))}
            className="mb-0"
          />
        </View>
        <Pressable
          onPress={() => setShowFilters((v) => !v)}
          className={`h-[46px] flex-row items-center gap-2 rounded-2xl border px-4 ${
            showFilters ? "border-gold bg-gold" : "border-gold/30 bg-white"
          }`}
        >
          <Feather
            name="sliders"
            size={13}
            color={showFilters ? colors.navyDeep : colors.slate}
          />
          <Text
            className={`font-sans-semibold text-sm ${
              showFilters ? "text-navy-deep" : "text-slate"
            }`}
          >
            Filters
          </Text>
          {hasFilters ? <View className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
        </Pressable>
      </View>

      {hasFilters ? (
        <Pressable
          onPress={clearFilters}
          className="mb-3 flex-row items-center gap-1.5 self-start rounded-xl border border-red-200 bg-red-50 px-3 py-2"
        >
          <Feather name="x" size={12} color="#B91C1C" />
          <Text className="font-sans-semibold text-xs text-red-700">Clear</Text>
        </Pressable>
      ) : null}

      {showFilters ? (
        <View className="mb-8 gap-4 rounded-2xl border border-gold/15 bg-white p-4">
          <Input
            label="Industry"
            placeholder="e.g. Technology, Finance"
            value={filters.industry}
            onChangeText={(v) => setFilters((f) => ({ ...f, industry: v }))}
            className="mb-0"
          />

          <Pressable
            onPress={() => setFilters((f) => ({ ...f, verified: !f.verified }))}
            className="flex-row items-center gap-2.5"
          >
            <View
              className={`h-5 w-10 justify-center rounded-full px-0.5 ${
                filters.verified ? "bg-gold" : "bg-gold/20"
              }`}
            >
              <View
                className={`h-4 w-4 rounded-full bg-white ${
                  filters.verified ? "self-end" : "self-start"
                }`}
              />
            </View>
            <Text className="font-sans-medium text-sm text-navy">
              Verified coaches only
            </Text>
          </Pressable>
        </View>
      ) : (
        <View className="mb-8" />
      )}

      {/* ── Results count ────────────────────────────── */}
      {!loading ? (
        <View className="mb-5 flex-row items-center gap-1">
          <Feather name="users" size={11} color={colors.slateLight} />
          <Text className="text-xs font-sans-semibold uppercase tracking-wider text-slate-light">
            {coaches.length} {coaches.length === 1 ? "coach" : "coaches"} found
          </Text>
        </View>
      ) : null}

      {/* ── Loading ──────────────────────────────────── */}
      {loading ? (
        <View className="items-center gap-4 py-20">
          <ActivityIndicator size="large" color={colors.gold} />
          <Text className="font-sans text-sm text-slate">Finding coaches...</Text>
        </View>
      ) : null}

      {/* ── Empty State ──────────────────────────────── */}
      {!loading && coaches.length === 0 ? (
        <Card className="items-center py-20">
          <Text className="mb-4 text-5xl">🔍</Text>
          <Text className="mb-2 font-display text-xl text-navy">No coaches found</Text>
          <Text className="mb-5 text-center font-sans text-sm text-slate">
            Try adjusting your filters or search terms.
          </Text>
          {hasFilters ? (
            <Button variant="gold" onPress={clearFilters}>
              Clear Filters
            </Button>
          ) : null}
        </Card>
      ) : null}

      {/* ── Coach list ───────────────────────────────── */}
      {!loading && coaches.length > 0 ? (
        <View className="gap-5">
          {coaches.map((coach) => (
            <CoachCard
              key={coach.user_id}
              coach={coach}
              onView={() => router.push(`/coaches/${coach.user_id}`)}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
