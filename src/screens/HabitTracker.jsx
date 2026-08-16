import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, Modal, ScrollView } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { Screen, Card, Button, Input } from "@/components/ui";
import { toast } from "@/lib/toast";
import { confirm } from "@/lib/confirm";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/HabitTracker.jsx.
//
// Client view: tap a day to log it. Coach view is read-only for check-ins
// (`readOnly` below) but can create, edit, archive and delete habits, and get
// AI-suggested habits for a selected client.

// Wellness domains — mirror Habit.CATEGORY_CHOICES on the backend.
const CATEGORIES = [
  { key: "nutrition", label: "Nutrition & eating" },
  { key: "activity", label: "Physical activity" },
  { key: "sleep", label: "Sleep" },
  { key: "stress", label: "Stress" },
  { key: "mindfulness", label: "Mindfulness" },
  { key: "relationships", label: "Relationships" },
  { key: "burnout", label: "Burnout" },
  { key: "balance", label: "Work-life balance" },
];
const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

const isoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const last7Days = () => {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d;
  });
};

const WEEKDAY = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function HabitCard({ habit, readOnly, onToggleDay, onEdit, onArchive, onDelete }) {
  const dates = last7Days();
  const todayIso = isoDate(new Date());
  const archived = habit.active === false;

  return (
    <Card className={archived ? "opacity-70" : ""}>
      <View className="mb-4 flex-row items-start justify-between gap-4">
        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="font-display text-lg text-navy">{habit.title}</Text>
            {habit.category ? (
              <View className="rounded-full bg-slate/10 px-2 py-0.5">
                <Text className="text-[10px] font-sans-bold uppercase text-slate">
                  {CAT_LABEL[habit.category] || habit.category}
                </Text>
              </View>
            ) : null}
            {archived ? (
              <View className="rounded-full bg-slate/10 px-2 py-0.5">
                <Text className="text-[10px] font-sans-bold uppercase text-slate">
                  Archived
                </Text>
              </View>
            ) : null}
          </View>

          {habit.description ? (
            <Text className="mt-0.5 font-sans text-sm text-slate">{habit.description}</Text>
          ) : null}
          {readOnly ? (
            <Text className="mt-1 font-sans text-xs text-slate-light">
              for {habit.client}
            </Text>
          ) : null}
        </View>

        <View className="flex-row items-center gap-2">
          <View className="flex-row items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1">
            <Feather name="zap" size={12} color={colors.goldDeep} />
            <Text className="font-sans-bold text-xs text-gold-deep">{habit.streak}d</Text>
          </View>
          <View className="rounded-full bg-green-100 px-2.5 py-1">
            <Text className="font-sans-bold text-xs text-green-900">
              {habit.consistency}%
            </Text>
          </View>
        </View>
      </View>

      {/* 7-day grid */}
      <View className="flex-row items-end justify-between gap-2">
        {dates.map((d) => {
          const iso = isoDate(d);
          const done = habit.check_in_dates.includes(iso);
          const isToday = iso === todayIso;

          const cell = (
            <View
              className={`aspect-square w-full max-w-[40px] items-center justify-center rounded-xl border ${
                done
                  ? "border-gold bg-gold"
                  : isToday
                    ? "border-gold bg-cream"
                    : "border-gold/25 bg-cream"
              }`}
            >
              {done ? (
                <Feather name="check" size={16} color={colors.navyDeep} />
              ) : (
                <Text className="font-sans-semibold text-xs text-slate-light">
                  {d.getDate()}
                </Text>
              )}
            </View>
          );

          return (
            <View key={iso} className="flex-1 items-center gap-1.5">
              <Text
                className={`text-[10px] font-sans-semibold ${
                  isToday ? "text-gold" : "text-slate-light"
                }`}
              >
                {WEEKDAY[d.getDay()]}
              </Text>
              {readOnly ? (
                <View className="w-full items-center">{cell}</View>
              ) : (
                <Pressable
                  onPress={() => onToggleDay(habit, d)}
                  className="w-full items-center"
                >
                  {cell}
                </Pressable>
              )}
            </View>
          );
        })}
      </View>

      {readOnly ? (
        <View className="mt-4 flex-row items-center gap-2 border-t border-gold/10 pt-4">
          {!archived ? (
            <Pressable
              onPress={() => onEdit(habit)}
              className="flex-row items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1.5"
            >
              <Feather name="edit-2" size={12} color={colors.goldDeep} />
              <Text className="font-sans-semibold text-xs text-gold-deep">Edit</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => onArchive(habit)}
            className="flex-row items-center gap-1.5 rounded-full bg-navy/5 px-3 py-1.5"
          >
            <Feather
              name={archived ? "rotate-ccw" : "archive"}
              size={12}
              color={colors.navy}
            />
            <Text className="font-sans-semibold text-xs text-navy">
              {archived ? "Unarchive" : "Archive"}
            </Text>
          </Pressable>

          <View className="flex-1" />

          <Pressable
            onPress={() => onDelete(habit)}
            className="flex-row items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5"
          >
            <Feather name="trash-2" size={12} color="#B91C1C" />
            <Text className="font-sans-semibold text-xs text-red-700">Delete</Text>
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}

function CategoryPicker({ value, onChange, emptyLabel }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 pb-1"
      className="mb-4"
    >
      <Pressable
        onPress={() => onChange("")}
        className={`rounded-full px-4 py-2 ${
          !value ? "bg-gold" : "border border-gold/30 bg-cream"
        }`}
      >
        <Text
          className={`font-sans-medium text-sm ${!value ? "text-navy-deep" : "text-slate"}`}
        >
          {emptyLabel}
        </Text>
      </Pressable>
      {CATEGORIES.map((c) => {
        const active = value === c.key;
        return (
          <Pressable
            key={c.key}
            onPress={() => onChange(c.key)}
            className={`rounded-full px-4 py-2 ${
              active ? "bg-gold" : "border border-gold/30 bg-cream"
            }`}
          >
            <Text
              className={`font-sans-medium text-sm ${
                active ? "text-navy-deep" : "text-slate"
              }`}
            >
              {c.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function HabitModal({ initial, onClose, onSave }) {
  const isEdit = !!initial?.id;
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [category, setCategory] = useState(initial?.category || "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    setSaving(true);
    try {
      await onSave({ title: title.trim(), description: description.trim(), category });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-navy-deep/60 p-4">
        <View className="w-full max-w-md rounded-2xl bg-white p-6">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="font-display text-xl text-navy">
              {isEdit ? "Edit habit" : "New habit"}
            </Text>
            <Pressable onPress={onClose} hitSlop={8} className="rounded-full bg-navy/5 p-1.5">
              <Feather name="x" size={16} color={colors.slate} />
            </Pressable>
          </View>

          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Meditate 10 minutes"
          />
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder="Optional details…"
            multiline
          />

          <CategoryPicker
            value={category}
            onChange={setCategory}
            emptyLabel="Wellness area (optional)"
          />

          <View className="flex-row gap-3">
            <Button variant="ghost" onPress={onClose} className="flex-1">
              Cancel
            </Button>
            <Button variant="gold" onPress={submit} loading={saving} className="flex-1">
              {isEdit ? "Save" : "Create"}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SuggestModal({ clientId, clientName, onClose, onAssigned }) {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null); // null = not generated yet
  const [added, setAdded] = useState({});
  const [busyIdx, setBusyIdx] = useState(null);

  const generate = async () => {
    setLoading(true);
    setSuggestions(null);
    setAdded({});
    try {
      const res = await api.post("/bookings/habits/suggest/", {
        client_id: clientId,
        domain,
      });
      const list = res.data.suggestions || [];
      setSuggestions(list);
      if (!list.length) toast.info(res.data.detail || "No suggestions right now.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to get suggestions.");
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const add = async (s, idx) => {
    setBusyIdx(idx);
    try {
      const res = await api.post("/bookings/habits/", {
        client_id: clientId,
        title: s.title,
        description: s.description,
        category: s.category,
      });
      onAssigned(res.data);
      setAdded((a) => ({ ...a, [idx]: true }));
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to add habit.");
    } finally {
      setBusyIdx(null);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-navy-deep/60 p-4">
        <View className="max-h-[85%] w-full max-w-lg rounded-2xl bg-white p-6">
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="font-display text-xl text-navy">Suggest habits with AI</Text>
            <Pressable onPress={onClose} hitSlop={8} className="rounded-full bg-navy/5 p-1.5">
              <Feather name="x" size={16} color={colors.slate} />
            </Pressable>
          </View>

          <Text className="mb-4 font-sans text-sm text-slate">
            Tailored ideas for <Text className="font-sans-bold text-navy">{clientName}</Text>
            , based on their recent sessions. Review and add the ones you like.
          </Text>

          <CategoryPicker value={domain} onChange={setDomain} emptyLabel="Any wellness area" />

          <Button variant="gold" onPress={generate} loading={loading} className="mb-4">
            {suggestions === null ? "Generate" : "Regenerate"}
          </Button>

          {loading ? (
            <Text className="py-6 text-center font-sans text-sm text-slate">
              Generating tailored habits…
            </Text>
          ) : null}

          {suggestions && suggestions.length > 0 ? (
            <ScrollView>
              <View className="gap-3">
                {suggestions.map((s, i) => (
                  <View
                    key={i}
                    className="rounded-xl border border-gold/20 bg-cream p-4"
                  >
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="min-w-0 flex-1">
                        <View className="flex-row flex-wrap items-center gap-2">
                          <Text className="font-sans-semibold text-sm text-navy">
                            {s.title}
                          </Text>
                          {s.category ? (
                            <View className="rounded-full bg-slate/10 px-2 py-0.5">
                              <Text className="text-[10px] font-sans-bold uppercase text-slate">
                                {CAT_LABEL[s.category] || s.category}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        {s.description ? (
                          <Text className="mt-1 font-sans text-xs text-slate">
                            {s.description}
                          </Text>
                        ) : null}
                      </View>

                      <Pressable
                        onPress={() => add(s, i)}
                        disabled={added[i] || busyIdx === i}
                        className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${
                          added[i] ? "bg-green-100" : "bg-gold"
                        } ${busyIdx === i ? "opacity-60" : ""}`}
                      >
                        <Feather
                          name={added[i] ? "check" : "plus"}
                          size={12}
                          color={added[i] ? "#2E7D32" : colors.navyDeep}
                        />
                        <Text
                          className={`font-sans-bold text-xs ${
                            added[i] ? "text-green-900" : "text-navy-deep"
                          }`}
                        >
                          {added[i] ? "Added" : busyIdx === i ? "Adding…" : "Add"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : null}

          {suggestions && suggestions.length === 0 && !loading ? (
            <Text className="py-6 text-center font-sans text-sm text-slate">
              No suggestions right now — try again or pick a different area.
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

export default function HabitTracker() {
  const { isAuthenticated, isCoach, logout } = useAuth();
  const coach = isCoach();

  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  // Coach-only state
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState("");
  const [modal, setModal] = useState({ open: false, data: null });
  const [suggestOpen, setSuggestOpen] = useState(false);

  const fetchClients = useCallback(async () => {
    try {
      const res = await api.get("/bookings/");
      const seen = new Map();
      (res.data || []).forEach((b) => {
        const id = b.learner; // booking serializer exposes the learner PK as `learner`
        if (id && !seen.has(id)) {
          seen.set(id, {
            id,
            username: b.learner_name || b.learner_username || `Client #${id}`,
          });
        }
      });
      setClients([...seen.values()]);
    } catch {
      /* non-critical */
    }
  }, []);

  const fetchHabits = useCallback(
    async (cid) => {
      setLoading(true);
      try {
        let url = "/bookings/habits/";
        if (coach) url += `?include_archived=1${cid ? `&client_id=${cid}` : ""}`;
        const res = await api.get(url);
        setHabits(res.data);
      } catch {
        toast.error("Failed to load habits.");
      } finally {
        setLoading(false);
      }
    },
    [coach]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      logout();
      return;
    }
    if (coach) {
      fetchClients();
      fetchHabits("");
    } else {
      fetchHabits();
    }
  }, [isAuthenticated, coach, logout, fetchClients, fetchHabits]);

  const onClientChange = (cid) => {
    setClientId(cid);
    fetchHabits(cid);
  };

  const toggleDay = async (habit, dateObj) => {
    const iso = isoDate(dateObj);
    const done = !habit.check_in_dates.includes(iso);
    try {
      const res = await api.post(`/bookings/habits/${habit.id}/check-in/`, {
        date: iso,
        done,
      });
      setHabits((hs) => hs.map((h) => (h.id === habit.id ? res.data : h)));
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update check-in.");
    }
  };

  const saveHabit = async ({ title, description, category }) => {
    try {
      if (modal.data?.id) {
        const res = await api.patch(`/bookings/habits/${modal.data.id}/`, {
          title,
          description,
          category,
        });
        setHabits((hs) => hs.map((h) => (h.id === modal.data.id ? res.data : h)));
      } else {
        if (!clientId) {
          toast.error("Select a client first.");
          return;
        }
        const res = await api.post("/bookings/habits/", {
          client_id: clientId,
          title,
          description,
          category,
        });
        setHabits((hs) => [res.data, ...hs]);
      }
      setModal({ open: false, data: null });
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save habit.");
    }
  };

  const archiveHabit = async (habit) => {
    try {
      const res = await api.patch(`/bookings/habits/${habit.id}/`, {
        active: habit.active === false,
      });
      setHabits((hs) => hs.map((h) => (h.id === habit.id ? res.data : h)));
    } catch {
      toast.error("Failed to update habit.");
    }
  };

  const deleteHabit = async (habit) => {
    const ok = await confirm(
      `Delete "${habit.title}"? This removes all its check-in history.`,
      { confirmLabel: "Delete" }
    );
    if (!ok) return;
    try {
      await api.delete(`/bookings/habits/${habit.id}/`);
      setHabits((hs) => hs.filter((h) => h.id !== habit.id));
    } catch {
      toast.error("Failed to delete habit.");
    }
  };

  if (loading) return <Screen loading />;

  return (
    <Screen onRefresh={() => fetchHabits(clientId)} refreshing={false}>
      <View className="mb-8">
        <Text className="mb-1 text-xs font-sans-semibold uppercase tracking-[2px] text-gold-deep">
          Accountability
        </Text>
        <Text className="font-display text-3xl text-navy">
          {coach ? "Habit Tracker" : "Daily Habits"}
        </Text>
        <Text className="mt-1 font-sans text-sm text-slate">
          {coach
            ? "Assign daily habits and track each client's consistency."
            : "Tap a day to log it. Keep your streak alive between sessions."}
        </Text>
      </View>

      {coach ? (
        <>
          <View className="mb-4 flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onPress={() => {
                if (!clientId) {
                  toast.info("Select a client first.");
                  return;
                }
                setSuggestOpen(true);
              }}
            >
              Suggest with AI
            </Button>
            <Button
              variant="gold"
              className="flex-1"
              onPress={() => setModal({ open: true, data: null })}
            >
              + New habit
            </Button>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 pb-1"
            className="mb-6"
          >
            {[{ id: "", username: "All clients" }, ...clients].map((c) => {
              const active = String(clientId) === String(c.id);
              return (
                <Pressable
                  key={String(c.id)}
                  onPress={() => onClientChange(String(c.id))}
                  className={`rounded-full px-4 py-2 ${
                    active ? "bg-gold" : "border border-gold/30 bg-white"
                  }`}
                >
                  <Text
                    className={`font-sans-medium text-sm ${
                      active ? "text-navy-deep" : "text-slate"
                    }`}
                  >
                    {c.username}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      {habits.length === 0 ? (
        <Card className="items-center border-dashed py-20">
          <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-gold/15">
            <Feather name="activity" size={22} color={colors.gold} />
          </View>
          <Text className="mb-1 font-display text-lg text-navy">No habits yet</Text>
          <Text className="text-center font-sans text-sm text-slate">
            {coach
              ? "Select a client and create a habit to get them started."
              : "Your coach will assign habits to help you build momentum."}
          </Text>
        </Card>
      ) : (
        <View className="gap-4">
          {habits.map((h) => (
            <HabitCard
              key={h.id}
              habit={h}
              readOnly={coach}
              onToggleDay={toggleDay}
              onEdit={(hb) => setModal({ open: true, data: hb })}
              onArchive={archiveHabit}
              onDelete={deleteHabit}
            />
          ))}
        </View>
      )}

      {modal.open ? (
        <HabitModal
          initial={modal.data}
          onClose={() => setModal({ open: false, data: null })}
          onSave={saveHabit}
        />
      ) : null}

      {suggestOpen ? (
        <SuggestModal
          clientId={clientId}
          clientName={
            clients.find((c) => String(c.id) === String(clientId))?.username ||
            "this client"
          }
          onClose={() => setSuggestOpen(false)}
          onAssigned={(h) => setHabits((hs) => [h, ...hs])}
        />
      ) : null}
    </Screen>
  );
}
