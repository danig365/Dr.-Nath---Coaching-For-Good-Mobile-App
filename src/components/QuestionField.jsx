import { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { colors } from "@/theme/colors";

// Renders one dynamic form question. Ported from the QuestionField in
// frontend/src/pages/ChemistryBooking.jsx, which the Forms page mirrors.
//
// Question types come from backend/formbuilder/models.py:
//   text | long_text | number | date | yes_no | rating | single_choice | multi_choice

const inputCls =
  "rounded-xl border border-gold/30 bg-white px-4 py-2.5 font-sans text-sm text-navy";

function Chip({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full px-4 py-2 ${
        active ? "bg-gold" : "border border-gold/30 bg-white"
      }`}
    >
      <Text
        className={`font-sans-semibold text-sm ${
          active ? "text-navy-deep" : "text-slate"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function DateAnswer({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} className={inputCls}>
        <Text className={`font-sans text-sm ${value ? "text-navy" : "text-slate-light"}`}>
          {value || "Select a date"}
        </Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={value ? new Date(`${value}T00:00:00`) : new Date()}
          mode="date"
          onChange={(event, selected) => {
            setOpen(false);
            if (event.type === "dismissed" || !selected) return;
            onChange(selected.toISOString().slice(0, 10));
          }}
        />
      ) : null}
    </>
  );
}

export default function QuestionField({ q, value, onChange }) {
  if (q.type === "long_text") {
    return (
      <TextInput
        multiline
        value={value || ""}
        onChangeText={onChange}
        placeholderTextColor={colors.slateLight}
        className={`${inputCls} min-h-[80px]`}
        style={{ textAlignVertical: "top" }}
      />
    );
  }

  if (q.type === "number") {
    return (
      <TextInput
        keyboardType="numeric"
        value={value != null ? String(value) : ""}
        onChangeText={onChange}
        placeholderTextColor={colors.slateLight}
        className={inputCls}
      />
    );
  }

  if (q.type === "date") {
    return <DateAnswer value={value} onChange={onChange} />;
  }

  if (q.type === "yes_no") {
    return (
      <View className="flex-row gap-2">
        {["Yes", "No"].map((o) => (
          <Chip key={o} label={o} active={value === o} onPress={() => onChange(o)} />
        ))}
      </View>
    );
  }

  if (q.type === "rating") {
    return (
      <View className="flex-row gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            className={`h-9 w-9 items-center justify-center rounded-full ${
              Number(value) >= n ? "bg-gold" : "border border-gold/30 bg-white"
            }`}
          >
            <Text
              className={`font-sans-bold text-sm ${
                Number(value) >= n ? "text-navy-deep" : "text-slate"
              }`}
            >
              {n}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }

  if (q.type === "single_choice") {
    return (
      <View className="flex-row flex-wrap gap-2">
        {(q.options || []).map((o) => (
          <Chip key={o} label={o} active={value === o} onPress={() => onChange(o)} />
        ))}
      </View>
    );
  }

  if (q.type === "multi_choice") {
    const arr = Array.isArray(value) ? value : [];
    const toggle = (o) =>
      onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
    return (
      <View className="flex-row flex-wrap gap-2">
        {(q.options || []).map((o) => (
          <Chip key={o} label={o} active={arr.includes(o)} onPress={() => toggle(o)} />
        ))}
      </View>
    );
  }

  return (
    <TextInput
      value={value || ""}
      onChangeText={onChange}
      placeholderTextColor={colors.slateLight}
      className={inputCls}
    />
  );
}
