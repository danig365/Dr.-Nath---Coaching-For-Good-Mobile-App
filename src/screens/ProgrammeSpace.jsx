import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { Screen, Card, Button, Input } from "@/components/ui";
import MonthCalendar from "@/components/MonthCalendar";
import { toast } from "@/lib/toast";
import { confirm } from "@/lib/confirm";
import { downloadResource } from "@/lib/download";
import { pickFile, appendFile } from "@/lib/filePicker";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/ProgrammeSpace.jsx — the shared space for one
// offering: announcements, resources, sessions and a way into chat.

const fmtDate = (iso) =>
  iso
    ? new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

const fmtLong = (iso) =>
  iso
    ? new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

const STATUS_LABEL = {
  pending: "Pending",
  accepted: "Upcoming",
  completed: "Completed",
  no_show: "No show",
  declined: "Declined",
  cancelled: "Cancelled",
  held_offline: "Held off-platform",
  not_held: "Did not take place",
  rescheduled: "Rescheduled",
};

const TABS = [
  { key: "announcements", label: "Announcements", icon: "bell" },
  { key: "resources", label: "Resources", icon: "folder" },
  { key: "sessions", label: "Sessions", icon: "calendar" },
  { key: "messages", label: "Messages", icon: "message-square" },
];

function SessionRow({ s, isCoach, onChat }) {
  return (
    <View className="flex-row items-center justify-between gap-3 rounded-xl border border-gold/15 bg-cream p-3">
      <View className="min-w-0 flex-1">
        <Text className="font-sans-semibold text-sm text-navy">
          {fmtDate(s.date)}
          {s.time ? ` · ${s.time}` : ""}
        </Text>
        <Text className="font-sans text-xs text-slate">
          {isCoach ? `with ${s.with}` : STATUS_LABEL[s.status] || s.status}
        </Text>
      </View>
      <Pressable
        onPress={onChat}
        className="flex-row items-center gap-1.5 rounded-full bg-navy/5 px-3 py-1.5"
      >
        <Feather name="message-square" size={12} color={colors.navy} />
        <Text className="font-sans-semibold text-xs text-navy">Chat</Text>
      </Pressable>
    </View>
  );
}

function EmptyBlock({ icon, text }) {
  return (
    <View className="items-center py-12">
      <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-gold/15">
        <Feather name={icon} size={20} color={colors.gold} />
      </View>
      <Text className="text-center font-sans text-sm text-slate">{text}</Text>
    </View>
  );
}

export default function ProgrammeSpace() {
  const { skillId } = useLocalSearchParams();
  const router = useRouter();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [tab, setTab] = useState("announcements");

  const [annForm, setAnnForm] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [posting, setPosting] = useState(false);

  const [resForm, setResForm] = useState(false);
  const [resTitle, setResTitle] = useState("");
  const [resFile, setResFile] = useState(null);
  const [resLink, setResLink] = useState("");
  const [uploading, setUploading] = useState(false);

  const [busy, setBusy] = useState("");
  const [selDate, setSelDate] = useState(null);
  const [sessionView, setSessionView] = useState("calendar"); // calendar | list

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/programmes/${skillId}/space/`);
      setData(res.data);
    } catch (err) {
      if (err.response?.status === 403) setForbidden(true);
      else toast.error("Failed to load this programme.");
    } finally {
      setLoading(false);
    }
  }, [skillId]);

  useEffect(() => {
    load();
  }, [load]);

  const isCoach = data?.role === "coach";

  const postAnnouncement = async () => {
    if (!annTitle.trim()) {
      toast.error("Give the announcement a title.");
      return;
    }
    setPosting(true);
    try {
      const res = await api.post(`/programmes/${skillId}/announcements/`, {
        title: annTitle.trim(),
        body: annBody.trim(),
      });
      setData((d) => ({ ...d, announcements: [res.data, ...d.announcements] }));
      setAnnTitle("");
      setAnnBody("");
      setAnnForm(false);
      toast.success("Announcement posted.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to post.");
    } finally {
      setPosting(false);
    }
  };

  const deleteAnnouncement = async (id) => {
    if (!(await confirm("Delete this announcement?", { confirmLabel: "Delete" }))) return;
    setBusy(`a${id}`);
    try {
      await api.delete(`/programmes/announcements/${id}/`);
      setData((d) => ({
        ...d,
        announcements: d.announcements.filter((a) => a.id !== id),
      }));
    } catch {
      toast.error("Failed to delete.");
    } finally {
      setBusy("");
    }
  };

  const chooseResFile = async () => {
    const f = await pickFile();
    if (f) setResFile(f);
  };

  const addResource = async () => {
    if (!resTitle.trim()) {
      toast.error("Give the resource a title.");
      return;
    }
    if (!resFile && !resLink.trim()) {
      toast.error("Attach a file or paste a link.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("title", resTitle.trim());
      fd.append("skill", skillId);
      fd.append("visibility", "all_clients");
      if (resFile) appendFile(fd, "file", resFile);
      else fd.append("link_url", resLink.trim());

      const res = await api.post("/resources/", fd);
      setData((d) => ({ ...d, resources: [res.data, ...d.resources] }));
      setResTitle("");
      setResFile(null);
      setResLink("");
      setResForm(false);
      toast.success("Resource added.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to add resource.");
    } finally {
      setUploading(false);
    }
  };

  const openResource = async (r) => {
    if (r.is_link || (!r.download_url && r.link_url)) {
      Linking.openURL(r.link_url);
      return;
    }
    setBusy(`r${r.id}`);
    try {
      await downloadResource(r.id, r.title);
    } catch {
      toast.error("Failed to download.");
    } finally {
      setBusy("");
    }
  };

  const sessions = data?.sessions || [];
  const dayEvents = useMemo(() => sessions.filter((s) => s.date), [sessions]);
  const shownSessions = selDate ? sessions.filter((s) => s.date === selDate) : sessions;

  if (loading) return <Screen loading />;

  if (forbidden) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <Feather name="book-open" size={40} color={colors.gold} />
          <Text className="mb-1 mt-4 font-display text-2xl text-navy">
            Not part of this programme
          </Text>
          <Text className="mb-5 text-center font-sans text-sm text-slate">
            You don't have access to this programme space.
          </Text>
          <Button variant="gold" onPress={() => router.back()}>
            Go back
          </Button>
        </View>
      </Screen>
    );
  }

  const { overview, announcements, resources } = data;
  const latestSession = sessions[0];
  const stats = [
    { label: "announcements", value: announcements.length },
    { label: "resources", value: resources.length },
    { label: "sessions", value: sessions.length },
  ];

  return (
    <Screen onRefresh={load} refreshing={false}>
      {/* Hero */}
      <View className="rounded-2xl bg-navy px-5 py-4">
        <View className="mb-2 flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"
          >
            <Feather name="arrow-left" size={13} color={colors.cream} />
            <Text className="font-sans-semibold text-xs text-cream">Back</Text>
          </Pressable>
          <Text className="text-[11px] font-sans-semibold uppercase tracking-[2px] text-gold">
            Programme Space
          </Text>
        </View>

        <Text className="mb-2 font-display text-xl text-cream">{overview.name}</Text>

        <View className="flex-row flex-wrap items-center gap-x-5 gap-y-1">
          {stats.map((s) => (
            <Text key={s.label} className="font-sans text-xs text-slate-light">
              <Text className="font-sans-bold text-sm text-gold">{s.value}</Text> {s.label}
            </Text>
          ))}
        </View>
        <Text className="mt-1 font-sans text-xs text-slate-light">
          with {overview.coach_name}
        </Text>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-1 p-1"
        className="my-4 rounded-full bg-navy/5"
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              className={`flex-row items-center gap-1.5 rounded-full px-4 py-2 ${
                active ? "bg-white" : ""
              }`}
            >
              <Feather
                name={t.icon}
                size={14}
                color={active ? colors.gold : colors.slate}
              />
              <Text
                className={`font-sans-semibold text-sm ${
                  active ? "text-navy" : "text-slate"
                }`}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Card>
        {/* ANNOUNCEMENTS */}
        {tab === "announcements" ? (
          <View>
            {isCoach ? (
              <View className="mb-4">
                {!annForm ? (
                  <Button variant="gold" size="sm" onPress={() => setAnnForm(true)}>
                    + New announcement
                  </Button>
                ) : (
                  <View className="rounded-xl border border-gold/20 bg-cream p-4">
                    <View className="mb-2 flex-row items-center justify-between">
                      <Text className="font-sans-bold text-sm text-navy">
                        New announcement
                      </Text>
                      <Pressable onPress={() => setAnnForm(false)} hitSlop={8}>
                        <Feather name="x" size={15} color={colors.slate} />
                      </Pressable>
                    </View>
                    <Input value={annTitle} onChangeText={setAnnTitle} placeholder="Title" />
                    <Input
                      value={annBody}
                      onChangeText={setAnnBody}
                      placeholder="Write an update for everyone on this programme…"
                      multiline
                    />
                    <Button variant="gold" size="sm" onPress={postAnnouncement} loading={posting}>
                      Post
                    </Button>
                  </View>
                )}
              </View>
            ) : null}

            {announcements.length === 0 ? (
              <EmptyBlock icon="bell" text="No announcements yet." />
            ) : (
              <View className="gap-3">
                {announcements.map((a) => (
                  <View
                    key={a.id}
                    className="rounded-xl border border-gold/15 bg-cream p-4"
                  >
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="min-w-0 flex-1">
                        <Text className="font-sans-bold text-sm text-navy">{a.title}</Text>
                        {a.body ? (
                          <Text className="mt-1 font-sans text-sm text-slate">{a.body}</Text>
                        ) : null}
                        <Text className="mt-2 font-sans text-xs text-slate-light">
                          {a.coach_name} ·{" "}
                          {new Date(a.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </Text>
                      </View>
                      {isCoach ? (
                        <Pressable
                          onPress={() => deleteAnnouncement(a.id)}
                          disabled={busy === `a${a.id}`}
                          hitSlop={6}
                          className="rounded-full bg-red-50 p-1.5"
                        >
                          <Feather name="trash-2" size={13} color="#B91C1C" />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}

        {/* RESOURCES */}
        {tab === "resources" ? (
          <View>
            {isCoach ? (
              <View className="mb-4">
                {!resForm ? (
                  <Button variant="gold" size="sm" onPress={() => setResForm(true)}>
                    + Add resource
                  </Button>
                ) : (
                  <View className="gap-2 rounded-xl border border-gold/20 bg-cream p-4">
                    <View className="flex-row items-center justify-between">
                      <Text className="font-sans-bold text-sm text-navy">Add resource</Text>
                      <Pressable onPress={() => setResForm(false)} hitSlop={8}>
                        <Feather name="x" size={15} color={colors.slate} />
                      </Pressable>
                    </View>

                    <Input
                      value={resTitle}
                      onChangeText={setResTitle}
                      placeholder="Resource title"
                      className="mb-0"
                    />

                    <Pressable
                      onPress={chooseResFile}
                      className="flex-row items-center gap-2 rounded-lg border border-dashed border-gold/40 bg-white px-3 py-2.5"
                    >
                      <Feather name="paperclip" size={14} color={colors.goldDeep} />
                      <Text
                        className="flex-1 font-sans text-sm text-slate"
                        numberOfLines={1}
                      >
                        {resFile ? resFile.name : "Attach a file…"}
                      </Text>
                    </Pressable>

                    <Input
                      value={resLink}
                      onChangeText={setResLink}
                      placeholder="…or paste a link"
                      autoCapitalize="none"
                      className="mb-0"
                    />

                    <Button variant="gold" size="sm" onPress={addResource} loading={uploading}>
                      Add
                    </Button>
                  </View>
                )}
              </View>
            ) : null}

            {resources.length === 0 ? (
              <EmptyBlock icon="folder" text="No resources for this programme yet." />
            ) : (
              <View className="gap-3">
                {resources.map((r) => {
                  const link = r.is_link || (!r.download_url && r.link_url);
                  return (
                    <Pressable
                      key={r.id}
                      onPress={() => openResource(r)}
                      disabled={busy === `r${r.id}`}
                      className="flex-row items-center gap-3 rounded-xl border border-gold/15 bg-cream p-3"
                    >
                      <View className="h-10 w-10 items-center justify-center rounded-lg bg-gold/15">
                        <Feather
                          name={link ? "external-link" : "file-text"}
                          size={16}
                          color={colors.goldDeep}
                        />
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text
                          className="font-sans-semibold text-sm text-navy"
                          numberOfLines={1}
                        >
                          {r.title}
                        </Text>
                        <Text className="font-sans text-xs text-slate">
                          {link ? "Open link" : "Download"}
                        </Text>
                      </View>
                      <Feather
                        name={link ? "external-link" : "download"}
                        size={14}
                        color={colors.gold}
                      />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        {/* SESSIONS */}
        {tab === "sessions" ? (
          <View>
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Feather name="calendar" size={16} color={colors.gold} />
                <Text className="font-display text-lg text-navy">Sessions</Text>
              </View>

              <View className="flex-row items-center gap-2">
                {!isCoach ? (
                  <Button
                    variant="gold"
                    size="sm"
                    onPress={() => router.push(`/book/${skillId}`)}
                  >
                    + Book next
                  </Button>
                ) : null}
                <View className="flex-row rounded-full bg-navy/5 p-0.5">
                  <Pressable
                    onPress={() => setSessionView("calendar")}
                    className={`rounded-full px-2.5 py-1 ${
                      sessionView === "calendar" ? "bg-white" : ""
                    }`}
                  >
                    <Feather
                      name="calendar"
                      size={12}
                      color={sessionView === "calendar" ? colors.navy : colors.slate}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setSessionView("list");
                      setSelDate(null);
                    }}
                    className={`rounded-full px-2.5 py-1 ${
                      sessionView === "list" ? "bg-white" : ""
                    }`}
                  >
                    <Feather
                      name="list"
                      size={12}
                      color={sessionView === "list" ? colors.navy : colors.slate}
                    />
                  </Pressable>
                </View>
              </View>
            </View>

            {sessions.length === 0 ? (
              <EmptyBlock icon="calendar" text="No sessions yet." />
            ) : sessionView === "calendar" ? (
              <>
                <View className="mb-4 rounded-xl border border-gold/15 bg-cream p-3">
                  <MonthCalendar
                    events={dayEvents}
                    selected={selDate}
                    onSelect={setSelDate}
                    initialMonth={dayEvents[0]?.date?.slice(0, 7)}
                  />
                </View>

                {selDate ? (
                  <>
                    <Text className="mb-2 text-xs font-sans-semibold uppercase tracking-wider text-slate-light">
                      {fmtLong(selDate)}
                    </Text>
                    <View className="gap-2">
                      {shownSessions.length === 0 ? (
                        <Text className="py-3 text-center font-sans text-sm text-slate">
                          No sessions on this day.
                        </Text>
                      ) : (
                        shownSessions.map((s) => (
                          <SessionRow
                            key={s.id}
                            s={s}
                            isCoach={isCoach}
                            onChat={() => router.push(`/chat/${s.id}`)}
                          />
                        ))
                      )}
                    </View>
                  </>
                ) : (
                  <Text className="py-3 text-center font-sans text-sm text-slate">
                    Tap a highlighted date (•) to see its sessions.
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text className="mb-2 text-xs font-sans-semibold uppercase tracking-wider text-slate-light">
                  {sessions.length} session{sessions.length === 1 ? "" : "s"}
                </Text>
                <View className="gap-2">
                  {sessions.map((s) => (
                    <SessionRow
                      key={s.id}
                      s={s}
                      isCoach={isCoach}
                      onChat={() => router.push(`/chat/${s.id}`)}
                    />
                  ))}
                </View>
              </>
            )}
          </View>
        ) : null}

        {/* MESSAGES */}
        {tab === "messages" ? (
          latestSession ? (
            <View className="items-center py-8">
              <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-gold/15">
                <Feather name="message-square" size={20} color={colors.gold} />
              </View>
              <Text className="mb-4 text-center font-sans text-sm text-slate">
                Message {isCoach ? "your client" : overview.coach_name} directly about this
                programme.
              </Text>
              <Button
                variant="gold"
                onPress={() => router.push(`/chat/${latestSession.id}`)}
              >
                Open chat
              </Button>
            </View>
          ) : (
            <EmptyBlock
              icon="message-square"
              text="Chat opens once there's a session on this programme."
            />
          )
        ) : null}
      </Card>
    </Screen>
  );
}
