import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Linking } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { Screen, Card, Button, Input, EmptyState } from "@/components/ui";
import WorkspaceTabs from "@/components/WorkspaceTabs";
import { toast } from "@/lib/toast";
import { downloadResource, downloadSubmission } from "@/lib/download";
import { pickFile, appendFile } from "@/lib/filePicker";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/MyResources.jsx — the client's view of resources
// shared by their coach, plus the upload inbox back to the coach.

const fmtSize = (b) =>
  b == null
    ? ""
    : b < 1024
      ? `${b} B`
      : b < 1048576
        ? `${(b / 1024).toFixed(0)} KB`
        : `${(b / 1048576).toFixed(1)} MB`;

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

const MAX_FILE_BYTES = 50 * 1024 * 1024;

const STATUS_STYLE = {
  submitted: { tone: "bg-gold/15", text: "text-gold-deep", icon: "clock" },
  reviewed: { tone: "bg-green-100", text: "text-green-900", icon: "check-circle" },
};

const emptyForm = { coach: "", title: "", note: "", in_response_to: "", file: null };

// Horizontal chip picker — the mobile stand-in for a <select>.
function ChipPicker({ options, value, onChange, emptyLabel = "— None —", allowEmpty = false }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 pb-1"
      className="mb-4"
    >
      {allowEmpty ? (
        <Pressable
          onPress={() => onChange("")}
          className={`rounded-full px-4 py-2 ${
            !value ? "bg-gold" : "border border-gold/25 bg-cream"
          }`}
        >
          <Text
            className={`font-sans-medium text-sm ${!value ? "text-navy-deep" : "text-slate"}`}
          >
            {emptyLabel}
          </Text>
        </Pressable>
      ) : null}

      {options.map((o) => {
        const selected = String(value) === String(o.id);
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(String(o.id))}
            className={`rounded-full px-4 py-2 ${
              selected ? "bg-gold" : "border border-gold/25 bg-cream"
            }`}
          >
            <Text
              className={`font-sans-medium text-sm ${
                selected ? "text-navy-deep" : "text-slate"
              }`}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function MyResources() {
  const { isAuthenticated, logout } = useAuth();

  const [resources, setResources] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!isAuthenticated) {
      toast.error("Please log in.");
      logout();
      return;
    }
    setLoading(true);
    try {
      const [shared, subs, cs] = await Promise.all([
        api.get("/resources/shared/"),
        api.get("/resources/submissions/"),
        api.get("/resources/submissions/coaches/"),
      ]);
      setResources(shared.data);
      setSubmissions(subs.data);
      setCoaches(cs.data);
      // Default the coach picker when there's only one option.
      if (cs.data.length === 1) setForm((f) => ({ ...f, coach: String(cs.data[0].id) }));
    } catch (err) {
      toast.error("Failed to load resources.");
      if (err.response?.status === 401) logout();
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, logout]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Shared resources grouped by coach → folder.
  const grouped = useMemo(() => {
    const byCoach = {};
    resources.forEach((r) => {
      const coach = r.coach_username || "Your coach";
      const folder = r.folder_name || "General";
      ((byCoach[coach] ||= {})[folder] ||= []).push(r);
    });
    return byCoach;
  }, [resources]);

  // Resources from the currently selected coach, offered as "responding to".
  const responseOptions = useMemo(
    () => resources.filter((r) => String(r.coach) === String(form.coach)),
    [resources, form.coach]
  );

  const download = async (r) => {
    setBusy(`r${r.id}`);
    try {
      await downloadResource(r.id, r.title);
    } catch {
      toast.error("Download failed.");
    } finally {
      setBusy(null);
    }
  };

  const downloadOwn = async (s) => {
    setBusy(`s${s.id}`);
    try {
      await downloadSubmission(s.id, s.title);
    } catch {
      toast.error("Download failed.");
    } finally {
      setBusy(null);
    }
  };

  const choose = async () => {
    const file = await pickFile();
    if (file) setForm((f) => ({ ...f, file }));
  };

  const upload = async () => {
    if (!form.coach) {
      toast.error("Choose a coach to send this to.");
      return;
    }
    if (!form.title.trim() || !form.file) {
      toast.error("A title and a file are required.");
      return;
    }
    if (form.file.size > MAX_FILE_BYTES) {
      toast.error("File is larger than 50 MB.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("coach", form.coach);
      fd.append("title", form.title.trim());
      fd.append("note", form.note || "");
      if (form.in_response_to) fd.append("in_response_to", form.in_response_to);
      appendFile(fd, "file", form.file);

      const res = await api.post("/resources/submissions/", fd);
      setSubmissions((s) => [res.data, ...s]);
      setForm((f) => ({ ...emptyForm, coach: f.coach }));
      toast.success("Sent to your coach — they've been notified by email.");
    } catch (err) {
      toast.error(
        err.response?.data?.file?.[0] || err.response?.data?.detail || "Upload failed."
      );
    } finally {
      setUploading(false);
    }
  };

  const deleteSubmission = async (id) => {
    try {
      await api.delete(`/resources/submissions/${id}/`);
      setSubmissions((s) => s.filter((x) => x.id !== id));
      toast.success("Removed.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to remove.");
    }
  };

  if (loading) {
    return (
      <Screen>
        <WorkspaceTabs />
        <Screen loading padded={false} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={fetchAll} refreshing={false}>
      <WorkspaceTabs />

      <View className="mb-8">
        <Text className="mb-2 text-xs font-sans-semibold uppercase tracking-[2px] text-gold-deep">
          Your workspace
        </Text>
        <Text className="font-display text-3xl text-navy">Resources</Text>
      </View>

      {/* ── Shared with you ─────────────────────────────────────────── */}
      <Text className="mb-3 font-display text-lg text-navy">Shared with you</Text>

      {resources.length === 0 ? (
        <Card className="mb-10 items-center py-12">
          <Text className="mb-3 text-4xl">📂</Text>
          <Text className="text-center font-sans text-sm text-slate">
            Documents your coach shares with you will appear here.
          </Text>
        </Card>
      ) : (
        <View className="mb-12 gap-8">
          {Object.entries(grouped).map(([coachName, folders]) => (
            <View key={coachName}>
              <View className="mb-3 flex-row items-center gap-2">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-gold">
                  <Text className="font-sans-bold text-sm text-navy-deep">
                    {coachName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text className="font-display text-base text-navy">{coachName}</Text>
              </View>

              <View className="gap-4">
                {Object.entries(folders).map(([folder, items]) => (
                  <Card key={folder}>
                    <View className="mb-3 flex-row items-center gap-2">
                      <Feather name="folder" size={14} color={colors.goldDeep} />
                      <Text className="font-sans-semibold text-sm text-gold-deep">
                        {folder}
                      </Text>
                    </View>

                    <View className="gap-2">
                      {items.map((r) => (
                        <View
                          key={r.id}
                          className="flex-row items-center gap-3 rounded-xl border border-gold/10 bg-cream px-3 py-2.5"
                        >
                          <Feather
                            name={r.is_link ? "link" : "file"}
                            size={18}
                            color={colors.gold}
                          />
                          <View className="min-w-0 flex-1">
                            <Text
                              className="font-sans-semibold text-navy"
                              numberOfLines={1}
                            >
                              {r.title}
                            </Text>
                            {r.description ? (
                              <Text
                                className="font-sans text-xs text-slate"
                                numberOfLines={1}
                              >
                                {r.description}
                              </Text>
                            ) : null}
                          </View>

                          {!r.is_link ? (
                            <Text className="font-sans text-xs text-slate-light">
                              {fmtSize(r.file_size)}
                            </Text>
                          ) : null}

                          {r.is_link ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onPress={() => Linking.openURL(r.link_url)}
                            >
                              <Feather
                                name="external-link"
                                size={13}
                                color={colors.goldDeep}
                              />
                              <Text className="font-sans-semibold text-sm text-gold-deep">
                                Open
                              </Text>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              loading={busy === `r${r.id}`}
                              onPress={() => download(r)}
                            >
                              <Feather name="download" size={13} color={colors.goldDeep} />
                              <Text className="font-sans-semibold text-sm text-gold-deep">
                                Download
                              </Text>
                            </Button>
                          )}
                        </View>
                      ))}
                    </View>
                  </Card>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── Upload to your coach ────────────────────────────────────── */}
      <Text className="mb-3 font-display text-lg text-navy">Send a file to your coach</Text>

      <Card className="mb-6">
        <View className="mb-4 flex-row items-start gap-2">
          <Feather name="upload-cloud" size={16} color={colors.gold} />
          <Text className="flex-1 font-sans text-sm text-slate">
            Upload a signed contract, completed assessment, or assignment for your coach
            to review.
          </Text>
        </View>

        <Text className="mb-1.5 font-sans-medium text-sm text-navy">Coach</Text>
        <ChipPicker
          options={coaches.map((c) => ({ id: c.id, label: c.username }))}
          value={form.coach}
          onChange={(v) => setForm((f) => ({ ...f, coach: v, in_response_to: "" }))}
        />

        <Input
          label="Title"
          placeholder="e.g. Signed contract"
          value={form.title}
          onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
        />

        <Input
          label="Note (optional)"
          value={form.note}
          onChangeText={(v) => setForm((f) => ({ ...f, note: v }))}
          multiline
        />

        {responseOptions.length > 0 ? (
          <>
            <Text className="mb-1.5 font-sans-medium text-sm text-navy">
              In response to (optional)
            </Text>
            <ChipPicker
              options={responseOptions.map((r) => ({ id: r.id, label: r.title }))}
              value={form.in_response_to}
              onChange={(v) => setForm((f) => ({ ...f, in_response_to: v }))}
              allowEmpty
            />
          </>
        ) : null}

        <Pressable
          onPress={choose}
          className="mb-2 flex-row items-center gap-2 rounded-2xl border border-dashed border-gold/40 bg-cream px-4 py-3"
        >
          <Feather name="paperclip" size={15} color={colors.goldDeep} />
          <Text className="flex-1 font-sans text-sm text-slate" numberOfLines={1}>
            {form.file ? form.file.name : "Choose a file…"}
          </Text>
        </Pressable>
        <Text className="mb-4 font-sans text-xs text-slate-light">
          PDF, Word, images, etc. · max 50 MB
        </Text>

        <Button onPress={upload} loading={uploading} variant="gold" fullWidth>
          Send to coach
        </Button>
      </Card>

      {/* ── Your uploads ────────────────────────────────────────────── */}
      <Text className="mb-3 font-display text-lg text-navy">
        Your uploads ({submissions.length})
      </Text>

      {submissions.length === 0 ? (
        <Card className="items-center py-10">
          <Text className="text-center font-sans text-sm text-slate">
            Files you send to your coach will appear here.
          </Text>
        </Card>
      ) : (
        <View className="gap-2">
          {submissions.map((s) => {
            const st = STATUS_STYLE[s.status] || STATUS_STYLE.submitted;
            return (
              <Card key={s.id}>
                <View className="flex-row items-center gap-3">
                  <Feather name="file" size={18} color={colors.gold} />
                  <View className="min-w-0 flex-1">
                    <Text className="font-sans-semibold text-navy" numberOfLines={1}>
                      {s.title}
                    </Text>
                    <Text className="font-sans text-xs text-slate">
                      To {s.coach_username} · {fmtDate(s.created_at)}
                      {s.in_response_to_title ? ` · re: ${s.in_response_to_title}` : ""}
                    </Text>
                  </View>
                </View>

                <View className="mt-3 flex-row items-center gap-2">
                  <View
                    className={`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${st.tone}`}
                  >
                    <Feather name={st.icon} size={11} color={colors.slate} />
                    <Text className={`font-sans-semibold text-xs uppercase ${st.text}`}>
                      {s.status}
                    </Text>
                  </View>

                  <View className="flex-1" />

                  <Pressable
                    onPress={() => downloadOwn(s)}
                    disabled={busy === `s${s.id}`}
                    hitSlop={8}
                    className="rounded-full p-2"
                  >
                    <Feather name="download" size={15} color={colors.goldDeep} />
                  </Pressable>

                  <Pressable
                    onPress={() => deleteSubmission(s.id)}
                    hitSlop={8}
                    className="rounded-full p-2"
                  >
                    <Feather name="trash-2" size={14} color="#B91C1C" />
                  </Pressable>
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
