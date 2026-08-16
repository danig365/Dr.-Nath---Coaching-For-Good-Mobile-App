import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { Screen, Card, Button, Input } from "@/components/ui";
import PaymentForm from "@/components/PaymentForm";
import { toast } from "@/lib/toast";
import {
  clearPendingBooking,
  getPendingBooking,
  setPendingBooking,
} from "@/lib/pendingBooking";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/BookSessionPage.jsx.
//
// Card payment uses @stripe/stripe-react-native via @/components/PaymentForm —
// same hold -> PaymentIntent -> confirm flow as the web, with Stripe's native
// CardField in place of the web CardElement.

const fmtTime = (isoStr) =>
  new Date(isoStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const dayLabel = (isoStr) =>
  new Date(isoStr).toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

function FieldLabel({ icon, children }) {
  return (
    <View className="mb-2 flex-row items-center gap-2">
      <Feather name={icon} size={12} color={colors.gold} />
      <Text className="text-xs font-sans-semibold uppercase tracking-wider text-slate">
        {children}
      </Text>
    </View>
  );
}

function StepIndicator({ step }) {
  return (
    <View className="mb-8 flex-row items-center justify-center gap-3">
      {[
        { n: 1, label: "Details" },
        { n: 2, label: "Payment" },
      ].map(({ n, label }, i) => (
        <View key={n} className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-2">
            <View
              className={`h-7 w-7 items-center justify-center rounded-full ${
                step >= n ? "bg-gold" : "bg-gold/10"
              }`}
            >
              {step > n ? (
                <Feather name="check-circle" size={13} color={colors.navyDeep} />
              ) : (
                <Text
                  className={`font-sans-bold text-xs ${
                    step >= n ? "text-navy-deep" : "text-slate-light"
                  }`}
                >
                  {n}
                </Text>
              )}
            </View>
            <Text
              className={`font-sans-semibold text-xs ${
                step >= n ? "text-gold-deep" : "text-slate-light"
              }`}
            >
              {label}
            </Text>
          </View>
          {i < 1 ? <View className="h-px w-12 bg-gold/20" /> : null}
        </View>
      ))}
    </View>
  );
}

function SkillSummary({ skill, duration }) {
  const isFree = parseFloat(skill.price) === 0;
  const totalCost = ((parseFloat(skill.price) / 60) * parseInt(duration)).toFixed(2);

  return (
    <View className="mb-6 overflow-hidden rounded-2xl border border-gold/20">
      <View className="h-1 bg-gold" />
      <View className="bg-cream-warm p-5">
        <View className="flex-row items-start gap-4">
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-gold">
            <Text className="font-sans-bold text-lg text-navy-deep">
              {skill.mentor?.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View className="min-w-0 flex-1">
            <Text className="font-display text-base text-navy" numberOfLines={1}>
              {skill.title}
            </Text>
            <Text className="mt-0.5 font-sans text-xs text-slate">
              with {skill.mentor}
            </Text>
            {skill.avg_rating ? (
              <View className="mt-1 flex-row items-center gap-1">
                <Feather name="star" size={11} color={colors.gold} />
                <Text className="font-sans-semibold text-xs text-gold-deep">
                  {parseFloat(skill.avg_rating).toFixed(1)}
                </Text>
              </View>
            ) : null}
          </View>

          <View className="items-end">
            <Text className="font-sans text-xs text-slate">
              {isFree ? "No charge" : `$${parseFloat(skill.price).toFixed(2)}/hr`}
            </Text>
            <Text className="font-display text-base text-navy">
              {isFree ? "Free" : `$${totalCost}`}
            </Text>
            <Text className="font-sans text-xs text-slate">for {duration} min</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Slot Calendar ────────────────────────────────────────────────────────────
const localDateKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function SlotCalendar({ slots, selectedSlot, onSelectSlot }) {
  // Group available slots by their local calendar date.
  const slotsByDate = useMemo(() => {
    const m = {};
    slots.forEach((s) => {
      const k = localDateKey(new Date(s.start_datetime));
      (m[k] ||= []).push(s);
    });
    Object.values(m).forEach((arr) =>
      arr.sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime))
    );
    return m;
  }, [slots]);

  const firstAvailable = useMemo(() => {
    const ds = slots.map((s) => new Date(s.start_datetime)).sort((a, b) => a - b);
    return ds[0] || null;
  }, [slots]);

  const [viewMonth, setViewMonth] = useState(() => {
    const base = firstAvailable || new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() =>
    firstAvailable ? localDateKey(firstAvailable) : null
  );

  // Keep the calendar pointed at whatever slot is selected — this is what makes
  // an invite-link slot (auto-selected by the parent) show up on the right day
  // with its time highlighted.
  useEffect(() => {
    if (!selectedSlot) return;
    const d = new Date(selectedSlot.start_datetime);
    setSelectedDate(localDateKey(d));
    setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  }, [selectedSlot]);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const startWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Mon-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const monthLabel = viewMonth.toLocaleDateString([], { month: "long", year: "numeric" });
  const daySlots = selectedDate ? slotsByDate[selectedDate] || [] : [];

  return (
    <View className="gap-4">
      {/* Calendar card */}
      <View className="rounded-2xl border border-gold/20 bg-white p-4">
        <View className="mb-3 flex-row items-center justify-between">
          <Pressable
            onPress={() => setViewMonth(new Date(year, month - 1, 1))}
            hitSlop={8}
            className="h-8 w-8 items-center justify-center rounded-full"
          >
            <Feather name="chevron-left" size={16} color={colors.goldDeep} />
          </Pressable>
          <Text className="font-display text-sm text-navy">{monthLabel}</Text>
          <Pressable
            onPress={() => setViewMonth(new Date(year, month + 1, 1))}
            hitSlop={8}
            className="h-8 w-8 items-center justify-center rounded-full"
          >
            <Feather name="chevron-right" size={16} color={colors.goldDeep} />
          </Pressable>
        </View>

        <View className="mb-1 flex-row">
          {WEEKDAYS.map((w) => (
            <View key={w} className="flex-1 items-center py-1">
              <Text className="text-[10px] font-sans-semibold uppercase tracking-wider text-slate-light">
                {w}
              </Text>
            </View>
          ))}
        </View>

        <View className="flex-row flex-wrap">
          {cells.map((date, i) => {
            if (!date)
              return (
                <View
                  key={`b${i}`}
                  style={{ width: `${100 / 7}%` }}
                  className="aspect-square p-0.5"
                />
              );

            const key = localDateKey(date);
            const hasSlots = !!slotsByDate[key];
            const isSelected = key === selectedDate;
            const isPast = date < todayStart;

            return (
              <View key={key} style={{ width: `${100 / 7}%` }} className="aspect-square p-0.5">
                <Pressable
                  disabled={!hasSlots}
                  onPress={() => setSelectedDate(key)}
                  className={`flex-1 items-center justify-center rounded-xl ${
                    isSelected ? "bg-navy" : hasSlots ? "bg-gold/10" : "bg-transparent"
                  }`}
                >
                  <Text
                    className={`font-sans-medium text-sm ${
                      isSelected
                        ? "text-cream"
                        : hasSlots
                          ? "text-navy"
                          : isPast
                            ? "text-slate-light/50"
                            : "text-slate-light"
                    }`}
                  >
                    {date.getDate()}
                  </Text>
                  {hasSlots && !isSelected ? (
                    <View className="absolute bottom-1 h-1 w-1 rounded-full bg-gold" />
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </View>

        <View className="mt-3 flex-row items-center gap-1.5">
          <View className="h-2 w-2 rounded-full bg-gold" />
          <Text className="text-[11px] text-slate">Available dates</Text>
        </View>
      </View>

      {/* Times for the selected date */}
      <View>
        <View className="mb-2 flex-row items-center gap-2">
          <Feather name="clock" size={13} color={colors.gold} />
          <Text className="text-xs font-sans-semibold uppercase tracking-wider text-slate">
            Available Times
          </Text>
        </View>

        {daySlots.length === 0 ? (
          <Text className="py-3 text-center font-sans text-sm text-slate-light">
            Select an available date above.
          </Text>
        ) : (
          <View className="flex-row flex-wrap gap-2">
            {daySlots.map((slot) => {
              const active = selectedSlot?.id === slot.id;
              return (
                <Pressable
                  key={slot.id}
                  onPress={() => onSelectSlot(slot)}
                  className={`min-w-[30%] flex-1 items-center rounded-xl border px-3 py-2.5 ${
                    active ? "border-gold bg-gold" : "border-gold/30 bg-white"
                  }`}
                >
                  <Text
                    className={`font-sans-semibold text-sm ${
                      active ? "text-navy-deep" : "text-navy"
                    }`}
                  >
                    {fmtTime(slot.start_datetime)}
                  </Text>
                  <Text
                    className={`mt-0.5 text-[10px] ${
                      active ? "text-navy-deep/70" : "text-slate-light"
                    }`}
                  >
                    {slot.duration_minutes} min
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BookSessionPage() {
  const { id: skillId, slot: requestedSlotId } = useLocalSearchParams();
  const router = useRouter();
  const { isAuthenticated, logout } = useAuth();

  const [skill, setSkill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({ skillLevel: "Beginner", message: "" });

  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slotNotice, setSlotNotice] = useState(""); // shown if an invite slot is gone
  const autoSelectedRef = useRef(false); // invite slot applied only once
  const resumedRef = useRef(false); // post-login resume runs only once

  const [paymentStep, setPaymentStep] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState(null);

  const duration = selectedSlot ? selectedSlot.duration_minutes : 60;
  const isFree = parseFloat(skill?.price ?? 0) === 0;

  const fetchSkillDetails = useCallback(async () => {
    // Guests are welcome here: they can browse the offering, see slots, pick a
    // time and fill in details. Authentication is only required at Confirm.
    setLoading(true);
    try {
      const response = await api.get("/skills/public/");
      const found = response.data.find((s) => s.id === parseInt(skillId));
      if (found) setSkill(found);
      else {
        toast.error("Skill not found.");
        router.replace("/skills");
      }
    } catch (error) {
      toast.error("Failed to load skill details.");
      // Only force logout for an authenticated user whose session genuinely expired.
      if (error.response?.status === 401 && isAuthenticated) logout();
    } finally {
      setLoading(false);
    }
  }, [skillId, isAuthenticated, logout, router]);

  useEffect(() => {
    fetchSkillDetails();
  }, [fetchSkillDetails]);

  const fetchSlots = useCallback(async () => {
    setSlotsLoading(true);
    try {
      const res = await api.get(`/bookings/slots/available/?skill=${skillId}`);
      setSlots(res.data);
    } catch {
      // non-fatal; just show empty state
    } finally {
      setSlotsLoading(false);
    }
  }, [skillId]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // Auto-select the slot from a coach invite link (`?slot=`) once slots load.
  // If that slot is no longer open, fall back gracefully with a soft notice.
  useEffect(() => {
    if (autoSelectedRef.current) return;
    if (!requestedSlotId || slotsLoading) return;
    const match = slots.find((s) => String(s.id) === String(requestedSlotId));
    if (match) {
      setSelectedSlot(match);
    } else {
      setSlotNotice(
        "The time from your invite link is no longer available — please pick another below."
      );
    }
    autoSelectedRef.current = true;
  }, [requestedSlotId, slots, slotsLoading]);

  // Release a held slot if the client backs out of payment.
  const releaseHold = useCallback(async () => {
    if (selectedSlot) {
      try {
        await api.post(`/bookings/slots/${selectedSlot.id}/release/`);
      } catch {
        /* best effort */
      }
    }
  }, [selectedSlot]);

  // Reserve the slot and continue. Requires auth (the hold is tied to the
  // logged-in user). Shared by the manual submit and the post-login auto-resume.
  const startCheckout = useCallback(
    async (slot) => {
      setIsSubmitting(true);
      try {
        // Free session → confirm directly, no payment step and no hold needed
        // beyond the confirm call itself.
        if (parseFloat(skill?.price ?? 0) === 0) {
          await api.post(`/bookings/slots/${slot.id}/hold/`);
          await api.post("/bookings/confirm-free-booking/", {
            booking_data: {
              skill: parseInt(skillId),
              slot_id: slot.id,
              skill_level: formData.skillLevel,
              message: formData.message,
            },
          });
          toast.success("Your session is booked! 🎉");
          router.replace("/(client)/learning");
          return;
        }

        // Paid session → reserve the slot so nobody else can grab it during
        // checkout, then open the payment step for the slot's duration.
        await api.post(`/bookings/slots/${slot.id}/hold/`);
        const res = await api.post("/bookings/create-payment-intent/", {
          skill_id: parseInt(skillId),
          duration: slot.duration_minutes,
        });
        setClientSecret(res.data.client_secret);
        setPaymentAmount(res.data.amount);
        setPaymentStep(true);
      } catch (err) {
        const msg =
          err.response?.data?.detail ||
          err.response?.data?.error ||
          "This slot is no longer available. Please pick another.";
        toast.error(msg);
        fetchSlots();
        setSelectedSlot(null);
      } finally {
        setIsSubmitting(false);
      }
    },
    [skillId, skill, formData, fetchSlots, router]
  );

  const handleSubmit = () => {
    if (!selectedSlot) {
      toast.error("Please select an available time slot.");
      return;
    }
    // Deferred login: a guest can fill everything in, but must sign in to
    // confirm. Stash the in-progress booking and bounce through login; the
    // resume effect picks it back up.
    if (!isAuthenticated) {
      setPendingBooking({
        skillId: String(skillId),
        slotId: selectedSlot.id,
        skillLevel: formData.skillLevel,
        message: formData.message,
      });
      const next = `/book/${skillId}?slot=${selectedSlot.id}`;
      toast.info("Please sign in to confirm — we've saved your selected time and details.");
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    startCheckout(selectedSlot);
  };

  // After returning from login/register, resume a booking the guest started.
  useEffect(() => {
    if (resumedRef.current) return;
    if (!isAuthenticated || loading || slotsLoading) return;
    const intent = getPendingBooking();
    if (!intent) return;
    if (String(intent.skillId) !== String(skillId)) return; // for another offering

    resumedRef.current = true;
    clearPendingBooking();
    setFormData({
      skillLevel: intent.skillLevel || "Beginner",
      message: intent.message || "",
    });

    const match = slots.find((s) => String(s.id) === String(intent.slotId));
    if (!match) {
      setSlotNotice(
        "The time you selected was just taken while you signed in — please pick another below."
      );
      return;
    }
    setSelectedSlot(match);
    toast.success("You're signed in — continuing to confirm your booking.");
    startCheckout(match);
  }, [isAuthenticated, loading, slotsLoading, slots, skillId, startCheckout]);

  const editDetails = async () => {
    await releaseHold();
    setPaymentStep(false);
  };

  if (loading) return <Screen loading />;

  if (!skill) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <Text className="font-sans text-sm text-slate">Skill not found.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Pressable
        onPress={() => router.push("/skills")}
        className="mb-6 flex-row items-center gap-2"
      >
        <Feather name="arrow-left" size={14} color={colors.goldDeep} />
        <Text className="font-sans-medium text-sm text-gold-deep">Back to Skills</Text>
      </Pressable>

      <Card className="overflow-hidden p-0">
        {/* Card header */}
        <View className="bg-navy px-6 pb-6 pt-8">
          <Text className="mb-2 text-xs font-sans-semibold uppercase tracking-[2px] text-gold">
            Book a Session
          </Text>
          <Text className="font-display text-3xl text-cream">
            {paymentStep ? "Complete Payment" : "Confirm Your Booking"}
          </Text>
          <Text className="mt-1 font-sans text-sm text-slate-light">
            {paymentStep
              ? "Your session is almost confirmed."
              : `Coaching session with ${skill.mentor}`}
          </Text>
        </View>

        <View className="px-6 py-8">
          <StepIndicator step={paymentStep ? 2 : 1} />

          <SkillSummary skill={skill} duration={duration} />

          {/* ── Step 1: Booking Form ─────────────────────── */}
          {!paymentStep ? (
            <View className="gap-5">
              <View>
                <FieldLabel icon="calendar">Choose an Available Slot</FieldLabel>

                {slotNotice ? (
                  <View className="mb-3 flex-row items-start gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3">
                    <Feather name="clock" size={15} color={colors.goldDeep} />
                    <Text className="flex-1 font-sans text-sm text-gold-deep">
                      {slotNotice}
                    </Text>
                  </View>
                ) : null}

                {slotsLoading ? (
                  <View className="flex-row items-center gap-2 py-4">
                    <ActivityIndicator size="small" color={colors.gold} />
                    <Text className="font-sans text-sm text-slate">
                      Loading available times…
                    </Text>
                  </View>
                ) : slots.length === 0 ? (
                  <View className="rounded-xl border border-dashed border-gold/40 bg-cream p-5">
                    <Text className="text-center font-sans text-sm text-slate">
                      This coach has no open slots right now. Please check back later.
                    </Text>
                  </View>
                ) : (
                  <SlotCalendar
                    slots={slots}
                    selectedSlot={selectedSlot}
                    onSelectSlot={setSelectedSlot}
                  />
                )}
              </View>

              {/* Skill Level */}
              <View>
                <FieldLabel icon="user">Your Experience Level</FieldLabel>
                <View className="flex-row gap-2">
                  {["Beginner", "Intermediate", "Advanced"].map((lvl) => {
                    const active = formData.skillLevel === lvl;
                    return (
                      <Pressable
                        key={lvl}
                        onPress={() => setFormData((f) => ({ ...f, skillLevel: lvl }))}
                        className={`flex-1 items-center rounded-xl border px-3 py-3 ${
                          active ? "border-gold bg-gold" : "border-gold/30 bg-white"
                        }`}
                      >
                        <Text
                          className={`font-sans-medium text-sm ${
                            active ? "text-navy-deep" : "text-navy"
                          }`}
                        >
                          {lvl}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Message */}
              <View>
                <FieldLabel icon="message-square">Learning Goals (optional)</FieldLabel>
                <Input
                  value={formData.message}
                  onChangeText={(v) => setFormData((f) => ({ ...f, message: v }))}
                  placeholder="What would you like to focus on? Share any specific goals or questions..."
                  multiline
                  className="mb-0"
                />
              </View>

              {/* Price breakdown */}
              {isFree ? (
                <View className="flex-row items-center justify-between rounded-xl border border-gold/15 bg-cream p-4">
                  <Text className="font-sans-bold text-sm text-navy">Total</Text>
                  <Text className="font-sans-bold text-sm text-green-800">
                    Free · no payment needed
                  </Text>
                </View>
              ) : (
                <View className="rounded-xl border border-gold/15 bg-cream p-4">
                  <View className="mb-1.5 flex-row justify-between">
                    <Text className="font-sans text-sm text-slate">Rate</Text>
                    <Text className="font-sans-medium text-sm text-navy">
                      ${parseFloat(skill.price).toFixed(2)}/hr
                    </Text>
                  </View>
                  <View className="mb-1.5 flex-row justify-between">
                    <Text className="font-sans text-sm text-slate">Duration</Text>
                    <Text className="font-sans-medium text-sm text-navy">
                      {selectedSlot ? `${duration} minutes` : "Select a slot"}
                    </Text>
                  </View>
                  <View className="my-2 h-px bg-gold/20" />
                  <View className="flex-row justify-between">
                    <Text className="font-sans-bold text-sm text-navy">Total</Text>
                    <Text className="font-sans-bold text-sm text-gold-deep">
                      ${((parseFloat(skill.price) / 60) * duration).toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}

              <Button
                variant="gold"
                onPress={handleSubmit}
                loading={isSubmitting}
                disabled={!selectedSlot}
                fullWidth
              >
                {isAuthenticated
                  ? isFree
                    ? "Confirm Booking"
                    : "Proceed to Payment"
                  : "Sign In to Confirm"}
              </Button>

              {!isAuthenticated ? (
                <View className="flex-row items-center justify-center gap-1.5">
                  <Feather name="user" size={11} color={colors.slate} />
                  <Text className="text-center font-sans text-xs text-slate">
                    You'll sign in to confirm — your selected time and details are saved.
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* ── Step 2: Payment ──────────────────────────── */}
          {paymentStep ? (
            <View>
              <View className="mb-5 flex-row items-center gap-3 rounded-xl border border-gold/20 bg-cream-warm p-4">
                <Feather name="check-circle" size={16} color={colors.gold} />
                <View className="flex-1">
                  <Text className="font-sans-semibold text-xs text-navy">
                    Session details confirmed
                  </Text>
                  <Text className="font-sans text-xs text-slate">
                    {selectedSlot
                      ? `${duration} min · ${dayLabel(selectedSlot.start_datetime)} at ${fmtTime(selectedSlot.start_datetime)}`
                      : ""}
                  </Text>
                </View>
              </View>

              {clientSecret ? (
                <PaymentForm
                  clientSecret={clientSecret}
                  amount={paymentAmount}
                  bookingData={{
                    skill: parseInt(skillId),
                    slot_id: selectedSlot?.id,
                    skill_level: formData.skillLevel,
                    message: formData.message,
                  }}
                  onSuccess={() => router.replace("/(client)/learning")}
                />
              ) : null}

              <Button variant="outline" onPress={editDetails} className="mt-4" fullWidth>
                ← Edit Session Details
              </Button>
            </View>
          ) : null}
        </View>
      </Card>
    </Screen>
  );
}
