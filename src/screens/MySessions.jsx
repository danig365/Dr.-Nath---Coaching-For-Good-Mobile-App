import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, Modal, Linking } from "react-native";
import { useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { Screen, Card, Button, Input } from "@/components/ui";
import SessionFeedbackCard from "@/components/SessionFeedbackCard";
import AddToCalendar from "@/components/AddToCalendar";
import SessionReflectionModal from "@/components/SessionReflectionModal";
import SessionSummaryModal from "@/components/SessionSummaryModal";
import {
  ActionBtn,
  DateFilter,
  NoShowNotice,
  Pagination,
  SortChips,
  StatusBadge,
  UnreadBadge,
  formatSessionDateTime,
} from "@/components/sessionUi";
import { toast } from "@/lib/toast";
import { downloadFile } from "@/lib/download";
import { pickFile, appendFile } from "@/lib/filePicker";
import {
  SESSION_REJOIN_MS,
  isSessionLive,
  isUpcomingSession,
  ordinal,
  sessionStartDate,
} from "@/lib/sessionTiming";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/MySessions.jsx — the coach's session list.
//
// Status badges, action buttons, pagination and the date filter live in
// @/components/sessionUi, shared with the client's My Learning screen.

// ─── Coach: correct a finished session's outcome ─────────────────────────────
const OUTCOME_OPTIONS = [
  { value: "completed", label: "Took place — on the platform" },
  { value: "held_offline", label: "Took place — off the platform (e.g. WhatsApp)" },
  { value: "no_show", label: "No show — someone didn't join" },
  { value: "not_held", label: "Did not take place at all" },
];

function OutcomeMenu({ current, onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ActionBtn icon="edit-2" label="Correct outcome" onPress={() => setOpen(true)} />
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-end bg-navy-deep/50" onPress={() => setOpen(false)}>
          <Pressable className="rounded-t-3xl bg-white pb-8 pt-2">
            <View className="mb-2 self-center h-1 w-10 rounded-full bg-cream-warm" />
            <Text className="px-5 py-3 font-display text-xl text-navy">Session outcome</Text>
            {OUTCOME_OPTIONS.map((o) => (
              <Pressable
                key={o.value}
                onPress={() => {
                  setOpen(false);
                  if (o.value !== current) onPick(o.value);
                }}
                className="flex-row items-center justify-between gap-2 border-b border-gold/10 px-5 py-4"
              >
                <Text className="flex-1 font-sans text-sm text-navy">{o.label}</Text>
                {o.value === current ? (
                  <Feather name="check" size={14} color="#2E7D32" />
                ) : null}
              </Pressable>
            ))}
            <Pressable onPress={() => setOpen(false)} className="px-5 py-4">
              <Text className="font-sans-semibold text-base text-slate">Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────
function SessionCard({
  session,
  activeTab,
  onCancel,
  onChangeProgram,
  onNudge,
  onSetMeetingLink,
  onUploadNotes,
  onReflect,
  onSummary,
  onSetOutcome,
  router,
}) {
  const { timezone } = useAuth(); // viewer's display timezone (coach's set zone)

  const startDt = sessionStartDate(session);
  const { date, time } = formatSessionDateTime(startDt, timezone);

  const accent =
    session.status === "accepted" || session.status === "confirmed"
      ? "#34A853"
      : session.status === "pending"
        ? "#F59E0B"
        : colors.gold;

  const sessionEndMs = session.slot_end
    ? new Date(session.slot_end).getTime()
    : startDt.getTime() + session.duration * 60 * 1000;
  // Joinable through the whole rejoin window so it can be reconnected (N3).
  const expired = sessionEndMs + SESSION_REJOIN_MS < Date.now();
  // "Remind to join" makes sense only near/after the start (until it expires).
  const canNudge = Date.now() >= startDt.getTime() - 30 * 60 * 1000 && !expired;

  const name = session.learner_name || session.learner_username;

  return (
    <Card className="overflow-hidden p-0">
      <View className="flex-row">
        <View className="w-1.5" style={{ backgroundColor: accent }} />

        <View className="flex-1 px-5 py-4">
          {/* Row 1: avatar · client + skill · tags · status */}
          <View className="flex-row flex-wrap items-center gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-gold">
              <Text className="font-sans-bold text-sm text-navy-deep">
                {name?.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-sans-semibold text-xs text-gold-deep">{name}</Text>
              <Text className="font-display text-base text-navy" numberOfLines={1}>
                {session.skill_title}
              </Text>
            </View>
            <StatusBadge status={session.status} />
          </View>

          <View className="mt-2 flex-row flex-wrap items-center gap-1.5">
            {session.duration ? (
              <View className="rounded-full border border-gold/20 bg-gold/10 px-2.5 py-1">
                <Text className="font-sans-semibold text-xs text-gold-deep">
                  {session.duration} min
                </Text>
              </View>
            ) : null}
            {session.price ? (
              <View className="flex-row items-center gap-1 rounded-full border border-gold/20 bg-cream-warm px-2.5 py-1">
                <Feather name="dollar-sign" size={10} color={colors.goldDeep} />
                <Text className="font-sans-semibold text-xs text-gold-deep">
                  {session.price}
                </Text>
              </View>
            ) : null}
            {/* Which session this is for this client on this programme. */}
            {session.session_number ? (
              <View className="rounded-full border border-gold/15 bg-cream-warm px-2.5 py-1">
                <Text className="font-sans-semibold text-xs text-slate">
                  {ordinal(session.session_number)} session
                </Text>
              </View>
            ) : null}
          </View>

          <View className="my-3 h-px bg-gold/10" />

          {/* Row 2: date · time */}
          <View className="flex-row flex-wrap items-center gap-5">
            <View className="flex-row items-center gap-1.5">
              <Feather name="calendar" size={13} color={colors.gold} />
              <Text className="font-sans text-sm text-slate">{date}</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Feather name="clock" size={13} color={colors.gold} />
              <Text className="font-sans text-sm text-slate">{time}</Text>
            </View>
          </View>

          {/* Actions */}
          <View className="mt-3 flex-row flex-wrap items-center gap-2">
            {activeTab === "upcoming" ? (
              <>
                {session.status === "accepted" ? (
                  <ActionBtn
                    onPress={() => !expired && router.push(`/session/${session.id}`)}
                    icon="video"
                    label={expired ? "Expired" : "Join"}
                    variant={expired ? "default" : "primary"}
                  />
                ) : (
                  <ActionBtn onPress={() => {}} icon="video" label="Pending" />
                )}
                {!expired ? (
                  <ActionBtn
                    onPress={() => onCancel(session)}
                    icon="x"
                    label="Cancel"
                    variant="danger"
                  />
                ) : null}
                {!expired ? (
                  <ActionBtn
                    onPress={() => onChangeProgram(session)}
                    icon="repeat"
                    label="Change Program"
                  />
                ) : null}
                {session.status === "accepted" && canNudge ? (
                  <ActionBtn
                    onPress={() => onNudge(session)}
                    icon="bell"
                    label="Remind to join"
                  />
                ) : null}
                {session.status === "accepted" ? (
                  <>
                    <ActionBtn
                      onPress={() => router.push(`/chat/${session.id}`)}
                      icon="message-square"
                      label="Chat"
                      badge={<UnreadBadge count={session.unread_messages} />}
                    />
                    <ActionBtn
                      onPress={() => onSetMeetingLink(session)}
                      icon="link"
                      label={session.meeting_link ? "Update Link" : "Add Link"}
                    />
                    <AddToCalendar session={session} />
                  </>
                ) : null}
                {session.payment_status === "paid" && Number(session.amount_paid) > 0 ? (
                  <ActionBtn
                    onPress={() =>
                      downloadFile(`/bookings/${session.id}/invoice/`, "receipt.pdf")
                    }
                    icon="file-text"
                    label="Receipt"
                  />
                ) : null}
              </>
            ) : null}

            {activeTab === "past" ? (
              <>
                <ActionBtn
                  onPress={() => onUploadNotes(session.id, !!session.notes_file)}
                  icon={session.notes_file ? "check" : "upload"}
                  label={session.notes_file ? "Notes ✓" : "Upload Notes"}
                />
                <ActionBtn
                  onPress={() => router.push(`/chat/${session.id}`)}
                  icon="message-square"
                  label="Chat"
                  badge={<UnreadBadge count={session.unread_messages} />}
                />
                {session.has_reflection ? (
                  <ActionBtn
                    onPress={() => onReflect(session)}
                    icon="file-text"
                    label="Client Notes"
                  />
                ) : null}
                {session.has_summary ? (
                  <ActionBtn
                    onPress={() => onSummary(session)}
                    icon="file-text"
                    label="AI Summary"
                  />
                ) : null}
                {session.payment_status === "paid" && Number(session.amount_paid) > 0 ? (
                  <ActionBtn
                    onPress={() =>
                      downloadFile(`/bookings/${session.id}/invoice/`, "receipt.pdf")
                    }
                    icon="file-text"
                    label="Receipt"
                  />
                ) : null}
              </>
            ) : null}

            {/* Coach can correct any concluded session's outcome. */}
            {["completed", "held_offline", "no_show", "not_held"].includes(session.status) ? (
              <OutcomeMenu
                current={session.status}
                onPick={(o) => onSetOutcome(session, o)}
              />
            ) : null}
          </View>

          {session.status === "no_show" ? <NoShowNotice session={session} /> : null}

          {/* Feedback (past only) */}
          {activeTab === "past" ? (
            <View className="mt-3 border-t border-gold/10 pt-3">
              {session.feedback ? (
                <SessionFeedbackCard
                  title="Student review"
                  subtitle={session.feedback.student_name}
                  badgeLabel="Published"
                  rating={session.feedback.rating}
                  comment={session.feedback.comment}
                  date={new Date(session.feedback.created_at).toLocaleDateString()}
                  tone="gold"
                />
              ) : (
                <Text className="text-center font-sans text-xs text-slate-light">
                  No feedback yet.
                </Text>
              )}
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

// ─── Group Session Card (coach-facing) ────────────────────────────────────────
function GroupCard({ s, onJoin, onChat, onRoster }) {
  const { timezone } = useAuth();
  const date = new Date(s.start_datetime).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: timezone || undefined,
  });
  const time = new Date(s.start_datetime).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone || undefined,
  });

  const cancelled = s.status === "cancelled";
  const upcoming = new Date(s.end_datetime).getTime() + SESSION_REJOIN_MS > Date.now();
  // Joinable from 15 min before start until the scheduled end.
  const canJoin =
    !cancelled &&
    upcoming &&
    Date.now() >= new Date(s.start_datetime).getTime() - 15 * 60 * 1000;

  const badge = cancelled ? "cancelled" : upcoming ? "scheduled" : "completed";
  const badgeTone = {
    scheduled: { bg: "bg-green-100", text: "text-green-900" },
    completed: { bg: "bg-gold/15", text: "text-gold-deep" },
    cancelled: { bg: "bg-red-100", text: "text-red-900" },
  }[badge];

  return (
    <Card className="overflow-hidden p-0">
      <View className="flex-row">
        <View className="w-1.5 bg-gold" />
        <View className="flex-1 px-5 py-4">
          <View className="flex-row items-center gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-gold">
              <Feather name="users" size={15} color={colors.navyDeep} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-sans-semibold text-xs text-gold-deep">
                {s.seats_taken}/{s.capacity} seats · ${s.price_per_seat}/seat
              </Text>
              <Text className="font-display text-base text-navy" numberOfLines={1}>
                {s.title}
              </Text>
            </View>
          </View>

          <View className="mt-2 flex-row items-center gap-1.5">
            <View className="rounded-full border border-gold/20 bg-cream-warm px-2.5 py-1">
              <Text className="font-sans-semibold text-xs text-gold-deep">Group</Text>
            </View>
            <View className={`rounded-full px-2.5 py-1 ${badgeTone.bg}`}>
              <Text className={`font-sans-semibold text-xs ${badgeTone.text}`}>
                {badge.charAt(0).toUpperCase() + badge.slice(1)}
              </Text>
            </View>
          </View>

          <View className="my-3 h-px bg-gold/10" />

          <View className="flex-row items-center gap-4">
            <View className="flex-row items-center gap-1.5">
              <Feather name="calendar" size={13} color={colors.gold} />
              <Text className="font-sans text-sm text-slate">{date}</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Feather name="clock" size={13} color={colors.gold} />
              <Text className="font-sans text-sm text-slate">{time}</Text>
            </View>
          </View>

          <View className="mt-3 flex-row flex-wrap items-center gap-2">
            {!cancelled && upcoming ? (
              canJoin ? (
                <ActionBtn
                  onPress={() => onJoin(s.id)}
                  icon="video"
                  label="Join Call"
                  variant="primary"
                />
              ) : (
                <ActionBtn onPress={() => {}} icon="video" label="Opens 15 min before" />
              )
            ) : null}
            {!cancelled ? (
              <ActionBtn
                onPress={() => onChat(s.id)}
                icon="message-square"
                label="Group Chat"
              />
            ) : null}
            <ActionBtn onPress={() => onRoster(s.id)} icon="users" label="Roster" />
          </View>
        </View>
      </View>
    </Card>
  );
}

const PAGE_SIZE = 4;

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MySessions() {
  const router = useRouter();
  const { isAuthenticated, isCoach, isAdmin } = useAuth();

  const [sessions, setSessions] = useState([]);
  const [groupSessions, setGroupSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("upcoming");
  const [page, setPage] = useState(1);

  // Group roster modal
  const [rosterSession, setRosterSession] = useState(null);
  const [roster, setRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [learnerFilter, setLearnerFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const fetchSessions = useCallback(async () => {
    // This is the coach screen. Send anyone else to their own area instead of
    // logging them out (avoids a login → bounce → logout loop).
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (isAdmin()) {
      // Admin tooling is web-only on mobile; drop them into the client view.
      router.replace("/(client)/dashboard");
      return;
    }
    if (!isCoach()) {
      router.replace("/(client)/learning");
      return;
    }

    setLoading(true);
    try {
      const [res, gres] = await Promise.all([
        api.get("/bookings/"),
        api.get("/bookings/group-sessions/"),
      ]);
      setSessions(res.data);
      setGroupSessions(gres.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to load sessions.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isCoach, isAdmin, router]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Coach's own offerings, for the "Change Program" picker.
  const [mySkills, setMySkills] = useState([]);
  useEffect(() => {
    api
      .get("/skills/")
      .then((res) => setMySkills(res.data || []))
      .catch(() => {});
  }, []);

  const openRoster = async (id) => {
    setRosterSession(groupSessions.find((g) => g.id === id) || { id });
    setRoster([]);
    setRosterLoading(true);
    try {
      const res = await api.get(`/bookings/group-sessions/${id}/roster/`);
      setRoster(res.data);
    } catch {
      toast.error("Failed to load roster.");
    } finally {
      setRosterLoading(false);
    }
  };

  // A session is joinable from its start until its rejoin window closes. Classify
  // by that window (not just the start) so a session that has already begun stays
  // in "Upcoming" — with a working Join button — instead of dropping into Past.
  const isLive = (s) => isSessionLive(s);
  const upcomingSessions = sessions.filter(isUpcomingSession);
  // "Completed" holds delivered sessions — on-platform AND those the coach marked
  // as held off-platform (they did take place).
  const pastSessions = sessions.filter(
    (s) =>
      s.status === "completed" ||
      s.status === "held_offline" ||
      ((s.status === "pending" || s.status === "accepted") && !isLive(s))
  );
  // "No Show" holds sessions that didn't take place.
  const noShowSessions = sessions.filter(
    (s) => s.status === "no_show" || s.status === "not_held"
  );

  const [changeTarget, setChangeTarget] = useState(null);
  const [changeSkillId, setChangeSkillId] = useState("");
  const [changingProgram, setChangingProgram] = useState(false);
  const openChangeProgram = (s) => {
    setChangeTarget(s);
    setChangeSkillId(String(s.skill || ""));
  };

  const handleNudge = async (session) => {
    try {
      const res = await api.post(`/bookings/${session.id}/nudge/`);
      toast.success(res.data?.detail || "Reminder sent to the client.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not send the reminder.");
    }
  };

  const handleChangeProgram = async () => {
    if (!changeTarget || !changeSkillId) return;
    if (Number(changeSkillId) === changeTarget.skill) {
      setChangeTarget(null);
      return;
    }
    setChangingProgram(true);
    try {
      await api.patch(`/bookings/${changeTarget.id}/change-program/`, {
        skill_id: Number(changeSkillId),
      });
      await fetchSessions();
      toast.success("Program updated for this booking.");
      setChangeTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not change the program.");
    } finally {
      setChangingProgram(false);
    }
  };

  const [reflectSession, setReflectSession] = useState(null);
  const [summarySession, setSummarySession] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await api.patch(`/bookings/${cancelTarget.id}/coach-cancel/`);
      await fetchSessions();
      toast.success("Session cancelled. The client has been refunded.");
    } catch {
      toast.error("Failed to cancel session.");
    } finally {
      setCancelTarget(null);
    }
  };

  const [meetingTarget, setMeetingTarget] = useState(null);
  const [meetingLink, setMeetingLink] = useState("");

  const handleSaveMeetingLink = async () => {
    try {
      await api.patch(`/bookings/${meetingTarget.id}/`, { meeting_link: meetingLink });
      await fetchSessions();
      toast.success("Meeting link saved.");
    } catch {
      toast.error("Failed to save meeting link.");
    } finally {
      setMeetingTarget(null);
      setMeetingLink("");
    }
  };

  const handleUploadNotes = async (id, hasNotes) => {
    if (hasNotes) {
      // Authenticated endpoint — /media/session_notes/ is no longer public.
      downloadFile(`/ops/media/session-notes/${id}/`, "session-notes.pdf");
      return;
    }
    const file = await pickFile({
      type: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
      ],
    });
    if (!file) return;

    const fd = new FormData();
    appendFile(fd, "notes_file", file);
    try {
      await api.patch(`/bookings/upload-notes/${id}/`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Notes uploaded.");
      await fetchSessions();
    } catch {
      toast.error("Failed to upload notes.");
    }
  };

  // Coach corrects a concluded session's outcome. Updates the list in place.
  const handleSetOutcome = async (session, outcome) => {
    try {
      const res = await api.patch(`/bookings/${session.id}/set-outcome/`, { outcome });
      setSessions((prev) =>
        prev.map((s) => (s.id === session.id ? { ...s, ...res.data } : s))
      );
      toast.success("Session outcome updated.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Couldn't update the outcome.");
    }
  };

  const totalEarnings = sessions
    .filter((s) => s.status === "completed")
    .reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);

  const applyFilters = (list) => {
    let out = [...list];
    if (search.trim())
      out = out.filter((s) =>
        s.skill_title?.toLowerCase().includes(search.trim().toLowerCase())
      );
    if (learnerFilter.trim())
      out = out.filter((s) =>
        `${s.learner_name || ""} ${s.learner_username || ""}`
          .toLowerCase()
          .includes(learnerFilter.trim().toLowerCase())
      );
    if (dateFrom) out = out.filter((s) => s.session_date >= dateFrom);
    if (dateTo) out = out.filter((s) => s.session_date <= dateTo);
    out.sort((a, b) => {
      const dtA = new Date(a.slot_start || `${a.session_date}T${a.session_time}Z`);
      const dtB = new Date(b.slot_start || `${b.session_date}T${b.session_time}Z`);
      return sortOrder === "newest" ? dtB - dtA : dtA - dtB;
    });
    return out;
  };

  const hasActiveFilters =
    search || learnerFilter || dateFrom || dateTo || sortOrder !== "newest";

  const resetFilters = () => {
    setSearch("");
    setLearnerFilter("");
    setDateFrom("");
    setDateTo("");
    setSortOrder("newest");
    setPage(1);
  };

  const filteredSessions = applyFilters(
    activeTab === "upcoming"
      ? upcomingSessions
      : activeTab === "no_show"
        ? noShowSessions
        : pastSessions
  );
  const totalPages = Math.ceil(filteredSessions.length / PAGE_SIZE);
  const pagedSessions = filteredSessions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) return <Screen loading />;

  const TABS = [
    { key: "upcoming", label: "Upcoming", count: upcomingSessions.length, icon: "calendar" },
    { key: "past", label: "Completed", count: pastSessions.length, icon: "check" },
    { key: "no_show", label: "No Show", count: noShowSessions.length, icon: "x-circle" },
    { key: "group", label: "Group Sessions", count: groupSessions.length, icon: "users" },
  ];

  return (
    <Screen onRefresh={fetchSessions} refreshing={false}>
      {/* ── Header ──────────────────────────────────────── */}
      <Text className="font-display text-3xl text-navy">My Sessions</Text>

      <View className="mt-4 flex-row items-center gap-3 rounded-2xl border border-gold/25 bg-cream-warm px-5 py-4">
        <Feather name="dollar-sign" size={18} color={colors.gold} />
        <View>
          <Text className="text-xs font-sans-semibold uppercase tracking-wider text-slate">
            Total Earnings
          </Text>
          <Text className="font-display text-2xl text-navy">
            ${totalEarnings.toFixed(0)}
          </Text>
        </View>
      </View>

      {/* ── Tabs ────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 pb-1"
        className="my-6"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                setActiveTab(tab.key);
                setPage(1);
              }}
              className={`flex-row items-center gap-2 rounded-full px-5 py-2.5 ${
                active ? "bg-gold" : "border border-gold/25 bg-white"
              }`}
            >
              <Feather
                name={tab.icon}
                size={14}
                color={active ? colors.navyDeep : colors.slate}
              />
              <Text
                className={`font-sans-semibold text-sm ${
                  active ? "text-navy-deep" : "text-slate"
                }`}
              >
                {tab.label}
              </Text>
              <Text
                className={`text-xs ${active ? "text-navy-deep/70" : "text-slate-light"}`}
              >
                ({tab.count})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Filters ─────────────────────────────────────── */}
      {activeTab !== "group" ? (
        <View className="mb-5">
          <View className="mb-2 flex-row gap-2">
            <View className="flex-1">
              <Input
                placeholder="Search by skill name…"
                value={search}
                onChangeText={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
                className="mb-0"
              />
            </View>
            <Pressable
              onPress={() => setFiltersOpen((o) => !o)}
              className={`h-[46px] flex-row items-center gap-2 rounded-2xl border px-4 ${
                filtersOpen || hasActiveFilters
                  ? "border-gold bg-gold/15"
                  : "border-cream-warm bg-white"
              }`}
            >
              <Feather name="filter" size={13} color={colors.slate} />
              <Text className="font-sans-semibold text-sm text-slate">Filters</Text>
              {hasActiveFilters ? <View className="h-2 w-2 rounded-full bg-gold" /> : null}
              <Feather
                name={filtersOpen ? "chevron-up" : "chevron-down"}
                size={13}
                color={colors.slate}
              />
            </Pressable>
          </View>

          {hasActiveFilters ? (
            <Pressable
              onPress={resetFilters}
              className="mb-2 self-start rounded-xl border border-red-200 bg-red-50 px-3 py-2"
            >
              <Text className="font-sans-semibold text-xs text-red-700">Clear</Text>
            </Pressable>
          ) : null}

          {filtersOpen ? (
            <View className="mt-1 gap-3 rounded-xl border border-gold/20 bg-white p-4">
              <Input
                label="Client name"
                placeholder="e.g. john"
                value={learnerFilter}
                onChangeText={(v) => {
                  setLearnerFilter(v);
                  setPage(1);
                }}
                className="mb-0"
              />

              <View className="flex-row gap-3">
                <DateFilter
                  label="From date"
                  value={dateFrom}
                  onChange={(v) => {
                    setDateFrom(v);
                    setPage(1);
                  }}
                />
                <DateFilter
                  label="To date"
                  value={dateTo}
                  onChange={(v) => {
                    setDateTo(v);
                    setPage(1);
                  }}
                />
              </View>

              <SortChips
                value={sortOrder}
                onChange={(v) => {
                  setSortOrder(v);
                  setPage(1);
                }}
              />
            </View>
          ) : null}

          {hasActiveFilters ? (
            <Text className="mt-2 font-sans text-xs text-slate">
              Showing{" "}
              <Text className="font-sans-bold">{filteredSessions.length}</Text> result
              {filteredSessions.length !== 1 ? "s" : ""}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* ── Group Sessions List ──────────────────────────── */}
      {activeTab === "group" ? (
        groupSessions.length === 0 ? (
          <Card className="items-center py-20">
            <Text className="mb-4 text-5xl">👥</Text>
            <Text className="mb-2 font-display text-xl text-navy">
              No group sessions yet
            </Text>
            <Text className="text-center font-sans text-sm text-slate">
              Create a group session from the Availability page.
            </Text>
          </Card>
        ) : (
          <View className="gap-4">
            {groupSessions.map((s) => (
              <GroupCard
                key={s.id}
                s={s}
                onJoin={(id) => router.push(`/group-session/${id}/call`)}
                onChat={(id) => router.push(`/group-chat/${id}`)}
                onRoster={openRoster}
              />
            ))}
          </View>
        )
      ) : (
        <>
          {filteredSessions.length === 0 ? (
            <Card className="items-center py-20">
              <Text className="mb-4 text-5xl">
                {activeTab === "upcoming" ? "📅" : "✅"}
              </Text>
              <Text className="mb-2 font-display text-xl text-navy">
                No {activeTab === "upcoming" ? "upcoming" : "completed"} sessions
              </Text>
              <Text className="text-center font-sans text-sm text-slate">
                {activeTab === "upcoming"
                  ? "You don't have any upcoming sessions yet."
                  : "Your completed sessions will appear here."}
              </Text>
            </Card>
          ) : (
            <View className="gap-4">
              {pagedSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  activeTab={activeTab}
                  onCancel={setCancelTarget}
                  onChangeProgram={openChangeProgram}
                  onNudge={handleNudge}
                  onSetMeetingLink={(s) => {
                    setMeetingTarget(s);
                    setMeetingLink(s.meeting_link || "");
                  }}
                  onUploadNotes={handleUploadNotes}
                  onReflect={setReflectSession}
                  onSummary={setSummarySession}
                  onSetOutcome={handleSetOutcome}
                  router={router}
                />
              ))}
            </View>
          )}
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {/* ── Cancel Confirmation Modal ────────────────────── */}
      <Modal
        visible={!!cancelTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelTarget(null)}
      >
        <View className="flex-1 items-center justify-center bg-navy-deep/60 p-4">
          <View className="w-full max-w-sm items-center rounded-2xl border border-gold/20 bg-cream p-8">
            <Text className="mb-4 text-4xl">⚠️</Text>
            <Text className="mb-2 font-display text-xl text-navy">Cancel Session</Text>
            <Text className="mb-6 text-center font-sans text-sm text-slate">
              Cancel your session with{" "}
              <Text className="font-sans-bold">
                {cancelTarget?.learner_name || cancelTarget?.learner_username}
              </Text>
              ? The time slot reopens and the client is refunded.
            </Text>
            <View className="w-full flex-row gap-3">
              <Button variant="outline" onPress={() => setCancelTarget(null)} className="flex-1">
                Keep It
              </Button>
              <Button variant="navy" onPress={handleCancel} className="flex-1">
                Cancel Session
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Meeting Link Modal ───────────────────────────── */}
      <Modal
        visible={!!meetingTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setMeetingTarget(null)}
      >
        <View className="flex-1 items-center justify-center bg-navy-deep/60 p-4">
          <View className="w-full max-w-md rounded-2xl border border-gold/20 bg-cream p-8">
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-gold/15">
              <Feather name="link" size={20} color={colors.gold} />
            </View>
            <Text className="mb-2 font-display text-xl text-navy">Meeting Link</Text>
            <Text className="mb-5 font-sans text-sm text-slate">
              Add a Zoom, Google Meet, or Jitsi link for this session.
            </Text>
            <Input
              placeholder="https://meet.jit.si/your-room"
              value={meetingLink}
              onChangeText={setMeetingLink}
              autoCapitalize="none"
              keyboardType="url"
            />
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                onPress={() => setMeetingTarget(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button variant="gold" onPress={handleSaveMeetingLink} className="flex-1">
                Save Link
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Change Program Modal ─────────────────────────── */}
      <Modal
        visible={!!changeTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setChangeTarget(null)}
      >
        <View className="flex-1 items-center justify-center bg-navy-deep/60 p-4">
          <View className="max-h-[85%] w-full max-w-md rounded-2xl border border-gold/20 bg-cream p-8">
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-gold/15">
              <Feather name="repeat" size={20} color={colors.gold} />
            </View>
            <Text className="mb-2 font-display text-xl text-navy">Change Program</Text>
            <Text className="mb-1 font-sans text-sm text-slate">
              Reassign this booking with{" "}
              <Text className="font-sans-semibold">
                {changeTarget?.learner_name || changeTarget?.learner_username}
              </Text>{" "}
              to a different offering.
            </Text>
            <Text className="mb-5 font-sans text-xs text-slate-light">
              The date and time stay the same. No new email is sent — upcoming reminders
              update automatically.
            </Text>

            <ScrollView className="mb-5 max-h-56">
              <View className="gap-2">
                {mySkills.map((sk) => {
                  const selected = String(changeSkillId) === String(sk.id);
                  return (
                    <Pressable
                      key={sk.id}
                      onPress={() => setChangeSkillId(String(sk.id))}
                      className={`rounded-xl border px-4 py-3 ${
                        selected ? "border-gold bg-gold/10" : "border-gold/25 bg-white"
                      }`}
                    >
                      <Text className="font-sans-medium text-sm text-navy">
                        {sk.name}
                        {sk.price ? ` — $${sk.price}` : ""}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View className="flex-row gap-3">
              <Button variant="outline" onPress={() => setChangeTarget(null)} className="flex-1">
                Cancel
              </Button>
              <Button
                variant="gold"
                onPress={handleChangeProgram}
                loading={changingProgram}
                disabled={Number(changeSkillId) === changeTarget?.skill}
                className="flex-1"
              >
                Update Program
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Roster Modal ─────────────────────────────────── */}
      <Modal
        visible={!!rosterSession}
        transparent
        animationType="fade"
        onRequestClose={() => setRosterSession(null)}
      >
        <View className="flex-1 items-center justify-center bg-navy-deep/60 p-4">
          <View className="w-full max-w-md rounded-2xl border border-gold/20 bg-cream p-6">
            <View className="mb-4 flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-gold/15">
                <Feather name="users" size={18} color={colors.gold} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-display text-lg text-navy" numberOfLines={1}>
                  {rosterSession?.title || "Roster"}
                </Text>
                <Text className="font-sans text-xs text-slate">
                  {roster.length} participant{roster.length !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>

            {rosterLoading ? (
              <Text className="py-8 text-center font-sans text-sm text-slate-light">
                Loading…
              </Text>
            ) : roster.length === 0 ? (
              <Text className="py-8 text-center font-sans text-sm text-slate-light">
                No participants yet.
              </Text>
            ) : (
              <ScrollView className="max-h-72">
                <View className="gap-2">
                  {roster.map((r) => (
                    <View
                      key={r.id}
                      className="flex-row items-center gap-3 rounded-xl border border-gold/15 bg-white px-3 py-2.5"
                    >
                      <View className="h-8 w-8 items-center justify-center rounded-full bg-gold">
                        <Text className="font-sans-bold text-xs text-navy-deep">
                          {r.learner_username?.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text
                        className="flex-1 font-sans-medium text-sm text-navy"
                        numberOfLines={1}
                      >
                        {r.learner_username}
                      </Text>
                      <View
                        className={`rounded-full px-2.5 py-1 ${
                          r.status === "booked" ? "bg-green-100" : "bg-amber-100"
                        }`}
                      >
                        <Text
                          className={`font-sans-semibold text-xs ${
                            r.status === "booked" ? "text-green-900" : "text-amber-900"
                          }`}
                        >
                          {r.status === "booked" ? "Booked" : "Held"}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}

            <Button
              variant="outline"
              onPress={() => setRosterSession(null)}
              className="mt-5"
              fullWidth
            >
              Close
            </Button>
          </View>
        </View>
      </Modal>

      {reflectSession ? (
        <SessionReflectionModal
          session={reflectSession}
          readOnly
          onClose={() => setReflectSession(null)}
        />
      ) : null}

      {summarySession ? (
        <SessionSummaryModal
          session={summarySession}
          onClose={() => setSummarySession(null)}
        />
      ) : null}
    </Screen>
  );
}
