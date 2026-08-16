import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { Card, Input } from "@/components/ui";
import { toast } from "@/lib/toast";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/SentInvitesPanel.jsx.
//
// Sent-invite history + one-click resend. Embedded in the Availability screen's
// tab bar, so it renders no page chrome of its own. `tz` is the coach's display
// timezone; falls back to the auth context timezone.

const fmtWhen = (iso, tz) =>
  new Date(iso).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz || undefined,
  });

const fmtSent = (iso, tz) =>
  new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz || undefined,
  });

const STATUS_STYLES = {
  pending: { label: "Pending", bg: "bg-gold/15", text: "text-gold-deep" },
  booked: { label: "Booked", bg: "bg-green-100", text: "text-green-900" },
  filled: { label: "Slot filled", bg: "bg-slate/10", text: "text-slate" },
  expired: { label: "Expired", bg: "bg-red-100", text: "text-red-900" },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <View className={`rounded-full px-2.5 py-1 ${s.bg}`}>
      <Text className={`font-sans-semibold text-xs ${s.text}`}>{s.label}</Text>
    </View>
  );
}

export default function SentInvitesPanel({ tz }) {
  const { timezone } = useAuth();
  const displayTz = tz || timezone;

  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState(null);
  const [filter, setFilter] = useState("all"); // all | pending | booked | filled | expired
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/bookings/invites/");
      setInvites(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch {
      toast.error("Could not load your sent invites.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Counts per status drive the filter tab badges.
  const counts = useMemo(() => {
    const c = { all: invites.length, pending: 0, booked: 0, filled: 0, expired: 0 };
    for (const i of invites) c[i.status] = (c[i.status] || 0) + 1;
    return c;
  }, [invites]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invites.filter(
      (i) =>
        (filter === "all" || i.status === filter) &&
        (!q ||
          i.email.toLowerCase().includes(q) ||
          (i.skill_title || "").toLowerCase().includes(q))
    );
  }, [invites, filter, query]);

  const resend = async (invite) => {
    setResendingId(invite.id);
    try {
      const res = await api.post(`/bookings/invites/${invite.id}/resend/`);
      toast.success(res.data?.detail || "Invite resent.");
      // Patch the row in place with the refreshed counters/timestamp.
      if (res.data?.invite) {
        setInvites((prev) => prev.map((i) => (i.id === invite.id ? res.data.invite : i)));
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not resend the invite.");
    } finally {
      setResendingId(null);
    }
  };

  if (loading) {
    return (
      <View className="items-center py-20">
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  if (invites.length === 0) {
    return (
      <Card className="items-center p-12">
        <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-gold/15">
          <Feather name="mail" size={24} color={colors.goldDeep} />
        </View>
        <Text className="mb-1 font-sans-semibold text-lg text-navy">
          No invites sent yet
        </Text>
        <Text className="text-center font-sans text-sm text-slate">
          Open the <Text className="font-sans-semibold">Calendar</Text> tab and share a
          slot to invite people to book.
        </Text>
      </Card>
    );
  }

  const FILTERS = [
    ["all", "All"],
    ["pending", "Pending"],
    ["booked", "Booked"],
    ["filled", "Slot filled"],
    ["expired", "Expired"],
  ].filter(([key]) => key === "all" || counts[key] > 0);

  return (
    <View>
      {/* Filters + search */}
      <View className="mb-3 flex-row flex-wrap gap-2">
        {FILTERS.map(([key, label]) => {
          const active = filter === key;
          return (
            <Pressable
              key={key}
              onPress={() => setFilter(key)}
              className={`rounded-full px-4 py-1.5 ${
                active ? "bg-navy" : "border border-navy/10 bg-white"
              }`}
            >
              <Text
                className={`font-sans-semibold text-xs ${
                  active ? "text-cream" : "text-slate"
                }`}
              >
                {label} {counts[key] || 0}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Input
        placeholder="Search recipient or session…"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
      />

      <View className="gap-3">
        {visible.length === 0 ? (
          <Card className="py-10">
            <Text className="text-center font-sans text-sm text-slate">
              No invites match this filter.
            </Text>
          </Card>
        ) : null}

        {visible.map((inv) => (
          <Card key={inv.id}>
            {/* Recipient */}
            <View className="flex-row items-center gap-2">
              <Feather name="mail" size={13} color={colors.gold} />
              <Text
                className="flex-1 font-sans-medium text-sm text-navy"
                numberOfLines={1}
              >
                {inv.email}
              </Text>
            </View>

            {inv.note ? (
              <Text className="mt-1 font-sans text-xs text-slate-light" numberOfLines={1}>
                “{inv.note}”
              </Text>
            ) : null}

            {inv.attached_documents?.length > 0 ? (
              <View className="mt-1 flex-row items-center gap-1">
                <Feather name="paperclip" size={11} color={colors.goldDeep} />
                <Text className="font-sans text-xs text-gold-deep">
                  {inv.attached_documents.length} document
                  {inv.attached_documents.length !== 1 ? "s" : ""}
                </Text>
              </View>
            ) : null}

            {/* Session */}
            <View className="mt-3">
              <Text className="font-sans-medium text-sm text-navy">
                {inv.skill_title || "—"}
              </Text>
              <Text className="mt-0.5 font-sans text-xs text-slate">
                {fmtWhen(inv.slot_start, displayTz)}
              </Text>
            </View>

            {/* Sent */}
            <Text className="mt-2 font-sans text-xs text-slate">
              Sent {fmtSent(inv.last_sent_at, displayTz)}
              {inv.sent_count > 1 ? (
                <Text className="text-gold-deep"> · {inv.sent_count}×</Text>
              ) : null}
            </Text>

            {/* Status + resend */}
            <View className="mt-3 flex-row items-center gap-3">
              <StatusBadge status={inv.status} />
              <View className="flex-1" />
              {inv.can_resend ? (
                <Pressable
                  onPress={() => resend(inv)}
                  disabled={resendingId === inv.id}
                  className={`flex-row items-center gap-1.5 rounded-full border border-gold/30 bg-gold/15 px-3 py-1.5 ${
                    resendingId === inv.id ? "opacity-60" : ""
                  }`}
                >
                  <Feather name="send" size={12} color={colors.goldDeep} />
                  <Text className="font-sans-semibold text-xs text-gold-deep">Resend</Text>
                </Pressable>
              ) : null}
            </View>
          </Card>
        ))}
      </View>
    </View>
  );
}
