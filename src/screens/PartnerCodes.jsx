import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, Modal, Share, TextInput, ScrollView, Linking } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { Screen, Card, Button, Input } from "@/components/ui";
import ModalBackdrop from "@/components/ui/ModalBackdrop";
import { useAccessGuard } from "@/lib/accessGuard";
import { toast } from "@/lib/toast";
import { colors } from "@/theme/colors";

// Partner organisations (October Health Month), mirroring
// frontend/src/pages/PartnerCodes.jsx — each practice's code, how much of its
// allocation is used, and its anonymised report.
//
// Creating and editing a code stays on the website: it is a long form with dates
// and an offering picker, done once per practice at a desk. The phone carries
// what she actually reaches for — the numbers, and sending the invitation.

const Stat = ({ label, value, tone }) => (
  <View className="flex-1 rounded-xl border border-gold/15 bg-cream px-2 py-2.5">
    <Text className="text-center font-sans-bold text-base" style={{ color: tone || colors.navy }}>
      {value}
    </Text>
    <Text className="text-center font-sans text-[10px] uppercase tracking-wider text-slate-light">
      {label}
    </Text>
  </View>
);

export default function PartnerCodes() {
  const { requireCoach } = useAccessGuard();
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [patients, setPatients] = useState(null);
  const [invite, setInvite] = useState(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (requireCoach()) return;
    setLoading(true);
    try {
      const res = await api.get("/participation-codes/");
      setCodes(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch {
      toast.error("Couldn't load participation codes.");
    } finally {
      setLoading(false);
    }
  }, [requireCoach]);

  useEffect(() => {
    load();
  }, [load]);

  const openReport = async (c) => {
    try {
      const res = await api.get(`/participation-codes/${c.id}/report/`);
      setReport(res.data);
    } catch {
      toast.error("Couldn't load the report.");
    }
  };

  const openPatients = async (c) => {
    if (!c.clients_registered) return;
    try {
      const res = await api.get(`/participation-codes/${c.id}/patients/`);
      setPatients(res.data);
    } catch {
      toast.error("Couldn't load the patient list.");
    }
  };

  const openInvite = async (c) => {
    try {
      const res = await api.get(`/participation-codes/${c.id}/invitation/`);
      setInvite({
        id: c.id,
        organisation: c.organisation,
        code: c.code,
        to: (res.data.to || []).join(", "),
        subject: res.data.subject || "",
        body: res.data.body || "",
        sent_count: res.data.sent_count,
      });
    } catch {
      toast.error("Couldn't prepare the invitation.");
    }
  };

  const sendInvite = async () => {
    if (!invite.to.trim()) {
      toast.error("Add at least one email address.");
      return;
    }
    setSending(true);
    try {
      const res = await api.post(`/participation-codes/${invite.id}/invitation/`, {
        to: invite.to,
        subject: invite.subject,
        body: invite.body,
      });
      const { sent, failed } = res.data;
      if (sent) toast.success(`Invitation sent to ${sent} recipient${sent === 1 ? "" : "s"}.`);
      if (failed?.length) toast.error(`Couldn't send to: ${failed.join(", ")}`);
      setInvite(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Couldn't send the invitation.");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <Screen loading />;

  return (
    <Screen>
      <Text className="mb-1 font-display text-3xl text-navy">Partner Organisations</Text>
      <Text className="mb-6 font-sans text-sm text-slate">
        A code per practice, each with its own allocation. Send each one its invitation from here;
        create and edit codes on the website.
      </Text>

      {codes.length === 0 ? (
        <Card className="items-center py-14">
          <Feather name="briefcase" size={26} color={colors.slateLight} />
          <Text className="mt-3 font-sans-semibold text-navy">No partner organisations yet</Text>
          <Text className="mt-1 text-center font-sans text-sm text-slate">
            Create a code on the website, then send it with your invitation.
          </Text>
        </Card>
      ) : (
        codes.map((c) => {
          const used = c.sessions_used || 0;
          const pct = c.total_sessions
            ? Math.min(100, Math.round((used / c.total_sessions) * 100))
            : 0;
          return (
            <Card key={c.id} className="mb-3" style={{ opacity: c.active ? 1 : 0.65 }}>
              <View className="flex-row items-start justify-between gap-3">
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="rounded-lg bg-gold/15 px-2 py-1 font-sans-bold text-sm tracking-wider text-gold-deep">
                      {c.code}
                    </Text>
                    <Pressable
                      onPress={() => Share.share({ message: c.code })}
                      hitSlop={8}
                      accessibilityLabel={`Share code ${c.code}`}
                    >
                      <Feather name="share-2" size={14} color={colors.slateLight} />
                    </Pressable>
                    {!c.active ? (
                      <Text className="rounded-full bg-red-100 px-2 py-0.5 font-sans-semibold text-[10px] text-red-700">
                        Inactive
                      </Text>
                    ) : null}
                  </View>
                  <Text className="mt-1.5 font-display text-lg text-navy">{c.organisation}</Text>
                  {c.invite_sent_at ? (
                    <Text className="font-sans text-xs text-green-700">
                      Invitation sent {new Date(c.invite_sent_at).toLocaleDateString()}
                      {c.invite_sent_count > 1 ? ` · ${c.invite_sent_count} emails` : ""}
                    </Text>
                  ) : null}
                  <Text className="font-sans text-xs text-slate-light">
                    {c.skill_name || "Any offering"}
                    {c.valid_from && c.valid_until ? ` · ${c.valid_from} → ${c.valid_until}` : ""}
                  </Text>
                </View>
                <View className="items-end gap-2">
                  <Pressable
                    onPress={() => openInvite(c)}
                    className="flex-row items-center gap-1.5 rounded-full bg-gold px-3 py-1.5"
                  >
                    <Feather name="send" size={13} color={colors.navyDeep} />
                    <Text className="font-sans-bold text-xs text-navy-deep">
                      {c.invite_sent_count ? "Send again" : "Invite"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => openReport(c)}
                    className="flex-row items-center gap-1.5 rounded-full border border-gold/25 bg-gold/10 px-3 py-1.5"
                  >
                    <Feather name="bar-chart-2" size={13} color={colors.goldDeep} />
                    <Text className="font-sans-semibold text-xs text-gold-deep">Report</Text>
                  </Pressable>
                </View>
              </View>

              <View className="mt-3 flex-row flex-wrap items-center gap-4">
                <Pressable onPress={() => openPatients(c)} disabled={!c.clients_registered}>
                  <Text
                    className="font-sans text-sm"
                    style={{
                      color: c.clients_registered ? colors.goldDeep : colors.slate,
                      textDecorationLine: c.clients_registered ? "underline" : "none",
                    }}
                  >
                    {c.clients_registered} patient{c.clients_registered === 1 ? "" : "s"}
                  </Text>
                </Pressable>
                <Text className="font-sans text-sm text-slate">max {c.max_per_client} each</Text>
                <Text className="font-sans-semibold text-sm text-navy">
                  {used} of {c.total_sessions} used
                </Text>
              </View>
              <View className="mt-2 h-2 overflow-hidden rounded-full bg-navy/10">
                <View
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? "#B91C1C" : colors.gold }}
                />
              </View>
            </Card>
          );
        })
      )}

      <Modal
        visible={!!invite}
        transparent
        animationType="fade"
        onRequestClose={() => !sending && setInvite(null)}
      >
        <ModalBackdrop>
          <View className="max-h-[88%] w-full max-w-md rounded-2xl bg-white p-5">
            <View className="mb-1 flex-row items-start justify-between">
              <Text className="flex-1 font-display text-2xl text-navy">
                Invite {invite?.organisation}
              </Text>
              <Pressable onPress={() => !sending && setInvite(null)} hitSlop={8}>
                <Feather name="x" size={20} color={colors.slateLight} />
              </Pressable>
            </View>
            <Text className="mb-4 font-sans text-xs text-slate-light">
              Code {invite?.code} is already in the message. Edit anything before you send; each
              person gets their own copy.
            </Text>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Input
                label="To"
                value={invite?.to || ""}
                onChangeText={(v) => setInvite((i) => ({ ...i, to: v }))}
                placeholder="doctor@practice.co.za, reception@practice.co.za"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Input
                label="Subject"
                value={invite?.subject || ""}
                onChangeText={(v) => setInvite((i) => ({ ...i, subject: v }))}
              />
              <Text className="mb-1.5 font-sans-semibold text-xs uppercase tracking-wider text-gold-deep">
                Message
              </Text>
              <TextInput
                multiline
                value={invite?.body || ""}
                onChangeText={(v) => setInvite((i) => ({ ...i, body: v }))}
                className="mb-4 h-56 rounded-xl border border-gold/30 bg-cream px-3.5 py-3 font-sans text-sm leading-6 text-navy"
                textAlignVertical="top"
              />
            </ScrollView>

            <Button variant="gold" onPress={sendInvite} loading={sending} fullWidth>
              Send invitation
            </Button>
            <Text className="mt-2 text-center font-sans text-[11px] text-slate-light">
              Sent from dr-nath.com. Replies come to your enquiries inbox.
            </Text>
          </View>
        </ModalBackdrop>
      </Modal>

      <Modal
        visible={!!patients}
        transparent
        animationType="fade"
        onRequestClose={() => setPatients(null)}
      >
        <ModalBackdrop>
          <View className="max-h-[85%] w-full max-w-md rounded-2xl bg-white p-5">
            <View className="mb-1 flex-row items-start justify-between">
              <Text className="flex-1 font-display text-2xl text-navy">{patients?.organisation}</Text>
              <Pressable onPress={() => setPatients(null)} hitSlop={8}>
                <Feather name="x" size={20} color={colors.slateLight} />
              </Pressable>
            </View>
            <Text className="mb-4 font-sans text-xs text-slate-light">
              {patients?.patients?.length || 0} registered with code {patients?.code}. Contact details
              are yours only — the practice's report shows counts, never names.
            </Text>
            <ScrollView>
              {(patients?.patients || []).map((p) => (
                <View key={p.id} className="mb-2 rounded-xl border border-gold/15 bg-cream px-3.5 py-3">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="flex-1 font-sans-semibold text-navy" numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text className="font-sans-bold text-xs text-navy">
                      {p.sessions_booked}/{patients?.max_per_client || "—"}
                    </Text>
                  </View>
                  <Pressable onPress={() => Linking.openURL(`mailto:${p.email}`)}>
                    <Text className="mt-1 font-sans text-xs text-gold-deep" numberOfLines={1}>
                      {p.email}
                    </Text>
                  </Pressable>
                  {p.phone ? (
                    <Pressable onPress={() => Linking.openURL(`tel:${p.phone}`)}>
                      <Text className="mt-0.5 font-sans text-xs text-gold-deep">{p.phone}</Text>
                    </Pressable>
                  ) : (
                    <Text className="mt-0.5 font-sans text-xs text-slate-light">No phone given</Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </ModalBackdrop>
      </Modal>

      <Modal visible={!!report} transparent animationType="fade" onRequestClose={() => setReport(null)}>
        <ModalBackdrop>
          <View className="w-full max-w-md rounded-2xl bg-white p-5">
            <View className="mb-1 flex-row items-start justify-between">
              <Text className="flex-1 font-display text-2xl text-navy">{report?.organisation}</Text>
              <Pressable onPress={() => setReport(null)} hitSlop={8}>
                <Feather name="x" size={20} color={colors.slateLight} />
              </Pressable>
            </View>
            <Text className="mb-4 font-sans text-xs text-slate-light">
              Code {report?.code}
              {report?.window?.from ? ` · ${report.window.from} → ${report.window.until}` : ""}
            </Text>

            {report ? (
              <>
                <View className="mb-3 flex-row gap-2">
                  <Stat label="Allocated" value={report.allocation.total} />
                  <Stat label="Used" value={report.allocation.used} tone="#2E7D32" />
                  <Stat label="Left" value={report.allocation.left} />
                </View>
                <View className="mb-3 flex-row gap-2">
                  <Stat label="Patients" value={report.patients.registered} />
                  <Stat label="Booked" value={report.patients.booked_at_least_one} />
                  <Stat label="Avg each" value={report.patients.average_sessions_each} />
                </View>
                <View className="flex-row gap-2">
                  <Stat label="Done" value={report.sessions.completed} tone="#2E7D32" />
                  <Stat label="Upcoming" value={report.sessions.upcoming} />
                  <Stat label="Cancelled" value={report.sessions.cancelled} />
                  <Stat label="Missed" value={report.sessions.missed} tone="#B91C1C" />
                </View>
                <Text className="mt-4 font-sans text-xs leading-5 text-slate-light">
                  Counts only — what a patient discusses in coaching is never shared with their
                  practice. {report.patients.consented_to_share} of {report.patients.registered}{" "}
                  patients agreed to be included in a summary shared with {report.organisation}.
                </Text>
              </>
            ) : null}
          </View>
        </ModalBackdrop>
      </Modal>
    </Screen>
  );
}
