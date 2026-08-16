import { useState } from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from "react-native";
import { useRouter, useLocalSearchParams, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { Button, Input } from "@/components/ui";
import { toast } from "@/lib/toast";

// Mobile port of frontend/src/pages/Login.jsx. Same endpoint, same field
// semantics (the "username" field accepts a username OR an email), and the same
// error handling — including the 429 case, since the backend throttles login at
// 10/min per IP (REST_FRAMEWORK DEFAULT_THROTTLE_RATES in config/settings.py).
export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  // Deep links (e.g. an emailed join link via app/join/[token].jsx) pass a
  // destination through ?next= so the user lands where they were headed.
  const { next } = useLocalSearchParams();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
          router.replace(isCoach ? "/(coach)/dashboard" : "/(client)/dashboard");
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
          <Text className="text-xs font-sans-semibold uppercase tracking-[3px] text-gold">
            Dr. Nath · Coaching for Impact
          </Text>
          <Text className="mt-3 font-display text-4xl text-cream">Welcome back</Text>
          <Text className="mt-2 font-sans text-base text-slate-light">
            Sign in to reach your sessions, resources and coach.
          </Text>

          <View className="mt-8 rounded-3xl bg-cream p-5">
            <Input
              label="Username or email"
              placeholder="Your username or email"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
            />

            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
            />

            {formError ? (
              <Text className="mb-3 font-sans text-sm text-red-700">{formError}</Text>
            ) : null}

            <Button onPress={onSubmit} loading={submitting} fullWidth variant="gold">
              Sign in
            </Button>

            <Link href="/forgot-password" asChild>
              <Pressable className="mt-4 items-center">
                <Text className="font-sans text-sm text-gold-deep">
                  Forgot your password?
                </Text>
              </Pressable>
            </Link>
          </View>

          <Link href="/register" asChild>
            <Pressable className="mt-6 items-center">
              <Text className="font-sans text-sm text-slate-light">
                New here? <Text className="text-gold">Create an account</Text>
              </Text>
            </Pressable>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
