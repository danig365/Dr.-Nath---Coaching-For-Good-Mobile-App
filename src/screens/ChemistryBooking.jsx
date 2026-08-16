import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { Screen, Card, Button, Input } from "@/components/ui";
import MonthCalendar from "@/components/MonthCalendar";
import QuestionField from "@/components/QuestionField";
import { toast } from "@/lib/toast";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/ChemistryBooking.jsx — the free discovery call flow.

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtTime = (isoStr) =>
  new Date(isoStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const fmtLong = (key) =>
  key
    ? new Date(key + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

export default function ChemistryBooking() {
  const router = useRouter();

  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [step, setStep] = useState("intake"); // intake | calendar | done

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState({});

  const [slots, setSlots] = useState([]);
  const [selDate, setSelDate] = useState(null);
  const [selSlot, setSelSlot] = useState(null);
  const [booking, setBooking] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/bookings/chemistry/");
        setInfo(res.data);
      } catch {
        setUnavailable(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadSlots = async () => {
    try {
      const res = await api.get(`/bookings/slots/available/?skill=${info.skill_id}`);
      setSlots(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error("Couldn't load available times.");
    }
  };

  const slotsByDate = useMemo(() => {
    const m = {};
    slots.forEach((s) => {
      const k = dayKey(new Date(s.start_datetime));
      (m[k] ||= []).push(s);
    });
    Object.values(m).forEach((a) =>
      a.sort((x, y) => new Date(x.start_datetime) - new Date(y.start_datetime))
    );
    return m;
  }, [slots]);

  const calEvents = useMemo(
    () => Object.keys(slotsByDate).map((date) => ({ date })),
    [slotsByDate]
  );

  const submitIntake = () => {
    if (!name.trim()) return toast.error("Please enter your name.");
    if (!email.trim()) return toast.error("Please enter your email.");
    for (const q of info.intake.questions || []) {
      if (q.required) {
        const v = answers[q.id];
        if (v === undefined || v === "" || (Array.isArray(v) && !v.length))
          return toast.error(`Please answer: ${q.label}`);
      }
    }
    setStep("calendar");
    loadSlots();
  };

  const confirm = async () => {
    if (!selSlot) return toast.error("Please pick a time.");
    setBooking(true);
    try {
      const res = await api.post("/bookings/chemistry/book/", {
        name,
        email,
        answers,
        slot_id: selSlot.id,
      });
      setDone(res.data);
      setStep("done");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Couldn't complete the booking.");
    } finally {
      setBooking(false);
    }
  };

  if (loading) return <Screen loading />;

  if (unavailable) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <Feather name="calendar" size={40} color={colors.gold} />
          <Text className="mb-1 mt-4 font-display text-2xl text-navy">
            No free session right now
          </Text>
          <Text className="mb-5 text-center font-sans text-sm text-slate">
            A chemistry session isn't available at the moment. Please check back soon.
          </Text>
          <Button variant="gold" onPress={() => router.replace("/")}>
            Back home
          </Button>
        </View>
      </Screen>
    );
  }

  const dayTimes = selDate ? slotsByDate[selDate] || [] : [];
  const stepIdx = ["intake", "calendar", "done"].indexOf(step);

  return (
    <Screen>
      {/* Hero */}
      <View className="mb-5 rounded-2xl bg-navy px-5 py-5">
        <Text className="mb-1 text-[11px] font-sans-semibold uppercase tracking-[2px] text-gold">
          Free discovery call
        </Text>
        <Text className="mb-1 font-display text-2xl text-cream">{info.name}</Text>
        <Text className="font-sans text-sm text-slate-light">
          with {info.coach_name} · no charge
        </Text>
      </View>

      {/* Stepper */}
      <View className="mb-5 flex-row items-center gap-2">
        {["Your details", "Pick a time", "Done"].map((label, i) => {
          const active = i <= stepIdx;
          return (
            <View key={label} className="flex-row items-center gap-2">
              <View
                className={`h-6 w-6 items-center justify-center rounded-full ${
                  active ? "bg-gold" : "bg-navy/10"
                }`}
              >
                <Text
                  className={`font-sans-semibold text-xs ${
                    active ? "text-navy-deep" : "text-slate"
                  }`}
                >
                  {i + 1}
                </Text>
              </View>
              <Text
                className={`font-sans-semibold text-xs ${
                  active ? "text-navy" : "text-slate"
                }`}
              >
                {label}
              </Text>
              {i < 2 ? <View className="h-px w-4 bg-navy/15" /> : null}
            </View>
          );
        })}
      </View>

      <Card>
        {/* STEP 1 — INTAKE */}
        {step === "intake" ? (
          <View>
            {info.intake.description ? (
              <Text className="mb-4 font-sans text-sm text-slate">
                {info.intake.description}
              </Text>
            ) : null}

            <Input
              label="Your name *"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
            <Input
              label="Your email *"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {(info.intake.questions || []).map((q) => (
              <View key={q.id} className="mb-4">
                <Text className="mb-1.5 font-sans-semibold text-sm text-navy">
                  {q.label}
                  {q.required ? <Text className="text-red-700"> *</Text> : null}
                </Text>
                <QuestionField
                  q={q}
                  value={answers[q.id]}
                  onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
                />
              </View>
            ))}

            <Button variant="gold" onPress={submitIntake}>
              Continue to calendar →
            </Button>
          </View>
        ) : null}

        {/* STEP 2 — CALENDAR */}
        {step === "calendar" ? (
          <View>
            <Pressable
              onPress={() => setStep("intake")}
              className="mb-4 flex-row items-center gap-1.5"
            >
              <Feather name="arrow-left" size={13} color={colors.slate} />
              <Text className="font-sans-semibold text-xs text-slate">
                Back to your details
              </Text>
            </Pressable>

            {slots.length === 0 ? (
              <Text className="py-8 text-center font-sans text-sm text-slate">
                No open times right now — please check back soon.
              </Text>
            ) : (
              <View className="gap-5">
                <View className="rounded-xl border border-gold/15 bg-cream p-3">
                  <MonthCalendar
                    events={calEvents}
                    selected={selDate}
                    onSelect={(d) => {
                      setSelDate(d);
                      setSelSlot(null);
                    }}
                    initialMonth={calEvents[0]?.date?.slice(0, 7)}
                  />
                </View>

                <View>
                  <Text className="mb-2 text-xs font-sans-semibold uppercase tracking-wider text-slate-light">
                    {selDate ? fmtLong(selDate) : "Pick a date with a •"}
                  </Text>

                  {selDate ? (
                    <View className="flex-row flex-wrap gap-2">
                      {dayTimes.map((s) => {
                        const active = selSlot?.id === s.id;
                        return (
                          <Pressable
                            key={s.id}
                            onPress={() => setSelSlot(s)}
                            className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-2 ${
                              active ? "bg-navy" : "border border-gold/30 bg-white"
                            }`}
                          >
                            <Feather
                              name="clock"
                              size={12}
                              color={active ? colors.cream : colors.navy}
                            />
                            <Text
                              className={`font-sans-semibold text-sm ${
                                active ? "text-cream" : "text-navy"
                              }`}
                            >
                              {fmtTime(s.start_datetime)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <Text className="font-sans text-sm text-slate">
                      Highlighted dates have open times.
                    </Text>
                  )}

                  {selSlot ? (
                    <Button
                      variant="gold"
                      onPress={confirm}
                      loading={booking}
                      className="mt-5"
                      fullWidth
                    >
                      Confirm free session
                    </Button>
                  ) : null}
                </View>
              </View>
            )}
          </View>
        ) : null}

        {/* STEP 3 — DONE */}
        {step === "done" ? (
          <View className="items-center py-8">
            <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <Feather name="check-circle" size={26} color="#2E7D32" />
            </View>
            <Text className="mb-2 font-display text-2xl text-navy">You're booked!</Text>
            <Text className="mb-1 text-center font-sans text-sm text-slate">
              Your free chemistry session with {info.coach_name} is confirmed.
            </Text>
            <Text className="mb-6 text-center font-sans text-sm text-slate">
              {done?.account_created ? (
                <>
                  We've emailed <Text className="font-sans-bold text-navy">{email}</Text> a
                  link to activate your account and view your session.
                </>
              ) : (
                <>
                  Check <Text className="font-sans-bold text-navy">{email}</Text> for your
                  booking confirmation.
                </>
              )}
            </Text>
            <Button variant="gold" onPress={() => router.replace("/login")}>
              Go to sign in
            </Button>
          </View>
        ) : null}
      </Card>
    </Screen>
  );
}
