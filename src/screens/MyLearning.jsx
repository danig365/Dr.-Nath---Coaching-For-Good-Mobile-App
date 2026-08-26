import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, Modal, TextInput } from "react-native";
import { useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { Screen, Card, Button, Input } from "@/components/ui";
import SessionFeedbackCard from "@/components/SessionFeedbackCard";
import AddToCalendar from "@/components/AddToCalendar";
import SessionReflectionModal from "@/components/SessionReflectionModal";
import SessionSummaryModal from "@/components/SessionSummaryModal";
import GoogleCalendarCard from "@/components/GoogleCalendarCard";
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
import {
  SESSION_REJOIN_MS,
  isSessionLive,
  isUpcomingSession,
  ordinal,
  sessionStartDate,
} from "@/lib/sessionTiming";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/"MyLearning .jsx" — the client's session list.

const PAGE_SIZE = 4;

// ─── Session Card ─────────────────────────────────────────────────────────────
function SessionCard({
  session,
  activeTab,
  onCancel,
  onFeedback,
  onDownload,
  onReflect,
  onSummary,
  router,
}) {
  const { timezone } = useAuth(); // viewer's display timezone
  const startDt = sessionStartDate(session);
  const { date, time } = formatSessionDateTime(startDt, timezone);

  const accent =
    activeTab === "upcoming"
      ? session.status === "accepted"
        ? "#34A853"
        : "#F59E0B"
      : colors.gold;

  const sessionEndMs = session.slot_end
    ? new Date(session.slot_end).getTime()
    : startDt.getTime() + session.duration * 60 * 1000;
  // Joinable through the whole rejoin window so it can be reconnected (N3).
  const expired = sessionEndMs + SESSION_REJOIN_MS < Date.now();

  const coachName = session.mentor_name || session.mentor_username;

  return (
    <Card className="overflow-hidden p-0">
      <View className="flex-row">
        <View className="w-1.5" style={{ backgroundColor: accent }} />

        <View className="flex-1 px-5 py-4">
          {/* Row 1: avatar · coach + skill */}
          <View className="flex-row items-center gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-gold">
              <Text className="font-sans-bold text-sm text-navy-deep">
                {coachName?.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-sans-semibold text-xs text-gold-deep">{coachName}</Text>
              <Text className="font-display text-base text-navy" numberOfLines={1}>
                {session.skill_title}
              </Text>
            </View>
            <StatusBadge status={session.status} />
          </View>

          {/* Badges row */}
          <View className="mt-2 flex-row flex-wrap items-center gap-1.5">
            {session.duration ? (
              <View className="rounded-full border border-gold/20 bg-gold/10 px-2.5 py-1">
                <Text className="font-sans-semibold text-xs text-gold-deep">
                  {session.duration} min
                </Text>
              </View>
            ) : null}
            {session.price ? (
              <View className="rounded-full border border-gold/20 bg-cream-warm px-2.5 py-1">
                <Text className="font-sans-semibold text-xs text-gold-deep">
                  ${session.price}
                </Text>
              </View>
            ) : null}
            {/* Which session this is on this programme. */}
            {session.session_number ? (
              <View className="rounded-full border border-gold/15 bg-cream-warm px-2.5 py-1">
                <Text className="font-sans-semibold text-xs text-slate">
                  {ordinal(session.session_number)} session
                </Text>
              </View>
            ) : null}
          </View>

          <View className="my-3 h-px bg-gold/10" />

          {/* Date + time */}
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

          {/* Actions */}
          <View className="mt-3 flex-row flex-wrap items-center gap-2">
            {activeTab === "upcoming" ? (
              <>
                {session.status === "accepted" ? (
                  <ActionBtn
                    onPress={() => router.push(`/session/${session.id}`)}
                    icon="video"
                    label={expired ? "Expired" : "Join Session"}
                    variant="primary"
                    disabled={expired}
                  />
                ) : (
                  <ActionBtn icon="video" label="Awaiting" disabled />
                )}
                {session.status === "accepted" && !expired ? (
                  <ActionBtn
                    onPress={() => router.push(`/chat/${session.id}`)}
                    icon="message-square"
                    label="Chat"
                    badge={<UnreadBadge count={session.unread_messages} />}
                  />
                ) : null}
                {session.status === "accepted" && !expired ? (
                  <AddToCalendar session={session} />
                ) : null}
                {session.skill ? (
                  <ActionBtn
                    onPress={() => router.push(`/programme/${session.skill}`)}
                    icon="book-open"
                    label="Programme"
                  />
                ) : null}
                {!expired ? (
                  <ActionBtn
                    onPress={() => onCancel(session)}
                    icon="x-circle"
                    label="Cancel"
                    variant="danger"
                  />
                ) : null}
                {session.notes_file ? (
                  <ActionBtn
                    onPress={() => onDownload(session)}
                    icon="download"
                    label="Notes"
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

            {activeTab === "past" ? (
              <>
                {!session.feedback ? (
                  <ActionBtn
                    onPress={() => onFeedback(session.id)}
                    icon="star"
                    label="Leave Feedback"
                    variant="primary"
                  />
                ) : null}
                <ActionBtn
                  onPress={() => router.push(`/chat/${session.id}`)}
                  icon="message-square"
                  label="Chat"
                  badge={<UnreadBadge count={session.unread_messages} />}
                />
                {session.notes_file ? (
                  <ActionBtn
                    onPress={() => onDownload(session)}
                    icon="download"
                    label="Notes"
                  />
                ) : null}
                <ActionBtn
                  onPress={() => onReflect(session)}
                  icon="edit"
                  label={session.has_reflection ? "My Notes ✓" : "Add Notes"}
                />
                {session.has_summary ? (
                  <ActionBtn
                    onPress={() => onSummary(session)}
                    icon="file-text"
                    label="AI Summary"
                  />
                ) : null}
                {session.skill ? (
                  <ActionBtn
                    onPress={() => router.push(`/programme/${session.skill}`)}
                    icon="book-open"
                    label="Programme"
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
                <ActionBtn
                  onPress={() => router.push("/skills")}
                  icon="arrow-right"
                  label="Book Again"
                />
              </>
            ) : null}
          </View>

          {session.status === "no_show" ? <NoShowNotice session={session} /> : null}

          {/* Feedback display (past only) */}
          {activeTab === "past" && session.feedback ? (
            <View className="mt-3 border-t border-gold/10 pt-3">
              <SessionFeedbackCard
                title="Your review"
                subtitle={`Shared with ${coachName}`}
                badgeLabel="Submitted"
                rating={session.feedback.rating}
                comment={session.feedback.comment}
                date={new Date(session.feedback.created_at).toLocaleDateString()}
                tone="gold"
              />
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

// ─── Group Session Card ───────────────────────────────────────────────────────
function GroupCard({ e, onCancel, onJoin, onChat }) {
  const { timezone } = useAuth();
  const { date, time } = formatSessionDateTime(new Date(e.start_datetime), timezone);

  const cancelled = e.session_status === "cancelled";
  const upcoming = new Date(e.end_datetime).getTime() + SESSION_REJOIN_MS > Date.now();
  // Joinable from 15 min before start until the scheduled end.
  const canJoin =
    !cancelled &&
    upcoming &&
    Date.now() >= new Date(e.start_datetime).getTime() - 15 * 60 * 1000;

  const badge = cancelled ? "cancelled" : upcoming ? "upcoming" : "completed";
  const badgeTone = {
    upcoming: { bg: "bg-green-100", text: "text-green-900" },
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
                {e.coach_username}
              </Text>
              <Text className="font-display text-base text-navy" numberOfLines={1}>
                {e.title}
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
                  onPress={() => onJoin(e.group_session)}
                  icon="video"
                  label="Join Call"
                  variant="primary"
                />
              ) : (
                <ActionBtn icon="video" label="Opens 15 min before" disabled />
              )
            ) : null}
            {!cancelled ? (
              <ActionBtn
                onPress={() => onChat(e.group_session)}
                icon="message-square"
                label="Group Chat"
              />
            ) : null}
            {e.payment_status === "paid" && Number(e.amount_paid) > 0 ? (
              <ActionBtn
                onPress={() =>
                  downloadFile(
                    `/bookings/group-enrollments/${e.id}/invoice/`,
                    "receipt.pdf"
                  )
                }
                icon="file-text"
                label="Receipt"
              />
            ) : null}
            {!cancelled && upcoming ? (
              <ActionBtn
                onPress={() => onCancel(e.id)}
                icon="x-circle"
                label="Cancel"
                variant="danger"
              />
            ) : null}
          </View>
        </View>
      </View>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MyLearning() {
  const router = useRouter();
  const { isAuthenticated, isCoach, isAdmin } = useAuth();

  const [sessions, setSessions] = useState([]);
  const [groupEnrollments, setGroupEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("upcoming");
  const [page, setPage] = useState(1);

  // Filters
  const [search, setSearch] = useState("");
  const [coachFilter, setCoachFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [sessionToCancelId, setSessionToCancelId] = useState(null);
  const [cancelSession, setCancelSession] = useState(null); // full session (late-cancel warning)
  const [cancelKind, setCancelKind] = useState("session"); // "session" | "group"
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackSession, setFeedbackSession] = useState(null);
  const [reflectSession, setReflectSession] = useState(null);
  const [summarySession, setSummarySession] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");

  const fetchSessions = useCallback(async () => {
    // This is the client screen. Send anyone else to their own area instead of
    // logging them out (a coach following a client link must not get bounced
    // out — that caused a login → "access denied" → logout loop).
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (isAdmin()) {
      // Admin tooling is web-only on mobile.
      router.replace("/(client)/dashboard");
      return;
    }
    if (isCoach()) {
      router.replace("/(coach)/sessions");
      return;
    }

    setLoading(true);
    try {
      const [res, gres] = await Promise.all([
        api.get("/bookings/"),
        api.get("/bookings/group-sessions/mine/"),
      ]);
      setSessions(res.data);
      setGroupEnrollments(gres.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to load sessions.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isCoach, isAdmin, router]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Keep a session in "Upcoming" (with a working Join button) until its rejoin
  // window closes — so a session already started, or joined a few minutes late,
  // stays joinable instead of dropping into Past at its start time.
  const isLive = (s) => isSessionLive(s);
  const upcomingSessions = sessions.filter(isUpcomingSession);
  const pastSessions = sessions.filter(
    (s) =>
      s.status === "completed" ||
      s.status === "held_offline" ||
      ((s.status === "pending" || s.status === "accepted") && !isLive(s))
  );
  const noShowSessions = sessions.filter(
    (s) => s.status === "no_show" || s.status === "not_held"
  );

  const handleCancelSession = (session) => {
    setCancelKind("session");
    setSessionToCancelId(session.id);
    setCancelSession(session);
    setShowCancelModal(true);
  };

  const handleCancelGroup = (id) => {
    setCancelKind("group");
    setSessionToCancelId(id);
    setCancelSession(null);
    setShowCancelModal(true);
  };

  const confirmCancel = async () => {
    try {
      if (cancelKind === "group") {
        await api.patch(`/bookings/group-sessions/${sessionToCancelId}/leave/`, {});
        toast.success("Seat cancelled and refunded.");
      } else {
        const res = await api.patch(`/bookings/${sessionToCancelId}/cancel/`, {});
        toast.success(res.data?.detail || "Session cancelled.");
      }
      await fetchSessions();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to cancel.");
    } finally {
      setSessionToCancelId(null);
      setCancelSession(null);
      setShowCancelModal(false);
    }
  };

  const handleLeaveFeedback = (id) => {
    setFeedbackSession(sessions.find((s) => s.id === id));
    setFeedbackRating(5);
    setFeedbackComment("");
    setShowFeedbackModal(true);
  };

  const submitFeedback = async () => {
    if (!feedbackComment.trim()) {
      toast.warning("Please write a comment.");
      return;
    }
    try {
      await api.post("/bookings/reviews/", {
        mentor_profile: feedbackSession.mentor,
        rating: feedbackRating,
        comment: feedbackComment.trim(),
      });
      toast.success("Feedback submitted! Thank you.");
      setShowFeedbackModal(false);
      setFeedbackSession(null);
      await fetchSessions();
    } catch (err) {
      toast.error(
        err.response?.data?.detail ||
          err.response?.data?.[0] ||
          "Failed to submit feedback."
      );
    }
  };

  const handleDownload = (session) => {
    // Goes through the authenticated endpoint: /media/session_notes/ is no longer
    // public, since notes are confidential and their filenames were guessable.
    if (session?.notes_file)
      downloadFile(`/ops/media/session-notes/${session.id}/`, "session-notes.pdf");
    else toast.info("No notes uploaded yet.");
  };

  const uniqueSkills = [
    ...new Set([...upcomingSessions, ...pastSessions].map((s) => s.skill_title)),
  ].length;

  const applyFilters = (list) => {
    let out = [...list];
    if (search.trim())
      out = out.filter((s) =>
        s.skill_title?.toLowerCase().includes(search.trim().toLowerCase())
      );
    if (coachFilter.trim())
      out = out.filter((s) =>
        `${s.mentor_name || ""} ${s.mentor_username || ""}`
          .toLowerCase()
          .includes(coachFilter.trim().toLowerCase())
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
    search || coachFilter || dateFrom || dateTo || sortOrder !== "newest";

  const resetFilters = () => {
    setSearch("");
    setCoachFilter("");
    setDateFrom("");
    setDateTo("");
    setSortOrder("newest");
    setPage(1);
  };

  const filtered = applyFilters(
    activeTab === "upcoming"
      ? upcomingSessions
      : activeTab === "no_show"
        ? noShowSessions
        : pastSessions
  );
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pagedSessions = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) return <Screen loading />;

  const TABS = [
    { key: "upcoming", label: "Upcoming", count: upcomingSessions.length, icon: "calendar" },
    { key: "past", label: "Past Sessions", count: pastSessions.length, icon: "check-circle" },
    { key: "no_show", label: "No Show", count: noShowSessions.length, icon: "x-circle" },
    { key: "group", label: "Group Sessions", count: groupEnrollments.length, icon: "users" },
  ];

  // Late-cancellation warning: paid session starting within 24 hours.
  const lateCancelWarning = (() => {
    const cs = cancelSession;
    if (cancelKind !== "session" || !cs) return false;
    const startMs = cs.slot_start
      ? new Date(cs.slot_start).getTime()
      : cs.session_date && cs.session_time
        ? new Date(`${cs.session_date}T${cs.session_time}Z`).getTime()
        : 0;
    const isPaid = cs.payment_status === "paid" && Number(cs.amount_paid) > 0;
    const within24 = startMs && startMs - Date.now() < 24 * 3600 * 1000;
    return !!(isPaid && within24);
  })();

  return (
    <Screen onRefresh={fetchSessions} refreshing={false}>
      {/* Google Calendar connect (auto-add sessions) */}
      <GoogleCalendarCard />

      {/* ── Stats ───────────────────────────────────────── */}
      <View className="mb-6 flex-row gap-2">
        {[
          { label: "Upcoming", value: upcomingSessions.length, warm: true },
          { label: "Completed", value: pastSessions.length, warm: false },
          { label: "Skills", value: uniqueSkills, warm: false },
        ].map((s) => (
          <View
            key={s.label}
            className={`flex-1 rounded-2xl border border-gold/15 p-3 ${
              s.warm ? "bg-cream-warm" : "bg-white"
            }`}
          >
            <Text className="mb-1 text-[10px] font-sans-semibold uppercase tracking-wider text-slate-light">
              {s.label}
            </Text>
            <Text className="font-display text-2xl text-navy">{s.value}</Text>
          </View>
        ))}
      </View>

      {/* ── Tabs ────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 pb-1"
        className="mb-5"
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
              className={`flex-row items-center gap-2 rounded-full px-4 py-2.5 ${
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
                label="Coach name"
                placeholder="e.g. drsmith"
                value={coachFilter}
                onChangeText={(v) => {
                  setCoachFilter(v);
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
              Showing <Text className="font-sans-bold">{filtered.length}</Text> result
              {filtered.length !== 1 ? "s" : ""}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* ── Session List / Empty ─────────────────────────── */}
      {activeTab === "group" ? (
        groupEnrollments.length === 0 ? (
          <Card className="items-center py-20">
            <Text className="mb-4 text-5xl">👥</Text>
            <Text className="mb-2 font-display text-xl text-navy">
              No group sessions yet
            </Text>
            <Text className="mb-6 text-center font-sans text-sm text-slate">
              Browse and reserve a seat in a group session.
            </Text>
            <Button variant="gold" onPress={() => router.push("/group-sessions")}>
              Browse Group Sessions
            </Button>
          </Card>
        ) : (
          <View className="gap-4">
            {groupEnrollments.map((e) => (
              <GroupCard
                key={e.id}
                e={e}
                onCancel={handleCancelGroup}
                onJoin={(sid) => router.push(`/group-session/${sid}/call`)}
                onChat={(sid) => router.push(`/group-chat/${sid}`)}
              />
            ))}
          </View>
        )
      ) : (
        <>
          {filtered.length === 0 ? (
            <Card className="items-center py-20">
              <Text className="mb-4 text-5xl">
                {activeTab === "upcoming" ? "📚" : "🎓"}
              </Text>
              <Text className="mb-2 font-display text-xl text-navy">
                No {activeTab === "upcoming" ? "upcoming" : "past"} sessions
              </Text>
              <Text className="mb-6 text-center font-sans text-sm text-slate">
                {activeTab === "upcoming"
                  ? "Book a session to start your learning journey."
                  : "Your completed sessions will appear here."}
              </Text>
              {activeTab === "upcoming" ? (
                <Button variant="gold" onPress={() => router.push("/skills")}>
                  Browse Skills
                </Button>
              ) : null}
            </Card>
          ) : (
            <View className="gap-4">
              {pagedSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  activeTab={activeTab}
                  onCancel={handleCancelSession}
                  onFeedback={handleLeaveFeedback}
                  onDownload={handleDownload}
                  onReflect={setReflectSession}
                  onSummary={setSummarySession}
                  router={router}
                />
              ))}
            </View>
          )}
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {/* ── Cancel Modal ─────────────────────────────────── */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View className="flex-1 items-center justify-center bg-navy-deep/60 p-4">
          <View className="w-full max-w-sm items-center rounded-2xl border border-gold/20 bg-cream p-8">
            <Text className="mb-3 text-4xl">⚠️</Text>
            <Text className="mb-2 font-display text-xl text-navy">Cancel Session?</Text>
            <Text className="mb-3 text-center font-sans text-sm text-slate">
              This action cannot be undone. Your coach will be notified.
            </Text>

            {lateCancelWarning ? (
              <View className="mb-6 rounded-xl border border-red-200 bg-red-50 p-3">
                <Text className="font-sans text-sm text-red-700">
                  This is <Text className="font-sans-bold">less than 24 hours</Text> before
                  a paid session. Per the cancellation policy,{" "}
                  <Text className="font-sans-bold">you will not be refunded</Text>.
                </Text>
              </View>
            ) : null}

            <View className="w-full flex-row gap-3">
              <Button
                variant="outline"
                onPress={() => setShowCancelModal(false)}
                className="flex-1"
              >
                Keep Session
              </Button>
              <Button variant="navy" onPress={confirmCancel} className="flex-1">
                Yes, Cancel
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Feedback Modal ───────────────────────────────── */}
      <Modal
        visible={showFeedbackModal && !!feedbackSession}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFeedbackModal(false)}
      >
        <View className="flex-1 items-center justify-center bg-navy-deep/60 p-4">
          <View className="w-full max-w-lg overflow-hidden rounded-2xl border border-gold/20 bg-cream">
            <View className="h-1 w-full bg-gold" />
            <View className="p-6">
              <View className="mb-6 flex-row items-start justify-between gap-4">
                <View className="flex-1">
                  <Text className="mb-1 text-xs font-sans-semibold uppercase tracking-[2px] text-gold-deep">
                    Session Feedback
                  </Text>
                  <Text className="font-display text-2xl text-navy">Leave a Review</Text>
                  <Text className="mt-1 font-sans text-sm text-slate">
                    For your session with{" "}
                    <Text className="font-sans-semibold text-navy">
                      {feedbackSession?.mentor_name || feedbackSession?.mentor_username}
                    </Text>
                  </Text>
                </View>
                <View className="h-11 w-11 items-center justify-center rounded-xl bg-gold/15">
                  <Feather name="star" size={18} color={colors.gold} />
                </View>
              </View>

              {/* Star rating */}
              <View className="mb-5 rounded-xl border border-gold/15 bg-white p-4">
                <Text className="mb-3 text-xs font-sans-semibold uppercase tracking-wider text-slate">
                  Your Rating
                </Text>
                <View className="flex-row items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Pressable key={star} onPress={() => setFeedbackRating(star)} hitSlop={4}>
                      <Text
                        className="text-2xl"
                        style={{
                          color: star <= feedbackRating ? colors.gold : "rgba(200,169,81,0.25)",
                        }}
                      >
                        ★
                      </Text>
                    </Pressable>
                  ))}
                  <Text className="ml-2 font-sans-medium text-sm text-gold-deep">
                    {feedbackRating}/5
                  </Text>
                </View>
              </View>

              {/* Comment */}
              <View className="mb-6">
                <Text className="mb-2 text-xs font-sans-semibold uppercase tracking-wider text-slate">
                  Your Feedback
                </Text>
                <TextInput
                  value={feedbackComment}
                  onChangeText={setFeedbackComment}
                  multiline
                  placeholder="Share what was helpful, what stood out, or how the session impacted you..."
                  placeholderTextColor={colors.slateLight}
                  className="min-h-[96px] rounded-xl border border-gold/30 bg-white px-4 py-3 font-sans text-sm text-navy"
                  style={{ textAlignVertical: "top" }}
                />
              </View>

              <View className="flex-row gap-3">
                <Button
                  variant="outline"
                  onPress={() => setShowFeedbackModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button variant="gold" onPress={submitFeedback} className="flex-1">
                  Submit Feedback
                </Button>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {reflectSession ? (
        <SessionReflectionModal
          session={reflectSession}
          onClose={() => setReflectSession(null)}
          onSaved={fetchSessions}
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
