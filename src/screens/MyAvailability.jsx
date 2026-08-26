import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Modal, TextInput } from "react-native";
import { useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import * as Clipboard from "expo-clipboard";

import { api } from "@/api/client";
import { API_HOST } from "@/api/config";
import { useAuth } from "@/context/AuthContext";
import { Screen, Card, Button, Input, Select } from "@/components/ui";
import { DateFilter, TimeField, DateTimeField } from "@/components/sessionUi";
import GoogleCalendarCard from "@/components/GoogleCalendarCard";
import SentInvitesPanel from "@/components/SentInvitesPanel";
import { GROUP_SESSIONS_ENABLED } from "@/config/features";
import { SESSION_GRACE_MS } from "@/lib/sessionTiming";
import { toast } from "@/lib/toast";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/MyAvailability.jsx — the coach's schedule, slot
// calendar, group sessions and sent invites.

const DAYS = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];
const DURATIONS = [15, 30, 45, 60]; // 60 min is the maximum slot length
const COMMON_TZS = [
  "UTC",
  "Africa/Johannesburg", "Africa/Lagos", "Africa/Nairobi", "Africa/Cairo", "Africa/Accra",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Dubai", "Asia/Karachi",
  "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney",
];

// The coach's device timezone — a sensible pre-fill when none is confirmed yet.
const DEVICE_TZ = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
})();

const fmtTime = (iso, tz) =>
  new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz || undefined,
  });

const fmtDateShort = (iso, tz) =>
  new Date(iso).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: tz || undefined,
  });

// Interpret a wall-clock date + time as being IN `timeZone` (the coach's chosen
// timezone) and return the corresponding UTC ISO string. Without this, the
// device would parse the typed time in the VIEWER's timezone, so a coach whose
// phone is in a different zone than their profile would store the wrong instant.
const wallTimeToUtcISO = (dateStr, timeStr, timeZone) => {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, 0);
  if (!timeZone) return new Date(asUtc).toISOString();
  const inTz = new Date(new Date(asUtc).toLocaleString("en-US", { timeZone }));
  const inUtc = new Date(new Date(asUtc).toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(asUtc - (inTz.getTime() - inUtc.getTime())).toISOString();
};

const RULES_PER_PAGE = 6;

const STATUS_TONE = {
  open: { bg: "bg-green-100", text: "text-green-900" },
  booked: { bg: "bg-navy/10", text: "text-navy" },
  held: { bg: "bg-gold/15", text: "text-gold-deep" },
  blocked: { bg: "bg-slate/10", text: "text-slate" },
};

const GS_STATUS_TONE = {
  scheduled: { bg: "bg-green-100", text: "text-green-900" },
  full: { bg: "bg-gold/15", text: "text-gold-deep" },
  completed: { bg: "bg-navy/10", text: "text-navy" },
  cancelled: { bg: "bg-red-100", text: "text-red-900" },
};

const pad2 = (n) => String(n).padStart(2, "0");
// Calendar date (YYYY-MM-DD) of a slot, in the coach's own timezone.
const tzDateKey = (iso, tz) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: tz || undefined });

function Chip({ label, active, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`rounded-full px-4 py-2 ${
        active ? "bg-gold" : "border border-gold/30 bg-cream"
      } ${disabled ? "opacity-40" : ""}`}
    >
      <Text
        className={`font-sans-medium text-sm ${active ? "text-navy-deep" : "text-slate"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// Compact numeric field, styled to match Select and TimeField so a card
// mixing all three reads as one row of controls.
function NumField({ label, value, onChange, className = "" }) {
  return (
    <View className={className}>
      <Text className="mb-1.5 text-[10px] font-sans-semibold uppercase tracking-wider text-slate">
        {label}
      </Text>
      <TextInput
        value={String(value)}
        onChangeText={(v) => onChange(Number(v) || 0)}
        keyboardType="numeric"
        className="rounded-lg border border-navy/20 bg-cream px-3 py-2 font-sans text-sm text-navy"
      />
    </View>
  );
}

// ─── Weekly rule row ────────────────────────────────────────────────────────
// Laid out like the web page (frontend/src/pages/MyAvailability.jsx): two rows
// of compact fields, then the actions. The previous version gave Day and Slot a
// chip per option, which cost three full-width rows per rule and pushed the
// times and Save button below the fold.
function RuleRow({ rule, onChange, onSave, onDelete, saving }) {
  return (
    <Card>
      <View className="flex-row gap-3">
        <Select
          label="Day"
          value={rule.day_of_week}
          options={DAYS}
          onChange={(v) => onChange({ day_of_week: v })}
          className="flex-1"
        />
        <TimeField
          label="From"
          value={rule.start_time?.slice(0, 5)}
          onChange={(v) => onChange({ start_time: v })}
          className="flex-1"
        />
      </View>

      <View className="mt-3 flex-row gap-3">
        <TimeField
          label="To"
          value={rule.end_time?.slice(0, 5)}
          onChange={(v) => onChange({ end_time: v })}
          className="flex-1"
        />
        <Select
          label="Slot (min)"
          value={rule.slot_duration}
          options={DURATIONS}
          onChange={(v) => onChange({ slot_duration: v })}
          className="flex-1"
        />
        <NumField
          label="Buffer (min)"
          value={rule.buffer_minutes ?? 0}
          onChange={(v) => onChange({ buffer_minutes: v })}
          className="flex-1"
        />
      </View>

      <View className="mt-4 flex-row items-center justify-end gap-2">
        <Button variant="gold" size="sm" onPress={onSave} loading={saving}>
          Save
        </Button>
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel="Delete this rule"
          className="rounded-full bg-red-50 p-2.5"
        >
          <Feather name="trash-2" size={14} color="#B91C1C" />
        </Pressable>
      </View>
    </Card>
  );
}

function Pager({ page, totalPages, onPrev, onNext }) {
  if (totalPages <= 1) return null;
  return (
    <View className="flex-row items-center justify-center gap-3 pt-1">
      <Pressable
        onPress={onPrev}
        disabled={page <= 1}
        className={`h-9 w-9 items-center justify-center rounded-full border border-navy/10 bg-white ${
          page <= 1 ? "opacity-40" : ""
        }`}
      >
        <Feather name="chevron-left" size={16} color={colors.navy} />
      </Pressable>
      <Text className="font-sans text-sm text-slate">
        Page {page} of {totalPages}
      </Text>
      <Pressable
        onPress={onNext}
        disabled={page >= totalPages}
        className={`h-9 w-9 items-center justify-center rounded-full border border-navy/10 bg-white ${
          page >= totalPages ? "opacity-40" : ""
        }`}
      >
        <Feather name="chevron-right" size={16} color={colors.navy} />
      </Pressable>
    </View>
  );
}

// ─── Coach availability calendar ─────────────────────────────────────────────
const CAL_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function CoachCalendar({
  slots,
  tz,
  onBlockSlot,
  onUnblockSlot,
  onDeleteSlot,
  onAddSlot,
  onBlockDay,
  onOpenDay,
  onShareSlot,
  busy,
}) {
  const slotsByDate = useMemo(() => {
    const m = {};
    slots.forEach((s) => {
      (m[tzDateKey(s.start_datetime, tz)] ||= []).push(s);
    });
    Object.values(m).forEach((arr) =>
      arr.sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime))
    );
    return m;
  }, [slots, tz]);

  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedKey, setSelectedKey] = useState(null);
  const [addForm, setAddForm] = useState({ from: "09:00", to: "10:00" });

  // On first load (or when slots first arrive), jump to the earliest slot's month.
  useEffect(() => {
    if (selectedKey === null) {
      const keys = Object.keys(slotsByDate).sort();
      if (keys.length) {
        setSelectedKey(keys[0]);
        const d = new Date(keys[0] + "T00:00:00");
        setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      }
    }
  }, [slotsByDate, selectedKey]);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const startWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Mon-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayKey = tzDateKey(new Date().toISOString(), tz);
  // Past months/days are not selectable — the coach manages today onward.
  const _now = new Date();
  const prevDisabled =
    year < _now.getFullYear() || (year === _now.getFullYear() && month <= _now.getMonth());
  const monthLabel = viewMonth.toLocaleDateString([], { month: "long", year: "numeric" });
  const daySlots = selectedKey ? slotsByDate[selectedKey] || [] : [];

  const counts = (arr) => ({
    open: arr.filter((s) => s.status === "open").length,
    booked: arr.filter((s) => s.status === "booked" || s.status === "held").length,
    blocked: arr.filter((s) => s.status === "blocked").length,
  });

  const selCounts = counts(daySlots);
  const prettyDay = selectedKey
    ? new Date(selectedKey + "T00:00:00").toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const addOnDay = () => {
    if (!selectedKey) return;
    // Interpret the typed times in the coach's timezone (`tz`), not the device's.
    const startISO = wallTimeToUtcISO(selectedKey, addForm.from, tz);
    const endISO = wallTimeToUtcISO(selectedKey, addForm.to, tz);
    if (new Date(endISO) <= new Date(startISO)) {
      toast.error("End time must be after start time.");
      return;
    }
    onAddSlot(startISO, endISO);
  };

  return (
    <View className="gap-6">
      {/* Month grid */}
      <Card className="p-5">
        <View className="mb-4 flex-row items-center justify-between">
          <Pressable
            disabled={prevDisabled}
            onPress={() => !prevDisabled && setViewMonth(new Date(year, month - 1, 1))}
            className={`h-9 w-9 items-center justify-center rounded-full ${
              prevDisabled ? "opacity-30" : ""
            }`}
          >
            <Feather name="chevron-left" size={16} color={colors.goldDeep} />
          </Pressable>
          <Text className="font-display text-base text-navy">{monthLabel}</Text>
          <Pressable
            onPress={() => setViewMonth(new Date(year, month + 1, 1))}
            className="h-9 w-9 items-center justify-center rounded-full"
          >
            <Feather name="chevron-right" size={16} color={colors.goldDeep} />
          </Pressable>
        </View>

        <View className="mb-1 flex-row">
          {CAL_WEEKDAYS.map((w) => (
            <View key={w} className="flex-1 items-center py-1">
              <Text className="text-[10px] font-sans-semibold uppercase tracking-wider text-slate-light">
                {w}
              </Text>
            </View>
          ))}
        </View>

        <View className="flex-row flex-wrap">
          {cells.map((d, i) => {
            if (!d)
              return (
                <View
                  key={`b${i}`}
                  style={{ width: `${100 / 7}%` }}
                  className="aspect-square p-0.5"
                />
              );

            const key = `${year}-${pad2(month + 1)}-${pad2(d)}`;
            const dayArr = slotsByDate[key];
            const c = dayArr ? counts(dayArr) : null;
            const isSelected = key === selectedKey;
            const isToday = key === todayKey;
            const isPast = key < todayKey;

            return (
              <View key={key} style={{ width: `${100 / 7}%` }} className="aspect-square p-0.5">
                <Pressable
                  disabled={isPast}
                  onPress={() => !isPast && setSelectedKey(key)}
                  className={`flex-1 items-center justify-center rounded-xl border ${
                    isSelected
                      ? "border-navy bg-navy"
                      : dayArr
                        ? "border-transparent bg-gold/10"
                        : isToday
                          ? "border-gold/40 bg-transparent"
                          : "border-transparent bg-transparent"
                  }`}
                >
                  <Text
                    className={`font-sans-medium text-sm ${
                      isPast
                        ? "text-slate-light/40"
                        : isSelected
                          ? "text-cream"
                          : dayArr
                            ? "text-navy"
                            : "text-slate-light"
                    }`}
                  >
                    {d}
                  </Text>
                  {!isPast && c ? (
                    <View className="mt-0.5 flex-row items-center gap-0.5">
                      {c.open > 0 ? (
                        <View
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: isSelected ? "#E8C96A" : "#2E7D32" }}
                        />
                      ) : null}
                      {c.booked > 0 ? (
                        <View
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: isSelected ? colors.cream : colors.navy }}
                        />
                      ) : null}
                      {c.blocked > 0 ? (
                        <View
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: colors.slateLight }}
                        />
                      ) : null}
                    </View>
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* Legend */}
        <View className="mt-4 flex-row flex-wrap items-center gap-3">
          <View className="flex-row items-center gap-1">
            <View className="h-2 w-2 rounded-full bg-green-700" />
            <Text className="text-[11px] text-slate">Open</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <View className="h-2 w-2 rounded-full bg-navy" />
            <Text className="text-[11px] text-slate">Booked</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <View className="h-2 w-2 rounded-full bg-slate-light" />
            <Text className="text-[11px] text-slate">Blocked</Text>
          </View>
          <View className="flex-1" />
          <View className="flex-row items-center gap-1">
            <Feather name="globe" size={11} color={colors.slate} />
            <Text className="text-[11px] text-slate">{tz}</Text>
          </View>
        </View>
      </Card>

      {/* Selected day panel */}
      <Card className="p-5">
        {!selectedKey ? (
          <View className="items-center py-12">
            <Text className="mb-2 text-3xl">🗓️</Text>
            <Text className="font-sans text-sm text-slate">
              Select a day to manage its slots.
            </Text>
          </View>
        ) : (
          <>
            <Text className="mb-1 font-display text-base text-navy">{prettyDay}</Text>
            <Text className="mb-4 font-sans text-xs text-slate">
              {selCounts.open} open · {selCounts.booked} booked · {selCounts.blocked} blocked
            </Text>

            {/* Bulk day actions */}
            <View className="mb-4 flex-row gap-2">
              <Pressable
                onPress={() => onBlockDay(daySlots)}
                disabled={busy || selCounts.open === 0}
                className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-slate/10 px-3 py-2 ${
                  busy || selCounts.open === 0 ? "opacity-40" : ""
                }`}
              >
                <Feather name="lock" size={12} color={colors.slate} />
                <Text className="font-sans-semibold text-xs text-slate">Block day</Text>
              </Pressable>
              <Pressable
                onPress={() => onOpenDay(daySlots)}
                disabled={busy || selCounts.blocked === 0}
                className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-green-100 px-3 py-2 ${
                  busy || selCounts.blocked === 0 ? "opacity-40" : ""
                }`}
              >
                <Feather name="unlock" size={12} color="#2E7D32" />
                <Text className="font-sans-semibold text-xs text-green-900">Open day</Text>
              </Pressable>
            </View>

            {/* Slot list */}
            {daySlots.length === 0 ? (
              <Text className="py-3 text-center font-sans text-sm text-slate-light">
                No slots on this day.
              </Text>
            ) : (
              <View className="mb-5 gap-2">
                {daySlots.map((slot) => {
                  const locked = slot.status === "booked" || slot.status === "held";
                  const invited = slot.invited_emails || [];
                  const tone = STATUS_TONE[slot.status] || STATUS_TONE.open;

                  return (
                    <View
                      key={slot.id}
                      className="rounded-xl border border-navy/5 bg-cream px-3 py-2"
                    >
                      <View className="flex-row flex-wrap items-center gap-2">
                        <Text className="font-sans-medium text-sm text-navy">
                          {fmtTime(slot.start_datetime, tz)}–{fmtTime(slot.end_datetime, tz)}
                        </Text>
                        <View className={`rounded-full px-2 py-0.5 ${tone.bg}`}>
                          <Text
                            className={`text-[10px] font-sans-semibold uppercase ${tone.text}`}
                          >
                            {slot.status}
                          </Text>
                        </View>
                        {invited.length > 0 && slot.status === "open" ? (
                          <View className="flex-row items-center gap-1 rounded-full border border-gold/40 bg-gold/20 px-2 py-0.5">
                            <Feather name="mail" size={9} color={colors.goldDeep} />
                            <Text className="text-[10px] font-sans-semibold uppercase text-gold-deep">
                              Invited · {invited.length}
                            </Text>
                          </View>
                        ) : null}

                        <View className="flex-1" />

                        {locked ? (
                          <Text className="font-sans text-[11px] italic text-slate-light">
                            locked
                          </Text>
                        ) : (
                          <View className="flex-row items-center gap-1">
                            {slot.status === "open" ? (
                              <Pressable
                                onPress={() => onShareSlot(slot)}
                                disabled={busy}
                                hitSlop={4}
                                className="rounded-full p-1.5"
                              >
                                <Feather name="share-2" size={13} color={colors.navy} />
                              </Pressable>
                            ) : null}
                            <Pressable
                              onPress={() =>
                                slot.status === "blocked"
                                  ? onUnblockSlot(slot)
                                  : onBlockSlot(slot)
                              }
                              disabled={busy}
                              hitSlop={4}
                              className="rounded-full p-1.5"
                            >
                              <Feather
                                name={slot.status === "blocked" ? "unlock" : "lock"}
                                size={13}
                                color={colors.goldDeep}
                              />
                            </Pressable>
                            <Pressable
                              onPress={() => onDeleteSlot(slot)}
                              disabled={busy}
                              hitSlop={4}
                              className="rounded-full p-1.5"
                            >
                              <Feather name="trash-2" size={13} color="#B91C1C" />
                            </Pressable>
                          </View>
                        )}
                      </View>

                      {invited.length > 0 ? (
                        <Text className="mt-1.5 font-sans text-[11px] leading-snug text-slate">
                          <Text className="font-sans-semibold text-gold-deep">
                            Invitation sent to:
                          </Text>{" "}
                          {invited.join(", ")}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Add a slot to this day */}
            <View className="rounded-xl border border-gold/20 bg-gold/5 p-3">
              <Text className="mb-2 text-[11px] font-sans-semibold uppercase tracking-wider text-gold-deep">
                Add a slot
              </Text>
              <View className="flex-row items-end gap-2">
                <TimeField
                  label="From"
                  value={addForm.from}
                  onChange={(v) => setAddForm((f) => ({ ...f, from: v }))}
                  className="flex-1"
                />
                <TimeField
                  label="To"
                  value={addForm.to}
                  onChange={(v) => setAddForm((f) => ({ ...f, to: v }))}
                  className="flex-1"
                />
                <Button variant="gold" size="sm" onPress={addOnDay} disabled={busy}>
                  Add
                </Button>
              </View>
              <Text className="mt-2 font-sans text-[11px] leading-relaxed text-slate">
                Tip: a booking only reserves the length of the session booked — a 30-minute
                call on a 1-hour slot leaves the other 30 minutes open. To offer two short
                sessions in the same hour up front, add them as separate 30-minute slots.
              </Text>
            </View>
          </>
        )}
      </Card>
    </View>
  );
}

// ─── Share-slot invite modal ──────────────────────────────────────────────────
function ShareSlotModal({ slot, skills, tz, onClose, onSent }) {
  // Default to the slot's own skill if it has one, else the first offering.
  const [skillId, setSkillId] = useState(() => slot.skill ?? skills[0]?.id ?? "");
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  // Documents the coach can attach to the invite email (D3). Only library
  // resources that have an actual file are attachable.
  const [docs, setDocs] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState(() => new Set());

  useEffect(() => {
    let alive = true;
    api
      .get("/resources/")
      .then((res) => {
        if (!alive) return;
        setDocs((res.data || []).filter((r) => r.file));
      })
      .catch(() => {
        /* attachments are optional — ignore load failures */
      });
    return () => {
      alive = false;
    };
  }, []);

  const toggleDoc = (id) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sendInvite = async () => {
    const addrs = email.trim();
    if (!addrs) {
      toast.error("Enter at least one recipient email.");
      return;
    }
    if (!skillId) {
      toast.error("Pick an offering first.");
      return;
    }
    setSending(true);
    try {
      const res = await api.post(`/bookings/slots/${slot.id}/invite/`, {
        emails: addrs,
        skill_id: skillId,
        message: note.trim(),
        resource_ids: [...selectedDocs],
      });
      toast.success(res.data?.detail || "Invite sent.");
      setEmail("");
      setNote("");
      setSelectedDocs(new Set());
      onSent?.(); // refresh the calendar so the "Invited" badge appears
    } catch (err) {
      if (err.response?.status === 401) {
        toast.error("Your session expired — please log in again, then resend the invite.");
      } else {
        toast.error(
          err.response?.data?.detail || "Could not send the invite. Please try again."
        );
      }
    } finally {
      setSending(false);
    }
  };

  const link = skillId ? `${API_HOST}/book/${skillId}?slot=${slot.id}` : "";

  const copy = async () => {
    if (!link) return;
    await Clipboard.setStringAsync(link);
    setCopied(true);
    toast.success("Invite link copied.");
    setTimeout(() => setCopied(false), 2000);
  };

  const when = `${fmtDateShort(slot.start_datetime, tz)} · ${fmtTime(
    slot.start_datetime,
    tz
  )}–${fmtTime(slot.end_datetime, tz)}`;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-navy-deep/60 p-4">
        <View className="max-h-[90%] w-full max-w-md rounded-2xl bg-cream p-6">
          <View className="mb-1 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Feather name="share-2" size={16} color={colors.goldDeep} />
              <Text className="font-display text-lg text-navy">Share this slot</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={18} color={colors.slate} />
            </Pressable>
          </View>
          <Text className="mb-5 font-sans text-xs text-slate">{when}</Text>

          <ScrollView>
            <Text className="mb-1.5 text-[11px] font-sans-semibold uppercase tracking-wider text-gold-deep">
              Offering to book
            </Text>
            {skills.length === 0 ? (
              <Text className="mb-4 font-sans text-sm text-red-700">
                You have no offerings yet. Add a skill first.
              </Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-2 pb-1"
                className="mb-4"
              >
                {skills.map((sk) => (
                  <Chip
                    key={sk.id}
                    label={`${sk.name}${sk.price ? ` — $${sk.price}/hr` : ""}`}
                    active={String(skillId) === String(sk.id)}
                    onPress={() => setSkillId(sk.id)}
                  />
                ))}
              </ScrollView>
            )}

            <Text className="mb-1.5 text-[11px] font-sans-semibold uppercase tracking-wider text-gold-deep">
              Invite link
            </Text>
            <View className="flex-row items-center gap-2">
              <View className="flex-1 rounded-xl border border-navy/20 bg-cream-warm px-3 py-2.5">
                <Text className="font-sans text-xs text-slate" numberOfLines={1}>
                  {link}
                </Text>
              </View>
              <Button variant="gold" size="sm" onPress={copy} disabled={!link}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </View>
            <Text className="mt-3 font-sans text-[11px] leading-relaxed text-slate">
              Anyone with this link lands on the booking page with this exact time
              pre-selected. They sign in only when they confirm.
            </Text>

            {/* Or email the invite directly */}
            <View className="mt-5 border-t border-gold/30 pt-5">
              <Text className="mb-1.5 text-[11px] font-sans-semibold uppercase tracking-wider text-gold-deep">
                Or email the invite
              </Text>
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder="one@email.com; two@email.com"
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Text className="-mt-2 mb-2 font-sans text-[11px] text-slate">
                Separate multiple addresses with a semicolon (;) to invite several people
                at once.
              </Text>

              <Input
                value={note}
                onChangeText={setNote}
                placeholder="Add a short personal note (optional)"
                multiline
              />

              {docs.length > 0 ? (
                <View className="mb-4">
                  <View className="mb-1.5 flex-row items-center gap-1.5">
                    <Feather name="paperclip" size={12} color={colors.goldDeep} />
                    <Text className="text-[11px] font-sans-semibold uppercase tracking-wider text-gold-deep">
                      Attach documents (optional)
                    </Text>
                  </View>
                  <View className="max-h-36 rounded-xl border border-gold/30 bg-white">
                    <ScrollView>
                      {docs.map((d) => (
                        <Pressable
                          key={d.id}
                          onPress={() => toggleDoc(d.id)}
                          className="flex-row items-center gap-2 border-b border-gold/10 px-3 py-2"
                        >
                          <View
                            className={`h-4 w-4 items-center justify-center rounded border ${
                              selectedDocs.has(d.id)
                                ? "border-gold bg-gold"
                                : "border-gold/40 bg-white"
                            }`}
                          >
                            {selectedDocs.has(d.id) ? (
                              <Feather name="check" size={11} color={colors.navyDeep} />
                            ) : null}
                          </View>
                          <Text
                            className="flex-1 font-sans text-sm text-navy"
                            numberOfLines={1}
                          >
                            {d.title}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                  <Text className="mt-1.5 font-sans text-[11px] text-slate">
                    Selected files are attached to the invite email, so the recipient gets
                    them even before signing in.
                  </Text>
                </View>
              ) : null}

              <Button
                variant="navy"
                onPress={sendInvite}
                loading={sending}
                disabled={!link}
                fullWidth
              >
                Send invite
              </Button>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────
export default function MyAvailability() {
  const router = useRouter();
  const { isAuthenticated, isCoach, logout } = useAuth();

  const [tab, setTab] = useState("rules");
  const [rules, setRules] = useState([]);
  const [slots, setSlots] = useState([]);
  const [settings, setSettings] = useState({
    timezone: "UTC",
    booking_horizon_days: 30,
    min_notice_hours: 12,
  });
  // The timezone actually saved on the server ('UTC' = not confirmed yet).
  const [savedTimezone, setSavedTimezone] = useState("UTC");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [calBusy, setCalBusy] = useState(false);
  const [shareSlot, setShareSlot] = useState(null);
  // Date range to generate bookable slots across (defaults to the launch season).
  const [genRange, setGenRange] = useState({ start: "2026-07-01", end: "2026-12-06" });
  const [rulePage, setRulePage] = useState(1);

  // Group sessions
  const [groupSessions, setGroupSessions] = useState([]);
  const [coachSkills, setCoachSkills] = useState([]);
  const [gsForm, setGsForm] = useState({
    title: "",
    description: "",
    start: "",
    end: "",
    capacity: 10,
    price_per_seat: "",
    skill: "",
  });
  const [gsSaving, setGsSaving] = useState(false);
  const [rosterFor, setRosterFor] = useState(null);
  const [rosterData, setRosterData] = useState([]);

  // Coach can enter the call from 15 min before start until a grace window
  // after the scheduled end.
  const canJoinCall = (s) =>
    s.status !== "cancelled" &&
    new Date(s.end_datetime).getTime() + SESSION_GRACE_MS > Date.now() &&
    Date.now() >= new Date(s.start_datetime).getTime() - 15 * 60 * 1000;

  const totalRulePages = Math.max(1, Math.ceil(rules.length / RULES_PER_PAGE));
  const currentRulePage = Math.min(rulePage, totalRulePages);
  const pagedRules = rules.slice(
    (currentRulePage - 1) * RULES_PER_PAGE,
    currentRulePage * RULES_PER_PAGE
  );

  const fetchAll = useCallback(async () => {
    if (!isAuthenticated || !isCoach()) {
      logout();
      return;
    }
    setLoading(true);
    try {
      const [r, s, p, g, sk] = await Promise.all([
        api.get("/skills/availabilities/"),
        api.get("/bookings/slots/"),
        api.get("/profile/"),
        api.get("/bookings/group-sessions/"),
        api.get("/skills/"),
      ]);
      setRules(r.data);
      setSlots(s.data);
      setGroupSessions(g.data);
      setCoachSkills(sk.data);

      const prof = p.data.profile || {};
      const serverTz = prof.timezone || "UTC";
      setSavedTimezone(serverTz);
      setSettings({
        // Pre-fill the device timezone when none is confirmed, so the coach has
        // a sensible value to review and save.
        timezone: serverTz === "UTC" ? DEVICE_TZ : serverTz,
        booking_horizon_days: prof.booking_horizon_days ?? 30,
        min_notice_hours: prof.min_notice_hours ?? 12,
      });
    } catch (err) {
      toast.error("Failed to load availability.");
      if (err.response?.status === 401) logout();
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isCoach, logout]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Rules ──
  const patchLocalRule = (id, patch) =>
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addRule = () => {
    const tempId = `new-${Date.now()}`;
    setRules((rs) => [
      ...rs,
      {
        id: tempId,
        day_of_week: "Monday",
        start_time: "09:00",
        end_time: "12:00",
        slot_duration: 60,
        buffer_minutes: 0,
        is_available: true,
        _new: true,
      },
    ]);
    setRulePage(Math.ceil((rules.length + 1) / RULES_PER_PAGE));
  };

  const saveRule = async (rule) => {
    setSavingId(rule.id);
    const payload = {
      day_of_week: rule.day_of_week,
      start_time: rule.start_time,
      end_time: rule.end_time,
      slot_duration: rule.slot_duration,
      buffer_minutes: rule.buffer_minutes,
      is_available: true,
    };
    try {
      if (rule._new) {
        const res = await api.post("/skills/availabilities/", payload);
        setRules((rs) => rs.map((r) => (r.id === rule.id ? res.data : r)));
      } else {
        const res = await api.patch(`/skills/availabilities/${rule.id}/`, payload);
        setRules((rs) => rs.map((r) => (r.id === rule.id ? res.data : r)));
      }
      toast.success("Availability saved.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save rule.");
    } finally {
      setSavingId(null);
    }
  };

  const deleteRule = async (rule) => {
    if (rule._new) {
      setRules((rs) => rs.filter((r) => r.id !== rule.id));
      return;
    }
    try {
      await api.delete(`/skills/availabilities/${rule.id}/`);
      setRules((rs) => rs.filter((r) => r.id !== rule.id));
      toast.success("Removed.");
    } catch {
      toast.error("Failed to delete.");
    }
  };

  // ── Settings ──
  const saveSettings = async () => {
    try {
      await api.patch("/profile/", { profile: settings });
      setSavedTimezone(settings.timezone); // now confirmed — hides the prompt
      toast.success("Booking settings updated.");
    } catch {
      toast.error("Failed to save settings.");
    }
  };

  // ── Generate ──
  const generate = async () => {
    if (!genRange.start || !genRange.end) {
      toast.error("Pick a start and end date.");
      return;
    }
    if (genRange.end < genRange.start) {
      toast.error("End date can't be before start date.");
      return;
    }
    setGenerating(true);
    try {
      const res = await api.post("/bookings/slots/generate/", {
        start_date: genRange.start,
        end_date: genRange.end,
      });
      toast.success(
        res.data.created > 0
          ? `${res.data.created} slot(s) created.`
          : "No new slots — your schedule may already be generated for this range."
      );
      const s = await api.get("/bookings/slots/");
      setSlots(s.data);
      if (res.data.created > 0) setTab("slots");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  // ── Slots ──
  const deleteSlot = async (slot) => {
    try {
      await api.delete(`/bookings/slots/${slot.id}/`);
      setSlots((s) => s.filter((x) => x.id !== slot.id));
    } catch (err) {
      toast.error(err.response?.data?.detail || "Cannot delete.");
    }
  };

  const setSlotStatus = async (slot, action) => {
    const res = await api.patch(`/bookings/slots/${slot.id}/${action}/`);
    setSlots((s) => s.map((x) => (x.id === slot.id ? res.data : x)));
  };

  const blockSlot = async (slot) => {
    try {
      await setSlotStatus(slot, "block");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Action failed.");
    }
  };

  const unblockSlot = async (slot) => {
    try {
      await setSlotStatus(slot, "unblock");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Action failed.");
    }
  };

  const blockDaySlots = async (daySlots) => {
    const open = daySlots.filter((s) => s.status === "open");
    if (open.length === 0) return;
    setCalBusy(true);
    try {
      await Promise.all(open.map((s) => setSlotStatus(s, "block")));
      toast.success(`Blocked ${open.length} slot(s).`);
    } catch {
      toast.error("Some slots could not be blocked.");
    } finally {
      setCalBusy(false);
    }
  };

  const openDaySlots = async (daySlots) => {
    const blocked = daySlots.filter((s) => s.status === "blocked");
    if (blocked.length === 0) return;
    setCalBusy(true);
    try {
      await Promise.all(blocked.map((s) => setSlotStatus(s, "unblock")));
      toast.success(`Opened ${blocked.length} slot(s).`);
    } catch {
      toast.error("Some slots could not be opened.");
    } finally {
      setCalBusy(false);
    }
  };

  const addSlotForDay = async (startISO, endISO) => {
    setCalBusy(true);
    try {
      const res = await api.post("/bookings/slots/", {
        start_datetime: startISO,
        end_datetime: endISO,
      });
      setSlots((s) =>
        [...s, res.data].sort(
          (a, b) => new Date(a.start_datetime) - new Date(b.start_datetime)
        )
      );
      toast.success("Slot added.");
    } catch (err) {
      toast.error(
        err.response?.data?.detail || err.response?.data?.[0] || "Failed to add slot."
      );
    } finally {
      setCalBusy(false);
    }
  };

  // ── Group sessions ──
  const sortByStart = (arr) =>
    [...arr].sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));

  const createGroupSession = async () => {
    if (!gsForm.title || !gsForm.start || !gsForm.end) {
      toast.error("Title, start and end are required.");
      return;
    }
    setGsSaving(true);
    try {
      const payload = {
        title: gsForm.title,
        description: gsForm.description,
        // Interpret the chosen times in the coach's timezone, not the device's.
        start_datetime: wallTimeToUtcISO(...gsForm.start.split("T"), settings.timezone),
        end_datetime: wallTimeToUtcISO(...gsForm.end.split("T"), settings.timezone),
        capacity: Number(gsForm.capacity),
        price_per_seat: gsForm.price_per_seat || 0,
      };
      if (gsForm.skill) payload.skill = Number(gsForm.skill);

      const res = await api.post("/bookings/group-sessions/", payload);
      setGroupSessions((gs) => sortByStart([...gs, res.data]));
      setGsForm({
        title: "",
        description: "",
        start: "",
        end: "",
        capacity: 10,
        price_per_seat: "",
        skill: "",
      });
      toast.success("Group session created.");
    } catch (err) {
      toast.error(
        err.response?.data?.detail || err.response?.data?.[0] || "Failed to create session."
      );
    } finally {
      setGsSaving(false);
    }
  };

  const cancelGroupSession = async (s) => {
    try {
      const res = await api.patch(`/bookings/group-sessions/${s.id}/cancel/`);
      setGroupSessions((gs) => gs.map((x) => (x.id === s.id ? res.data : x)));
      toast.success("Session cancelled. Participants refunded.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Cancel failed.");
    }
  };

  const deleteGroupSession = async (s) => {
    try {
      await api.delete(`/bookings/group-sessions/${s.id}/`);
      setGroupSessions((gs) => gs.filter((x) => x.id !== s.id));
      if (rosterFor === s.id) setRosterFor(null);
      toast.success("Session deleted.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Delete failed.");
    }
  };

  const toggleRoster = async (s) => {
    if (rosterFor === s.id) {
      setRosterFor(null);
      return;
    }
    try {
      const res = await api.get(`/bookings/group-sessions/${s.id}/roster/`);
      setRosterData(res.data);
      setRosterFor(s.id);
    } catch {
      toast.error("Failed to load roster.");
    }
  };

  if (loading) return <Screen loading />;

  const TABS = [
    ["rules", "Schedule", "clock"],
    ["slots", "Calendar", "calendar"],
    ...(GROUP_SESSIONS_ENABLED ? [["group", "Group Sessions", "users"]] : []),
    ["invites", "Sent Invites", "mail"],
  ];

  return (
    <Screen onRefresh={fetchAll} refreshing={false}>
      <View className="mb-8">
        <Text className="font-sans text-sm text-slate">
          Set your weekly schedule, generate slots for a date range, then fine-tune them on
          the calendar.
        </Text>
      </View>

      <GoogleCalendarCard />

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 pb-1"
        className="mb-6"
      >
        {TABS.map(([key, label, icon]) => {
          const active = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              className={`flex-row items-center gap-2 rounded-full px-5 py-2.5 ${
                active ? "bg-navy" : "border border-navy/10 bg-white"
              }`}
            >
              <Feather
                name={icon}
                size={14}
                color={active ? colors.cream : colors.slate}
              />
              <Text
                className={`font-sans-semibold text-sm ${
                  active ? "text-cream" : "text-slate"
                }`}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Schedule tab ── */}
      {tab === "rules" ? (
        <View className="gap-6">
          {/* Booking policy */}
          <Card className="p-6">
            <View className="mb-4 flex-row items-center gap-2">
              <Feather name="settings" size={16} color={colors.gold} />
              <Text className="font-display text-lg text-navy">Booking Policy</Text>
            </View>

            {savedTimezone === "UTC" ? (
              <View className="mb-4 flex-row items-start gap-2.5 rounded-xl border border-gold/35 bg-gold/10 px-4 py-3">
                <Feather name="globe" size={16} color={colors.goldDeep} />
                <Text className="flex-1 font-sans text-sm leading-relaxed text-gold-deep">
                  Please confirm your timezone. We detected{" "}
                  <Text className="font-sans-bold">{DEVICE_TZ}</Text> — make sure it's right
                  and tap <Text className="font-sans-bold">Save Policy</Text>. Your
                  availability and slots use this timezone, so an incorrect value would
                  offset your session times.
                </Text>
              </View>
            ) : null}

            {/* A dropdown, as on web. This was a horizontal chip scroller: finding
                your own timezone meant swiping through nineteen long strings. */}
            <Select
              label="Timezone"
              value={settings.timezone}
              options={[...new Set([settings.timezone, ...COMMON_TZS])]}
              onChange={(tz) => setSettings((s) => ({ ...s, timezone: tz }))}
              searchable
              className="mb-4"
            />

            <View className="mb-5 flex-row gap-3">
              <NumField
                label="Booking horizon (days)"
                value={settings.booking_horizon_days}
                onChange={(v) => setSettings((s) => ({ ...s, booking_horizon_days: v }))}
                className="flex-1"
              />
              <NumField
                label="Min notice (hours)"
                value={settings.min_notice_hours}
                onChange={(v) => setSettings((s) => ({ ...s, min_notice_hours: v }))}
                className="flex-1"
              />
            </View>

            <Button variant="navy" onPress={saveSettings} fullWidth>
              Save Policy
            </Button>

            <View className="mt-3 flex-row items-center gap-1.5">
              <Feather name="globe" size={12} color={colors.slate} />
              <Text className="flex-1 font-sans text-xs text-slate">
                Slots are generated in your timezone and shown to clients in theirs.
              </Text>
            </View>
          </Card>

          {/* Coaching days & times */}
          <View>
            <Text className="font-display text-lg text-navy">Coaching Days & Times</Text>
            <Text className="mt-1 font-sans text-sm text-slate">
              Add a row for each day you coach and the hours you're available (e.g.
              Saturday 08:00–13:00). Add a second row for a split day. Change these
              anytime — then re-generate below.
            </Text>
            <Button variant="ghost" size="sm" onPress={addRule} className="mt-3 self-start">
              + Add Day
            </Button>
          </View>

          {rules.length === 0 ? (
            <Card className="items-center py-16">
              <Text className="mb-3 text-4xl">🗓️</Text>
              <Text className="text-center font-sans text-sm text-slate">
                No coaching days set yet. Add one, then{" "}
                <Text className="font-sans-bold">Generate Slots</Text> below.
              </Text>
            </Card>
          ) : (
            <View className="gap-2">
              {pagedRules.map((rule) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  saving={savingId === rule.id}
                  onChange={(patch) => patchLocalRule(rule.id, patch)}
                  onSave={() => saveRule(rule)}
                  onDelete={() => deleteRule(rule)}
                />
              ))}
              <Pager
                page={currentRulePage}
                totalPages={totalRulePages}
                onPrev={() => setRulePage((p) => Math.max(1, p - 1))}
                onNext={() => setRulePage((p) => Math.min(totalRulePages, p + 1))}
              />
            </View>
          )}

          {/* Generate bookable slots */}
          <Card className="p-6">
            <View className="mb-1 flex-row items-center gap-2">
              <Feather name="zap" size={16} color={colors.gold} />
              <Text className="font-display text-lg text-navy">
                Generate Bookable Slots
              </Text>
            </View>
            <Text className="mb-4 font-sans text-sm text-slate">
              Turn the schedule above into bookable slots across a date range. Re-run it
              anytime — existing booked, held, or blocked slots are never touched.
            </Text>

            <View className="mb-4 flex-row gap-3">
              <DateFilter
                label="From date"
                value={genRange.start}
                onChange={(v) => setGenRange((r) => ({ ...r, start: v }))}
              />
              <DateFilter
                label="To date"
                value={genRange.end}
                onChange={(v) => setGenRange((r) => ({ ...r, end: v }))}
              />
            </View>

            <Button variant="gold" onPress={generate} loading={generating} fullWidth>
              Generate Slots
            </Button>
          </Card>
        </View>
      ) : null}

      {/* ── Calendar tab ── */}
      {tab === "slots" ? (
        <CoachCalendar
          slots={slots}
          tz={settings.timezone}
          busy={calBusy}
          onBlockSlot={blockSlot}
          onUnblockSlot={unblockSlot}
          onDeleteSlot={deleteSlot}
          onAddSlot={addSlotForDay}
          onBlockDay={blockDaySlots}
          onOpenDay={openDaySlots}
          onShareSlot={setShareSlot}
        />
      ) : null}

      {/* ── Group sessions tab ── */}
      {GROUP_SESSIONS_ENABLED && tab === "group" ? (
        <View className="gap-6">
          <Card className="p-6">
            <View className="mb-4 flex-row items-center gap-2">
              <Feather name="users" size={16} color={colors.gold} />
              <Text className="font-display text-lg text-navy">
                Create a Group Session
              </Text>
            </View>

            <Input
              label="Title"
              value={gsForm.title}
              onChangeText={(v) => setGsForm((f) => ({ ...f, title: v }))}
              placeholder="e.g. Group Wellness Workshop"
            />
            <Input
              label="Description"
              value={gsForm.description}
              onChangeText={(v) => setGsForm((f) => ({ ...f, description: v }))}
              multiline
            />

            <DateTimeField
              label="Starts"
              value={gsForm.start}
              onChange={(v) => setGsForm((f) => ({ ...f, start: v }))}
              className="mb-4"
            />
            <DateTimeField
              label="Ends"
              value={gsForm.end}
              onChange={(v) => setGsForm((f) => ({ ...f, end: v }))}
              className="mb-4"
            />

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Input
                  label="Capacity"
                  value={String(gsForm.capacity)}
                  onChangeText={(v) => setGsForm((f) => ({ ...f, capacity: v }))}
                  keyboardType="numeric"
                />
              </View>
              <View className="flex-1">
                <Input
                  label="Price per seat ($)"
                  value={String(gsForm.price_per_seat)}
                  onChangeText={(v) => setGsForm((f) => ({ ...f, price_per_seat: v }))}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text className="mb-1.5 text-[10px] font-sans-semibold uppercase tracking-wider text-slate">
              Linked skill (optional)
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2 pb-1"
              className="mb-4"
            >
              <Chip
                label="— None —"
                active={!gsForm.skill}
                onPress={() => setGsForm((f) => ({ ...f, skill: "" }))}
              />
              {coachSkills.map((sk) => (
                <Chip
                  key={sk.id}
                  label={sk.name}
                  active={String(gsForm.skill) === String(sk.id)}
                  onPress={() => setGsForm((f) => ({ ...f, skill: String(sk.id) }))}
                />
              ))}
            </ScrollView>

            <Button variant="gold" onPress={createGroupSession} loading={gsSaving} fullWidth>
              Create Session
            </Button>
          </Card>

          {groupSessions.length === 0 ? (
            <Card className="items-center py-16">
              <Text className="mb-3 text-4xl">👥</Text>
              <Text className="font-sans text-sm text-slate">
                No group sessions yet. Create one above.
              </Text>
            </Card>
          ) : (
            <View className="gap-3">
              {groupSessions.map((s) => {
                const tone = GS_STATUS_TONE[s.status] || GS_STATUS_TONE.scheduled;
                return (
                  <Card key={s.id} className="p-5">
                    <View className="flex-row flex-wrap items-start justify-between gap-3">
                      <View className="min-w-0 flex-1">
                        <View className="flex-row flex-wrap items-center gap-2">
                          <Text className="font-display text-base text-navy">
                            {s.title}
                          </Text>
                          <View className={`rounded-full px-2.5 py-1 ${tone.bg}`}>
                            <Text
                              className={`text-[11px] font-sans-semibold uppercase ${tone.text}`}
                            >
                              {s.status}
                            </Text>
                          </View>
                        </View>
                        <Text className="mt-1 font-sans text-sm text-slate">
                          {fmtDateShort(s.start_datetime, settings.timezone)} ·{" "}
                          {fmtTime(s.start_datetime, settings.timezone)} –{" "}
                          {fmtTime(s.end_datetime, settings.timezone)}
                        </Text>
                        <Text className="mt-1 font-sans text-xs text-slate">
                          {s.seats_taken}/{s.capacity} seats · $
                          {parseFloat(s.price_per_seat).toFixed(2)}/seat
                        </Text>
                      </View>
                    </View>

                    <View className="mt-3 flex-row items-center gap-1.5">
                      <Button variant="ghost" size="sm" onPress={() => toggleRoster(s)}>
                        {rosterFor === s.id ? "Hide" : "Roster"}
                      </Button>
                      {s.status !== "cancelled" ? (
                        <Pressable
                          onPress={() => cancelGroupSession(s)}
                          className="rounded-full bg-red-50 p-2"
                        >
                          <Feather name="x-circle" size={15} color="#B91C1C" />
                        </Pressable>
                      ) : null}
                      {s.seats_taken === 0 ? (
                        <Pressable
                          onPress={() => deleteGroupSession(s)}
                          className="rounded-full bg-red-50 p-2"
                        >
                          <Feather name="trash-2" size={14} color="#B91C1C" />
                        </Pressable>
                      ) : null}
                    </View>

                    {/* Built-in call + group chat */}
                    {s.status !== "cancelled" ? (
                      <View className="mt-4 flex-row flex-wrap items-center gap-2">
                        {new Date(s.end_datetime).getTime() + SESSION_GRACE_MS >
                        Date.now() ? (
                          canJoinCall(s) ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onPress={() => router.push(`/group-session/${s.id}/call`)}
                            >
                              Join Call
                            </Button>
                          ) : (
                            <Text className="font-sans text-xs text-slate-light">
                              Call opens 15 min before start
                            </Text>
                          )
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          onPress={() => router.push(`/group-chat/${s.id}`)}
                        >
                          Group Chat
                        </Button>
                      </View>
                    ) : null}

                    {/* Roster */}
                    {rosterFor === s.id ? (
                      <View className="mt-4 rounded-xl border border-gold/15 bg-cream p-4">
                        {rosterData.length === 0 ? (
                          <Text className="font-sans text-sm text-slate">
                            No participants yet.
                          </Text>
                        ) : (
                          <View className="gap-1.5">
                            {rosterData.map((e) => (
                              <View
                                key={e.id}
                                className="flex-row items-center justify-between"
                              >
                                <Text className="font-sans-medium text-sm text-navy">
                                  {e.learner_username}
                                </Text>
                                <Text
                                  className={`font-sans text-xs ${
                                    e.status === "booked"
                                      ? "text-green-800"
                                      : "text-gold-deep"
                                  }`}
                                >
                                  {e.status}
                                  {e.payment_status === "paid" ? " · paid" : ""}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    ) : null}
                  </Card>
                );
              })}
            </View>
          )}
        </View>
      ) : null}

      {/* ── Sent invites tab ── */}
      {tab === "invites" ? <SentInvitesPanel tz={settings.timezone} /> : null}

      {shareSlot ? (
        <ShareSlotModal
          slot={shareSlot}
          skills={coachSkills}
          tz={settings.timezone}
          onClose={() => setShareSlot(null)}
          onSent={async () => {
            try {
              const s = await api.get("/bookings/slots/");
              setSlots(s.data);
            } catch {
              /* noop */
            }
          }}
        />
      ) : null}
    </Screen>
  );
}
