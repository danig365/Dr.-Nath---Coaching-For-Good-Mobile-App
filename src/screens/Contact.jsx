import { useState } from "react";
import { View, Text } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { Screen, Card, Button, Input } from "@/components/ui";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/Contact.jsx.
export default function Contact() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: user?.username || "",
    email: "",
    subject: "",
    message: "",
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    setError("");
    if (!form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      setError("Please fill in your email, a subject and a message.");
      return;
    }
    setSending(true);
    try {
      await api.post("/contact/", {
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen>
      <View className="mb-10 items-center">
        <Text className="mb-3 text-xs font-sans-semibold uppercase tracking-[2px] text-gold-deep">
          Get in touch
        </Text>
        <Text className="mb-4 text-center font-display text-4xl text-navy">
          Contact <Text className="text-gold-deep">Dr. Nath</Text>
        </Text>
        <Text className="text-center font-sans text-base text-slate">
          Questions about coaching, programmes or bookings? Send a message and you'll get a
          reply by email.
        </Text>
      </View>

      {sent ? (
        <Card className="items-center py-16">
          <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <Feather name="check-circle" size={26} color="#2E7D32" />
          </View>
          <Text className="mb-2 font-display text-2xl text-navy">Message sent</Text>
          <Text className="text-center font-sans text-sm text-slate">
            Thank you for reaching out — you'll get a reply at{" "}
            <Text className="font-sans-semibold text-navy">{form.email}</Text>.
          </Text>
        </Card>
      ) : (
        <Card className="p-6">
          <Input label="Your name" value={form.name} onChangeText={(v) => set("name", v)} />
          <Input
            label="Email"
            value={form.email}
            onChangeText={(v) => set("email", v)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="you@email.com"
          />
          <Input
            label="Subject"
            value={form.subject}
            onChangeText={(v) => set("subject", v)}
          />
          <Input
            label="Message"
            value={form.message}
            onChangeText={(v) => set("message", v)}
            multiline
            error={error || undefined}
          />

          <Button variant="gold" onPress={submit} loading={sending} fullWidth>
            Send message
          </Button>
        </Card>
      )}
    </Screen>
  );
}
