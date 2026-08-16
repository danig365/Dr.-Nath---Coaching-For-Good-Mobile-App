import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { Screen, Card, Button } from "@/components/ui";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/SmartMatch.jsx — the three-question coach matcher.

const GOAL_OPTIONS = [
  "Leadership",
  "Executive",
  "Career Transition",
  "Work-Life Balance",
  "Team Management",
  "Personal Development",
];
const INDUSTRY_OPTIONS = [
  "Healthcare",
  "Finance",
  "Technology",
  "Energy",
  "Education",
  "Retail",
];
const LANGUAGE_OPTIONS = ["English", "French", "Spanish", "Arabic", "Mandarin"];

const STEPS = [
  { n: 1, label: "Goals" },
  { n: 2, label: "Industry" },
  { n: 3, label: "Language" },
];

function StepBar({ step }) {
  return (
    <View className="mb-8 flex-row items-center justify-center gap-2">
      {STEPS.map((s, i) => (
        <View key={s.n} className="flex-row items-center gap-2">
          <View className="flex-row items-center gap-1.5">
            <View
              className={`h-7 w-7 items-center justify-center rounded-full ${
                step >= s.n ? "bg-gold" : "bg-gold/10"
              }`}
            >
              {step > s.n ? (
                <Feather name="check-circle" size={13} color={colors.navyDeep} />
              ) : (
                <Text
                  className={`font-sans-bold text-xs ${
                    step >= s.n ? "text-navy-deep" : "text-slate-light"
                  }`}
                >
                  {s.n}
                </Text>
              )}
            </View>
            <Text
              className={`font-sans-semibold text-xs ${
                step >= s.n ? "text-gold-deep" : "text-slate-light"
              }`}
            >
              {s.label}
            </Text>
          </View>
          {i < 2 ? (
            <View className={`h-px w-6 ${step > s.n ? "bg-gold" : "bg-gold/20"}`} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

function OptionPill({ label, selected, onToggle }) {
  return (
    <Pressable
      onPress={onToggle}
      className={`rounded-full px-4 py-2.5 ${
        selected ? "bg-gold" : "border border-gold/30 bg-white"
      }`}
    >
      <Text
        className={`font-sans-semibold text-sm ${
          selected ? "text-navy-deep" : "text-slate"
        }`}
      >
        {selected ? "✓ " : ""}
        {label}
      </Text>
    </Pressable>
  );
}

function CoachCard({ coach, onView }) {
  return (
    <Card className="overflow-hidden p-0">
      <View className="h-1 bg-gold" />
      <View className="p-5">
        <View className="mb-3 flex-row items-start gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-gold">
            <Text className="font-sans-bold text-navy-deep">
              {coach.username?.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View className="min-w-0 flex-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="font-display text-base text-navy">{coach.username}</Text>
              {coach.is_verified ? (
                <View className="flex-row items-center gap-1 rounded-full border border-green-200 bg-green-100 px-2 py-0.5">
                  <Feather name="check-circle" size={9} color="#2E7D32" />
                  <Text className="font-sans-semibold text-xs text-green-900">Verified</Text>
                </View>
              ) : null}
            </View>
            {coach.avg_rating ? (
              <View className="mt-0.5 flex-row items-center gap-1">
                <Feather name="star" size={11} color={colors.gold} />
                <Text className="font-sans-semibold text-xs text-gold-deep">
                  {parseFloat(coach.avg_rating).toFixed(1)}
                </Text>
              </View>
            ) : null}
          </View>

          {coach.hourly_rate ? (
            <Text className="font-sans-bold text-sm text-navy">
              ${coach.hourly_rate}
              <Text className="font-sans text-xs text-slate">/hr</Text>
            </Text>
          ) : null}
        </View>

        {coach.specialties?.length > 0 ? (
          <View className="mb-4 flex-row flex-wrap gap-1.5">
            {coach.specialties.slice(0, 4).map((s) => (
              <View
                key={s}
                className="rounded-full border border-gold/20 bg-gold/10 px-2.5 py-1"
              >
                <Text className="font-sans-medium text-xs text-gold-deep">{s}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Button variant="gold" onPress={onView} fullWidth>
          View Profile →
        </Button>
      </View>
    </Card>
  );
}

export default function SmartMatch() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState({ goals: [], industries: [], languages: [] });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const toggle = (key, value) => {
    setAnswers((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((v) => v !== value)
        : [...prev[key], value],
    }));
  };

  const handleMatch = async () => {
    setLoading(true);
    try {
      const res = await api.post("/coaches/match/", answers);
      setResults(res.data);
      setStep(4);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const STEP_META = {
    1: {
      icon: "zap",
      label: "Step 1 of 3",
      heading: "What are your coaching goals?",
      options: GOAL_OPTIONS,
      key: "goals",
    },
    2: {
      icon: "users",
      label: "Step 2 of 3",
      heading: "Which industries are relevant to you?",
      options: INDUSTRY_OPTIONS,
      key: "industries",
    },
    3: {
      icon: "star",
      label: "Step 3 of 3",
      heading: "Preferred coaching language?",
      options: LANGUAGE_OPTIONS,
      key: "languages",
    },
  };

  const meta = STEP_META[step];

  return (
    <Screen>
      <View className="items-center">
        <Text className="mb-2 text-xs font-sans-semibold uppercase tracking-[2px] text-gold-deep">
          AI Coach Matching
        </Text>
        <Text className="mb-2 text-center font-display text-3xl text-navy">
          Find Your <Text className="text-gold-deep">Perfect Coach</Text>
        </Text>
        <Text className="text-center font-sans text-base text-slate">
          Answer three quick questions and we'll match you with coaches who fit your goals,
          industry, and preferences.
        </Text>
      </View>

      <Card className="mt-10 p-6">
        {step < 4 ? <StepBar step={step} /> : null}

        {/* ── Steps 1–3 ── */}
        {meta ? (
          <View>
            <View className="mb-1 flex-row items-center gap-2">
              <View className="h-7 w-7 items-center justify-center rounded-lg bg-gold/15">
                <Feather name={meta.icon} size={13} color={colors.gold} />
              </View>
              <Text className="text-xs font-sans-semibold uppercase tracking-wider text-gold">
                {meta.label}
              </Text>
            </View>

            <Text className="mb-1 font-display text-2xl text-navy">{meta.heading}</Text>
            <Text className="mb-6 font-sans text-sm text-slate">Select all that apply.</Text>

            <View className="mb-8 flex-row flex-wrap gap-2">
              {meta.options.map((o) => (
                <OptionPill
                  key={o}
                  label={o}
                  selected={answers[meta.key].includes(o)}
                  onToggle={() => toggle(meta.key, o)}
                />
              ))}
            </View>

            {step === 1 ? (
              <Button variant="gold" onPress={() => setStep(2)} fullWidth>
                Next →
              </Button>
            ) : (
              <View className="flex-row gap-3">
                <Button
                  variant="outline"
                  onPress={() => setStep(step - 1)}
                  className="flex-1"
                >
                  ← Back
                </Button>
                {step === 2 ? (
                  <Button variant="gold" onPress={() => setStep(3)} className="flex-1">
                    Next →
                  </Button>
                ) : (
                  <Button
                    variant="gold"
                    onPress={handleMatch}
                    loading={loading}
                    className="flex-1"
                  >
                    Find My Coach
                  </Button>
                )}
              </View>
            )}
          </View>
        ) : null}

        {/* ── Step 4: Results ── */}
        {step === 4 ? (
          <View>
            <View className="mb-6 items-center">
              <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-gold/15">
                <Feather name="zap" size={24} color={colors.gold} />
              </View>
              <Text className="mb-1 text-xs font-sans-semibold uppercase tracking-[2px] text-gold">
                Match Complete
              </Text>
              <Text className="font-display text-3xl text-navy">Your Matched Coaches</Text>
              <Text className="mt-1 font-sans text-sm text-slate">
                {results.length} coach{results.length !== 1 ? "es" : ""} found for you
              </Text>
            </View>

            {results.length === 0 ? (
              <View className="items-center rounded-2xl border border-gold/15 bg-cream py-10">
                <Text className="mb-3 text-4xl">🔍</Text>
                <Text className="mb-1 font-sans-semibold text-sm text-navy">
                  No exact matches found
                </Text>
                <Text className="font-sans text-xs text-slate">
                  Try browsing the full coach directory.
                </Text>
              </View>
            ) : (
              <View className="mb-6 gap-3">
                {results.map((coach) => (
                  <CoachCard
                    key={coach.user_id}
                    coach={coach}
                    onView={() => router.push(`/coaches/${coach.user_id}`)}
                  />
                ))}
              </View>
            )}

            <View className="gap-2 border-t border-gold/10 pt-4">
              <Button
                variant="outline"
                onPress={() => {
                  setStep(1);
                  setAnswers({ goals: [], industries: [], languages: [] });
                  setResults([]);
                }}
                fullWidth
              >
                Start Over
              </Button>
              <Pressable onPress={() => router.push("/coaches")} className="items-center py-2.5">
                <Text className="font-sans-medium text-sm text-slate-light">
                  Browse all coaches →
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </Card>
    </Screen>
  );
}
