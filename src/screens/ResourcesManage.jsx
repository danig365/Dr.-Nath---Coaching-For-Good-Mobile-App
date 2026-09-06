import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, Linking } from "react-native";
import { useLocalSearchParams } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { Screen, Card, Button, Input, Select, ModalBackdrop } from "@/components/ui";
import WorkspaceTabs from "@/components/WorkspaceTabs";
import { toast } from "@/lib/toast";
import { downloadResource, downloadSubmission } from "@/lib/download";
import { pickFile, appendFile } from "@/lib/filePicker";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/ResourcesManage.jsx — the coach's resource library
// and the client-submission inbox.

// Mirror the backend allowlist + cap (resources/serializers.py).
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "application/zip",
]);
const ALLOWED_HINT =
  "PDF, Word, PowerPoint, Excel, text/CSV, images, video, audio, ZIP · max 50 MB";

// Returns an error string if the file is invalid, else null. Empty content type
// is allowed through — the server makes the final call.
const fileError = (f) => {
  if (!f) return null;
  if (f.size > MAX_FILE_BYTES) return `"${f.name}" is larger than 50 MB.`;
  if (f.mimeType && !ALLOWED_TYPES.has(f.mimeType))
    return `"${f.name}" is not an allowed file type.`;
  return null;
};

const SUB_STATUS_TONE = {
  submitted: { bg: "bg-gold/15", text: "text-gold-deep", icon: "clock" },
  reviewed: { bg: "bg-green-100", text: "text-green-900", icon: "check-circle" },
};

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

const VIS_LABEL = {
  all_platform: "All clients",
  all_clients: "Booked coachees",
  specific: "Specific clients",
  group: "Group session",
};
const VIS_TONE = {
  all_platform: { bg: "bg-green-100", text: "text-green-900" },
  all_clients: { bg: "bg-green-100", text: "text-green-900" },
  specific: { bg: "bg-gold/15", text: "text-gold-deep" },
  group: { bg: "bg-navy/10", text: "text-navy" },
};

const fmtSize = (b) =>
  b == null
    ? "—"
    : b < 1024
      ? `${b} B`
      : b < 1048576
        ? `${(b / 1024).toFixed(0)} KB`
        : `${(b / 1048576).toFixed(1)} MB`;

const emptyForm = {
  title: "",
  description: "",
  folder: "",
  visibility: "all_clients",
  shared_clients: [],
  group_session: "",
  file: null,
  kind: "file",
  link_url: "",
};

function Chip({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full px-4 py-2 ${
        active ? "bg-gold" : "border border-gold/30 bg-cream"
      }`}
    >
      <Text
        className={`font-sans-medium text-sm ${active ? "text-navy-deep" : "text-slate"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function FieldLabel({ children }) {
  return (
    <Text className="mb-1.5 text-[10px] font-sans-semibold uppercase tracking-wider text-slate">
      {children}
    </Text>
  );
}

export default function ResourcesManage() {
  const { isAuthenticated, isCoach, logout } = useAuth();
  const params = useLocalSearchParams();

  const [folders, setFolders] = useState([]);
  const [resources, setResources] = useState([]);
  const [clients, setClients] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newFolder, setNewFolder] = useState("");
  const [newFolderClient, setNewFolderClient] = useState(""); // "" = shared; id = private
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [edit, setEdit] = useState(null);
  const [submissions, setSubmissions] = useState([]);

  // Active sub-section is driven by the WorkspaceTabs row (?tab=inbox), so
  // Library / Client Submissions live alongside Agreements & Forms.
  const tab = params.tab === "inbox" ? "inbox" : "manage";

  const fetchAll = useCallback(async () => {
    if (!isAuthenticated || !isCoach()) {
      logout();
      return;
    }
    setLoading(true);
    try {
      const [f, r, c, g, s] = await Promise.all([
        api.get("/resources/folders/"),
        api.get("/resources/"),
        api.get("/resources/clients/"),
        api.get("/bookings/group-sessions/"),
        api.get("/resources/submissions/"),
      ]);
      setFolders(f.data);
      setResources(r.data);
      setClients(c.data);
      setGroups(g.data);
      setSubmissions(s.data);
    } catch (err) {
      toast.error("Failed to load resources.");
      if (err.response?.status === 401) logout();
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isCoach, logout]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const buildForm = (data) => {
    const fd = new FormData();
    fd.append("title", data.title);
    fd.append("description", data.description || "");
    if (data.folder) fd.append("folder", data.folder);
    fd.append("visibility", data.visibility);
    if (data.visibility === "specific")
      data.shared_clients.forEach((id) => fd.append("shared_clients", id));
    if (data.visibility === "group" && data.group_session)
      fd.append("group_session", data.group_session);
    if (data.kind === "link") fd.append("link_url", data.link_url || "");
    else if (data.file) appendFile(fd, "file", data.file);
    return fd;
  };

  const createFolder = async () => {
    if (!newFolder.trim()) return;
    try {
      const payload = { name: newFolder.trim() };
      if (newFolderClient) payload.client = newFolderClient;
      const res = await api.post("/resources/folders/", payload);
      setFolders((f) => [...f, res.data]);
      setNewFolder("");
      setNewFolderClient("");
      toast.success(res.data.is_private ? "Private client folder created." : "Folder created.");
    } catch (err) {
      toast.error(
        err.response?.data?.name?.[0] ||
          err.response?.data?.client?.[0] ||
          err.response?.data?.detail ||
          "Failed to create folder."
      );
    }
  };

  const deleteFolder = async (id) => {
    try {
      await api.delete(`/resources/folders/${id}/`);
      setFolders((f) => f.filter((x) => x.id !== id));
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete folder.");
    }
  };

  const chooseFile = async (setter) => {
    const f = await pickFile();
    if (f) setter(f);
  };

  const upload = async () => {
    if (!form.title.trim()) {
      toast.error("A title is required.");
      return;
    }
    if (form.kind === "link") {
      if (!form.link_url.trim()) {
        toast.error("Enter a link URL.");
        return;
      }
    } else {
      if (!form.file) {
        toast.error("Choose a file to upload.");
        return;
      }
      const fe = fileError(form.file);
      if (fe) {
        toast.error(fe);
        return;
      }
    }
    if (form.visibility === "group" && !form.group_session) {
      toast.error("Pick a group session.");
      return;
    }
    if (form.visibility === "specific" && form.shared_clients.length === 0) {
      toast.error("Pick at least one client.");
      return;
    }

    setUploading(true);
    try {
      const res = await api.post("/resources/", buildForm(form));
      const n = form.visibility === "specific" ? form.shared_clients.length : 0;
      setResources((r) => [res.data, ...r]);
      setForm(emptyForm);
      toast.success(
        n ? `Shared — emailed to ${n} client${n === 1 ? "" : "s"}.` : "Resource uploaded."
      );
    } catch (err) {
      toast.error(
        err.response?.data?.file?.[0] || err.response?.data?.detail || "Upload failed."
      );
    } finally {
      setUploading(false);
    }
  };

  const deleteResource = async (id) => {
    try {
      await api.delete(`/resources/${id}/`);
      setResources((r) => r.filter((x) => x.id !== id));
      toast.success("Deleted.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete.");
    }
  };

  const saveEdit = async () => {
    const fe = fileError(edit.file);
    if (fe) {
      toast.error(fe);
      return;
    }
    try {
      let res;
      if (edit.file) {
        res = await api.patch(`/resources/${edit.id}/`, buildForm(edit));
      } else {
        const payload = {
          title: edit.title,
          description: edit.description || "",
          folder: edit.folder || null,
          visibility: edit.visibility,
          shared_clients: edit.visibility === "specific" ? edit.shared_clients : [],
          group_session: edit.visibility === "group" ? edit.group_session : null,
        };
        // Only a link resource may update its URL (sending link_url on a file
        // resource would switch it to a link and drop the file).
        if (edit.is_link) {
          if (!edit.link_url?.trim()) {
            toast.error("Enter a link URL.");
            return;
          }
          payload.link_url = edit.link_url.trim();
        }
        res = await api.patch(`/resources/${edit.id}/`, payload);
      }
      setResources((r) => r.map((x) => (x.id === edit.id ? res.data : x)));
      setEdit(null);
      toast.success("Saved.");
    } catch (err) {
      toast.error(
        err.response?.data?.detail || err.response?.data?.file?.[0] || "Failed to save."
      );
    }
  };

  const download = async (r) => {
    try {
      await downloadResource(r.id, r.title);
    } catch {
      toast.error("Download failed.");
    }
  };

  // ── Client submissions (inbox) ──
  const submissionsByClient = useMemo(() => {
    const m = {};
    submissions.forEach((s) => {
      (m[s.client_username || "Client"] ||= []).push(s);
    });
    return m;
  }, [submissions]);

  const downloadSub = async (s) => {
    try {
      await downloadSubmission(s.id, s.title);
    } catch {
      toast.error("Download failed.");
    }
  };

  const markReviewed = async (s) => {
    try {
      const res = await api.patch(`/resources/submissions/${s.id}/mark-reviewed/`);
      setSubmissions((arr) => arr.map((x) => (x.id === s.id ? res.data : x)));
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update.");
    }
  };

  const deleteSubmission = async (s) => {
    try {
      await api.delete(`/resources/submissions/${s.id}/`);
      setSubmissions((arr) => arr.filter((x) => x.id !== s.id));
      toast.success("Removed.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to remove.");
    }
  };

  const selectedFolder = folders.find((f) => String(f.id) === String(form.folder));
  const privateFolder = selectedFolder?.is_private ? selectedFolder : null;

  const toggleSharedClient = (id, current, setter) => {
    const arr = current.includes(String(id))
      ? current.filter((x) => x !== String(id))
      : [...current, String(id)];
    setter(arr);
  };

  if (loading) {
    return (
      <Screen>
        <WorkspaceTabs inbox={tab === "inbox"} />
        <Screen loading padded={false} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={fetchAll} refreshing={false}>
      <WorkspaceTabs inbox={tab === "inbox"} />

      <View className="mb-8">
        <Text className="mb-2 text-xs font-sans-semibold uppercase tracking-[2px] text-gold-deep">
          Coach workspace
        </Text>
      </View>

      {tab === "manage" ? (
        <>
          {/* Folders */}
          <Card className="mb-6 p-6">
            <View className="mb-4 flex-row items-center gap-2">
              <Feather name="folder" size={16} color={colors.gold} />
              <Text className="font-display text-lg text-navy">Folders</Text>
            </View>

            <View className="mb-4 flex-row flex-wrap gap-2">
              {folders.length === 0 ? (
                <Text className="font-sans text-sm text-slate">No folders yet.</Text>
              ) : null}
              {folders.map((f) => (
                <View
                  key={f.id}
                  className={`flex-row items-center gap-2 rounded-full px-3 py-1.5 ${
                    f.is_private ? "border border-blue-200 bg-blue-50" : "bg-gold/15"
                  }`}
                >
                  <Feather
                    name={f.is_private ? "lock" : "folder"}
                    size={12}
                    color={f.is_private ? "#0A66C2" : colors.goldDeep}
                  />
                  <Text
                    className={`font-sans text-sm ${
                      f.is_private ? "text-blue-700" : "text-gold-deep"
                    }`}
                  >
                    {f.name}
                    {f.is_private && f.client_username ? ` · ${f.client_username}` : ""} (
                    {f.resource_count})
                  </Text>
                  <Pressable onPress={() => deleteFolder(f.id)} hitSlop={6}>
                    <Feather name="x" size={13} color={colors.slate} />
                  </Pressable>
                </View>
              ))}
            </View>

            <Input
              value={newFolder}
              onChangeText={setNewFolder}
              placeholder="New folder name (e.g. Month 1)"
            />

            <FieldLabel>Make this a private folder for one client</FieldLabel>
            {/* A dropdown, not a chip row: this list is a coach's whole client
                base, so it only grows. Searchable for the same reason. */}
            <Select
              value={newFolderClient}
              onChange={(v) => setNewFolderClient(v)}
              searchable={clients.length > 8}
              className="mb-3"
              options={[
                { label: "Shared folder — visible to everyone", value: "" },
                ...clients.map((c) => ({ label: `🔒 ${c.username}`, value: String(c.id) })),
              ]}
            />

            {newFolderClient ? (
              <Text className="mb-3 font-sans text-xs text-blue-700">
                🔒 A private folder is visible only to that client — anything you put in it
                stays between you two.
              </Text>
            ) : null}

            <Button variant="ghost" size="sm" onPress={createFolder} className="self-start">
              + Add
            </Button>
          </Card>

          {/* Upload */}
          <Card className="mb-6 p-6">
            <View className="mb-4 flex-row items-center gap-2">
              <Feather name="upload-cloud" size={16} color={colors.gold} />
              <Text className="font-display text-lg text-navy">Upload a Resource</Text>
            </View>

            <Input
              label="Title"
              value={form.title}
              onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
            />
            <Input
              label="Description (optional)"
              value={form.description}
              onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
              multiline
            />

            <FieldLabel>Folder (optional)</FieldLabel>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2 pb-1"
              className="mb-4"
            >
              <Chip
                label="— None —"
                active={!form.folder}
                onPress={() => setForm((f) => ({ ...f, folder: "" }))}
              />
              {folders.map((f) => (
                <Chip
                  key={f.id}
                  label={f.is_private ? `🔒 ${f.name} · ${f.client_username}` : f.name}
                  active={String(form.folder) === String(f.id)}
                  onPress={() => setForm((x) => ({ ...x, folder: String(f.id) }))}
                />
              ))}
            </ScrollView>

            <FieldLabel>Share with</FieldLabel>
            {privateFolder ? (
              <View className="mb-4 flex-row items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
                <Feather name="lock" size={13} color="#0A66C2" />
                <Text className="flex-1 font-sans text-sm text-blue-700">
                  Private to {privateFolder.client_username} — only they can see files in
                  this folder.
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-2 pb-1"
                className="mb-4"
              >
                {[
                  ["all_platform", "All clients (incl. no booking)"],
                  ["all_clients", "Clients with a booking (coachees)"],
                  ["specific", "Specific clients"],
                  ["group", "A group session"],
                ].map(([v, label]) => (
                  <Chip
                    key={v}
                    label={label}
                    active={form.visibility === v}
                    onPress={() => setForm((f) => ({ ...f, visibility: v }))}
                  />
                ))}
              </ScrollView>
            )}

            {!privateFolder && form.visibility === "specific" ? (
              <View className="mb-4">
                <FieldLabel>Clients (tap to select multiple)</FieldLabel>
                <View className="flex-row flex-wrap gap-2">
                  {clients.map((c) => (
                    <Chip
                      key={c.id}
                      label={c.username}
                      active={form.shared_clients.includes(String(c.id))}
                      onPress={() =>
                        toggleSharedClient(c.id, form.shared_clients, (arr) =>
                          setForm((f) => ({ ...f, shared_clients: arr }))
                        )
                      }
                    />
                  ))}
                </View>
                <Text className="mt-1.5 font-sans text-xs text-slate">
                  ✉️ Selected clients are emailed a secure link to view this document.
                </Text>
              </View>
            ) : null}

            {!privateFolder && form.visibility === "group" ? (
              <View className="mb-4">
                <FieldLabel>Group session</FieldLabel>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerClassName="gap-2 pb-1"
                >
                  {groups.map((g) => (
                    <Chip
                      key={g.id}
                      label={g.title}
                      active={String(form.group_session) === String(g.id)}
                      onPress={() =>
                        setForm((f) => ({ ...f, group_session: String(g.id) }))
                      }
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <FieldLabel>Type</FieldLabel>
            <View className="mb-4 flex-row gap-2">
              {[
                ["file", "File"],
                ["link", "Link"],
              ].map(([key, label]) => (
                <Pressable
                  key={key}
                  onPress={() => setForm((f) => ({ ...f, kind: key }))}
                  className={`rounded-full px-4 py-1.5 ${
                    form.kind === key ? "bg-navy" : "border border-navy/10 bg-white"
                  }`}
                >
                  <Text
                    className={`font-sans-semibold text-sm ${
                      form.kind === key ? "text-cream" : "text-slate"
                    }`}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {form.kind === "link" ? (
              <Input
                label="Link URL"
                value={form.link_url}
                onChangeText={(v) => setForm((f) => ({ ...f, link_url: v }))}
                placeholder="https://… (e.g. the online assessment)"
                autoCapitalize="none"
              />
            ) : (
              <View className="mb-4">
                <FieldLabel>File</FieldLabel>
                <Pressable
                  onPress={() => chooseFile((f) => setForm((x) => ({ ...x, file: f })))}
                  className="flex-row items-center gap-2 rounded-2xl border border-dashed border-gold/40 bg-cream px-4 py-3"
                >
                  <Feather name="paperclip" size={15} color={colors.goldDeep} />
                  <Text className="flex-1 font-sans text-sm text-slate" numberOfLines={1}>
                    {form.file ? form.file.name : "Choose a file…"}
                  </Text>
                </Pressable>
                <Text className="mt-1 font-sans text-[11px] text-slate">
                  Allowed: {ALLOWED_HINT}
                </Text>
              </View>
            )}

            <Button variant="gold" onPress={upload} loading={uploading} fullWidth>
              {form.kind === "link" ? "Add Link" : "Upload"}
            </Button>
          </Card>

          {/* Resource list */}
          <Text className="mb-3 font-display text-lg text-navy">
            Your Resources ({resources.length})
          </Text>

          {resources.length === 0 ? (
            <Card className="items-center py-16">
              <Text className="mb-3 text-4xl">📁</Text>
              <Text className="font-sans text-sm text-slate">
                No resources yet. Upload one above.
              </Text>
            </Card>
          ) : (
            <View className="gap-2">
              {resources.map((r) => {
                const tone = VIS_TONE[r.visibility] || VIS_TONE.all_clients;
                return (
                  <Card key={r.id}>
                    <View className="flex-row items-center gap-3">
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
                        <Text className="font-sans text-xs text-slate">
                          {r.folder_name ? `${r.folder_name} · ` : ""}
                          {r.is_link ? "Link" : fmtSize(r.file_size)}
                          {r.visibility === "specific" && r.shared_client_usernames?.length
                            ? ` · ${r.shared_client_usernames.join(", ")}`
                            : ""}
                        </Text>
                      </View>
                    </View>

                    <View className="mt-3 flex-row items-center gap-2">
                      <View className={`rounded-full px-2.5 py-1 ${tone.bg}`}>
                        <Text
                          className={`text-[11px] font-sans-semibold uppercase ${tone.text}`}
                        >
                          {VIS_LABEL[r.visibility]}
                        </Text>
                      </View>

                      <View className="flex-1" />

                      <Pressable
                        onPress={() =>
                          r.is_link ? Linking.openURL(r.link_url) : download(r)
                        }
                        hitSlop={6}
                        className="rounded-full p-2"
                      >
                        <Feather
                          name={r.is_link ? "external-link" : "download"}
                          size={15}
                          color={colors.goldDeep}
                        />
                      </Pressable>

                      <Pressable
                        onPress={() =>
                          setEdit({
                            ...r,
                            folder: r.folder || "",
                            group_session: r.group_session || "",
                            shared_clients: [],
                            file: null,
                          })
                        }
                        hitSlop={6}
                        className="rounded-full p-2"
                      >
                        <Feather name="edit-2" size={14} color={colors.navy} />
                      </Pressable>

                      <Pressable
                        onPress={() => deleteResource(r.id)}
                        hitSlop={6}
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
        </>
      ) : null}

      {/* Client Submissions inbox */}
      {tab === "inbox" ? (
        submissions.length === 0 ? (
          <Card className="items-center py-16">
            <Text className="mb-3 text-4xl">📥</Text>
            <Text className="text-center font-sans text-sm text-slate">
              No client submissions yet. Files clients upload to you (signed contracts,
              assessments, assignments) appear here.
            </Text>
          </Card>
        ) : (
          <View className="gap-8">
            {Object.entries(submissionsByClient).map(([clientName, items]) => (
              <View key={clientName}>
                <View className="mb-3 flex-row items-center gap-2">
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-navy">
                    <Text className="font-sans-bold text-sm text-cream">
                      {clientName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text className="font-display text-base text-navy">{clientName}</Text>
                </View>

                <View className="gap-2">
                  {items.map((s) => {
                    const tone = SUB_STATUS_TONE[s.status] || SUB_STATUS_TONE.submitted;
                    return (
                      <Card key={s.id}>
                        <View className="flex-row items-center gap-3">
                          <Feather name="file" size={18} color={colors.gold} />
                          <View className="min-w-0 flex-1">
                            <Text
                              className="font-sans-semibold text-navy"
                              numberOfLines={1}
                            >
                              {s.title}
                            </Text>
                            <Text className="font-sans text-xs text-slate">
                              {fmtDate(s.created_at)} · {fmtSize(s.file_size)}
                              {s.in_response_to_title
                                ? ` · re: ${s.in_response_to_title}`
                                : ""}
                            </Text>
                            {s.note ? (
                              <Text className="mt-0.5 font-sans text-xs italic text-slate-light">
                                “{s.note}”
                              </Text>
                            ) : null}
                          </View>
                        </View>

                        <View className="mt-3 flex-row items-center gap-2">
                          <View
                            className={`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${tone.bg}`}
                          >
                            <Feather name={tone.icon} size={11} color={colors.slate} />
                            <Text
                              className={`text-[11px] font-sans-semibold uppercase ${tone.text}`}
                            >
                              {s.status}
                            </Text>
                          </View>

                          <View className="flex-1" />

                          <Pressable
                            onPress={() => downloadSub(s)}
                            hitSlop={6}
                            className="rounded-full p-2"
                          >
                            <Feather name="download" size={15} color={colors.goldDeep} />
                          </Pressable>

                          {s.status === "submitted" ? (
                            <Pressable
                              onPress={() => markReviewed(s)}
                              hitSlop={6}
                              className="rounded-full p-2"
                            >
                              <Feather name="check-circle" size={15} color="#2E7D32" />
                            </Pressable>
                          ) : null}

                          <Pressable
                            onPress={() => deleteSubmission(s)}
                            hitSlop={6}
                            className="rounded-full p-2"
                          >
                            <Feather name="trash-2" size={14} color="#B91C1C" />
                          </Pressable>
                        </View>
                      </Card>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )
      ) : null}

      {/* Edit modal */}
      {edit ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setEdit(null)}>
          <ModalBackdrop>
            <View className="max-h-[85%] w-full max-w-lg rounded-2xl border border-gold/20 bg-cream p-6">
              <View className="mb-4 flex-row items-center justify-between">
                <Text className="font-display text-xl text-navy">Edit Resource</Text>
                <Pressable onPress={() => setEdit(null)} hitSlop={8}>
                  <Feather name="x" size={18} color={colors.slate} />
                </Pressable>
              </View>

              <ScrollView>
                <Input
                  label="Title"
                  value={edit.title}
                  onChangeText={(v) => setEdit((s) => ({ ...s, title: v }))}
                />
                <Input
                  label="Description"
                  value={edit.description || ""}
                  onChangeText={(v) => setEdit((s) => ({ ...s, description: v }))}
                  multiline
                />

                <FieldLabel>Folder</FieldLabel>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerClassName="gap-2 pb-1"
                  className="mb-4"
                >
                  <Chip
                    label="— None —"
                    active={!edit.folder}
                    onPress={() => setEdit((s) => ({ ...s, folder: "" }))}
                  />
                  {folders.map((f) => (
                    <Chip
                      key={f.id}
                      label={f.name}
                      active={String(edit.folder) === String(f.id)}
                      onPress={() => setEdit((s) => ({ ...s, folder: String(f.id) }))}
                    />
                  ))}
                </ScrollView>

                <FieldLabel>Share with</FieldLabel>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerClassName="gap-2 pb-1"
                  className="mb-4"
                >
                  {[
                    ["all_clients", "All my coachees"],
                    ["specific", "Specific clients"],
                    ["group", "A group session"],
                  ].map(([v, label]) => (
                    <Chip
                      key={v}
                      label={label}
                      active={edit.visibility === v}
                      onPress={() => setEdit((s) => ({ ...s, visibility: v }))}
                    />
                  ))}
                </ScrollView>

                {edit.visibility === "specific" ? (
                  <View className="mb-4">
                    <FieldLabel>Clients (replaces current selection)</FieldLabel>
                    <View className="flex-row flex-wrap gap-2">
                      {clients.map((c) => (
                        <Chip
                          key={c.id}
                          label={c.username}
                          active={edit.shared_clients.includes(String(c.id))}
                          onPress={() =>
                            toggleSharedClient(c.id, edit.shared_clients, (arr) =>
                              setEdit((s) => ({ ...s, shared_clients: arr }))
                            )
                          }
                        />
                      ))}
                    </View>
                  </View>
                ) : null}

                {edit.visibility === "group" ? (
                  <View className="mb-4">
                    <FieldLabel>Group session</FieldLabel>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerClassName="gap-2 pb-1"
                    >
                      {groups.map((g) => (
                        <Chip
                          key={g.id}
                          label={g.title}
                          active={String(edit.group_session) === String(g.id)}
                          onPress={() =>
                            setEdit((s) => ({ ...s, group_session: String(g.id) }))
                          }
                        />
                      ))}
                    </ScrollView>
                  </View>
                ) : null}

                {edit.is_link ? (
                  <Input
                    label="Link URL"
                    value={edit.link_url || ""}
                    onChangeText={(v) => setEdit((s) => ({ ...s, link_url: v }))}
                    placeholder="https://…"
                    autoCapitalize="none"
                  />
                ) : (
                  <View className="mb-4">
                    <FieldLabel>Replace file (optional)</FieldLabel>
                    <Pressable
                      onPress={() => chooseFile((f) => setEdit((s) => ({ ...s, file: f })))}
                      className="flex-row items-center gap-2 rounded-2xl border border-dashed border-gold/40 bg-white px-4 py-3"
                    >
                      <Feather name="paperclip" size={15} color={colors.goldDeep} />
                      <Text
                        className="flex-1 font-sans text-sm text-slate"
                        numberOfLines={1}
                      >
                        {edit.file ? edit.file.name : "Choose a file…"}
                      </Text>
                    </Pressable>
                    <Text className="mt-1 font-sans text-[11px] text-slate">
                      Allowed: {ALLOWED_HINT}
                    </Text>
                  </View>
                )}
              </ScrollView>

              <View className="mt-5 flex-row justify-end gap-2">
                <Button variant="outline" size="sm" onPress={() => setEdit(null)}>
                  Cancel
                </Button>
                <Button variant="gold" size="sm" onPress={saveEdit}>
                  Save
                </Button>
              </View>
            </View>
          </ModalBackdrop>
        </Modal>
      ) : null}
    </Screen>
  );
}
