import { useState } from "react";
import { View, Text } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { publicApi } from "@/api/client";
import { Button, Input } from "@/components/ui";
import { toast } from "@/lib/toast";

// Newsletter sign-up band, ported from the #newsletter section in
// frontend/src/pages/Home.jsx — same endpoint, same source tag, same states.
//
// Uses publicApi: a visitor here is not signed in, and routing through the
// authenticated client would try (and fail) to refresh a token they don't have.
export default function NewsletterBand() {
  const [first, setFirst] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done

  const subscribe = async () => {
    if (status === "loading") return;
    if (!email.trim()) {
      toast.error("Please enter your email address.");
      return;
    }
    setStatus("loading");
    try {
      await publicApi.post("/newsletter/subscribe/", {
        email: email.trim(),
        first_name: first.trim(),
        source: "band",
      });
      setStatus("done");
    } catch (err) {
      toast.error(
        err.response?.data?.email?.[0] ||
          err.response?.data?.detail ||
          "Subscription failed. Please try again."
      );
      setStatus("idle");
    }
  };

  return (
    <View className="bg-navy px-6 py-12">
      <Text className="mb-4 text-center text-xs font-sans-semibold uppercase tracking-[2px] text-gold">
        Stay Inspired
      </Text>
      <Text className="mb-4 text-center font-display text-3xl leading-tight text-cream">
        A newsletter to help you <Text className="text-gold">grow</Text>, one week at a
        time.
      </Text>
      <Text className="mb-7 text-center font-sans text-sm leading-6 text-cream/70">
        Practical coaching insights, career strategies and the occasional story — clarity,
        growth and impact in one tidy package.
      </Text>

      {status === "done" ? (
        <View className="flex-row items-center justify-center gap-3 py-4">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-gold">
            <Feather name="check" size={20} color="#14213D" />
          </View>
          <Text className="font-display text-base text-cream">
            You're in! Watch your inbox.
          </Text>
        </View>
      ) : (
        <>
          <Input
            value={first}
            onChangeText={setFirst}
            placeholder="First Name"
            autoCapitalize="words"
          />
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="Email Address"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            variant="gold"
            onPress={subscribe}
            loading={status === "loading"}
            fullWidth
          >
            Sign Me Up
          </Button>
        </>
      )}
    </View>
  );
}
