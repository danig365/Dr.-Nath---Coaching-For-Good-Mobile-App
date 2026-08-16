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
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { groupChatSocket } from "@/api/socket";
import { mediaUrl } from "@/api/media";
import { useAuth } from "@/context/AuthContext";
import { Screen, Button } from "@/components/ui";
import { toast } from "@/lib/toast";
import { pickFile, appendFile } from "@/lib/filePicker";
import { SESSION_GRACE_MS } from "@/lib/sessionTiming";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/GroupChatPage.jsx — the persisted thread for a
// group session, shared by the coach and every enrolled client.

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // keep in sync with the backend guard

const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isImageType = (type) => typeof type === "string" && type.startsWith("image/");

export default function GroupChatPage() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user, isCoach } = useAuth();
  const coach = isCoach();

  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);

  const scrollRef = useRef(null);
  const wsRef = useRef(null);
  const currentUserId = user?.user_id;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      let found = null;
      if (coach) {
        const r = await api.get("/bookings/group-sessions/");
        found = r.data.find((s) => s.id === parseInt(id));
      } else {
        const r = await api.get("/bookings/group-sessions/mine/");
        const e = r.data.find((x) => x.group_session === parseInt(id));
        if (e)
          found = {
            id: e.group_session,
            title: e.title,
            coach_username: e.coach_username,
            start_datetime: e.start_datetime,
            end_datetime: e.end_datetime,
            status: e.session_status,
          };
      }

      if (!found) {
        toast.error("Session not found or you're not enrolled.");
        router.back();
        return;
      }
      setSession(found);

      const msgs = await api.get(`/bookings/group-sessions/${id}/messages/`);
      setMessages(msgs.data);
    } catch {
      toast.error("Failed to load the group chat.");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, coach, router]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!session) return undefined;
    let ws;
    let cancelled = false;

    (async () => {
      try {
        ws = await groupChatSocket(id);
        if (cancelled) {
          ws.close();
          return;
        }
        wsRef.current = ws;
        ws.onmessage = (e) => {
          const m = JSON.parse(e.data);
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        };
      } catch {
        // Non-fatal — the thread still loads over REST; only live updates stop.
      }
    })();

    return () => {
      cancelled = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [session, id]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const handleFileSelect = async () => {
    const file = await pickFile();
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("File exceeds the 50 MB limit.");
      return;
    }
    setPendingFile(file);
  };

  const send = async () => {
    if (uploading) return;

    // A staged file is sent over REST (optionally with a caption), then broadcast.
    if (pendingFile) {
      setUploading(true);
      try {
        const form = new FormData();
        appendFile(form, "attachment", pendingFile);
        const caption = text.trim();
        if (caption) form.append("content", caption);

        const res = await api.post(`/bookings/group-sessions/${id}/messages/`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        // The upload is also broadcast over the WebSocket; dedup by id handles it.
        setMessages((prev) =>
          prev.some((x) => x.id === res.data.id) ? prev : [...prev, res.data]
        );
        setPendingFile(null);
        setText("");
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

    const t = text.trim();
    const ws = wsRef.current;
    if (!t || ws?.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ content: t }));
    setText("");
  };

  if (loading) return <Screen loading />;
  if (!session) return null;

  const canJoinCall =
    session.status !== "cancelled" &&
    new Date(session.end_datetime).getTime() + SESSION_GRACE_MS > Date.now() &&
    Date.now() >= new Date(session.start_datetime).getTime() - 15 * 60 * 1000;

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View className="flex-row items-center gap-3 bg-navy px-4 py-3">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Feather name="arrow-left" size={20} color={colors.cream} />
          </Pressable>
          <View className="min-w-0 flex-1">
            <Text className="text-xs font-sans-semibold uppercase tracking-[2px] text-gold">
              Group chat
            </Text>
            <Text className="font-display text-lg text-cream" numberOfLines={1}>
              {session.title}
            </Text>
          </View>
          {canJoinCall ? (
            <Button
              variant="gold"
              size="sm"
              onPress={() => router.push(`/group-session/${id}/call`)}
            >
              Join call
            </Button>
          ) : null}
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerClassName="px-4 py-4 gap-3"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <View className="items-center rounded-2xl border border-dashed border-gold/30 bg-white px-6 py-10">
              <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-gold/15">
                <Feather name="message-square" size={22} color={colors.gold} />
              </View>
              <Text className="mb-1 font-display text-lg text-navy">
                No messages yet
              </Text>
              <Text className="text-center font-sans text-sm text-slate">
                Say hello to everyone in this group session.
              </Text>
            </View>
          ) : (
            messages.map((m) => {
              const isMine = m.sender === currentUserId;
              return (
                <View
                  key={m.id}
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
                        {isMine ? "You" : m.sender_username}
                      </Text>
                      <Text
                        className={`font-sans text-xs ${
                          isMine ? "text-navy-deep/70" : "text-slate-light"
                        }`}
                      >
                        {new Date(m.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>

                    {m.attachment_url ? (
                      isImageType(m.content_type) ? (
                        <Pressable
                          onPress={() => Linking.openURL(mediaUrl(m.attachment_url))}
                          className="mb-1"
                        >
                          <Image
                            source={{ uri: mediaUrl(m.attachment_url) }}
                            style={{ height: 200, width: 200, borderRadius: 8 }}
                            contentFit="cover"
                          />
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={() => Linking.openURL(mediaUrl(m.attachment_url))}
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
                              {m.attachment_name || "Attachment"}
                            </Text>
                            {m.attachment_size != null ? (
                              <Text
                                className={`font-sans text-xs ${
                                  isMine ? "text-navy-deep/60" : "text-slate-light"
                                }`}
                              >
                                {formatBytes(m.attachment_size)}
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

                    {m.content ? (
                      <Text
                        className={`font-sans text-sm leading-6 ${
                          isMine ? "text-navy-deep" : "text-navy"
                        }`}
                      >
                        {m.content}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Input */}
        <View className="border-t border-gold/15 bg-white px-4 py-3">
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
              disabled={uploading}
              className={`h-12 w-12 items-center justify-center rounded-xl border border-gold/30 ${
                pendingFile ? "bg-gold/20" : "bg-cream"
              } ${uploading ? "opacity-40" : ""}`}
            >
              <Feather name="paperclip" size={18} color={colors.goldDeep} />
            </Pressable>

            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              placeholder={pendingFile ? "Add a caption (optional)…" : "Write a message..."}
              placeholderTextColor={colors.slateLight}
              className="max-h-24 flex-1 rounded-xl border border-gold/30 bg-cream px-4 py-3 font-sans text-sm text-navy"
              style={{ textAlignVertical: "top" }}
            />

            <Button
              variant="gold"
              size="sm"
              onPress={send}
              loading={uploading}
              disabled={!text.trim() && !pendingFile}
            >
              Send
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
