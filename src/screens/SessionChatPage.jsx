import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { chatSocket } from "@/api/socket";
import { mediaUrl } from "@/api/media";
import { useAuth } from "@/context/AuthContext";
import { Screen, Card, Button } from "@/components/ui";
import { toast } from "@/lib/toast";
import { pickFile, appendFile } from "@/lib/filePicker";
import { SESSION_REJOIN_MS } from "@/lib/sessionTiming";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/SessionChatPage.jsx.
//
// First screen to use the WebSocket layer from Phase 1: `chatSocket()` handles
// the absolute host and refreshes the access token before the handshake, which
// the web builds inline from window.location.

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // keep in sync with backend guard

const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isImageType = (type) => typeof type === "string" && type.startsWith("image/");

const STATUS_TONE = {
  accepted: { bg: "bg-green-100", text: "text-green-900" },
  completed: { bg: "bg-gold/15", text: "text-gold-deep" },
  pending: { bg: "bg-amber-100", text: "text-amber-900" },
  declined: { bg: "bg-red-100", text: "text-red-900" },
};

export default function SessionChatPage() {
  const { bookingId } = useLocalSearchParams();
  const router = useRouter();
  const { user, isAuthenticated, isCoach, logout, timezone } = useAuth();

  const [booking, setBooking] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);

  const scrollRef = useRef(null);
  const wsRef = useRef(null);
  const currentUserId = user?.user_id;

  const fetchThread = useCallback(async () => {
    if (!isAuthenticated) {
      toast.error("Please log in.");
      logout();
      return;
    }
    setLoading(true);
    try {
      const [bookingRes, messagesRes] = await Promise.all([
        api.get(`/bookings/${bookingId}/`),
        api.get(`/messages/?booking=${bookingId}`),
      ]);
      setBooking(bookingRes.data);
      setMessages(messagesRes.data);
    } catch (error) {
      const fallback = isCoach() ? "/(coach)/sessions" : "/(client)/learning";
      toast.error(error.response?.data?.detail || "Failed to load chat.");
      router.replace(fallback);
    } finally {
      setLoading(false);
    }
  }, [bookingId, isAuthenticated, isCoach, logout, router]);

  const isChatEnabled = booking?.status === "accepted" || booking?.status === "completed";

  useEffect(() => {
    fetchThread();
  }, [fetchThread]);

  useEffect(() => {
    if (!booking || !isChatEnabled) return;
    let ws;
    let cancelled = false;

    (async () => {
      try {
        ws = await chatSocket(bookingId);
        if (cancelled) {
          ws.close();
          return;
        }
        wsRef.current = ws;
        ws.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.type === "signal") return; // signals handled on the call screen
          setMessages((prev) => (prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]));
        };
        ws.onerror = () => console.error("WebSocket error");
      } catch {
        // Non-fatal: sending falls back to REST below.
      }
    })();

    return () => {
      cancelled = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [booking, bookingId, isChatEnabled]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  // Selecting a file only stages it; nothing is sent until the user hits Send.
  const handleFileSelect = async () => {
    const file = await pickFile();
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("File exceeds the 50 MB limit.");
      return;
    }
    setPendingFile(file);
  };

  const sendMessage = async () => {
    if (sending || uploading) return;

    // A staged file is sent over REST (optionally with a caption), then broadcast.
    if (pendingFile) {
      setUploading(true);
      try {
        const form = new FormData();
        form.append("booking", Number(bookingId));
        appendFile(form, "attachment", pendingFile);
        const caption = messageText.trim();
        if (caption) form.append("content", caption);

        const res = await api.post("/messages/", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        // The upload is also broadcast over the WebSocket; dedup by id handles it.
        setMessages((prev) =>
          prev.find((m) => m.id === res.data.id) ? prev : [...prev, res.data]
        );
        setPendingFile(null);
        setMessageText("");
      } catch (err) {
        toast.error(
          err.response?.data?.detail ||
            err.response?.data?.attachment?.[0] ||
            "Failed to send file."
        );
      } finally {
        setUploading(false);
      }
      return;
    }

    if (!messageText.trim()) return;

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ content: messageText.trim() }));
      setMessageText("");
    } else {
      setSending(true);
      try {
        await api.post("/messages/", {
          booking: Number(bookingId),
          content: messageText.trim(),
        });
        setMessageText("");
        await fetchThread();
      } catch {
        toast.error("Failed to send message.");
      } finally {
        setSending(false);
      }
    }
  };

  const getChatPartnerName = () => {
    if (!booking) return "";
    return isCoach() ? booking.learner_username : booking.mentor_username;
  };

  if (loading) return <Screen loading />;
  if (!booking) return null;

  const tone = STATUS_TONE[booking.status] || STATUS_TONE.pending;
  const startDt = booking.slot_start
    ? new Date(booking.slot_start)
    : new Date(`${booking.session_date}T${booking.session_time}Z`);
  const sessionDate = startDt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: timezone || undefined,
  });
  const sessionTime = startDt.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone || undefined,
  });

  const canSend =
    isChatEnabled && !sending && !uploading && (!!messageText.trim() || !!pendingFile);

  // Join / Resume button state, mirroring the web's rejoin-window rule (N3).
  const joinState = (() => {
    if (!["accepted", "completed", "no_show"].includes(booking.status)) return null;
    const sessionEndMs = booking.slot_end
      ? new Date(booking.slot_end).getTime()
      : new Date(`${booking.session_date}T${booking.session_time}Z`).getTime() +
        booking.duration * 60 * 1000;
    const withinWindow = sessionEndMs + SESSION_REJOIN_MS >= Date.now();
    // A finalised session can be reconnected + continued on the same link while
    // its rejoin window is open; past that, no button at all.
    const resumable = booking.status !== "accepted" && withinWindow;
    if (booking.status !== "accepted" && !withinWindow) return null;
    const expired = booking.status === "accepted" && !withinWindow;
    return { expired, resumable };
  })();

  return (
    <Screen scroll={false} padded={false}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* ── Top bar ── */}
        <View className="flex-row items-center justify-between gap-4 px-5 py-3">
          <Pressable
            onPress={() =>
              router.replace(isCoach() ? "/(coach)/sessions" : "/(client)/learning")
            }
            className="flex-row items-center gap-2 rounded-full border border-gold/30 bg-white px-4 py-2"
          >
            <Feather name="arrow-left" size={14} color={colors.goldDeep} />
            <Text className="font-sans-medium text-sm text-gold-deep">Back</Text>
          </Pressable>

          <View className="flex-1 items-end">
            <Text className="text-xs font-sans-semibold uppercase tracking-[2px] text-gold-deep">
              Session Chat
            </Text>
            <Text className="font-display text-lg text-navy" numberOfLines={1}>
              {booking.skill_title}
            </Text>
          </View>
        </View>

        {/* ── Chat header ── */}
        <View className="mx-5 overflow-hidden rounded-t-2xl bg-navy px-5 py-4">
          <View className="flex-row items-start justify-between gap-4">
            <View className="flex-1">
              <Text className="mb-1 text-xs font-sans-semibold uppercase tracking-[2px] text-gold">
                Direct Session Chat
              </Text>
              <Text className="font-display text-2xl text-cream">
                {getChatPartnerName()}
              </Text>
              <Text className="mt-0.5 font-sans text-sm text-slate-light">
                Keep this conversation focused on the booked session.
              </Text>
            </View>
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-gold/15">
              <Feather name="message-square" size={18} color={colors.gold} />
            </View>
          </View>
        </View>

        {/* ── Messages ── */}
        <ScrollView
          ref={scrollRef}
          className="mx-5 flex-1 bg-cream"
          contentContainerClassName="px-4 py-4 gap-3"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length > 0 ? (
            messages.map((message) => {
              const isMine = message.sender === currentUserId;
              return (
                <View
                  key={message.id}
                  className={`flex-row ${isMine ? "justify-end" : "justify-start"}`}
                >
                  <View
                    className={`max-w-[78%] rounded-2xl px-4 py-3 ${
                      isMine
                        ? "rounded-br-sm bg-gold"
                        : "rounded-bl-sm border border-gold/20 bg-white"
                    }`}
                  >
                    <View className="mb-1.5 flex-row items-center justify-between gap-4">
                      <Text
                        className={`font-sans-medium text-xs ${
                          isMine ? "text-navy-deep/70" : "text-slate"
                        }`}
                      >
                        {isMine ? "You" : message.sender_username}
                      </Text>
                      <Text
                        className={`font-sans text-xs ${
                          isMine ? "text-navy-deep/70" : "text-slate-light"
                        }`}
                      >
                        {new Date(message.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>

                    {message.attachment_url ? (
                      isImageType(message.content_type) ? (
                        <Pressable
                          onPress={() => Linking.openURL(mediaUrl(message.attachment_url))}
                          className="mb-1"
                        >
                          <Image
                            source={{ uri: mediaUrl(message.attachment_url) }}
                            style={{ height: 200, width: 200, borderRadius: 8 }}
                            contentFit="cover"
                          />
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={() => Linking.openURL(mediaUrl(message.attachment_url))}
                          className={`mb-1 flex-row items-center gap-2.5 rounded-xl px-3 py-2 ${
                            isMine ? "bg-navy-deep/10" : "border border-gold/20 bg-cream"
                          }`}
                        >
                          <Feather
                            name="file"
                            size={18}
                            color={isMine ? colors.navyDeep : colors.navy}
                          />
                          <View className="min-w-0 flex-1">
                            <Text
                              className={`font-sans-semibold text-sm ${
                                isMine ? "text-navy-deep" : "text-navy"
                              }`}
                              numberOfLines={1}
                            >
                              {message.attachment_name || "Attachment"}
                            </Text>
                            {message.attachment_size != null ? (
                              <Text
                                className={`font-sans text-xs ${
                                  isMine ? "text-navy-deep/60" : "text-slate-light"
                                }`}
                              >
                                {formatBytes(message.attachment_size)}
                              </Text>
                            ) : null}
                          </View>
                          <Feather
                            name="download"
                            size={15}
                            color={isMine ? colors.navyDeep : colors.navy}
                          />
                        </Pressable>
                      )
                    ) : null}

                    {message.content ? (
                      <Text
                        className={`font-sans text-sm leading-6 ${
                          isMine ? "text-navy-deep" : "text-navy"
                        }`}
                      >
                        {message.content}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })
          ) : (
            <View className="items-center rounded-2xl border border-dashed border-gold/30 bg-white px-6 py-10">
              <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-gold/15">
                <Feather name="message-square" size={22} color={colors.gold} />
              </View>
              <Text className="mb-1 font-display text-lg text-navy">
                Start the conversation
              </Text>
              <Text className="text-center font-sans text-sm text-slate">
                Send the first message to coordinate the session, share updates, or follow
                up on feedback.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* ── Input ── */}
        <View className="mx-5 mb-3 rounded-b-2xl border-t border-gold/15 bg-white px-4 py-3">
          {!isChatEnabled ? (
            <View className="mb-3 rounded-xl border border-gold/25 bg-cream-warm px-4 py-2.5">
              <Text className="font-sans-medium text-sm text-gold-deep">
                Chat becomes available once the booking is accepted.
              </Text>
            </View>
          ) : null}

          {pendingFile ? (
            <View className="mb-3 flex-row items-center gap-2.5 rounded-xl border border-gold/30 bg-cream px-3 py-2">
              <Feather name="file" size={18} color={colors.goldDeep} />
              <View className="min-w-0 flex-1">
                <Text className="font-sans-semibold text-sm text-navy" numberOfLines={1}>
                  {pendingFile.name}
                </Text>
                <Text className="font-sans text-xs text-slate-light">
                  {formatBytes(pendingFile.size)} · ready to send
                </Text>
              </View>
              <Pressable
                onPress={() => setPendingFile(null)}
                disabled={uploading}
                hitSlop={8}
                className="px-2"
              >
                <Feather name="x" size={16} color={colors.goldDeep} />
              </Pressable>
            </View>
          ) : null}

          <View className="flex-row items-end gap-3">
            <Pressable
              onPress={handleFileSelect}
              disabled={!isChatEnabled || uploading}
              className={`h-12 w-12 items-center justify-center rounded-xl border border-gold/30 ${
                pendingFile ? "bg-gold/20" : "bg-cream"
              } ${!isChatEnabled || uploading ? "opacity-40" : ""}`}
            >
              <Feather name="paperclip" size={18} color={colors.goldDeep} />
            </Pressable>

            <TextInput
              value={messageText}
              onChangeText={setMessageText}
              multiline
              editable={isChatEnabled && !sending && !uploading}
              placeholder={
                isChatEnabled
                  ? pendingFile
                    ? "Add a caption (optional)…"
                    : "Write a message..."
                  : "Chat not available yet."
              }
              placeholderTextColor={colors.slateLight}
              className="max-h-24 flex-1 rounded-xl border border-gold/30 bg-cream px-4 py-3 font-sans text-sm text-navy"
              style={{ textAlignVertical: "top" }}
            />

            <Button
              variant="gold"
              size="sm"
              onPress={sendMessage}
              disabled={!canSend}
              loading={sending || uploading}
            >
              Send
            </Button>
          </View>
        </View>

        {/* ── Booking overview ── */}
        <ScrollView className="max-h-56 px-5" contentContainerClassName="pb-5">
          <Card className="overflow-hidden p-0">
            <View className="h-1 bg-gold" />
            <View className="p-5">
              <Text className="mb-1 text-xs font-sans-semibold uppercase tracking-[2px] text-gold-deep">
                Booking Overview
              </Text>
              <Text className="mb-4 font-display text-xl text-navy">
                {booking.skill_title}
              </Text>

              <View className="gap-3">
                {[
                  {
                    icon: "user",
                    text: isCoach() ? booking.learner_username : booking.mentor_username,
                  },
                  { icon: "calendar", text: sessionDate },
                  { icon: "clock", text: `${sessionTime} · ${booking.duration} mins` },
                ].map((row) => (
                  <View
                    key={row.icon}
                    className="flex-row items-center gap-3 rounded-xl border border-gold/10 bg-cream px-3 py-2.5"
                  >
                    <Feather name={row.icon} size={13} color={colors.gold} />
                    <Text className="font-sans-medium text-sm text-navy">{row.text}</Text>
                  </View>
                ))}
              </View>

              <View className={`mt-4 self-start rounded-full px-3 py-1.5 ${tone.bg}`}>
                <Text className={`font-sans-semibold text-xs capitalize ${tone.text}`}>
                  {booking.status}
                </Text>
              </View>

              {joinState ? (
                <Button
                  variant={joinState.expired ? "ghost" : "gold"}
                  onPress={() => !joinState.expired && router.push(`/session/${bookingId}`)}
                  disabled={joinState.expired}
                  className="mt-4"
                  fullWidth
                >
                  {joinState.expired
                    ? "Session Expired"
                    : joinState.resumable
                      ? "Resume Session"
                      : "Join Session"}
                </Button>
              ) : null}
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
