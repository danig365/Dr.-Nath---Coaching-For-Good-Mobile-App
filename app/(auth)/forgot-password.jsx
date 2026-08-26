import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { publicApi } from "@/api/client";
import { Button, Input } from "@/components/ui";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/ForgotPassword.jsx — same endpoint, same copy, same
// 429 handling (the backend throttles this path).
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    setBusy(true);
    try {
      await publicApi.post("/password-reset/", { email: email.trim() });
      setSent(true);
    } catch (err) {
      const s = err.response?.status;
      setError(
        s === 429
          ? "Too many attempts. Please wait a minute and try again."
          : "Something went wrong. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-navy-deep">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-10"
          keyboardShouldPersistTaps="handled"
        >
          {sent ? (
            <View className="items-center">
              <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <Feather name="check-circle" size={26} color="#34A853" />
              </View>
              <Text className="mb-2 font-display text-2xl text-cream">Check your inbox</Text>
              <Text className="text-center font-sans text-sm text-slate-light">
                If an account exists for{" "}
                <Text className="text-cream">{email}</Text>, we've sent a link to reset
                your password. It may take a minute to arrive — do check your spam folder
                too.
              </Text>
              <BackToSignIn className="mt-6" />
            </View>
          ) : (
            <>
              <Text className="mb-1 font-display text-2xl text-cream">
                Forgot your password?
              </Text>
              <Text className="mb-6 font-sans text-sm text-slate-light">
                Enter your account email and we'll send you a link to reset it.
              </Text>

              <View className="rounded-3xl bg-cream p-5">
                <Input
                  label="Email"
                  placeholder="you@email.com"
                  value={email}
                  onChangeText={(v) => {
                    setError("");
                    setEmail(v);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="go"
                  onSubmitEditing={submit}
                  error={error || undefined}
                />

                <Button onPress={submit} loading={busy} fullWidth variant="gold">
                  {busy ? "Sending…" : "Send reset link"}
                </Button>
              </View>

              <BackToSignIn className="mt-5" />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function BackToSignIn({ className = "" }) {
  return (
    <Link href="/login" asChild>
      <Pressable className={`flex-row items-center justify-center gap-2 ${className}`}>
        <Feather name="arrow-left" size={14} color={colors.gold} />
        <Text className="font-sans-semibold text-sm text-gold">Back to sign in</Text>
      </Pressable>
    </Link>
  );
}
