import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, TextInput } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { Screen, Card, Button, Input } from "@/components/ui";
import WorkspaceTabs from "@/components/WorkspaceTabs";
import { DateFilter } from "@/components/sessionUi";
import { toast } from "@/lib/toast";
import { confirm } from "@/lib/confirm";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/Forms.jsx — the template builder plus assignment
// and fill-in flows.
//
// Note: this page's yes_no answers are stored as booleans (true/false), unlike
// the Chemistry intake which stores "Yes"/"No" strings. That's why the fill-in
// renderer below is local rather than the shared @/components/QuestionField.

const Q_TYPES = [
  { value: "short_text", label: "Short text" },
  { value: "long_text", label: "Paragraph" },
  { value: "single_choice", label: "Single choice" },
  { value: "multi_choice", label: "Multiple choice" },
  { value: "rating", label: "Rating (1–5)" },
  { value: "yes_no", label: "Yes / No" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
];
const CHOICE = new Set(["single_choice", "multi_choice"]);
const KIND_LABEL = { intake: "Intake form", feedback: "Feedback survey", other: "Other" };

// Present a stored answer for a question type in a readable way.
function renderAnswer(q, a) {
  if (a === undefined || a === null || a === "" || (Array.isArray(a) && a.length === 0))
    return "—";
  if (q.type === "multi_choice") return Array.isArray(a) ? a.join(", ") : String(a);
  if (q.type === "yes_no") return a === true || a === "true" ? "Yes" : "No";
  if (q.type === "rating") return `${a} / 5`;
  return String(a);
}

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

// ── Template builder (create / edit) ─────────────────────────────────────────
function TemplateModal({ template, onClose, onSaved }) {
  const editing = !!template?.id;
  const [title, setTitle] = useState(template?.title || "");
  const [kind, setKind] = useState(template?.kind || "intake");
  const [description, setDescription] = useState(template?.description || "");
  const [skillId, setSkillId] = useState(template?.skill || "");
  const [skills, setSkills] = useState([]);
  const [questions, setQuestions] = useState(
    (template?.questions || []).map((q) => ({ ...q, options: q.options || [] }))
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get("/skills/")
      .then((r) => setSkills(Array.isArray(r.data) ? r.data : r.data.results || []))
      .catch(() => {});
  }, []);

  const addQ = () =>
    setQuestions((qs) => [
      ...qs,
      { label: "", type: "short_text", required: false, options: [] },
    ]);
  const updateQ = (i, patch) =>
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  const removeQ = (i) => setQuestions((qs) => qs.filter((_, idx) => idx !== i));
  const moveQ = (i, dir) =>
    setQuestions((qs) => {
      const j = i + dir;
      if (j < 0 || j >= qs.length) return qs;
      const copy = [...qs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const save = async () => {
    if (!title.trim()) {
      toast.error("Give the template a title.");
      return;
    }
    if (questions.length === 0) {
      toast.error("Add at least one question.");
      return;
    }
    for (const q of questions) {
      if (!q.label.trim()) {
        toast.error("Every question needs a label.");
        return;
      }
      if (CHOICE.has(q.type) && (q.options || []).filter((o) => o.trim()).length < 2) {
        toast.error(`"${q.label || "A choice question"}" needs at least two options.`);
        return;
      }
    }

    const payload = {
      title: title.trim(),
      kind,
      description: description.trim(),
      skill: kind === "intake" ? skillId || null : null,
      questions: questions.map((q) => ({
        ...(q.id ? { id: q.id } : {}),
        label: q.label.trim(),
        type: q.type,
        required: !!q.required,
        ...(CHOICE.has(q.type) ? { options: q.options.filter((o) => o.trim()) } : {}),
      })),
    };

    setSaving(true);
    try {
      if (editing) await api.patch(`/forms/templates/${template.id}/`, payload);
      else await api.post("/forms/templates/", payload);
      toast.success(editing ? "Template updated." : "Template created.");
      onSaved();
    } catch (err) {
      toast.error(
        err.response?.data?.questions?.[0] ||
          err.response?.data?.detail ||
          "Could not save the template."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-navy-deep/60 p-4">
        <View className="max-h-[90%] w-full max-w-2xl rounded-2xl bg-white">
          <View className="flex-row items-center justify-between border-b border-gold/20 p-5">
            <Text className="font-display text-xl text-navy">
              {editing ? "Edit template" : "New template"}
            </Text>
            <Pressable onPress={onClose} hitSlop={8} className="rounded-full bg-navy/5 p-1.5">
              <Feather name="x" size={16} color={colors.slate} />
            </Pressable>
          </View>

          <ScrollView contentContainerClassName="p-5">
            <Input value={title} onChangeText={setTitle} placeholder="Template title" />

            <Text className="mb-1.5 font-sans-medium text-sm text-navy">Kind</Text>
            <View className="mb-4 flex-row flex-wrap gap-2">
              {[
                { v: "intake", l: "Intake form" },
                { v: "feedback", l: "Feedback survey" },
                { v: "other", l: "Other" },
              ].map((k) => (
                <Chip
                  key={k.v}
                  label={k.l}
                  active={kind === k.v}
                  onPress={() => setKind(k.v)}
                />
              ))}
            </View>

            <Input
              value={description}
              onChangeText={setDescription}
              placeholder="Intro shown to the client (optional)…"
              multiline
            />

            {kind === "intake" ? (
              <View className="mb-4">
                <Text className="mb-1.5 font-sans-semibold text-xs text-slate">
                  Use as the intake form for a programme (optional)
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerClassName="gap-2 pb-1"
                >
                  <Chip
                    label="Not linked"
                    active={!skillId}
                    onPress={() => setSkillId("")}
                  />
                  {skills.map((s) => (
                    <Chip
                      key={s.id}
                      label={`${s.name}${s.is_chemistry ? " (Chemistry)" : ""}`}
                      active={String(skillId) === String(s.id)}
                      onPress={() => setSkillId(String(s.id))}
                    />
                  ))}
                </ScrollView>
                <Text className="mt-1 font-sans text-xs text-slate-light">
                  If this programme is a public Chemistry Session, visitors complete this
                  form before booking.
                </Text>
              </View>
            ) : null}

            <View className="gap-3">
              {questions.map((q, i) => (
                <View key={i} className="rounded-xl border border-gold/20 bg-cream p-4">
                  <View className="mb-2 flex-row items-center gap-2">
                    <Text className="font-sans-bold text-xs text-gold">Q{i + 1}</Text>
                    <View className="flex-1" />
                    <Pressable
                      onPress={() => moveQ(i, -1)}
                      disabled={i === 0}
                      hitSlop={6}
                      className={i === 0 ? "opacity-30" : ""}
                    >
                      <Feather name="chevron-up" size={14} color={colors.slate} />
                    </Pressable>
                    <Pressable
                      onPress={() => moveQ(i, 1)}
                      disabled={i === questions.length - 1}
                      hitSlop={6}
                      className={i === questions.length - 1 ? "opacity-30" : ""}
                    >
                      <Feather name="chevron-down" size={14} color={colors.slate} />
                    </Pressable>
                    <Pressable onPress={() => removeQ(i)} hitSlop={6}>
                      <Feather name="trash-2" size={14} color="#B91C1C" />
                    </Pressable>
                  </View>

                  <TextInput
                    value={q.label}
                    onChangeText={(v) => updateQ(i, { label: v })}
                    placeholder="Question text"
                    placeholderTextColor={colors.slateLight}
                    className="mb-2 rounded-lg border border-gold/30 bg-white px-3 py-2 font-sans text-sm text-navy"
                  />

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerClassName="gap-2 pb-1"
                    className="mb-2"
                  >
                    {Q_TYPES.map((t) => (
                      <Pressable
                        key={t.value}
                        onPress={() => updateQ(i, { type: t.value })}
                        className={`rounded-lg px-3 py-1.5 ${
                          q.type === t.value ? "bg-gold" : "border border-gold/30 bg-white"
                        }`}
                      >
                        <Text
                          className={`font-sans-medium text-xs ${
                            q.type === t.value ? "text-navy-deep" : "text-slate"
                          }`}
                        >
                          {t.label}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <Pressable
                    onPress={() => updateQ(i, { required: !q.required })}
                    className="flex-row items-center gap-1.5"
                    hitSlop={6}
                  >
                    <View
                      className={`h-4 w-4 items-center justify-center rounded border ${
                        q.required ? "border-gold bg-gold" : "border-gold/40 bg-white"
                      }`}
                    >
                      {q.required ? (
                        <Feather name="check" size={11} color={colors.navyDeep} />
                      ) : null}
                    </View>
                    <Text className="font-sans text-xs text-slate">Required</Text>
                  </Pressable>

                  {CHOICE.has(q.type) ? (
                    <TextInput
                      value={(q.options || []).join("\n")}
                      onChangeText={(v) => updateQ(i, { options: v.split("\n") })}
                      multiline
                      placeholder={"One option per line\ne.g. Career\nWellness"}
                      placeholderTextColor={colors.slateLight}
                      className="mt-2 min-h-[72px] rounded-lg border border-gold/30 bg-white px-3 py-2 font-sans text-sm text-navy"
                      style={{ textAlignVertical: "top" }}
                    />
                  ) : null}
                </View>
              ))}

              <Pressable
                onPress={addQ}
                className="items-center rounded-xl border border-dashed border-gold/40 bg-gold/5 py-2.5"
              >
                <Text className="font-sans-semibold text-sm text-gold-deep">
                  + Add question
                </Text>
              </Pressable>
            </View>
          </ScrollView>

          <View className="flex-row gap-3 border-t border-gold/20 p-5">
            <Button variant="ghost" onPress={onClose} className="flex-1">
              Cancel
            </Button>
            <Button variant="gold" onPress={save} loading={saving} className="flex-1">
              {editing ? "Save changes" : "Create template"}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Assign a template to a client ────────────────────────────────────────────
function AssignModal({ template, clients, onClose, onAssigned }) {
  const [client, setClient] = useState("");
  const [busy, setBusy] = useState(false);

  const assign = async () => {
    if (!client) {
      toast.error("Choose a client.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/forms/assignments/", { template: template.id, client });
      toast.success("Form sent to the client.");
      onAssigned();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not send the form.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-navy-deep/60 p-4">
        <View className="w-full max-w-md rounded-2xl bg-white p-6">
          <Text className="mb-1 font-display text-xl text-navy">Send form</Text>
          <Text className="mb-4 font-sans text-sm text-slate">{template.title}</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 pb-1"
            className="mb-5"
          >
            {clients.map((c) => (
              <Chip
                key={c.id}
                label={c.username}
                active={String(client) === String(c.id)}
                onPress={() => setClient(String(c.id))}
              />
            ))}
          </ScrollView>

          <View className="flex-row gap-3">
            <Button variant="ghost" onPress={onClose} className="flex-1">
              Cancel
            </Button>
            <Button variant="gold" onPress={assign} loading={busy} className="flex-1">
              Send
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── View a client's responses ────────────────────────────────────────────────
function ResponsesModal({ assignment, onClose }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-navy-deep/60 p-4">
        <View className="max-h-[90%] w-full max-w-lg rounded-2xl bg-white">
          <View className="flex-row items-center justify-between border-b border-gold/20 p-5">
            <View className="min-w-0 flex-1">
              <Text className="font-display text-lg text-navy">{assignment.title}</Text>
              <Text className="mt-0.5 font-sans text-xs text-slate">
                Response from {assignment.client_name}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} className="rounded-full bg-navy/5 p-1.5">
              <Feather name="x" size={16} color={colors.slate} />
            </Pressable>
          </View>

          <ScrollView contentContainerClassName="p-5 gap-4">
            {(assignment.questions_snapshot || []).map((q, i) => (
              <View key={q.id || i}>
                <Text className="font-sans-semibold text-sm text-navy">
                  {i + 1}. {q.label}
                </Text>
                <Text className="mt-0.5 font-sans text-sm text-slate">
                  {renderAnswer(q, assignment.answers?.[q.id])}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Client fills in an assigned form ─────────────────────────────────────────
function FillModal({ assignment, onClose, onSubmitted }) {
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (qid, val) => setAnswers((a) => ({ ...a, [qid]: val }));
  const toggleMulti = (qid, opt) =>
    setAnswers((a) => {
      const cur = Array.isArray(a[qid]) ? a[qid] : [];
      return {
        ...a,
        [qid]: cur.includes(opt) ? cur.filter((o) => o !== opt) : [...cur, opt],
      };
    });

  const submit = async () => {
    for (const q of assignment.questions_snapshot || []) {
      const v = answers[q.id];
      const empty =
        v === undefined || v === "" || v === null || (Array.isArray(v) && v.length === 0);
      if (q.required && empty) {
        toast.error(`"${q.label}" is required.`);
        return;
      }
    }
    setBusy(true);
    try {
      await api.post(`/forms/assignments/${assignment.id}/submit/`, { answers });
      toast.success("Thanks — your responses were sent.");
      onSubmitted();
    } catch (err) {
      toast.error(
        err.response?.data?.detail || "Could not submit. Please check your answers."
      );
    } finally {
      setBusy(false);
    }
  };

  const fieldCls =
    "rounded-lg border border-gold/30 bg-cream px-3 py-2 font-sans text-sm text-navy";

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-navy-deep/60 p-4">
        <View className="max-h-[90%] w-full max-w-lg rounded-2xl bg-white">
          <View className="flex-row items-center justify-between border-b border-gold/20 p-5">
            <View className="min-w-0 flex-1">
              <Text className="font-display text-lg text-navy" numberOfLines={1}>
                {assignment.title}
              </Text>
              <Text className="mt-0.5 font-sans text-xs text-slate">
                From {assignment.coach_name}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} className="rounded-full bg-navy/5 p-1.5">
              <Feather name="x" size={16} color={colors.slate} />
            </Pressable>
          </View>

          <ScrollView contentContainerClassName="p-5 gap-5">
            {assignment.description ? (
              <Text className="font-sans text-sm text-slate">{assignment.description}</Text>
            ) : null}

            {(assignment.questions_snapshot || []).map((q, i) => (
              <View key={q.id || i}>
                <Text className="mb-1.5 font-sans-semibold text-sm text-navy">
                  {i + 1}. {q.label}
                  {q.required ? <Text className="text-red-700"> *</Text> : null}
                </Text>

                {q.type === "short_text" ? (
                  <TextInput
                    value={answers[q.id] || ""}
                    onChangeText={(v) => set(q.id, v)}
                    placeholderTextColor={colors.slateLight}
                    className={fieldCls}
                  />
                ) : null}

                {q.type === "long_text" ? (
                  <TextInput
                    multiline
                    value={answers[q.id] || ""}
                    onChangeText={(v) => set(q.id, v)}
                    placeholderTextColor={colors.slateLight}
                    className={`${fieldCls} min-h-[72px]`}
                    style={{ textAlignVertical: "top" }}
                  />
                ) : null}

                {q.type === "number" ? (
                  <TextInput
                    keyboardType="numeric"
                    value={answers[q.id] != null ? String(answers[q.id]) : ""}
                    onChangeText={(v) => set(q.id, v)}
                    placeholderTextColor={colors.slateLight}
                    className={fieldCls}
                  />
                ) : null}

                {q.type === "date" ? (
                  <DateFilter
                    label=""
                    value={answers[q.id] || ""}
                    onChange={(v) => set(q.id, v)}
                  />
                ) : null}

                {q.type === "yes_no" ? (
                  <View className="flex-row gap-2">
                    {[
                      ["Yes", true],
                      ["No", false],
                    ].map(([lbl, val]) => (
                      <Chip
                        key={lbl}
                        label={lbl}
                        active={answers[q.id] === val}
                        onPress={() => set(q.id, val)}
                      />
                    ))}
                  </View>
                ) : null}

                {q.type === "rating" ? (
                  <View className="flex-row gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Pressable
                        key={n}
                        onPress={() => set(q.id, n)}
                        className={`h-9 w-9 items-center justify-center rounded-full ${
                          answers[q.id] === n ? "bg-gold" : "border border-gold/30 bg-cream"
                        }`}
                      >
                        <Text
                          className={`font-sans-bold text-sm ${
                            answers[q.id] === n ? "text-navy-deep" : "text-slate"
                          }`}
                        >
                          {n}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {q.type === "single_choice" ? (
                  <View className="gap-1.5">
                    {(q.options || []).map((opt) => (
                      <Pressable
                        key={opt}
                        onPress={() => set(q.id, opt)}
                        className="flex-row items-center gap-2"
                      >
                        <View
                          className={`h-4 w-4 items-center justify-center rounded-full border ${
                            answers[q.id] === opt
                              ? "border-gold bg-gold"
                              : "border-gold/40 bg-white"
                          }`}
                        />
                        <Text className="font-sans text-sm text-navy">{opt}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {q.type === "multi_choice" ? (
                  <View className="gap-1.5">
                    {(q.options || []).map((opt) => {
                      const checked =
                        Array.isArray(answers[q.id]) && answers[q.id].includes(opt);
                      return (
                        <Pressable
                          key={opt}
                          onPress={() => toggleMulti(q.id, opt)}
                          className="flex-row items-center gap-2"
                        >
                          <View
                            className={`h-4 w-4 items-center justify-center rounded border ${
                              checked ? "border-gold bg-gold" : "border-gold/40 bg-white"
                            }`}
                          >
                            {checked ? (
                              <Feather name="check" size={11} color={colors.navyDeep} />
                            ) : null}
                          </View>
                          <Text className="font-sans text-sm text-navy">{opt}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>

          <View className="flex-row gap-3 border-t border-gold/20 p-5">
            <Button variant="ghost" onPress={onClose} className="flex-1">
              Cancel
            </Button>
            <Button variant="gold" onPress={submit} loading={busy} className="flex-1">
              Submit responses
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Forms() {
  const { isAuthenticated, isCoach, logout } = useAuth();
  const coach = isCoach();

  const [tab, setTab] = useState("templates");
  const [templates, setTemplates] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editTemplate, setEditTemplate] = useState(null); // {} = new, {id...} = edit
  const [assignTemplate, setAssignTemplate] = useState(null);
  const [viewResponse, setViewResponse] = useState(null);
  const [fillTarget, setFillTarget] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!isAuthenticated) {
      logout();
      return;
    }
    setLoading(true);
    try {
      if (coach) {
        // Templates + the client picker are coach-only endpoints.
        const [t, a, c] = await Promise.all([
          api.get("/forms/templates/"),
          api.get("/forms/assignments/"),
          api.get("/resources/clients/"),
        ]);
        setTemplates(t.data);
        setAssignments(a.data);
        setClients(c.data);
      } else {
        const a = await api.get("/forms/assignments/");
        setAssignments(a.data);
      }
    } catch {
      toast.error("Failed to load forms.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, coach, logout]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const archive = async (t) => {
    const ok = await confirm(`Archive "${t.title}"? Existing responses are kept.`, {
      confirmLabel: "Archive",
    });
    if (!ok) return;
    try {
      await api.delete(`/forms/templates/${t.id}/`);
      toast.success("Template archived.");
      fetchAll();
    } catch {
      toast.error("Could not archive.");
    }
  };

  const duplicate = async (t) => {
    try {
      await api.post(`/forms/templates/${t.id}/duplicate/`);
      toast.success("Template duplicated.");
      fetchAll();
    } catch {
      toast.error("Could not duplicate.");
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

      <View className="mb-6">
        <Text className="mb-1 text-xs font-sans-semibold uppercase tracking-[2px] text-gold-deep">
          Template Builder
        </Text>
        <Text className="font-display text-3xl text-navy">Forms & Surveys</Text>
        <Text className="mt-1 font-sans text-sm text-slate">
          {coach
            ? "Build reusable intake forms and feedback surveys, then send them to clients and read their responses."
            : "Forms and surveys your coach has asked you to complete."}
        </Text>
      </View>

      {coach ? (
        <>
          <View className="mb-6 flex-row gap-2">
            {[
              ["templates", "Templates"],
              ["sent", "Sent forms"],
            ].map(([key, label]) => (
              <Chip
                key={key}
                label={label}
                active={tab === key}
                onPress={() => setTab(key)}
              />
            ))}
          </View>

          {/* Templates tab */}
          {tab === "templates" ? (
            <View className="gap-4">
              <Pressable
                onPress={() => setEditTemplate({})}
                className="items-center rounded-2xl border border-dashed border-gold/40 bg-white py-3"
              >
                <Text className="font-sans-bold text-sm text-gold-deep">+ New template</Text>
              </Pressable>

              {templates.length === 0 ? (
                <Card className="items-center border-dashed py-16">
                  <Feather name="file-text" size={22} color={colors.gold} />
                  <Text className="mt-3 text-center font-sans text-sm text-slate">
                    No templates yet — create your first intake form or survey.
                  </Text>
                </Card>
              ) : (
                templates.map((t) => (
                  <Card key={t.id}>
                    <Text className="font-display text-lg text-navy">{t.title}</Text>
                    <Text className="mt-0.5 font-sans text-xs text-slate">
                      {KIND_LABEL[t.kind] || t.kind} · {t.questions.length} question
                      {t.questions.length !== 1 ? "s" : ""} · sent {t.assignment_count}×
                    </Text>

                    <View className="mt-3 flex-row flex-wrap items-center gap-2">
                      <Button variant="gold" size="sm" onPress={() => setAssignTemplate(t)}>
                        Send to client
                      </Button>
                      <Button variant="ghost" size="sm" onPress={() => setEditTemplate(t)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onPress={() => duplicate(t)}>
                        Duplicate
                      </Button>
                      <Pressable
                        onPress={() => archive(t)}
                        className="flex-row items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5"
                      >
                        <Feather name="archive" size={12} color="#B91C1C" />
                        <Text className="font-sans-semibold text-xs text-red-700">
                          Archive
                        </Text>
                      </Pressable>
                    </View>
                  </Card>
                ))
              )}
            </View>
          ) : null}

          {/* Sent tab */}
          {tab === "sent" ? (
            assignments.length === 0 ? (
              <Card className="items-center border-dashed py-16">
                <Feather name="send" size={22} color={colors.gold} />
                <Text className="mt-3 text-center font-sans text-sm text-slate">
                  No forms sent yet. Send a template from the Templates tab.
                </Text>
              </Card>
            ) : (
              <View className="gap-3">
                {assignments.map((a) => {
                  const done = a.status === "completed";
                  return (
                    <Card key={a.id}>
                      <Text className="font-sans-semibold text-sm text-navy" numberOfLines={1}>
                        {a.title}
                      </Text>
                      <Text className="mt-0.5 font-sans text-xs text-slate">
                        For {a.client_name} · sent{" "}
                        {new Date(a.created_at).toLocaleDateString()}
                        {done && a.completed_at
                          ? ` · completed ${new Date(a.completed_at).toLocaleDateString()}`
                          : ""}
                      </Text>

                      <View className="mt-3 flex-row flex-wrap items-center gap-2">
                        <View
                          className={`flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${
                            done ? "bg-green-100" : "bg-amber-100"
                          }`}
                        >
                          <Feather
                            name={done ? "check-circle" : "clock"}
                            size={12}
                            color={done ? "#2E7D32" : "#92400E"}
                          />
                          <Text
                            className={`font-sans-semibold text-xs ${
                              done ? "text-green-900" : "text-amber-900"
                            }`}
                          >
                            {done ? "Completed" : "Awaiting"}
                          </Text>
                        </View>

                        {done ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onPress={() => setViewResponse(a)}
                          >
                            View responses
                          </Button>
                        ) : null}
                      </View>
                    </Card>
                  );
                })}
              </View>
            )
          ) : null}
        </>
      ) : null}

      {/* Client: forms assigned to me */}
      {!coach ? (
        assignments.length === 0 ? (
          <Card className="items-center border-dashed py-16">
            <Feather name="file-text" size={22} color={colors.gold} />
            <Text className="mt-3 text-center font-sans text-sm text-slate">
              No forms to complete right now. Anything your coach sends will appear here.
            </Text>
          </Card>
        ) : (
          <View className="gap-3">
            {assignments.map((a) => {
              const done = a.status === "completed";
              const qCount = (a.questions_snapshot || []).length;
              return (
                <Card key={a.id}>
                  <Text className="font-sans-semibold text-sm text-navy" numberOfLines={1}>
                    {a.title}
                  </Text>
                  <Text className="mt-0.5 font-sans text-xs text-slate">
                    From {a.coach_name}
                    {done && a.completed_at
                      ? ` · completed ${new Date(a.completed_at).toLocaleDateString()}`
                      : ` · ${qCount} question${qCount !== 1 ? "s" : ""}`}
                  </Text>

                  <View className="mt-3 flex-row flex-wrap items-center gap-2">
                    {done ? (
                      <>
                        <View className="flex-row items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1">
                          <Feather name="check-circle" size={12} color="#2E7D32" />
                          <Text className="font-sans-semibold text-xs text-green-900">
                            Completed
                          </Text>
                        </View>
                        <Button variant="ghost" size="sm" onPress={() => setViewResponse(a)}>
                          My answers
                        </Button>
                      </>
                    ) : (
                      <Button variant="gold" size="sm" onPress={() => setFillTarget(a)}>
                        Fill in
                      </Button>
                    )}
                  </View>
                </Card>
              );
            })}
          </View>
        )
      ) : null}

      {editTemplate ? (
        <TemplateModal
          template={editTemplate}
          onClose={() => setEditTemplate(null)}
          onSaved={() => {
            setEditTemplate(null);
            fetchAll();
          }}
        />
      ) : null}

      {assignTemplate ? (
        <AssignModal
          template={assignTemplate}
          clients={clients}
          onClose={() => setAssignTemplate(null)}
          onAssigned={() => {
            setAssignTemplate(null);
            setTab("sent");
            fetchAll();
          }}
        />
      ) : null}

      {viewResponse ? (
        <ResponsesModal
          assignment={viewResponse}
          onClose={() => setViewResponse(null)}
        />
      ) : null}

      {fillTarget ? (
        <FillModal
          assignment={fillTarget}
          onClose={() => setFillTarget(null)}
          onSubmitted={() => {
            setFillTarget(null);
            fetchAll();
          }}
        />
      ) : null}
    </Screen>
  );
}
