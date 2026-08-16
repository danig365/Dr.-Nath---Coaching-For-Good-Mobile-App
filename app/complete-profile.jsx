import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { Button, Input } from "@/components/ui";
import { toast } from "@/lib/toast";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/CompleteProfilePage.jsx.
//
// Same gate, same validation rules, same PATCH shape. Coaches supply bio /
// specialties / hourly rate; clients supply job title / organisation.

function SectionTitle({ children }) {
  return (
    <Text className="text-xs font-sans-semibold uppercase tracking-[2px] text-gold-deep">
      {children}
    </Text>
  );
}

function Divider() {
  return <View className="my-5 h-px bg-cream-warm" />;
}

// Chip entry for coach specialties. On web this listens for Enter/comma; the
// mobile equivalent is the return key plus an explicit add button.
function TagInput({ tags, onChange, placeholder }) {
  const [input, setInput] = useState("");

  const add = () => {
    const val = input.trim();
    if (val && !tags.includes(val)) onChange([...tags, val]);
    setInput("");
  };

  const remove = (tag) => onChange(tags.filter((t) => t !== tag));

  return (
    <View>
      {tags.length > 0 && (
        <View className="mb-2 flex-row flex-wrap gap-2">
          {tags.map((t) => (
            <View
              key={t}
              className="flex-row items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1"
            >
              <Text className="font-sans-medium text-xs text-gold-deep">{t}</Text>
              <Pressable onPress={() => remove(t)} hitSlop={8}>
                <Feather name="x" size={11} color={colors.goldDeep} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View className="flex-row gap-2">
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={add}
          placeholder={placeholder}
          placeholderTextColor={colors.slateLight}
          returnKeyType="done"
          className="flex-1 rounded-2xl border border-cream-warm bg-cream px-4 py-3 font-sans text-base text-ink"
        />
        <Pressable
          onPress={add}
          className="items-center justify-center rounded-2xl border border-gold/30 bg-gold/15 px-4"
        >
          <Feather name="plus" size={16} color={colors.goldDeep} />
        </Pressable>
      </View>

      <Text className="mt-1 font-sans text-xs text-slate-light">
        Type a specialty and press return to add
      </Text>
    </View>
  );
}

export default function CompleteProfilePage() {
  const { role, isAuthenticated, profileComplete, markProfileComplete, logout } = useAuth();
  const router = useRouter();
  const { next } = useLocalSearchParams();

  const isCoach = role === "coach";
  const isClient = role === "client";

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    bio: "",
    specialties: [],
    hourly_rate: "",
    job_title: "",
    organisation: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (profileComplete) {
      router.replace(next || "/");
      return;
    }

    api
      .get("/profile/")
      .then((res) => {
        const d = res.data;
        const p = d.profile || {};
        setForm((prev) => ({
          ...prev,
          first_name: d.first_name || "",
          last_name: d.last_name || "",
          bio: p.bio || "",
          specialties: p.specialties || [],
          hourly_rate: p.hourly_rate != null ? String(p.hourly_rate) : "",
          job_title: p.job_title || "",
          organisation: p.organisation || "",
        }));
      })
      .catch(() => {
        // Non-blocking — the form still renders with empty fields.
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  // Returns the first validation error, or "" if the form is valid.
  const validate = () => {
    if (!form.first_name.trim()) return "First name is required.";
    if (!form.last_name.trim()) return "Last name is required.";
    if (isCoach) {
      if (!form.bio.trim()) return "Please add a short bio.";
      if (!form.specialties.length) return "Add at least one specialty.";
      if (!form.hourly_rate) return "Hourly rate is required.";
    }
    if (isClient) {
      if (!form.job_title.trim()) return "Job title is required.";
      if (!form.organisation.trim()) return "Organisation is required.";
    }
    return "";
  };

  const handleSubmit = async () => {
    setFormError("");
    const err = validate();
    if (err) {
      setFormError(err);
      toast.error(err);
      return;
    }

    setSaving(true);
    try {
      const profilePatch = isCoach
        ? {
            bio: form.bio.trim(),
            specialties: form.specialties,
            hourly_rate: parseFloat(form.hourly_rate),
          }
        : {
            job_title: form.job_title.trim(),
            organisation: form.organisation.trim(),
          };

      await api.patch("/profile/", {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        profile: profilePatch,
      });

      await markProfileComplete();
      toast.success("Profile complete! Welcome aboard.");
      // Honour a deep-link destination; otherwise "/" re-routes through the
      // entry gate to the correct role dashboard.
      router.replace(next || "/");
    } catch {
      setFormError(
        "Couldn't save your profile — please check your connection and try again."
      );
      toast.error("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-cream">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="px-5 py-8"
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center">
            <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-gold">
              <Feather name="user" size={24} color={colors.navyDeep} />
            </View>
            <Text className="mb-2 text-center font-display text-3xl text-navy">
              Complete Your Profile
            </Text>
            <Text className="text-center font-sans text-sm text-slate">
              A few details before you get started.
            </Text>
          </View>

          <View className="mt-8 rounded-2xl border border-gold/15 bg-white p-5">
            <SectionTitle>Your Name</SectionTitle>
            <View className="mt-3">
              <Input
                label="First name *"
                value={form.first_name}
                onChangeText={(v) => set("first_name", v)}
                placeholder="Jane"
              />
              <Input
                label="Last name *"
                value={form.last_name}
                onChangeText={(v) => set("last_name", v)}
                placeholder="Smith"
              />
            </View>

            {isCoach && (
              <>
                <Divider />
                <SectionTitle>Coach Details</SectionTitle>
                <View className="mt-3">
                  <Input
                    label="Bio *"
                    value={form.bio}
                    onChangeText={(v) => set("bio", v)}
                    placeholder="Tell clients about your background and coaching style..."
                    multiline
                  />

                  <Text className="mb-1.5 font-sans-medium text-sm text-navy">
                    Specialties *
                  </Text>
                  <TagInput
                    tags={form.specialties}
                    onChange={(val) => set("specialties", val)}
                    placeholder="e.g. Leadership, Executive, Career..."
                  />

                  <View className="mt-4">
                    <Input
                      label="Hourly rate (USD) *"
                      value={form.hourly_rate}
                      onChangeText={(v) => set("hourly_rate", v)}
                      placeholder="150"
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </>
            )}

            {isClient && (
              <>
                <Divider />
                <SectionTitle>Work Details</SectionTitle>
                <View className="mt-3">
                  <Input
                    label="Job title *"
                    value={form.job_title}
                    onChangeText={(v) => set("job_title", v)}
                    placeholder="e.g. Senior Product Manager"
                  />
                  <Input
                    label="Organisation *"
                    value={form.organisation}
                    onChangeText={(v) => set("organisation", v)}
                    placeholder="e.g. Acme Corp"
                  />
                </View>
              </>
            )}

            {formError ? (
              <View className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3">
                <Text className="font-sans text-sm text-red-700">{formError}</Text>
              </View>
            ) : null}

            <Button onPress={handleSubmit} loading={saving} fullWidth variant="gold">
              {saving ? "Saving..." : "Complete Profile →"}
            </Button>
          </View>

          <View className="mt-5 flex-row items-center justify-center gap-1">
            <Text className="font-sans text-xs text-slate-light">Not you?</Text>
            <Pressable
              onPress={async () => {
                await logout();
                router.replace("/login");
              }}
            >
              <Text className="font-sans text-xs text-slate underline">Log out</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
