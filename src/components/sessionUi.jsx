import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import DateTimePicker from "@react-native-community/datetimepicker";

import { colors } from "@/theme/colors";

// Pieces shared by the coach's My Sessions and the client's My Learning.
//
// The web keeps a near-identical copy in each page (frontend/src/pages/
// MySessions.jsx and "MyLearning .jsx"). They had drifted slightly — only
// MyLearning's ActionBtn had a disabled/"muted" variant — so this is the union
// of both, and both screens now render from one definition.

// Human labels for every booking status (shared wording across the app).
export const STATUS_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  declined: "Declined",
  no_show: "No Show",
  held_offline: "Held off-platform",
  not_held: "Did not take place",
};

const STATUS_TONE = {
  pending: { bg: "bg-amber-100", text: "text-amber-900" },
  accepted: { bg: "bg-green-100", text: "text-green-900" },
  confirmed: { bg: "bg-green-100", text: "text-green-900" },
  completed: { bg: "bg-gold/15", text: "text-gold-deep" },
  // Held off-platform = it happened, just elsewhere → positive tone.
  held_offline: { bg: "bg-green-100", text: "text-green-900" },
  cancelled: { bg: "bg-red-100", text: "text-red-900" },
  declined: { bg: "bg-red-100", text: "text-red-900" },
  no_show: { bg: "bg-red-100", text: "text-red-900" },
  // Did not take place = neutral, not a failure.
  not_held: { bg: "bg-slate/10", text: "text-slate" },
};

export function StatusBadge({ status }) {
  const t = STATUS_TONE[status] || STATUS_TONE.pending;
  const label = STATUS_LABELS[status] || status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <View className={`rounded-full px-3 py-1 ${t.bg}`}>
      <Text className={`font-sans-semibold text-xs ${t.text}`}>{label}</Text>
    </View>
  );
}

// Why a session is a no-show (factual — same wording for coach + client views).
export function noShowReason(session) {
  const by = session.no_show_by;
  const fmtJoin = (ts) => (ts ? "joined" : "didn't join");
  const detail = `Coach ${fmtJoin(session.coach_joined_at)} · Client ${fmtJoin(session.client_joined_at)}.`;
  const lead =
    by === "both"
      ? "Neither of you joined, so the session didn't take place."
      : by === "coach"
        ? "The coach didn't join this session."
        : by === "client"
          ? "The client didn't join this session."
          : "This session wasn't attended by both parties.";
  return `${lead} ${detail} A session completes only when both people join.`;
}

export function NoShowNotice({ session }) {
  return (
    <View className="mt-3 flex-row items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
      <Feather name="x-circle" size={15} color="#B91C1C" style={{ marginTop: 2 }} />
      <Text className="flex-1 font-sans text-xs leading-5 text-slate">
        <Text className="font-sans-bold text-red-700">Marked no-show. </Text>
        {noShowReason(session)}
      </Text>
    </View>
  );
}

export function UnreadBadge({ count }) {
  if (!count) return null;
  return (
    <View className="ml-1.5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5">
      <Text className="font-sans-bold text-xs text-white">{count > 99 ? "99+" : count}</Text>
    </View>
  );
}

export function ActionBtn({
  onPress,
  icon,
  label,
  badge,
  variant = "default",
  disabled = false,
}) {
  const styles = {
    default: {
      box: "border border-gold/25 bg-gold/10",
      text: "text-gold-deep",
      icon: colors.goldDeep,
    },
    danger: { box: "border border-red-200 bg-red-50", text: "text-red-700", icon: "#B91C1C" },
    primary: { box: "bg-gold", text: "text-navy-deep", icon: colors.navyDeep },
    muted: {
      box: "border border-gold/15 bg-gold/5",
      text: "text-slate-light",
      icon: colors.slateLight,
    },
  }[disabled ? "muted" : variant];

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      className={`flex-row items-center gap-1.5 rounded-full px-4 py-2 ${styles.box}`}
    >
      <Feather name={icon} size={13} color={styles.icon} />
      <Text className={`font-sans-semibold text-xs ${styles.text}`}>{label}</Text>
      {badge}
    </Pressable>
  );
}

export function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <View className="mt-6 flex-row items-center justify-center gap-2">
      <Pressable
        onPress={() => onChange(page - 1)}
        disabled={page === 1}
        className={`rounded-xl border border-gold/25 bg-white px-4 py-2 ${page === 1 ? "opacity-30" : ""}`}
      >
        <Text className="font-sans-semibold text-sm text-slate">← Prev</Text>
      </Pressable>

      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <Pressable
          key={p}
          onPress={() => onChange(p)}
          className={`h-9 w-9 items-center justify-center rounded-xl border ${
            p === page ? "border-gold bg-gold" : "border-gold/25 bg-white"
          }`}
        >
          <Text
            className={`font-sans-bold text-sm ${p === page ? "text-navy-deep" : "text-slate"}`}
          >
            {p}
          </Text>
        </Pressable>
      ))}

      <Pressable
        onPress={() => onChange(page + 1)}
        disabled={page === totalPages}
        className={`rounded-xl border border-gold/25 bg-white px-4 py-2 ${
          page === totalPages ? "opacity-30" : ""
        }`}
      >
        <Text className="font-sans-semibold text-sm text-slate">Next →</Text>
      </Pressable>
    </View>
  );
}

// Date field backed by the native picker — replaces <input type="date">.
// Keeps the same YYYY-MM-DD string the filters compare against.
export function DateFilter({ label, value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="flex-1">
      <Text className="mb-1.5 text-xs font-sans-semibold uppercase tracking-wide text-slate">
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        className="rounded-lg border border-gold/20 bg-cream px-3 py-2"
      >
        <Text className={`font-sans text-sm ${value ? "text-navy" : "text-slate-light"}`}>
          {value || "Any"}
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
    </View>
  );
}

// Time field backed by the native picker — replaces <input type="time">.
// Keeps the same "HH:MM" 24-hour string the API and the web use.
export function TimeField({ label, value, onChange, className = "" }) {
  const [open, setOpen] = useState(false);

  const asDate = () => {
    const [h, m] = (value || "09:00").split(":").map(Number);
    const d = new Date();
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
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
        className="rounded-lg border border-navy/20 bg-cream px-3 py-2"
      >
        <Text className="font-sans text-sm text-navy">{value || "--:--"}</Text>
      </Pressable>

      {open ? (
        <DateTimePicker
          value={asDate()}
          mode="time"
          is24Hour
          onChange={(event, selected) => {
            setOpen(false);
            if (event.type === "dismissed" || !selected) return;
            const hh = String(selected.getHours()).padStart(2, "0");
            const mm = String(selected.getMinutes()).padStart(2, "0");
            onChange(`${hh}:${mm}`);
          }}
        />
      ) : null}
    </View>
  );
}

// Date + time field — replaces <input type="datetime-local">.
// Value is the same "YYYY-MM-DDTHH:MM" string the web produces.
export function DateTimeField({ label, value, onChange, className = "" }) {
  const [datePart, timePart] = (value || "").split("T");

  const setDate = (d) => onChange(`${d}T${timePart || "09:00"}`);
  const setTime = (t) => onChange(`${datePart || new Date().toISOString().slice(0, 10)}T${t}`);

  return (
    <View className={className}>
      {label ? (
        <Text className="mb-1.5 text-[10px] font-sans-semibold uppercase tracking-wider text-slate">
          {label}
        </Text>
      ) : null}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <DateFilter label="" value={datePart || ""} onChange={setDate} />
        </View>
        <TimeField value={timePart || ""} onChange={setTime} className="w-24" />
      </View>
    </View>
  );
}

// Sort-order chips — replaces the web's <select> of newest/oldest.
export function SortChips({ value, onChange }) {
  return (
    <View>
      <Text className="mb-1.5 text-xs font-sans-semibold uppercase tracking-wide text-slate">
        Sort by date
      </Text>
      <View className="flex-row gap-2">
        {[
          { key: "newest", label: "Newest first" },
          { key: "oldest", label: "Oldest first" },
        ].map((o) => (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            className={`rounded-full px-4 py-2 ${
              value === o.key ? "bg-gold" : "border border-gold/25 bg-cream"
            }`}
          >
            <Text
              className={`font-sans-medium text-sm ${
                value === o.key ? "text-navy-deep" : "text-slate"
              }`}
            >
              {o.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// Shared date/time formatting for session cards, in the viewer's timezone.
export function formatSessionDateTime(startDt, timezone) {
  return {
    date: startDt.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: timezone || undefined,
    }),
    time: startDt.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: timezone || undefined,
    }),
  };
}
