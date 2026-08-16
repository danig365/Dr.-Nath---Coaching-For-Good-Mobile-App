import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { Screen, Card, Button } from "@/components/ui";
import PaymentForm from "@/components/PaymentForm";
import { toast } from "@/lib/toast";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/GroupSessions.jsx — the client-facing catalogue of
// bookable group sessions.
//
// Seat checkout holds a seat, opens a PaymentIntent and confirms with Stripe's
// native card sheet — same flow and endpoints as the web CheckoutModal,
// including releasing the held seat if the client backs out before paying.

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// Checkout: hold a seat -> PaymentIntent -> pay -> confirm. Ported from the
// CheckoutModal in frontend/src/pages/GroupSessions.jsx.
function CheckoutModal({ session, onClose, onSuccess }) {
  const [stage, setStage] = useState("confirm"); // confirm | pay
  const [clientSecret, setClientSecret] = useState(null);
  const [amount, setAmount] = useState(null);
  const [busy, setBusy] = useState(false);
  const [held, setHeld] = useState(false);

  const startCheckout = async () => {
    setBusy(true);
    try {
      await api.post(`/bookings/group-sessions/${session.id}/hold/`);
      setHeld(true);
      const res = await api.post("/bookings/create-group-payment-intent/", {
        group_session_id: session.id,
      });
      setClientSecret(res.data.client_secret);
      setAmount(res.data.amount);
      setStage("pay");
    } catch (err) {
      toast.error(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          "Could not reserve a seat — it may be full."
      );
      onClose(true); // signal a refresh
    } finally {
      setBusy(false);
    }
  };

  // Release the held seat if the client backs out before paying.
  const handleClose = async () => {
    if (held) {
      try {
        await api.post(`/bookings/group-sessions/${session.id}/release/`);
      } catch {
        /* best effort */
      }
    }
    onClose(true);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleClose}>
      <View className="flex-1 items-center justify-center bg-navy-deep/60 p-4">
        <View className="w-full max-w-md overflow-hidden rounded-2xl border border-gold/20 bg-white">
          <View className="bg-navy px-6 pb-5 pt-6">
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <Text className="mb-1 text-xs font-sans-semibold uppercase tracking-[2px] text-gold">
                  Reserve a Seat
                </Text>
                <Text className="font-display text-2xl text-cream">{session.title}</Text>
                <Text className="mt-1 font-sans text-sm text-slate-light">
                  with {session.coach_username}
                </Text>
              </View>
              <Pressable onPress={handleClose} hitSlop={8}>
                <Feather name="x" size={18} color={colors.slateLight} />
              </Pressable>
            </View>
          </View>

          <View className="p-6">
            <View className="mb-5 rounded-xl border border-gold/20 bg-cream-warm p-4">
              <View className="flex-row items-center gap-2">
                <Feather name="calendar" size={13} color={colors.gold} />
                <Text className="font-sans text-sm text-navy">
                  {fmtDate(session.start_datetime)}
                </Text>
              </View>
              <View className="mt-1.5 flex-row items-center gap-2">
                <Feather name="clock" size={13} color={colors.gold} />
                <Text className="font-sans text-sm text-navy">
                  {fmtTime(session.start_datetime)} – {fmtTime(session.end_datetime)}
                </Text>
              </View>
              <View className="mt-1.5 flex-row items-center gap-2">
                <Feather name="users" size={13} color={colors.gold} />
                <Text className="font-sans text-sm text-navy">
                  {session.seats_remaining} seat{session.seats_remaining !== 1 ? "s" : ""} left
                </Text>
              </View>
            </View>

            {stage === "confirm" ? (
              <>
                <View className="mb-5 flex-row items-center justify-between">
                  <Text className="font-sans text-sm text-slate">Price per seat</Text>
                  <Text className="font-display text-xl text-gold-deep">
                    ${parseFloat(session.price_per_seat).toFixed(2)}
                  </Text>
                </View>
                <Button variant="gold" onPress={startCheckout} loading={busy} fullWidth>
                  Reserve & Pay
                </Button>
              </>
            ) : clientSecret ? (
              <PaymentForm
                clientSecret={clientSecret}
                amount={amount}
                confirmUrl="/bookings/confirm-group-payment/"
                buildConfirmPayload={(piId) => ({
                  payment_intent_id: piId,
                  group_session_id: session.id,
                })}
                onSuccess={onSuccess}
              />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SessionCard({ session, onReserve, reserved, router }) {
  return (
    <Card className="overflow-hidden p-0">
      <View className={`h-1 ${reserved ? "bg-green-500" : "bg-gold"}`} />

      <View className="p-6">
        <View className="mb-2 flex-row items-center gap-2">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-gold">
            <Text className="font-sans-bold text-sm text-navy-deep">
              {session.coach_username?.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text className="font-sans-semibold text-xs text-gold-deep">
            {session.coach_username}
          </Text>
          <View className="flex-1" />
          {reserved ? (
            <View className="flex-row items-center gap-1 rounded-full border border-green-200 bg-green-100 px-2.5 py-1">
              <Feather name="check-circle" size={12} color="#2E7D32" />
              <Text className="font-sans-semibold text-xs text-green-900">Reserved</Text>
            </View>
          ) : null}
        </View>

        <Text className="mb-2 font-display text-xl text-navy">{session.title}</Text>

        {session.description ? (
          <Text className="mb-4 font-sans text-sm text-slate" numberOfLines={3}>
            {session.description}
          </Text>
        ) : null}

        <View className="mb-4 gap-1.5">
          <View className="flex-row items-center gap-2">
            <Feather name="calendar" size={13} color={colors.gold} />
            <Text className="font-sans text-sm text-slate">
              {fmtDate(session.start_datetime)}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Feather name="clock" size={13} color={colors.gold} />
            <Text className="font-sans text-sm text-slate">
              {fmtTime(session.start_datetime)} – {fmtTime(session.end_datetime)}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Feather name="users" size={13} color={colors.gold} />
            <Text className="font-sans text-sm text-slate">
              {session.seats_remaining} of {session.capacity} seats left
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between border-t border-gold/10 pt-4">
          <Text className="font-display text-lg text-gold-deep">
            ${parseFloat(session.price_per_seat).toFixed(2)}
            <Text className="font-sans text-xs text-slate"> /seat</Text>
          </Text>

          {reserved ? (
            <Button
              variant="ghost"
              size="sm"
              onPress={() => router.push("/(client)/learning")}
            >
              My Learning
            </Button>
          ) : (
            <Button
              variant="gold"
              size="sm"
              onPress={() => onReserve(session)}
              disabled={session.seats_remaining <= 0}
            >
              {session.seats_remaining <= 0 ? "Full" : "Reserve"}
            </Button>
          )}
        </View>
      </View>
    </Card>
  );
}

export default function GroupSessions() {
  const router = useRouter();
  const { isAuthenticated, logout } = useAuth();

  const [sessions, setSessions] = useState([]);
  const [reservedIds, setReservedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [checkout, setCheckout] = useState(null);

  const fetchSessions = useCallback(async () => {
    if (!isAuthenticated) {
      toast.error("Please log in to view group sessions.");
      logout();
      return;
    }
    setLoading(true);
    try {
      const [res, mine] = await Promise.all([
        api.get("/bookings/group-sessions/available/"),
        api.get("/bookings/group-sessions/mine/"),
      ]);
      setSessions(res.data);
      // Sessions the client already holds a booked seat in.
      setReservedIds(
        new Set(
          mine.data
            .filter((e) => e.session_status !== "cancelled")
            .map((e) => e.group_session)
        )
      );
    } catch (err) {
      toast.error("Failed to load group sessions.");
      if (err.response?.status === 401) logout();
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, logout]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  if (loading) return <Screen loading />;

  return (
    <Screen onRefresh={fetchSessions} refreshing={false}>
      <View className="mb-8">
        <Text className="mb-2 text-xs font-sans-semibold uppercase tracking-[2px] text-gold-deep">
          Coaching, together
        </Text>
        <Text className="font-display text-3xl text-navy">Group Sessions</Text>
      </View>

      {sessions.length === 0 ? (
        <Card className="items-center py-20">
          <Text className="mb-4 text-5xl">👥</Text>
          <Text className="mb-2 font-display text-xl text-navy">
            No group sessions available
          </Text>
          <Text className="text-center font-sans text-sm text-slate">
            Check back soon — new sessions are added regularly.
          </Text>
        </Card>
      ) : (
        <View className="gap-6">
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              onReserve={setCheckout}
              reserved={reservedIds.has(s.id)}
              router={router}
            />
          ))}
        </View>
      )}

      {checkout ? (
        <CheckoutModal
          session={checkout}
          onClose={(refresh) => {
            setCheckout(null);
            if (refresh) fetchSessions();
          }}
          onSuccess={() => {
            setCheckout(null);
            router.replace("/(client)/learning");
          }}
        />
      ) : null}
    </Screen>
  );
}
