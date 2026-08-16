import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, Modal, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { Screen, Card, Button, Input } from "@/components/ui";
import { DateFilter } from "@/components/sessionUi";
import { toast } from "@/lib/toast";
import { confirm } from "@/lib/confirm";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/Milestones.jsx.
//
// Shared by coach and client: coaches create/edit/delete milestones, clients
// tick them off. Only clients can toggle completion — that's enforced server
// side too, this just mirrors it in the UI.

function MilestoneCard({ m, role, onToggle, onDelete, onEdit }) {
  const overdue = !m.completed && m.due_date && new Date(m.due_date) < new Date();

  return (
    <View
      className={`flex-row items-start gap-4 rounded-2xl border p-4 ${
        m.completed
          ? "border-green-200 bg-green-50/40"
          : overdue
            ? "border-red-200 bg-white"
            : "border-gold/15 bg-white"
      }`}
    >
      {/* Checkbox */}
      <Pressable
        onPress={() => onToggle(m)}
        disabled={role !== "client"}
        hitSlop={6}
        className={`mt-0.5 h-6 w-6 items-center justify-center rounded-lg border-2 ${
          m.completed ? "border-green-600 bg-green-600" : "border-slate/40 bg-transparent"
        }`}
      >
        {m.completed ? <Feather name="check" size={13} color="white" /> : null}
      </Pressable>

      {/* Content */}
      <View className="min-w-0 flex-1">
        <Text
          className={`font-sans-semibold text-sm ${
            m.completed ? "text-slate-light line-through" : "text-navy"
          }`}
        >
          {m.title}
        </Text>

        {m.description ? (
          <Text className="mt-1 font-sans text-xs leading-5 text-slate">
            {m.description}
          </Text>
        ) : null}

        <View className="mt-2 flex-row flex-wrap items-center gap-3">
          {m.due_date ? (
            <View className="flex-row items-center gap-1">
              <Feather
                name="calendar"
                size={11}
                color={overdue ? "#EF4444" : colors.slateLight}
              />
              <Text
                className={`font-sans text-xs ${overdue ? "text-red-500" : "text-slate-light"}`}
              >
                {overdue && !m.completed ? "Overdue · " : ""}
                {m.due_date}
              </Text>
            </View>
          ) : null}

          {m.completed && m.completed_at ? (
            <Text className="font-sans text-xs text-green-600">
              ✓ Completed {new Date(m.completed_at).toLocaleDateString()}
            </Text>
          ) : null}

          <View className="rounded-full bg-gold/10 px-2 py-0.5">
            <Text className="font-sans text-xs text-gold-deep">
              {role === "coach" ? m.client : `from ${m.coach}`}
            </Text>
          </View>
        </View>
      </View>

      {/* Coach actions */}
      {role === "coach" ? (
        <View className="flex-row gap-1.5">
          <Pressable
            onPress={() => onEdit(m)}
            hitSlop={6}
            className="h-7 w-7 items-center justify-center rounded-lg"
          >
            <Feather name="edit-2" size={13} color={colors.slate} />
          </Pressable>
          <Pressable
            onPress={() => onDelete(m.id)}
            hitSlop={6}
            className="h-7 w-7 items-center justify-center rounded-lg"
          >
            <Feather name="trash-2" size={13} color="#EF4444" />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function AddEditModal({ onClose, onSave, clients, initial }) {
  const isEdit = !!initial;
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [dueDate, setDueDate] = useState(initial?.due_date || "");
  const [clientId, setClientId] = useState(initial?.client_id?.toString() || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (!isEdit && !clientId) {
      toast.error("Select a client.");
      return;
    }
    setSaving(true);
    await onSave({ title, description, due_date: dueDate || null, client_id: clientId });
    setSaving(false);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-navy-deep/60 p-4">
        <View className="max-h-[90%] w-full max-w-md rounded-2xl bg-white p-6">
          <View className="mb-5 flex-row items-center justify-between">
            <Text className="font-display text-xl text-navy">
              {isEdit ? "Edit Milestone" : "New Milestone"}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              className="h-8 w-8 items-center justify-center rounded-lg bg-navy/5"
            >
              <Feather name="x" size={14} color={colors.slate} />
            </Pressable>
          </View>

          <ScrollView>
            {!isEdit ? (
              <View className="mb-4">
                <Text className="mb-1.5 text-xs font-sans-semibold uppercase tracking-wider text-slate">
                  Client
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerClassName="gap-2 pb-1"
                >
                  {clients.map((c) => {
                    const selected = String(clientId) === String(c.id);
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => setClientId(String(c.id))}
                        className={`rounded-full px-4 py-2 ${
                          selected ? "bg-gold" : "border border-gold/30 bg-cream"
                        }`}
                      >
                        <Text
                          className={`font-sans-medium text-sm ${
                            selected ? "text-navy-deep" : "text-slate"
                          }`}
                        >
                          {c.username}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <Input
              label="Title *"
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Complete 3 networking conversations"
            />

            <Input
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Optional details…"
              multiline
            />

            <View className="mb-4">
              <DateFilter label="Due Date" value={dueDate} onChange={setDueDate} />
            </View>
          </ScrollView>

          <View className="mt-2 flex-row gap-3">
            <Button variant="ghost" onPress={onClose} className="flex-1">
              Cancel
            </Button>
            <Button variant="gold" onPress={handleSave} loading={saving} className="flex-1">
              {isEdit ? "Save Changes" : "Create"}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function Milestones() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const role = user?.role;

  const [milestones, setMilestones] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { mode: 'add' | 'edit', data? }
  const [filter, setFilter] = useState("all"); // all | pending | completed | overdue
  const [clientFilter, setClientFilter] = useState("all");

  useEffect(() => {
    if (!isAuthenticated) router.replace("/login");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMilestones = useCallback(async () => {
    try {
      const res = await api.get("/bookings/milestones/");
      setMilestones(res.data);
    } catch {
      toast.error("Failed to load milestones.");
    }
  }, []);

  const fetchClients = useCallback(async () => {
    if (role !== "coach") return;
    try {
      // Distinct clients, derived from bookings.
      const res = await api.get("/bookings/");
      const seen = new Map();
      res.data.forEach((b) => {
        if (b.learner_id && !seen.has(b.learner_id)) {
          seen.set(b.learner_id, {
            id: b.learner_id,
            username: b.learner_username || b.learner_name || `Client #${b.learner_id}`,
          });
        }
      });
      setClients([...seen.values()]);
    } catch {
      /* non-critical */
    }
  }, [role]);

  const load = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchMilestones(), fetchClients()]);
    setLoading(false);
  }, [fetchMilestones, fetchClients]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = async (m) => {
    if (role !== "client") return;
    try {
      const res = await api.patch(`/bookings/milestones/${m.id}/`, {
        completed: !m.completed,
      });
      setMilestones((prev) => prev.map((x) => (x.id === m.id ? res.data : x)));
      toast.success(res.data.completed ? "Milestone completed! 🎉" : "Marked as incomplete.");
    } catch {
      toast.error("Failed to update.");
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirm("Delete this milestone?", { confirmLabel: "Delete" }))) return;
    try {
      await api.delete(`/bookings/milestones/${id}/`);
      setMilestones((prev) => prev.filter((m) => m.id !== id));
      toast.success("Milestone deleted.");
    } catch {
      toast.error("Failed to delete.");
    }
  };

  const handleSave = async ({ title, description, due_date, client_id }) => {
    try {
      if (modal.mode === "add") {
        const res = await api.post("/bookings/milestones/", {
          title,
          description,
          due_date,
          client_id,
        });
        setMilestones((prev) => [res.data, ...prev]);
        toast.success("Milestone created.");
      } else {
        const res = await api.patch(`/bookings/milestones/${modal.data.id}/`, {
          title,
          description,
          due_date,
        });
        setMilestones((prev) => prev.map((m) => (m.id === modal.data.id ? res.data : m)));
        toast.success("Milestone updated.");
      }
      setModal(null);
    } catch {
      toast.error("Failed to save milestone.");
    }
  };

  // Filters
  const now = new Date();
  const uniqueClients = [
    ...new Set(milestones.map((m) => (role === "coach" ? m.client : m.coach))),
  ];

  const filtered = milestones.filter((m) => {
    const matchStatus =
      filter === "all"
        ? true
        : filter === "completed"
          ? m.completed
          : filter === "pending"
            ? !m.completed
            : filter === "overdue"
              ? !m.completed && m.due_date && new Date(m.due_date) < now
              : true;
    const matchClient =
      clientFilter === "all"
        ? true
        : role === "coach"
          ? m.client === clientFilter
          : m.coach === clientFilter;
    return matchStatus && matchClient;
  });

  const stats = {
    total: milestones.length,
    completed: milestones.filter((m) => m.completed).length,
    overdue: milestones.filter(
      (m) => !m.completed && m.due_date && new Date(m.due_date) < now
    ).length,
  };
  const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const FILTERS = [
    { key: "all", label: `All (${stats.total})` },
    { key: "pending", label: `Pending (${stats.total - stats.completed})` },
    { key: "completed", label: `Completed (${stats.completed})` },
    { key: "overdue", label: `Overdue (${stats.overdue})`, danger: true },
  ];

  return (
    <Screen onRefresh={load} refreshing={false}>
      {/* Header */}
      <View className="mb-8 flex-row items-center justify-between gap-4">
        <View className="flex-1 flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-2xl bg-gold/15">
            <Feather name="target" size={20} color={colors.gold} />
          </View>
          <Text className="flex-1 font-display text-3xl text-navy">
            Milestones & Goals
          </Text>
        </View>
      </View>

      {role === "coach" ? (
        <Button
          variant="gold"
          onPress={() => setModal({ mode: "add" })}
          className="mb-6"
          fullWidth
        >
          + New Milestone
        </Button>
      ) : null}

      {/* Progress bar */}
      {stats.total > 0 ? (
        <View className="mb-6 rounded-2xl border border-gold/20 bg-white p-4">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="font-sans-semibold text-xs text-navy">{pct}% Complete</Text>
            <Text className="font-sans text-xs text-slate">
              {stats.completed}/{stats.total} milestones
              {stats.overdue > 0 ? (
                <Text className="text-red-600"> · {stats.overdue} overdue</Text>
              ) : null}
            </Text>
          </View>
          <View className="h-2 overflow-hidden rounded-full bg-gold/15">
            <View className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
          </View>
        </View>
      ) : null}

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 pb-1"
        className="mb-6"
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              className={`rounded-full border px-3 py-1.5 ${
                active
                  ? f.danger
                    ? "border-red-200 bg-red-50"
                    : "border-gold bg-gold"
                  : "border-gold/20 bg-white"
              }`}
            >
              <Text
                className={`font-sans-semibold text-xs ${
                  active ? (f.danger ? "text-red-700" : "text-navy-deep") : "text-slate"
                }`}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {uniqueClients.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 pb-1"
          className="mb-6"
        >
          {["all", ...uniqueClients].map((c) => {
            const active = clientFilter === c;
            return (
              <Pressable
                key={c}
                onPress={() => setClientFilter(c)}
                className={`rounded-xl border px-3 py-1.5 ${
                  active ? "border-gold bg-gold" : "border-gold/20 bg-white"
                }`}
              >
                <Text
                  className={`font-sans-semibold text-xs ${
                    active ? "text-navy-deep" : "text-slate"
                  }`}
                >
                  {c === "all" ? (role === "coach" ? "All Clients" : "All Coaches") : c}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {/* List */}
      {loading ? (
        <View className="gap-3">
          {[...Array(3)].map((_, i) => (
            <View key={i} className="h-20 rounded-2xl bg-gold/10" />
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <Card className="items-center py-20">
          <Feather name="flag" size={40} color="rgba(200,169,81,0.3)" />
          <Text className="mb-1 mt-3 font-display text-xl text-navy">
            {filter === "all" && stats.total === 0
              ? role === "coach"
                ? "No milestones yet"
                : "No goals assigned yet"
              : "No milestones match this filter"}
          </Text>
          <Text className="text-center font-sans text-sm text-slate-light">
            {role === "coach" && filter === "all"
              ? "Create milestones to track your clients' progress toward their goals."
              : "Try a different filter or check back later."}
          </Text>
          {role === "coach" && filter === "all" && stats.total === 0 ? (
            <Button
              variant="gold"
              onPress={() => setModal({ mode: "add" })}
              className="mt-5"
            >
              + Create First Milestone
            </Button>
          ) : null}
        </Card>
      ) : (
        <View className="gap-3">
          {filtered.map((m) => (
            <MilestoneCard
              key={m.id}
              m={m}
              role={role}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onEdit={(x) => setModal({ mode: "edit", data: x })}
            />
          ))}
        </View>
      )}

      {modal ? (
        <AddEditModal
          onClose={() => setModal(null)}
          onSave={handleSave}
          clients={clients}
          initial={modal.data}
        />
      ) : null}
    </Screen>
  );
}
