import { useCallback, useEffect, useState } from "react";
import { View, Text, Modal, Pressable, TextInput, ScrollView } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { Screen, Card, Button, Input, EmptyState } from "@/components/ui";
import WorkspaceTabs from "@/components/WorkspaceTabs";
import { toast } from "@/lib/toast";
import { downloadFile } from "@/lib/download";
import { pickFile, appendFile } from "@/lib/filePicker";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/Agreements.jsx.
//
// Shared by coach and client — the same screen renders both sides, exactly as
// on web. Coaches upload a document and counter-sign; clients sign or decline.

const STATUS = {
  sent: { label: "Awaiting signature", tone: "bg-amber-100", text: "text-amber-900", icon: "clock" },
  client_signed: {
    label: "Awaiting your counter-signature",
    tone: "bg-gold/15",
    text: "text-gold-deep",
    icon: "clock",
  },
  completed: { label: "Completed", tone: "bg-green-100", text: "text-green-900", icon: "check-circle" },
  declined: { label: "Declined", tone: "bg-red-100", text: "text-red-900", icon: "x-circle" },
};

// Sign / counter-sign / decline modal.
function ActionModal({ mode, doc, onClose, onSubmit }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const isDecline = mode === "decline";

  const submit = async () => {
    if (!isDecline && !value.trim()) {
      toast.error("Type your full name to sign.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(value.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-navy-deep/60 p-4">
        <View className="w-full max-w-md rounded-2xl bg-white p-6">
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="flex-1 font-display text-xl text-navy">
              {isDecline
                ? "Decline document"
                : mode === "counter"
                  ? "Counter-sign"
                  : "Sign document"}
            </Text>
            <Pressable onPress={onClose} hitSlop={8} className="rounded-full bg-navy/5 p-1.5">
              <Feather name="x" size={16} color={colors.slate} />
            </Pressable>
          </View>

          <Text className="mb-4 font-sans text-sm text-slate">{doc.title}</Text>

          {isDecline ? (
            <TextInput
              value={value}
              onChangeText={setValue}
              multiline
              placeholder="Reason (optional)…"
              placeholderTextColor={colors.slateLight}
              className="mb-5 min-h-[80px] rounded-xl border border-gold/30 bg-cream px-4 py-2.5 font-sans text-sm text-navy"
              style={{ textAlignVertical: "top" }}
            />
          ) : (
            <>
              <Text className="mb-2 text-xs font-sans-semibold uppercase tracking-wider text-slate">
                Type your full name
              </Text>
              <TextInput
                value={value}
                onChangeText={setValue}
                placeholder="e.g. Nathalie Chinje"
                placeholderTextColor={colors.slateLight}
                className="mb-2 rounded-xl border border-gold/30 bg-cream px-4 py-2.5 font-display text-lg italic text-navy"
              />
              <Text className="mb-5 font-sans text-xs text-slate-light">
                Typing your name and tapping below is your electronic signature
                (recorded with date, time and IP).
              </Text>
            </>
          )}

          <View className="flex-row gap-3">
            <Button variant="ghost" onPress={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              variant={isDecline ? "navy" : "gold"}
              onPress={submit}
              loading={busy}
              className="flex-1"
            >
              {isDecline ? "Decline" : "Sign"}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function Agreements() {
  const { isAuthenticated, isCoach, logout } = useAuth();
  const coach = isCoach();

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({ title: "", message: "", client: "", file: null });
  const [sending, setSending] = useState(false);
  const [modal, setModal] = useState(null); // { mode, doc }

  const fetchDocs = useCallback(async () => {
    if (!isAuthenticated) {
      logout();
      return;
    }
    setLoading(true);
    try {
      const reqs = [api.get("/signatures/")];
      if (coach) reqs.push(api.get("/resources/clients/"));
      const [d, cs] = await Promise.all(reqs);
      setDocs(d.data);
      if (coach && cs) setClients(cs.data);
    } catch {
      toast.error("Failed to load documents.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, coach, logout]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const choose = async () => {
    const file = await pickFile();
    if (file) setForm((f) => ({ ...f, file }));
  };

  const send = async () => {
    if (!form.title.trim() || !form.client || !form.file) {
      toast.error("Title, client and file are required.");
      return;
    }
    setSending(true);
    try {
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("message", form.message);
      fd.append("client", form.client);
      appendFile(fd, "file", form.file);
      await api.post("/signatures/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm({ title: "", message: "", client: "", file: null });
      toast.success("Sent to the client for signature.");
      fetchDocs();
    } catch (err) {
      toast.error(
        err.response?.data?.file?.[0] || err.response?.data?.detail || "Failed to send."
      );
    } finally {
      setSending(false);
    }
  };

  const runAction = async (mode, doc, value) => {
    try {
      const url = { sign: "sign", counter: "counter-sign", decline: "decline" }[mode];
      const body = mode === "decline" ? { reason: value } : { signature: value };
      const res = await api.post(`/signatures/${doc.id}/${url}/`, body);
      setDocs((ds) => ds.map((d) => (d.id === doc.id ? res.data : d)));
      setModal(null);
      toast.success(
        mode === "decline"
          ? "Document declined."
          : mode === "counter"
            ? "Counter-signed — document completed."
            : "Signed. Thank you!"
      );
    } catch (err) {
      toast.error(err.response?.data?.detail || "Action failed.");
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
    <Screen onRefresh={fetchDocs} refreshing={false}>
      <WorkspaceTabs />

      <View className="mb-8">
        <Text className="mb-1 text-xs font-sans-semibold uppercase tracking-[2px] text-gold-deep">
          E-Signatures
        </Text>
        <Text className="font-display text-3xl text-navy">Agreements</Text>
        <Text className="mt-1 font-sans text-sm text-slate">
          {coach
            ? "Send documents to clients to sign, then counter-sign to complete."
            : "Review and sign documents your coach sent you."}
        </Text>
      </View>

      {/* Coach: send form */}
      {coach ? (
        <Card className="mb-8">
          <View className="mb-3 flex-row items-center gap-2">
            <Feather name="upload-cloud" size={15} color={colors.gold} />
            <Text className="font-sans-bold text-sm text-navy">
              Send a document for signature
            </Text>
          </View>

          <Input
            label="Document title"
            placeholder="Document title"
            value={form.title}
            onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
          />

          <Text className="mb-1.5 font-sans-medium text-sm text-navy">Client</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 pb-1"
            className="mb-4"
          >
            {clients.map((c) => {
              const selected = String(form.client) === String(c.id);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setForm((f) => ({ ...f, client: String(c.id) }))}
                  className={`rounded-full px-4 py-2 ${
                    selected ? "bg-gold" : "border border-gold/25 bg-cream"
                  }`}
                >
                  <Text
                    className={`font-sans-medium text-sm ${
                      selected ? "text-navy-deep" : "text-slate"
                    }`}
                  >
                    {c.username}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Input
            label="Message to the client (optional)"
            placeholder="Message to the client (optional)…"
            value={form.message}
            onChangeText={(v) => setForm((f) => ({ ...f, message: v }))}
            multiline
          />

          <Pressable
            onPress={choose}
            className="mb-4 flex-row items-center gap-2 rounded-2xl border border-dashed border-gold/40 bg-cream px-4 py-3"
          >
            <Feather name="paperclip" size={15} color={colors.goldDeep} />
            <Text className="flex-1 font-sans text-sm text-slate" numberOfLines={1}>
              {form.file ? form.file.name : "Choose a file…"}
            </Text>
          </Pressable>

          <Button onPress={send} loading={sending} variant="gold" fullWidth>
            Send for signature
          </Button>
        </Card>
      ) : null}

      {/* Documents list */}
      {docs.length === 0 ? (
        <EmptyState
          icon="file-text"
          title="No documents yet"
          message={
            coach
              ? "Send a document above to get started."
              : "Documents your coach sends you will appear here."
          }
        />
      ) : (
        <View className="gap-4">
          {docs.map((d) => {
            const st = STATUS[d.status] || STATUS.sent;
            return (
              <Card key={d.id}>
                <View className="mb-2 flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="font-display text-lg text-navy">{d.title}</Text>
                    <Text className="mt-0.5 font-sans text-xs text-slate">
                      {coach ? `For ${d.client_name}` : `From ${d.coach_name}`}
                      {d.client_signed_at
                        ? ` · client signed ${new Date(d.client_signed_at).toLocaleDateString()}`
                        : ""}
                    </Text>
                  </View>
                  <View
                    className={`flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${st.tone}`}
                  >
                    <Feather name={st.icon} size={11} color={colors.slate} />
                    <Text className={`font-sans-semibold text-xs ${st.text}`}>
                      {st.label}
                    </Text>
                  </View>
                </View>

                {d.message ? (
                  <Text className="mb-3 font-sans text-sm text-slate">{d.message}</Text>
                ) : null}

                {d.status === "declined" && d.decline_reason ? (
                  <Text className="mb-3 font-sans text-sm text-red-700">
                    Reason: {d.decline_reason}
                  </Text>
                ) : null}

                <View className="flex-row flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() =>
                      downloadFile(`/signatures/${d.id}/download/`, `${d.title}.pdf`)
                    }
                  >
                    <Feather name="download" size={12} color={colors.goldDeep} />
                    <Text className="font-sans-semibold text-xs text-gold-deep">
                      Original
                    </Text>
                  </Button>

                  {/* Client actions */}
                  {!coach && d.status === "sent" ? (
                    <>
                      <Button
                        size="sm"
                        variant="gold"
                        onPress={() => setModal({ mode: "sign", doc: d })}
                      >
                        <Feather name="edit-3" size={12} color={colors.navyDeep} />
                        <Text className="font-sans-bold text-xs text-navy-deep">Sign</Text>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => setModal({ mode: "decline", doc: d })}
                      >
                        <Feather name="x-circle" size={12} color="#B91C1C" />
                        <Text className="font-sans-semibold text-xs text-red-700">
                          Decline
                        </Text>
                      </Button>
                    </>
                  ) : null}

                  {/* Coach action */}
                  {coach && d.status === "client_signed" ? (
                    <Button
                      size="sm"
                      variant="gold"
                      onPress={() => setModal({ mode: "counter", doc: d })}
                    >
                      <Feather name="edit-3" size={12} color={colors.navyDeep} />
                      <Text className="font-sans-bold text-xs text-navy-deep">
                        Counter-sign
                      </Text>
                    </Button>
                  ) : null}

                  {/* Completed: signed download */}
                  {d.status === "completed" && d.has_signed_file ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() =>
                        downloadFile(
                          `/signatures/${d.id}/download-signed/`,
                          `${d.title} (signed).pdf`
                        )
                      }
                    >
                      <Feather name="download" size={12} color="#2E7D32" />
                      <Text className="font-sans-bold text-xs text-green-800">
                        Signed copy
                      </Text>
                    </Button>
                  ) : null}
                </View>
              </Card>
            );
          })}
        </View>
      )}

      {modal ? (
        <ActionModal
          mode={modal.mode}
          doc={modal.doc}
          onClose={() => setModal(null)}
          onSubmit={(value) => runAction(modal.mode, modal.doc, value)}
        />
      ) : null}
    </Screen>
  );
}
