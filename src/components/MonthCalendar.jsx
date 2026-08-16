import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { colors } from "@/theme/colors";

// Port of frontend/src/components/MonthCalendar.jsx.
//
// Lightweight month grid. `events` is a list of { date: 'YYYY-MM-DD' }; days with
// an event get a dot. Tapping a day calls onSelect(dateStr) — and toggles off if
// the same day is tapped again.
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const iso = (y, m, d) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export default function MonthCalendar({ events = [], selected, onSelect, initialMonth }) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => {
    if (initialMonth) {
      const [y, m] = initialMonth.split("-").map(Number);
      return { y, m: m - 1 };
    }
    return { y: today.getFullYear(), m: today.getMonth() };
  });

  const eventDates = new Set(events.map((e) => e.date));
  const firstDay = new Date(cursor.y, cursor.m, 1).getDay();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const todayIso = iso(today.getFullYear(), today.getMonth(), today.getDate());

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prev = () =>
    setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }));
  const next = () =>
    setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }));

  return (
    <View>
      <View className="mb-3 flex-row items-center justify-between">
        <Pressable
          onPress={prev}
          hitSlop={8}
          className="h-8 w-8 items-center justify-center rounded-full bg-navy/5"
        >
          <Feather name="chevron-left" size={16} color={colors.navy} />
        </Pressable>
        <Text className="font-display text-sm text-navy">
          {MONTHS[cursor.m]} {cursor.y}
        </Text>
        <Pressable
          onPress={next}
          hitSlop={8}
          className="h-8 w-8 items-center justify-center rounded-full bg-navy/5"
        >
          <Feather name="chevron-right" size={16} color={colors.navy} />
        </Pressable>
      </View>

      <View className="mb-1 flex-row">
        {WEEKDAYS.map((w, i) => (
          <View key={i} className="flex-1 items-center">
            <Text className="text-[10px] font-sans-bold uppercase text-slate-light">{w}</Text>
          </View>
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={{ width: `${100 / 7}%` }} className="aspect-square p-0.5" />;

          const ds = iso(cursor.y, cursor.m, d);
          const hasEvent = eventDates.has(ds);
          const isSel = selected === ds;
          const isToday = todayIso === ds;

          return (
            <View key={i} style={{ width: `${100 / 7}%` }} className="aspect-square p-0.5">
              <Pressable
                onPress={() => onSelect(isSel ? null : ds)}
                className={`flex-1 items-center justify-center rounded-lg border ${
                  isSel
                    ? "border-gold bg-gold"
                    : hasEvent
                      ? "bg-gold/10"
                      : "bg-transparent"
                } ${!isSel && isToday ? "border-gold" : !isSel ? "border-transparent" : ""}`}
              >
                <Text
                  className={`text-sm ${isSel ? "font-sans-bold text-navy-deep" : "text-navy"}`}
                >
                  {d}
                </Text>
                {hasEvent && !isSel ? (
                  <View className="absolute bottom-1 h-1 w-1 rounded-full bg-gold" />
                ) : null}
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
