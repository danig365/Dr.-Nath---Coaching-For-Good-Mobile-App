import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { Screen, Card, Button, Input } from "@/components/ui";
import { toast } from "@/lib/toast";
import { colors } from "@/theme/colors";
import { useAccessGuard } from "@/lib/accessGuard";

// Combined port of frontend/src/pages/AddSkill.jsx and EditSkill.jsx.
//
// Those two files are the same ~350-line form duplicated, differing only in:
// the heading, whether it loads an existing skill, POST vs PATCH, and the submit
// label. Rather than carry the duplication across, this takes a `mode` prop.
// Every field, validation and error-mapping behaviour is unchanged.

const SKILL_LEVELS = ["beginner", "intermediate", "advanced", "expert"];
const CATEGORIES = [
  "Programming",
  "Design",
  "Business",
  "Marketing",
  "Data Science",
  "Career Growth",
  "Leadership",
  "Other",
];

function FieldLabel({ icon, children, required }) {
  return (
    <View className="mb-2 flex-row items-center gap-2">
      {icon ? <Feather name={icon} size={11} color={colors.gold} /> : null}
      <Text className="text-xs font-sans-semibold uppercase tracking-wider text-slate">
        {children}
        {required ? <Text className="text-gold"> *</Text> : null}
      </Text>
    </View>
  );
}

function Chip({ label, active, onPress, className = "" }) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full px-4 py-2.5 ${
        active ? "bg-gold" : "border border-gold/25 bg-white"
      } ${className}`}
    >
      <Text
        className={`font-sans-semibold text-xs capitalize ${
          active ? "text-navy-deep" : "text-slate"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function SkillForm({ mode = "add" }) {
  const isEdit = mode === "edit";
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { isAuthenticated, isCoach, logout } = useAuth();
  const { requireCoach } = useAccessGuard();

  const [form, setForm] = useState({
    name: "",
    description: "",
    level: "intermediate",
    category: "",
    price: "",
    tags: [],
    currentTag: "",
    is_chemistry: false,
    duration_minutes: 60,
    max_total_bookings: "",
    max_bookings_per_client: "",
    requires_participation_code: false,
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (requireCoach()) return;
    if (!isEdit) return;

    (async () => {
      try {
        const res = await api.get(`/skills/${id}/`);
        const s = res.data;
        setForm({
          name: s.name || "",
          description: s.description || "",
          level: s.level || "intermediate",
          category: s.category || "",
          price: s.price || "",
          tags: Array.isArray(s.tags) ? s.tags : [],
          currentTag: "",
          is_chemistry: !!s.is_chemistry,
          duration_minutes: s.duration_minutes || 60,
          max_total_bookings: s.max_total_bookings == null ? "" : String(s.max_total_bookings),
          max_bookings_per_client:
            s.max_bookings_per_client == null ? "" : String(s.max_bookings_per_client),
          requires_participation_code: !!s.requires_participation_code,
        });
      } catch {
        toast.error("Failed to load skill.");
        router.replace("/(coach)/skills");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isAuthenticated, isEdit]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleTagAdd = () => {
    const tag = form.currentTag.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm((f) => ({ ...f, tags: [...f.tags, tag], currentTag: "" }));
    }
  };

  const handleTagRemove = (tag) =>
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        level: form.level,
        category: form.category,
        price: Number(form.price),
        tags: form.tags,
        is_chemistry: form.is_chemistry,
        duration_minutes: Number(form.duration_minutes) || 60,
        // Blank means no limit, which the API stores as null.
        max_total_bookings:
          String(form.max_total_bookings).trim() === "" ? null : Number(form.max_total_bookings),
        max_bookings_per_client:
          String(form.max_bookings_per_client).trim() === ""
            ? null
            : Number(form.max_bookings_per_client),
        requires_participation_code: !!form.requires_participation_code,
      };

      if (isEdit) await api.patch(`/skills/${id}/`, payload);
      else await api.post("/skills/", payload);

      toast.success(isEdit ? "Skill updated successfully!" : "Skill added successfully!");
      router.replace("/(coach)/skills");
    } catch (error) {
      const errorData = error.response?.data;
      if (errorData) {
        // Surface each field error the API returned, one toast per field.
        Object.keys(errorData).forEach((key) => {
          const msg = Array.isArray(errorData[key]) ? errorData[key][0] : errorData[key];
          toast.error(`${key.charAt(0).toUpperCase() + key.slice(1)}: ${msg}`);
        });
      } else {
        toast.error(
          isEdit
            ? "Failed to update skill. Please try again."
            : "Failed to add skill. Please try again."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  // Estimated earnings preview
  const estimatedMonthly = form.price ? (parseFloat(form.price) * 10).toFixed(0) : null;

  if (loading) return <Screen loading />;

  return (
    <Screen>
      <Card className="overflow-hidden p-0">
        {/* Card Header */}
        <View className="bg-navy px-6 pb-6 pt-8">
          <Text className="font-display text-3xl text-cream">
            {isEdit ? "Edit Skill" : "Add a New Skill"}
          </Text>
          <Text className="mt-1 font-sans text-sm text-slate-light">
            {isEdit
              ? "Update your skill details below."
              : "Share your expertise and start earning."}
          </Text>
        </View>

        <View className="gap-6 px-6 py-8">
          {/* Skill Name */}
          <View>
            <FieldLabel icon="book-open" required>
              Skill Name
            </FieldLabel>
            <Input
              value={form.name}
              onChangeText={(v) => set("name", v)}
              placeholder="e.g. Executive Communication"
              className="mb-0"
            />
          </View>

          {/* Category */}
          <View>
            <FieldLabel icon="layers" required>
              Category
            </FieldLabel>
            <View className="flex-row flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  active={form.category === c}
                  onPress={() => set("category", c)}
                />
              ))}
            </View>
          </View>

          {/* Hourly rate */}
          <View>
            <FieldLabel icon="dollar-sign" required>
              Hourly Rate (USD)
            </FieldLabel>
            <Input
              value={String(form.price)}
              onChangeText={(v) => set("price", v)}
              placeholder="50"
              keyboardType="numeric"
              className="mb-0"
            />
            {estimatedMonthly ? (
              <Text className="mt-1.5 font-sans text-xs text-gold-deep">
                ≈ ${estimatedMonthly}/mo at 10 sessions
              </Text>
            ) : null}
          </View>

          {/* Skill Level */}
          <View>
            <FieldLabel required>Experience Level</FieldLabel>
            <View className="flex-row flex-wrap gap-2">
              {SKILL_LEVELS.map((l) => (
                <Chip
                  key={l}
                  label={l}
                  active={form.level === l}
                  onPress={() => set("level", l)}
                />
              ))}
            </View>
          </View>

          {/* Tags */}
          <View>
            <FieldLabel icon="tag">Topics Covered</FieldLabel>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Input
                  value={form.currentTag}
                  onChangeText={(v) => set("currentTag", v)}
                  onSubmitEditing={handleTagAdd}
                  placeholder="e.g. Hooks, Leadership, Branding"
                  returnKeyType="done"
                  className="mb-0"
                />
              </View>
              <Pressable
                onPress={handleTagAdd}
                className="h-[46px] items-center justify-center rounded-xl bg-gold px-4"
              >
                <Feather name="plus" size={16} color={colors.navyDeep} />
              </Pressable>
            </View>

            {form.tags.length > 0 ? (
              <View className="mt-3 flex-row flex-wrap gap-2">
                {form.tags.map((tag) => (
                  <View
                    key={tag}
                    className="flex-row items-center gap-1.5 rounded-full border border-gold/25 bg-gold/15 px-3 py-1.5"
                  >
                    <Text className="font-sans-semibold text-xs text-gold-deep">{tag}</Text>
                    <Pressable onPress={() => handleTagRemove(tag)} hitSlop={6}>
                      <Feather name="x" size={11} color={colors.goldDeep} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {/* Description */}
          <View>
            <FieldLabel icon="book-open" required>
              Description
            </FieldLabel>
            <Input
              value={form.description}
              onChangeText={(v) => set("description", v)}
              placeholder={
                isEdit
                  ? "What will learners gain? Describe your approach, topics, and who this is for..."
                  : "What will learners gain? Describe what you cover, your approach, and who this is for..."
              }
              multiline
              className="mb-0"
            />
            {!isEdit ? (
              <Text className="mt-1.5 font-sans text-xs text-slate-light">
                Visible to all learners browsing the directory.
              </Text>
            ) : null}
          </View>

          {/* Session duration */}
          <View>
            <FieldLabel icon="layers">Session duration (minutes)</FieldLabel>
            <Input
              value={String(form.duration_minutes)}
              onChangeText={(v) => set("duration_minutes", v)}
              keyboardType="numeric"
              className="mb-0"
            />
            <Text className="mt-1.5 font-sans text-xs text-slate-light">
              How long one session runs (e.g. 30 for a chemistry call, 60 for a full
              session).
            </Text>
          </View>

          {/* Nominated patients only */}
          <Pressable
            onPress={() =>
              set("requires_participation_code", !form.requires_participation_code)
            }
            className="flex-row items-start gap-3 rounded-xl border border-gold/20 bg-gold/5 p-4"
          >
            <View
              className={`mt-0.5 h-5 w-5 items-center justify-center rounded border-2 ${
                form.requires_participation_code ? "border-gold bg-gold" : "border-gold/40 bg-white"
              }`}
            >
              {form.requires_participation_code ? (
                <Feather name="check" size={12} color={colors.navyDeep} />
              ) : null}
            </View>
            <View className="flex-1">
              <Text className="font-sans-semibold text-sm text-navy">
                Only for patients with a coaching code
              </Text>
              <Text className="mt-0.5 font-sans text-xs text-slate-light">
                For partner campaigns: only clients who registered with a code from a
                participating organisation can book.
              </Text>
            </View>
          </Pressable>

          {/* Limited allocation (optional) */}
          <View className="rounded-xl border border-gold/20 bg-gold/5 p-4">
            <FieldLabel icon="layers">Limit this offering (optional)</FieldLabel>
            <Text className="mb-3 font-sans text-xs text-slate-light">
              For a fixed allocation — e.g. 20 free sessions for one clinic's patients, no
              more than 4 each. Leave both blank for no limit.
            </Text>
            <Input
              label="Total sessions offered"
              value={String(form.max_total_bookings)}
              onChangeText={(v) => set("max_total_bookings", v)}
              keyboardType="numeric"
              placeholder="No limit"
            />
            <Input
              label="Maximum per client"
              value={String(form.max_bookings_per_client)}
              onChangeText={(v) => set("max_bookings_per_client", v)}
              keyboardType="numeric"
              placeholder="No limit"
              className="mb-0"
            />
          </View>

          {/* Chemistry session toggle */}
          <Pressable
            onPress={() => set("is_chemistry", !form.is_chemistry)}
            className="flex-row items-start gap-3 rounded-xl border border-gold/20 bg-gold/5 p-4"
          >
            <View
              className={`mt-0.5 h-4 w-4 items-center justify-center rounded border ${
                form.is_chemistry ? "border-gold bg-gold" : "border-gold/40 bg-white"
              }`}
            >
              {form.is_chemistry ? (
                <Feather name="check" size={11} color={colors.navyDeep} />
              ) : null}
            </View>
            <View className="flex-1">
              <Text className="font-sans-semibold text-sm text-navy">
                Offer as a free Chemistry Session
              </Text>
              <Text className="mt-0.5 font-sans text-xs text-slate">
                Shows a public "Book a Chemistry Session" button on the home page. Visitors
                complete this programme's intake form (build it in Forms) before the
                calendar unlocks. Set the price to 0.
              </Text>
            </View>
          </Pressable>

          {/* Actions */}
          <View className="flex-row gap-3 pt-2">
            <Button
              variant="outline"
              onPress={() => router.replace("/(coach)/skills")}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="gold"
              onPress={handleSubmit}
              loading={saving}
              className="flex-1"
            >
              {isEdit ? "Save Changes" : "Add Skill"}
            </Button>
          </View>
        </View>
      </Card>
    </Screen>
  );
}
