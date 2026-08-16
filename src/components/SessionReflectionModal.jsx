import { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { Button } from "@/components/ui";
import { toast } from "@/lib/toast";
import { colors } from "@/theme/colors";

// Port of frontend/src/components/SessionReflectionModal.jsx.
//
// Post-session reflection: the client captures takeaways + action items; the
// coach views them read-only. Used from My Learning (client) and My Sessions
// (coach). `readOnly` = coach view.
export default function SessionReflectionModal({ session, readOnly = false, onClose, onSaved }) {
  const [takeaways, setTakeaways] = useState("");
  const [items, setItems] = useState([]);
  const [aiItems, setAiItems] = useState([]); // AI-suggested action items (client only)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;

    api
      .get(`/bookings/${session.id}/reflection/`)
      .then((res) => {
        if (!alive) return;
        setTakeaways(res.data.takeaways || "");
        setItems(Array.isArray(res.data.action_items) ? res.data.action_items : []);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));

    // Offer the AI-generated action items as a one-tap starting point (client only).
    if (!readOnly) {
      api
        .get(`/bookings/${session.id}/ai-summary/`)
        .then((res) => {
          if (alive && Array.isArray(res.data.action_items)) setAiItems(res.data.action_items);
        })
        .catch(() => {});
    }

    return () => {
      alive = false;
    };
  }, [session.id, readOnly]);

  const setItem = (i, patch) =>
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const addItem = () => setItems((arr) => [...arr, { text: "", done: false }]);
  const removeItem = (i) => setItems((arr) => arr.filter((_, idx) => idx !== i));

  // Append any AI suggestions not already present in the client's list.
  const addAiSuggestions = () =>
    setItems((arr) => {
      const existing = new Set(arr.map((it) => (it.text || "").trim().toLowerCase()));
      const additions = aiItems
        .filter((t) => t && !existing.has(String(t).trim().toLowerCase()))
        .map((t) => ({ text: String(t).slice(0, 500), done: false }));
      return [...arr, ...additions];
    });

  const save = async () => {
    setSaving(true);
    try {
      const clean = items
        .map((it) => ({ text: (it.text || "").trim(), done: !!it.done }))
        .filter((it) => it.text);
      await api.put(`/bookings/${session.id}/reflection/`, {
        takeaways: takeaways.trim(),
        action_items: clean,
      });
      toast.success("Your session notes were saved.");
      onSaved?.();
      onClose();
    } catch {
      toast.error("Couldn't save your notes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-1 items-center justify-center bg-navy-deep/60 p-4">
          <View className="max-h-[90%] w-full max-w-lg rounded-2xl bg-white">
            <View className="flex-row items-center justify-between border-b border-gold/20 p-5">
              <View className="min-w-0 flex-1">
                <Text className="font-display text-lg text-navy" numberOfLines={1}>
                  {readOnly ? "Client's session notes" : "Your session notes"}
                </Text>
                <Text className="mt-0.5 font-sans text-xs text-slate">
                  {session.skill_title}
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={8} className="rounded-full bg-navy/5 p-1.5">
                <Feather name="x" size={16} color={colors.slate} />
              </Pressable>
            </View>

            {loading ? (
              <View className="items-center py-16">
                <ActivityIndicator color={colors.gold} />
              </View>
            ) : (
              <ScrollView contentContainerClassName="p-5 gap-5">
                <View>
                  <Text className="mb-1.5 text-xs font-sans-semibold uppercase tracking-wider text-gold-deep">
                    Key takeaways
                  </Text>
                  {readOnly ? (
                    <Text className="font-sans text-sm text-navy">
                      {takeaways || (
                        <Text className="text-slate-light">No takeaways added.</Text>
                      )}
                    </Text>
                  ) : (
                    <TextInput
                      value={takeaways}
                      onChangeText={setTakeaways}
                      multiline
                      placeholder="What stood out? What did you learn or realise in this session?"
                      placeholderTextColor={colors.slateLight}
                      className="min-h-[96px] rounded-xl border border-gold/30 bg-cream px-4 py-2.5 font-sans text-sm text-navy"
                      style={{ textAlignVertical: "top" }}
                    />
                  )}
                </View>

                <View>
                  <Text className="mb-1.5 text-xs font-sans-semibold uppercase tracking-wider text-gold-deep">
                    Action items / next steps
                  </Text>

                  {items.length === 0 && readOnly ? (
                    <Text className="font-sans text-sm text-slate-light">
                      No action items added.
                    </Text>
                  ) : null}

                  <View className="gap-2">
                    {items.map((it, i) => (
                      <View key={i} className="flex-row items-center gap-2">
                        <Pressable
                          onPress={() => !readOnly && setItem(i, { done: !it.done })}
                          disabled={readOnly}
                          hitSlop={6}
                          className={`h-5 w-5 items-center justify-center rounded border ${
                            it.done ? "border-gold bg-gold" : "border-gold/40 bg-cream"
                          }`}
                        >
                          {it.done ? (
                            <Feather name="check" size={13} color={colors.navyDeep} />
                          ) : null}
                        </Pressable>

                        {readOnly ? (
                          <Text
                            className={`flex-1 font-sans text-sm text-navy ${
                              it.done ? "line-through opacity-60" : ""
                            }`}
                          >
                            {it.text}
                          </Text>
                        ) : (
                          <TextInput
                            value={it.text}
                            onChangeText={(v) => setItem(i, { text: v })}
                            placeholder="e.g. Practise the breathing exercise daily"
                            placeholderTextColor={colors.slateLight}
                            className={`flex-1 rounded-lg border border-gold/30 bg-cream px-3 py-2 font-sans text-sm text-navy ${
                              it.done ? "line-through" : ""
                            }`}
                          />
                        )}

                        {!readOnly ? (
                          <Pressable onPress={() => removeItem(i)} hitSlop={6} className="p-1">
                            <Feather name="trash-2" size={14} color="#B91C1C" />
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                  </View>

                  {!readOnly ? (
                    <View className="mt-2 flex-row flex-wrap items-center gap-4">
                      <Pressable
                        onPress={addItem}
                        className="flex-row items-center gap-1.5"
                        hitSlop={6}
                      >
                        <Feather name="plus" size={13} color={colors.goldDeep} />
                        <Text className="font-sans-semibold text-xs text-gold-deep">
                          Add action item
                        </Text>
                      </Pressable>

                      {aiItems.length > 0 ? (
                        <Pressable
                          onPress={addAiSuggestions}
                          className="flex-row items-center gap-1.5 rounded-full bg-gold/15 px-2.5 py-1"
                        >
                          <Feather name="zap" size={12} color={colors.goldDeep} />
                          <Text className="font-sans-bold text-xs text-gold-deep">
                            Add AI suggestions
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </ScrollView>
            )}

            {!readOnly && !loading ? (
              <View className="flex-row gap-3 border-t border-gold/20 p-5">
                <Button variant="ghost" onPress={onClose} className="flex-1">
                  Cancel
                </Button>
                <Button variant="gold" onPress={save} loading={saving} className="flex-1">
                  Save notes
                </Button>
              </View>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
