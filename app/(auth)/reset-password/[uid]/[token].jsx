import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { publicApi } from "@/api/client";
import { Button, Input } from "@/components/ui";
import { toast } from "@/lib/toast";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/ResetPassword.jsx. Reached from the emailed link,
// which carries uid + token — matching the web route /reset-password/:uid/:token.
export default function ResetPassword() {
  const { uid, token } = useLocalSearchParams();
  const router = useRouter();

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (pw.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }
    if (pw !== pw2) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await publicApi.post("/password-reset/confirm/", {
        uid,
        token,
        new_password: pw,
      });
      toast.success("Password reset! Please sign in with your new password.");
      router.replace("/login");
    } catch (err) {
      setError(
        err.response?.data?.detail || "Couldn't reset your password. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-navy-deep">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-10"
          keyboardShouldPersistTaps="handled"
        >
          <Text className="mb-1 font-display text-2xl text-cream">
            Choose a new password
          </Text>
          <Text className="mb-6 font-sans text-sm text-slate-light">
            Enter a new password for your account below.
          </Text>

          <View className="rounded-3xl bg-cream p-5">
            <View className="relative">
              <Input
                label="New password"
                placeholder="••••••••"
                value={pw}
                onChangeText={(v) => {
                  setError("");
                  setPw(v);
                }}
                secureTextEntry={!show}
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
              />
              <Pressable
                onPress={() => setShow((s) => !s)}
                hitSlop={10}
                className="absolute right-4 top-9"
              >
                <Feather
                  name={show ? "eye-off" : "eye"}
                  size={18}
                  color={colors.slateLight}
                />
              </Pressable>
            </View>

            <Input
              label="Confirm password"
              placeholder="••••••••"
              value={pw2}
              onChangeText={(v) => {
                setError("");
                setPw2(v);
              }}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={submit}
              error={error || undefined}
            />

            <Button onPress={submit} loading={busy} fullWidth variant="gold">
              {busy ? "Saving…" : "Reset password"}
            </Button>
          </View>

          <Link href="/login" asChild>
            <Pressable className="mt-5 flex-row items-center justify-center gap-2">
              <Feather name="arrow-left" size={14} color={colors.gold} />
              <Text className="font-sans-semibold text-sm text-gold">Back to sign in</Text>
            </Pressable>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
