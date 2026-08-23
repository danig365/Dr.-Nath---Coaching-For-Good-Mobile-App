import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { Screen, Card, Button, Input } from "@/components/ui";
import { toast } from "@/lib/toast";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/ProfilePage.jsx.
//
// One screen, two modes: a read-only profile view and an inline edit form. Array
// fields (specialties, certifications, …) are edited as comma-separated text and
// split on save, exactly as on web.

function Tag({ label, tone = "gold" }) {
  const TONES = {
    gold: { bg: "bg-gold/15", text: "text-gold-deep" },
    green: { bg: "bg-green-100", text: "text-green-900" },
    amber: { bg: "bg-amber-100", text: "text-amber-900" },
    navy: { bg: "bg-navy/10", text: "text-navy" },
  };
  const t = TONES[tone] || TONES.gold;
  return (
    <View className={`rounded-full px-2.5 py-1 ${t.bg}`}>
      <Text className={`font-sans-semibold text-xs ${t.text}`}>{label}</Text>
    </View>
  );
}

function TagList({ icon, title, items }) {
  if (!items?.length) return null;
  return (
    <Card className="mb-4">
      <View className="mb-3 flex-row items-center gap-2">
        <Feather name={icon} size={14} color={colors.goldDeep} />
        <Text className="text-sm font-sans-semibold uppercase tracking-wider text-gold-deep">
          {title}
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {items.map((it) => (
          <View key={it} className="rounded-full border border-gold/20 bg-gold/10 px-3 py-1.5">
            <Text className="font-sans-medium text-xs text-gold-deep">{it}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function InfoRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-gold/10 bg-cream px-3 py-2.5">
      <Feather name={icon} size={13} color={colors.gold} />
      <Text className="font-sans text-xs text-slate">{label}</Text>
      <View className="flex-1" />
      <Text className="font-sans-medium text-sm text-navy">{value}</Text>
    </View>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, isCoach, logout } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get("/profile/");
      const d = res.data;
      const p = {
        fullName: d.full_name,
        firstName: d.first_name || "",
        lastName: d.last_name || "",
        email: d.email,
        bio: d.profile.bio,
        role: d.profile.role,
        specialties: d.profile.specialties || [],
        certifications: d.profile.certifications || [],
        hourly_rate: d.profile.hourly_rate,
        years_experience: d.profile.years_experience,
        languages: d.profile.languages || [],
        industries: d.profile.industries || [],
        linkedin_url: d.profile.linkedin_url || "",
        approval_status: d.profile.approval_status,
        is_verified: d.profile.is_verified,
        organisation: d.profile.organisation,
        job_title: d.profile.job_title,
        coaching_goals: d.profile.coaching_goals || [],
      };
      setProfile(p);
      setFormData({
        first_name: p.firstName,
        last_name: p.lastName,
        email: p.email || "",
        bio: p.bio || "",
        linkedin_url: p.linkedin_url || "",
        hourly_rate: p.hourly_rate ?? "",
        years_experience: p.years_experience ?? "",
        organisation: p.organisation || "",
        job_title: p.job_title || "",
        // Arrays are edited as comma-separated text; joined here, split on save.
        specialties: (p.specialties || []).join(", "),
        certifications: (p.certifications || []).join(", "),
        industries: (p.industries || []).join(", "),
        languages: (p.languages || []).join(", "),
        coaching_goals: (p.coaching_goals || []).join(", "),
      });
    } catch (err) {
      toast.error("Failed to load profile.");
      if (err.message?.includes("Session expired")) logout();
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, logout]);

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [fetchData, isAuthenticated]);

  // "a, b ,c" → ["a","b","c"] (drops blanks + surrounding spaces).
  const toList = (s) => (s || "").split(",").map((x) => x.trim()).filter(Boolean);
  // "" → null for optional numbers, so the backend doesn't get an empty string.
  const toNum = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

  const set = (key, value) => setFormData((f) => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const profilePayload = {
        bio: formData.bio,
        linkedin_url: formData.linkedin_url,
        organisation: formData.organisation,
        job_title: formData.job_title,
        specialties: toList(formData.specialties),
        certifications: toList(formData.certifications),
        industries: toList(formData.industries),
        languages: toList(formData.languages),
        coaching_goals: toList(formData.coaching_goals),
      };
      // Coach-only numeric fields (leave client payloads clean).
      if (isCoach()) {
        profilePayload.hourly_rate = toNum(formData.hourly_rate);
        profilePayload.years_experience = toNum(formData.years_experience);
      }

      const res = await api.patch("/profile/", {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        profile: profilePayload,
      });

      const rp = res.data.profile;
      setProfile((prev) => ({
        ...prev,
        fullName: res.data.full_name,
        firstName: res.data.first_name || "",
        lastName: res.data.last_name || "",
        email: res.data.email,
        bio: rp.bio,
        linkedin_url: rp.linkedin_url || "",
        hourly_rate: rp.hourly_rate,
        years_experience: rp.years_experience,
        organisation: rp.organisation,
        job_title: rp.job_title,
        specialties: rp.specialties || [],
        certifications: rp.certifications || [],
        industries: rp.industries || [],
        languages: rp.languages || [],
        coaching_goals: rp.coaching_goals || [],
      }));
      setEditMode(false);
      toast.success("Profile updated.");
    } catch (err) {
      // Surface a specific backend message (e.g. duplicate email) if there is one.
      const detail = err?.response?.data;
      const msg = detail?.email?.[0] || detail?.profile?.[0] || detail?.detail;
      toast.error(msg || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Screen loading />;

  if (!profile) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <Text className="font-sans text-slate">Failed to load profile.</Text>
        </View>
      </Screen>
    );
  }

  const initials =
    profile.fullName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  const roleLabel =
    { coach: "Coach", client: "Client", admin: "Admin" }[profile.role] || profile.role;

  const coach = isCoach();

  return (
    <Screen onRefresh={fetchData} refreshing={false}>
      {/* ── Header card ── */}
      <Card className="mb-6">
        <View className="flex-row items-start gap-4">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-gold">
            <Text className="font-display text-2xl text-navy-deep">{initials}</Text>
          </View>

          <View className="min-w-0 flex-1">
            {editMode ? (
              <>
                <Input
                  label="First name"
                  value={formData.first_name}
                  onChangeText={(v) => set("first_name", v)}
                />
                <Input
                  label="Last name"
                  value={formData.last_name}
                  onChangeText={(v) => set("last_name", v)}
                />
              </>
            ) : (
              <Text className="font-display text-2xl text-navy">{profile.fullName}</Text>
            )}

            <View className="mt-2 flex-row flex-wrap items-center gap-2">
              <Tag label={roleLabel} tone="navy" />
              {profile.is_verified ? <Tag label="✓ Verified" tone="green" /> : null}
              {profile.role === "coach" && !profile.is_verified ? (
                <Tag
                  label={
                    profile.approval_status === "pending" ? "Pending Approval" : "Rejected"
                  }
                  tone="amber"
                />
              ) : null}
            </View>
          </View>
        </View>

        {editMode ? (
          <View className="mt-4">
            <Input
              label="Email"
              value={formData.email}
              onChangeText={(v) => set("email", v)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        ) : (
          <View className="mt-4 gap-3">
            <InfoRow icon="mail" label="Email" value={profile.email} />
            {profile.linkedin_url ? (
              <Pressable
                onPress={() => Linking.openURL(profile.linkedin_url)}
                className="flex-row items-center gap-3 rounded-xl border border-gold/10 bg-cream px-3 py-2.5"
              >
                <Feather name="linkedin" size={13} color="#0A66C2" />
                <Text className="font-sans text-xs text-slate">LinkedIn</Text>
                <View className="flex-1" />
                <Feather name="external-link" size={13} color={colors.goldDeep} />
              </Pressable>
            ) : null}
          </View>
        )}

        <View className="mt-5 flex-row gap-3">
          {editMode ? (
            <>
              <Button
                variant="outline"
                onPress={() => setEditMode(false)}
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
                Save Changes
              </Button>
            </>
          ) : (
            <Button variant="gold" onPress={() => setEditMode(true)} fullWidth>
              Edit Profile
            </Button>
          )}
        </View>
      </Card>

      {/* ── Editable body ── */}
      {editMode ? (
        <Card className="mb-6">
          <Input
            label="Bio"
            value={formData.bio}
            onChangeText={(v) => set("bio", v)}
            multiline
          />
          <Input
            label="LinkedIn URL"
            value={formData.linkedin_url}
            onChangeText={(v) => set("linkedin_url", v)}
            autoCapitalize="none"
            placeholder="https://linkedin.com/in/…"
          />

          {coach ? (
            <>
              <Input
                label="Hourly rate (USD)"
                value={String(formData.hourly_rate)}
                onChangeText={(v) => set("hourly_rate", v)}
                keyboardType="numeric"
              />
              <Input
                label="Years of experience"
                value={String(formData.years_experience)}
                onChangeText={(v) => set("years_experience", v)}
                keyboardType="numeric"
              />
              <Input
                label="Specialties"
                value={formData.specialties}
                onChangeText={(v) => set("specialties", v)}
                hint="Separate with commas"
              />
              <Input
                label="Certifications"
                value={formData.certifications}
                onChangeText={(v) => set("certifications", v)}
                hint="Separate with commas"
              />
            </>
          ) : (
            <>
              <Input
                label="Organisation"
                value={formData.organisation}
                onChangeText={(v) => set("organisation", v)}
              />
              <Input
                label="Job title"
                value={formData.job_title}
                onChangeText={(v) => set("job_title", v)}
              />
              <Input
                label="Coaching goals"
                value={formData.coaching_goals}
                onChangeText={(v) => set("coaching_goals", v)}
                hint="Separate with commas"
              />
            </>
          )}

          <Input
            label="Industries"
            value={formData.industries}
            onChangeText={(v) => set("industries", v)}
            hint="Separate with commas"
          />
          <Input
            label="Languages"
            value={formData.languages}
            onChangeText={(v) => set("languages", v)}
            hint="Separate with commas"
            className="mb-0"
          />
        </Card>
      ) : (
        <>
          {profile.bio ? (
            <Card className="mb-4">
              <Text className="mb-2 text-sm font-sans-semibold uppercase tracking-wider text-gold-deep">
                About
              </Text>
              <Text className="font-sans text-base leading-6 text-slate">{profile.bio}</Text>
            </Card>
          ) : null}

          {coach ? (
            <Card className="mb-4 gap-3">
              <InfoRow
                icon="dollar-sign"
                label="Hourly rate"
                value={profile.hourly_rate ? `$${profile.hourly_rate}/hr` : null}
              />
              <InfoRow
                icon="award"
                label="Experience"
                value={
                  profile.years_experience ? `${profile.years_experience} years` : null
                }
              />
            </Card>
          ) : (
            <Card className="mb-4 gap-3">
              <InfoRow icon="briefcase" label="Organisation" value={profile.organisation} />
              <InfoRow icon="user" label="Job title" value={profile.job_title} />
            </Card>
          )}

          <TagList icon="zap" title="Specialties" items={profile.specialties} />
          <TagList icon="award" title="Certifications" items={profile.certifications} />
          <TagList icon="target" title="Coaching goals" items={profile.coaching_goals} />
          <TagList icon="briefcase" title="Industries" items={profile.industries} />
          <TagList icon="globe" title="Languages" items={profile.languages} />
        </>
      )}

      <Button
        variant="ghost"
        onPress={() => router.push("/contact")}
        className="mt-4"
        fullWidth
      >
        Contact Dr. Nath
      </Button>

      <Button
        variant="outline"
        onPress={async () => {
          await logout();
          router.replace("/login");
        }}
        className="mt-2"
        fullWidth
      >
        Sign out
      </Button>
    </Screen>
  );
}
