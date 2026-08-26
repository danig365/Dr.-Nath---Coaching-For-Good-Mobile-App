import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { useAuth } from "@/context/AuthContext";
import { toast } from "@/lib/toast";

// Mobile port of frontend/src/pages/Login.jsx. Same endpoint, same field
// semantics (the "username" field accepts a username OR an email), and the same
// error handling — including the 429 case, since the backend throttles login at
// 10/min per IP (REST_FRAMEWORK DEFAULT_THROTTLE_RATES in config/settings.py).
//
// The web page is a two-column split whose left panel is desktop-only, so this
// ports the right-hand card — the part a phone actually renders.
//
// One deliberate omission: web draws a "Remember me" checkbox that holds no
// state and is read nowhere. Here the refresh token lives in SecureStore and
// the session persists across launches regardless, so the control would be
// doubly meaningless.

// Web: background #FAF6EC, 1px rgba(200,169,81,0.3), gold on focus.
const FIELD_BORDER = "rgba(200,169,81,0.3)";
const FIELD_BORDER_FOCUS = "#C8A951";

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  // Deep links (e.g. an emailed join link via app/join/[token].jsx) pass a
  // destination through ?next= so the user lands where they were headed.
  const { next } = useLocalSearchParams();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [focused, setFocused] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    const u = username.trim();
    if (!u || !password) {
      setFormError("Please enter both your username and password.");
      return;
    }

    setFormError("");
    setSubmitting(true);
    try {
      const user = await login(u, password);
      if (user) {
        const isCoach = user.role === "coach" || user.role === "mentor";
        if (user.is_profile_complete === false) {
          router.replace(
            next ? `/complete-profile?next=${encodeURIComponent(next)}` : "/complete-profile"
          );
        } else if (next) {
          router.replace(next);
        } else {
          router.replace(isCoach ? "/(coach)/skills" : "/(client)/book");
        }
      }
    } catch (err) {
      const status = err.response?.status;
      const msg =
        status === 429
          ? "Too many attempts. Please wait a minute and try again."
          : err.response?.data?.detail ||
            "Couldn't sign you in. Please check your connection and try again.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const borderFor = (name) => (focused === name ? FIELD_BORDER_FOCUS : FIELD_BORDER);

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-navy-deep">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-5 py-8"
          keyboardShouldPersistTaps="handled"
        >
          {/* Card */}
          <View
            className="overflow-hidden rounded-2xl"
            style={{
              backgroundColor: "rgba(255,255,255,0.04)",
              borderWidth: 1,
              borderColor: "rgba(200,169,81,0.15)",
            }}
          >
            {/* Header */}
            <View
              className="px-6 py-5"
              style={{ borderBottomWidth: 1, borderBottomColor: "rgba(200,169,81,0.1)" }}
            >
              <Text className="font-display text-3xl text-white">Sign In</Text>
              <Text className="mt-1 font-sans text-sm" style={{ color: "rgba(250,246,236,0.5)" }}>
                Access your Dr. Nath account
              </Text>
            </View>

            {/* Mid-booking context: tell the user why they're here */}
            {typeof next === "string" && next.startsWith("/book/") ? (
              <View
                className="mx-6 mt-5 flex-row items-start gap-2.5 rounded-xl px-4 py-3"
                style={{
                  backgroundColor: "rgba(200,169,81,0.12)",
                  borderWidth: 1,
                  borderColor: "rgba(200,169,81,0.3)",
                }}
              >
                <Feather name="check-circle" size={18} color="#C8A951" style={{ marginTop: 1 }} />
                <Text
                  className="flex-1 font-sans text-sm leading-5"
                  style={{ color: "rgba(250,246,236,0.85)" }}
                >
                  Almost there! Sign in to confirm your booking — your selected time and
                  details are saved.
                </Text>
              </View>
            ) : null}

            <View className="px-6 py-6">
              {/* Username or email */}
              <Text
                className="mb-1.5 text-xs font-sans-semibold uppercase tracking-wider"
                style={{ color: "rgba(200,169,81,0.8)" }}
              >
                Username or email
              </Text>
              <View className="relative justify-center">
                <View className="absolute left-3.5 z-10">
                  <Feather name="user" size={16} color="#C8A951" />
                </View>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  onFocus={() => setFocused("username")}
                  onBlur={() => setFocused("")}
                  placeholder="Enter your username or email"
                  placeholderTextColor="#7A8699"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  textContentType="username"
                  returnKeyType="next"
                  className="rounded-xl py-3 pl-10 pr-4 font-sans text-sm"
                  style={{
                    backgroundColor: "#FAF6EC",
                    borderWidth: 1,
                    borderColor: borderFor("username"),
                    color: "#1B2B4A",
                  }}
                />
              </View>

              {/* Password — the label row carries the forgot link, as on web */}
              <View className="mb-1.5 mt-4 flex-row items-center justify-between">
                <Text
                  className="text-xs font-sans-semibold uppercase tracking-wider"
                  style={{ color: "rgba(200,169,81,0.8)" }}
                >
                  Password
                </Text>
                <Link href="/forgot-password" asChild>
                  <Pressable hitSlop={8}>
                    <Text className="font-sans text-xs" style={{ color: "rgba(200,169,81,0.5)" }}>
                      Forgot password?
                    </Text>
                  </Pressable>
                </Link>
              </View>
              <View className="relative justify-center">
                <View className="absolute left-3.5 z-10">
                  <Feather name="lock" size={16} color="#C8A951" />
                </View>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused("")}
                  placeholder="Enter your password"
                  placeholderTextColor="#7A8699"
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={onSubmit}
                  className="rounded-xl py-3 pl-10 pr-11 font-sans text-sm"
                  style={{
                    backgroundColor: "#FAF6EC",
                    borderWidth: 1,
                    borderColor: borderFor("password"),
                    color: "#1B2B4A",
                  }}
                />
                <Pressable
                  onPress={() => setShowPass((v) => !v)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={showPass ? "Hide password" : "Show password"}
                  className="absolute right-3.5 z-10"
                >
                  <Feather
                    name={showPass ? "eye-off" : "eye"}
                    size={16}
                    color="rgba(200,169,81,0.85)"
                  />
                </Pressable>
              </View>

              {formError ? (
                <View
                  className="mt-4 rounded-xl px-4 py-3"
                  style={{
                    backgroundColor: "rgba(239,68,68,0.12)",
                    borderWidth: 1,
                    borderColor: "rgba(239,68,68,0.4)",
                  }}
                >
                  <Text className="font-sans text-sm" style={{ color: "#FCA5A5" }}>
                    {formError}
                  </Text>
                </View>
              ) : null}

              {/* Web uses .gold-btn — a full-width gold pill. Built inline rather
                  than with <Button> so the label can carry the arrow. */}
              <Pressable
                onPress={submitting ? undefined : onSubmit}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityState={{ disabled: submitting, busy: submitting }}
                className={`mt-5 w-full flex-row items-center justify-center rounded-full bg-gold py-3.5 active:bg-gold-light ${
                  submitting ? "opacity-50" : ""
                }`}
              >
                {submitting ? (
                  <>
                    <ActivityIndicator size="small" color="#1B2B4A" />
                    <Text className="ml-2 font-sans-bold text-sm text-navy">Signing in...</Text>
                  </>
                ) : (
                  <Text className="font-sans-bold text-sm text-navy">Sign In →</Text>
                )}
              </Pressable>

              <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} asChild>
                <Pressable className="mt-5 items-center">
                  <Text className="font-sans text-xs" style={{ color: "rgba(250,246,236,0.4)" }}>
                    Don&apos;t have an account?{" "}
                    <Text
                      className="font-sans-semibold"
                      style={{ color: "rgba(200,169,81,0.8)" }}
                    >
                      Create one
                    </Text>
                  </Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
