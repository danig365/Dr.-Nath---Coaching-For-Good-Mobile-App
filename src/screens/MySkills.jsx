import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import * as Clipboard from "expo-clipboard";

import { api } from "@/api/client";
import { API_HOST } from "@/api/config";
import { useAuth } from "@/context/AuthContext";
import { Screen, Card, Button } from "@/components/ui";
import { toast } from "@/lib/toast";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/MySkills.jsx — the coach's offerings.

function StatCard({ title, value, icon, warm = true }) {
  return (
    <View
      className={`flex-1 rounded-2xl border border-gold/20 p-4 ${
        warm ? "bg-cream-warm" : "bg-white"
      }`}
    >
      <View className="mb-2 flex-row items-center gap-1.5">
        <Feather name={icon} size={13} color={colors.gold} />
        <Text className="text-[10px] font-sans-semibold uppercase tracking-wider text-slate">
          {title}
        </Text>
      </View>
      <Text className="font-display text-2xl text-navy">{value}</Text>
    </View>
  );
}

// Build the public, shareable booking link for a programme and copy it. Sharing
// this with a preselected participant lands them (after login/registration)
// straight on this exact programme's booking page — so they can't accidentally
// book the wrong one.
const copyBookingLink = async (skill) => {
  const url = `${API_HOST}/book/${skill.id}`;
  await Clipboard.setStringAsync(url);
  toast.success("Booking link copied — share it with your participant.");
};

function SkillCard({ skill, onEdit, onDelete, onToggleActive, onSpace }) {
  return (
    <Card className="overflow-hidden p-0">
      <View className={`h-1 ${skill.active ? "bg-gold" : "bg-gold/20"}`} />

      <View className="p-6">
        <View className="mb-3 flex-row flex-wrap items-center gap-3">
          <Text className="flex-1 font-display text-lg text-navy">{skill.name}</Text>

          {skill.avg_rating !== null && skill.avg_rating !== undefined ? (
            <View className="flex-row items-center gap-1">
              <Feather name="star" size={12} color={colors.gold} />
              <Text className="font-sans-semibold text-xs text-gold">
                {parseFloat(skill.avg_rating).toFixed(1)}
              </Text>
            </View>
          ) : null}

          <View
            className={`rounded-full border px-2.5 py-1 ${
              skill.active
                ? "border-green-200 bg-green-100"
                : "border-gold/20 bg-gold/10"
            }`}
          >
            <Text
              className={`font-sans-semibold text-xs ${
                skill.active ? "text-green-900" : "text-gold-deep"
              }`}
            >
              {skill.active ? "✓ Active" : "Inactive"}
            </Text>
          </View>
        </View>

        <View className="mb-3 flex-row flex-wrap gap-2">
          {skill.category ? (
            <View className="rounded-full border border-gold/20 bg-gold/10 px-2.5 py-1">
              <Text className="font-sans text-xs text-gold-deep">{skill.category}</Text>
            </View>
          ) : null}
          {skill.level ? (
            <View className="rounded-full border border-gold/15 bg-cream-warm px-2.5 py-1">
              <Text className="font-sans text-xs text-slate">{skill.level}</Text>
            </View>
          ) : null}
          <View className="flex-row items-center gap-1 rounded-full border border-gold/20 bg-cream-warm px-2.5 py-1">
            <Feather name="dollar-sign" size={11} color={colors.goldDeep} />
            <Text className="font-sans-semibold text-xs text-gold-deep">
              {Number(skill.price) > 0 ? `${skill.price}/hr` : "Free"}
            </Text>
          </View>
        </View>

        {skill.description ? (
          <Text className="mb-3 font-sans text-sm leading-6 text-slate" numberOfLines={2}>
            {skill.description}
          </Text>
        ) : null}

        {skill.tags?.length > 0 ? (
          <View className="flex-row flex-wrap gap-1.5">
            {skill.tags.map((tag, i) => (
              <View key={tag + i} className="rounded-md bg-gold/10 px-2 py-0.5">
                <Text className="font-sans text-xs text-gold-deep">{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {/* Action toolbar */}
      <View className="flex-row flex-wrap items-center gap-2 border-t border-gold/15 bg-cream/60 px-5 py-3">
        <Button variant="gold" size="sm" onPress={onSpace}>
          Space
        </Button>
        <Button variant="ghost" size="sm" onPress={onEdit}>
          Edit
        </Button>
        <Button variant="ghost" size="sm" onPress={() => copyBookingLink(skill)}>
          Booking link
        </Button>

        <View className="flex-1" />

        <Button variant="ghost" size="sm" onPress={onToggleActive}>
          {skill.active ? "Deactivate" : "Activate"}
        </Button>
        <Pressable
          onPress={onDelete}
          className="h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-red-50"
        >
          <Feather name="trash-2" size={14} color="#B91C1C" />
        </Pressable>
      </View>
    </Card>
  );
}

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-navy-deep/60 p-4">
        <View className="w-full max-w-sm items-center rounded-2xl border border-gold/20 bg-cream p-8">
          <Text className="mb-4 text-4xl">🗑️</Text>
          <Text className="mb-2 font-display text-xl text-navy">Delete Skill</Text>
          <Text className="mb-6 text-center font-sans text-sm text-slate">{message}</Text>
          <View className="w-full flex-row gap-3">
            <Button variant="outline" onPress={onCancel} className="flex-1">
              Cancel
            </Button>
            <Button variant="navy" onPress={onConfirm} className="flex-1">
              Delete
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function MySkills() {
  const router = useRouter();
  const { isAuthenticated, isCoach, logout } = useAuth();

  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchSkills = useCallback(async () => {
    if (!isAuthenticated || !isCoach()) {
      logout();
      return;
    }
    setLoading(true);
    try {
      const res = await api.get("/skills/");
      setSkills(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to load skills.");
      if (err.response?.status === 401) logout();
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isCoach, logout]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/skills/${id}/`);
      setSkills((s) => s.filter((x) => x.id !== id));
      toast.success("Skill deleted.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete.");
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleToggleActive = async (id) => {
    const skill = skills.find((s) => s.id === id);
    if (!skill) return;
    try {
      const res = await api.patch(`/skills/${id}/`, { active: !skill.active });
      setSkills((s) => s.map((x) => (x.id === id ? res.data : x)));
      toast.success(`Skill ${res.data.active ? "activated" : "deactivated"}.`);
    } catch {
      toast.error("Failed to update status.");
    }
  };

  const averageRate =
    skills.length > 0
      ? Math.round(
          skills.reduce((acc, s) => acc + parseFloat(s.price || 0), 0) / skills.length
        )
      : 0;

  if (loading) return <Screen loading />;

  return (
    <Screen onRefresh={fetchSkills} refreshing={false}>
      <View className="mb-8">
        <Text className="font-display text-3xl text-navy">My Skills</Text>
      </View>

      <Button
        variant="gold"
        onPress={() => router.push("/add-skill")}
        className="mb-8"
        fullWidth
      >
        + Add New Skill
      </Button>

      {skills.length > 0 ? (
        <View className="mb-8 flex-row gap-3">
          <StatCard title="Total Skills" value={skills.length} icon="users" />
          <StatCard
            title="Active"
            value={skills.filter((s) => s.active).length}
            icon="star"
            warm={false}
          />
          <StatCard title="Avg. Rate" value={`$${averageRate}`} icon="dollar-sign" warm={false} />
        </View>
      ) : null}

      {skills.length === 0 ? (
        <Card className="items-center py-20">
          <Text className="mb-4 text-5xl">🎯</Text>
          <Text className="mb-2 font-display text-2xl text-navy">No skills yet</Text>
          <Text className="mb-6 text-center font-sans text-sm text-slate">
            Add your first skill to start coaching clients.
          </Text>
          <Button variant="gold" onPress={() => router.push("/add-skill")}>
            + Add Your First Skill
          </Button>
        </Card>
      ) : (
        <View className="gap-4">
          {skills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onEdit={() => router.push(`/skills/edit/${skill.id}`)}
              onDelete={() => setDeleteTarget(skill)}
              onToggleActive={() => handleToggleActive(skill.id)}
              onSpace={() => router.push(`/programme/${skill.id}`)}
            />
          ))}
        </View>
      )}

      {deleteTarget ? (
        <ConfirmModal
          message={`Are you sure you want to delete "${deleteTarget.name}"? This cannot be undone.`}
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : null}
    </Screen>
  );
}
