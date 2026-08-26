import { useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, TextInput } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { colors } from "@/theme/colors";
import { useKeyboardHeight } from "@/lib/useKeyboardHeight";

// Dropdown equivalent of the web app's <select>. Opens a modal list rather than
// laying every choice out inline: a chip row only works while the options stay
// few and short, and several of these lists (timezones, a coach's clients) grow
// without bound.
//
// `options` is [{ label, value }] — or plain strings, which are used as both.
// Pass `searchable` for long lists.
export default function Select({
  label,
  // Heading for the modal, when the caller renders its own field label (some
  // forms use sentence-case labels and would look odd with this one's).
  title,
  value,
  options,
  onChange,
  placeholder = "Select…",
  searchable = false,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const keyboardHeight = useKeyboardHeight();

  const items = options.map((o) =>
    typeof o === "object" && o !== null ? o : { label: String(o), value: o }
  );
  const selected = items.find((o) => String(o.value) === String(value));

  const shown = query.trim()
    ? items.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : items;

  const modalTitle = title ?? label;

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <View className={className}>
      {label ? (
        <Text className="mb-1.5 text-[10px] font-sans-semibold uppercase tracking-wider text-slate">
          {label}
        </Text>
      ) : null}

      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label || "Select"}: ${selected?.label ?? placeholder}`}
        className="flex-row items-center gap-1 rounded-lg border border-navy/20 bg-cream px-3 py-2.5"
      >
        <Text
          className={`flex-1 font-sans text-sm ${selected ? "text-navy" : "text-slate-light"}`}
          numberOfLines={1}
        >
          {selected?.label ?? placeholder}
        </Text>
        <Feather name="chevron-down" size={14} color={colors.slateLight} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable
          onPress={close}
          style={{ paddingBottom: keyboardHeight }}
          className="flex-1 justify-center bg-navy-deep/60 px-8"
        >
          {/* Stops a tap inside the sheet from closing it. */}
          <Pressable onPress={() => {}} className="max-h-[70%] overflow-hidden rounded-2xl bg-white">
            {modalTitle ? (
              <Text className="border-b border-cream-warm px-4 py-3 text-[10px] font-sans-semibold uppercase tracking-wider text-slate">
                {modalTitle}
              </Text>
            ) : null}

            {searchable ? (
              <View className="border-b border-cream-warm px-3 py-2">
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search…"
                  placeholderTextColor={colors.slateLight}
                  autoCorrect={false}
                  className="rounded-lg bg-cream px-3 py-2 font-sans text-sm text-navy"
                />
              </View>
            ) : null}

            <ScrollView keyboardShouldPersistTaps="handled">
              {shown.length === 0 ? (
                <Text className="px-4 py-6 text-center font-sans text-sm text-slate-light">
                  No matches.
                </Text>
              ) : (
                shown.map((o) => {
                  const on = String(o.value) === String(value);
                  return (
                    <Pressable
                      key={String(o.value)}
                      onPress={() => {
                        onChange(o.value);
                        close();
                      }}
                      className={`flex-row items-center gap-2 px-4 py-3 ${on ? "bg-gold/15" : ""}`}
                    >
                      <Text
                        className={`flex-1 font-sans text-[15px] ${
                          on ? "text-gold-deep" : "text-navy"
                        }`}
                      >
                        {o.label}
                      </Text>
                      {on ? <Feather name="check" size={15} color={colors.goldDeep} /> : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
