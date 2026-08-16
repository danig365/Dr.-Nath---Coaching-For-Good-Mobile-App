import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { colors } from "@/theme/colors";

// Port of frontend/src/components/AssistantWidget.jsx — the floating AI helper.

const GREETING = {
  role: "assistant",
  content:
    "Hi! 👋 I'm the Dr. Nath assistant. Ask me about coaching, how booking works, or finding the right coach.",
};

const SUGGESTIONS = [
  "How do I book a session?",
  "What kinds of coaching are offered?",
  "How does Smart Match work?",
];

// Don't overlap the video-call UI.
const isHiddenPath = (path) => /\/session\/|\/group-session\/|\/call$/.test(path);

// Render a reply as plain text, but turn any stray **bold** the model emits into
// real bold instead of showing the literal asterisks. Also strips leftover
// Markdown heading hashes.
function RichText({ text, className }) {
  const cleaned = String(text || "").replace(/^#{1,6}\s+/gm, "");
  const parts = cleaned.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text className={className}>
      {parts.map((part, i) =>
        /^\*\*[^*]+\*\*$/.test(part) ? (
          <Text key={i} className="font-sans-bold">
            {part.slice(2, -2)}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </Text>
  );
}

export default function AssistantWidget() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (open) scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, open, loading]);

  if (isHiddenPath(pathname)) return null;

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      // Send only user/assistant turns (drop the local greeting) to the API.
      const history = next.filter((m, i) => !(i === 0 && m === GREETING));
      const res = await api.post("/assistant/chat/", { messages: history });
      setMessages((m) => [...m, { role: "assistant", content: res.data.reply }]);
    } catch (err) {
      const msg =
        err.response?.status === 429
          ? "You're sending messages a bit fast — please wait a moment and try again."
          : "Sorry, I couldn't respond just now. Please try again shortly.";
      setMessages((m) => [...m, { role: "assistant", content: msg }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityLabel="Open assistant"
        className="absolute h-14 w-14 items-center justify-center rounded-full border-2 border-gold bg-navy"
        style={{ bottom: insets.bottom + 24, right: 24 }}
      >
        <Feather name="message-circle" size={24} color={colors.gold} />
      </Pressable>

      {/* Chat panel */}
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <KeyboardAvoidingView
          className="flex-1 justify-end"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable className="flex-1" onPress={() => setOpen(false)} />

          <View
            className="overflow-hidden rounded-t-2xl border border-gold/30 bg-cream"
            style={{ height: "72%" }}
          >
            {/* Header */}
            <View className="flex-row items-center gap-3 bg-navy px-4 py-3">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-gold/20">
                <Feather name="message-circle" size={18} color={colors.gold} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-sans-bold text-sm text-cream">
                  Dr. Nath Assistant
                </Text>
                <Text className="text-[11px] text-slate-light">
                  Here to help you get started
                </Text>
              </View>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Feather name="x" size={20} color={colors.slateLight} />
              </Pressable>
            </View>

            {/* Messages */}
            <ScrollView
              ref={scrollRef}
              className="flex-1"
              contentContainerClassName="px-4 py-4 gap-3"
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              {messages.map((m, i) => {
                const mine = m.role === "user";
                return (
                  <View
                    key={i}
                    className={`flex-row ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <View
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                        mine
                          ? "rounded-br-sm bg-gold"
                          : "rounded-bl-sm border border-gold/20 bg-white"
                      }`}
                    >
                      {mine ? (
                        <Text className="font-sans text-sm leading-6 text-navy-deep">
                          {m.content}
                        </Text>
                      ) : (
                        <RichText
                          text={m.content}
                          className="font-sans text-sm leading-6 text-navy"
                        />
                      )}
                    </View>
                  </View>
                );
              })}

              {/* Suggestions (only before the first user turn) */}
              {messages.length === 1 && !loading ? (
                <View className="flex-row flex-wrap gap-2 pt-1">
                  {SUGGESTIONS.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => send(s)}
                      className="rounded-full border border-gold bg-white px-3 py-1.5"
                    >
                      <Text className="font-sans text-xs text-gold-deep">{s}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {loading ? (
                <View className="flex-row justify-start">
                  <View className="rounded-2xl border border-gold/20 bg-white px-4 py-3">
                    <Text className="font-sans text-sm text-slate-light">…</Text>
                  </View>
                </View>
              ) : null}
            </ScrollView>

            {/* Input */}
            <View
              className="flex-row items-center gap-2 border-t border-gold/20 bg-white px-3 py-3"
              style={{ paddingBottom: insets.bottom + 12 }}
            >
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Type your message…"
                placeholderTextColor={colors.slateLight}
                maxLength={2000}
                onSubmitEditing={() => send()}
                returnKeyType="send"
                className="flex-1 rounded-full border border-gold/30 bg-cream px-4 py-2.5 font-sans text-sm text-navy"
              />
              <Pressable
                onPress={() => send()}
                disabled={!input.trim() || loading}
                className={`h-10 w-10 items-center justify-center rounded-full bg-gold ${
                  !input.trim() || loading ? "opacity-40" : ""
                }`}
              >
                <Feather name="send" size={16} color={colors.navyDeep} />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
