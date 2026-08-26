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

import { api } from "@/api/client";
import { Button, Input } from "@/components/ui";
import { toast } from "@/lib/toast";
import { useKeyboardHeight } from "@/lib/useKeyboardHeight";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/Register.jsx — the same three-step wizard.
//
// The web page's left-hand marketing panel is `hidden lg:flex`, i.e. already
// hidden on phone widths, so it is deliberately absent here rather than dropped.
const steps = ["Account", "Profile", "Details"];

function PasswordStrength({ password }) {
  const checks = [
    { label: "8+ characters", ok: password.length >= 8 },
    { label: "Uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "Number", ok: /\d/.test(password) },
  ];
  if (!password) return null;

  return (
    <View className="mb-4 -mt-2 flex-row flex-wrap gap-3">
      {checks.map((c) => (
        <View key={c.label} className="flex-row items-center gap-1">
          <Feather
            name="check-circle"
            size={13}
            color={c.ok ? colors.gold : colors.slateLight}
          />
          <Text
            className={`font-sans text-xs ${c.ok ? "text-gold-deep" : "text-slate-light"}`}
          >
            {c.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function StepIndicator({ step }) {
  return (
    <View className="mb-8 flex-row items-center justify-center gap-2">
      {steps.map((s, i) => (
        <View key={s} className="flex-row items-center gap-2">
          <View
            className={`h-7 w-7 items-center justify-center rounded-full ${
              i <= step ? "bg-gold" : "bg-white/10"
            }`}
          >
            <Text
              className={`font-sans-bold text-xs ${
                i <= step ? "text-navy-deep" : "text-slate-light"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </Text>
          </View>
          <Text
            className={`font-sans-medium text-xs ${
              i === step ? "text-gold" : "text-slate-light"
            }`}
          >
            {s}
          </Text>
          {i < steps.length - 1 && <View className="mx-1 h-px w-5 bg-white/15" />}
        </View>
      ))}
    </View>
  );
}

export default function Register() {
  const router = useRouter();
  const keyboardHeight = useKeyboardHeight();
  const { next } = useLocalSearchParams();

  const [step, setStep] = useState(0);
  const [showPass, setShowPass] = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    password2: "",
    // No default — the user must consciously pick a role. A pre-selected role
    // let people register as the wrong type without noticing (a client landed on
    // a coach account this way). A ?role= link is deliberately NOT honoured.
    role: "",
    bio: "",
    specialties: [],
    certifications: [],
    hourly_rate: null,
    years_experience: null,
    languages: [],
    industries: [],
    organisation: "",
    job_title: "",
  });

  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [emailTaken, setEmailTaken] = useState(false);

  const setField = (name, value) => {
    setFormError("");
    setFieldErrors((fe) => ({ ...fe, [name]: undefined }));
    if (name === "email") setEmailTaken(false);
    setForm((f) => ({ ...f, [name]: value }));
  };

  // Validate the account step with a specific message per field.
  const validateStep0 = () => {
    const errs = {};
    const u = form.username.trim();
    const em = form.email.trim();
    if (u.length < 3) errs.username = "Username must be at least 3 characters.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em))
      errs.email = "Please enter a valid email address.";
    if (form.password.length < 8)
      errs.password = "Password must be at least 8 characters.";
    else if (form.password !== form.password2)
      errs.password2 = "The two passwords don't match.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Advance from step 0 only once it validates AND username/email are free — so
  // a taken account is flagged here, not at the very end of the form.
  const advanceFromStep0 = async () => {
    setFormError("");
    if (!validateStep0()) return;
    setChecking(true);
    try {
      const res = await api.post("/register/check/", {
        username: form.username.trim(),
        email: form.email.trim(),
      });
      const errs = {};
      if (res.data.username_taken)
        errs.username = "This username is already taken. Please choose another.";
      if (res.data.email_taken) {
        errs.email = "An account with this email already exists.";
        setEmailTaken(true);
      }
      if (Object.keys(errs).length) {
        setFieldErrors(errs);
        return;
      }
      setStep(1);
    } catch {
      // If the availability check fails (e.g. network), let them continue — the
      // final submit still validates everything server-side.
      setStep(1);
    } finally {
      setChecking(false);
    }
  };

  const handleNext = () => {
    if (step === 0) {
      advanceFromStep0();
      return;
    }
    if (step === 1) {
      if (!form.role) {
        setFormError("Please choose whether you're a client or a coach.");
        return;
      }
      setStep(2);
      return;
    }
    handleSubmit();
  };

  const handleSubmit = async () => {
    setFormError("");
    setIsLoading(true);
    try {
      await api.post("/register/", {
        ...form,
        username: form.username.trim(),
        email: form.email.trim(),
      });

      if (form.role === "coach") {
        toast.info("Registration submitted. Your profile is under review.");
      } else {
        toast.success("Registered successfully! You can now log in.");
      }

      router.replace(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
    } catch (err) {
      const d = err.response?.data;
      if (d && typeof d === "object") {
        const fe = {};
        let general = "";
        for (const [k, v] of Object.entries(d)) {
          const text = Array.isArray(v) ? v.join(" ") : String(v);
          if (["username", "email", "password", "password2"].includes(k)) fe[k] = text;
          else general = general ? `${general} ${text}` : text;
        }
        setFieldErrors(fe);
        if (fe.email && /exist/i.test(fe.email)) setEmailTaken(true);
        // A step-0 field failed server-side (e.g. a weak password) — send the
        // user back so the error shows right under the offending field.
        if (fe.username || fe.email || fe.password || fe.password2) setStep(0);
        setFormError(general);
        toast.error(general || "Please fix the highlighted fields.");
      } else {
        setFormError(
          "Couldn't create your account. Please check your connection and try again."
        );
        toast.error("An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isStep0Valid =
    form.username &&
    form.email &&
    form.password &&
    form.password2 &&
    form.password === form.password2;
  const isStep1Valid = !!form.role;

  const heading =
    step === 0 ? "Create Your Account" : step === 1 ? "Choose Your Role" : "Complete Your Profile";
  const subheading =
    step === 0
      ? "Join Coaching for Impact today"
      : step === 1
        ? "How will you be using the platform?"
        : "Just a few more details";

  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-navy-deep">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="px-5 py-8"
          keyboardShouldPersistTaps="handled"
        >
          <StepIndicator step={step} />

          <Text className="font-display text-3xl text-cream">{heading}</Text>
          <Text className="mt-1 font-sans text-sm text-slate-light">{subheading}</Text>

          {/* Mid-booking context: tell the user why they're here */}
          {typeof next === "string" && next.startsWith("/book/") ? (
            <View className="mt-5 flex-row items-start gap-2.5 rounded-xl border border-gold/30 bg-gold/10 p-4">
              <Feather name="check-circle" size={18} color={colors.gold} />
              <Text className="flex-1 font-sans text-sm text-cream">
                Create your account to confirm your booking — your selected time and
                details are saved.
              </Text>
            </View>
          ) : null}

          <View className="mt-6 rounded-2xl bg-cream p-5">
            {step === 0 && (
              <>
                <Input
                  label="Username"
                  placeholder="Choose a username"
                  value={form.username}
                  onChangeText={(v) => setField("username", v)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={fieldErrors.username}
                />

                <Input
                  label="Email"
                  placeholder="your@email.com"
                  value={form.email}
                  onChangeText={(v) => setField("email", v)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={fieldErrors.email}
                />
                {emailTaken ? (
                  <Link href={loginHref} asChild>
                    <Pressable className="-mt-3 mb-4">
                      <Text className="font-sans-semibold text-xs text-gold-deep underline">
                        Sign in instead
                      </Text>
                    </Pressable>
                  </Link>
                ) : null}

                <View className="relative">
                  <Input
                    label="Password"
                    placeholder="Create a strong password"
                    value={form.password}
                    onChangeText={(v) => setField("password", v)}
                    secureTextEntry={!showPass}
                    autoCapitalize="none"
                    error={fieldErrors.password}
                  />
                  <Pressable
                    onPress={() => setShowPass((v) => !v)}
                    hitSlop={10}
                    className="absolute right-4 top-9"
                  >
                    <Feather
                      name={showPass ? "eye-off" : "eye"}
                      size={18}
                      color={colors.slateLight}
                    />
                  </Pressable>
                </View>
                <PasswordStrength password={form.password} />

                <View className="relative">
                  <Input
                    label="Confirm Password"
                    placeholder="Repeat your password"
                    value={form.password2}
                    onChangeText={(v) => setField("password2", v)}
                    secureTextEntry={!showPass2}
                    autoCapitalize="none"
                    error={
                      fieldErrors.password2 ||
                      (form.password2 && form.password !== form.password2
                        ? "The two passwords don't match."
                        : undefined)
                    }
                  />
                  <Pressable
                    onPress={() => setShowPass2((v) => !v)}
                    hitSlop={10}
                    className="absolute right-4 top-9"
                  >
                    <Feather
                      name={showPass2 ? "eye-off" : "eye"}
                      size={18}
                      color={colors.slateLight}
                    />
                  </Pressable>
                </View>
              </>
            )}

            {step === 1 && (
              <View className="gap-4">
                {[
                  {
                    value: "client",
                    icon: "🎯",
                    title: "I'm a Client",
                    desc: "I want to find a coach and work on my personal or professional growth.",
                  },
                  {
                    value: "coach",
                    icon: "🏆",
                    title: "I'm a Coach",
                    desc: "I want to offer my expertise and coach clients through their challenges.",
                  },
                ].map((opt) => {
                  const selected = form.role === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setField("role", opt.value)}
                      className={`rounded-xl border-2 p-5 ${
                        selected ? "border-gold bg-gold/10" : "border-cream-warm bg-white"
                      }`}
                    >
                      <View className="flex-row items-start gap-4">
                        <Text className="text-2xl">{opt.icon}</Text>
                        <View className="flex-1">
                          <Text className="mb-1 font-sans-semibold text-sm text-navy">
                            {opt.title}
                          </Text>
                          <Text className="font-sans text-xs text-slate">{opt.desc}</Text>
                        </View>
                        {selected ? (
                          <Feather name="check-circle" size={18} color={colors.gold} />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {step === 2 && (
              <>
                {form.role === "coach" && (
                  <>
                    <Input
                      label="Specialties"
                      placeholder="e.g. Leadership, Executive, Career"
                      onChangeText={(v) =>
                        setForm((f) => ({
                          ...f,
                          specialties: v.split(",").map((s) => s.trim()),
                        }))
                      }
                      hint="Separate with commas"
                    />
                    <Input
                      label="Certifications"
                      placeholder="e.g. ICF PCC, EMCC"
                      onChangeText={(v) =>
                        setForm((f) => ({
                          ...f,
                          certifications: v.split(",").map((s) => s.trim()),
                        }))
                      }
                      hint="Separate with commas"
                    />
                    <Input
                      label="Hourly Rate (USD)"
                      placeholder="150"
                      keyboardType="numeric"
                      onChangeText={(v) => setField("hourly_rate", v)}
                    />
                    <Input
                      label="Years Exp."
                      placeholder="5"
                      keyboardType="numeric"
                      onChangeText={(v) => setField("years_experience", v)}
                    />
                    <Input
                      label="Industries"
                      placeholder="e.g. Healthcare, Finance, Tech"
                      onChangeText={(v) =>
                        setForm((f) => ({
                          ...f,
                          industries: v.split(",").map((s) => s.trim()),
                        }))
                      }
                      hint="Separate with commas"
                    />
                  </>
                )}

                {form.role === "client" && (
                  <>
                    <Input
                      label="Organisation"
                      placeholder="Your company or organisation"
                      value={form.organisation}
                      onChangeText={(v) => setField("organisation", v)}
                    />
                    <Input
                      label="Job Title"
                      placeholder="e.g. Product Manager"
                      value={form.job_title}
                      onChangeText={(v) => setField("job_title", v)}
                    />
                  </>
                )}

                <Input
                  label="About You (Optional)"
                  placeholder="Tell us a bit about yourself..."
                  value={form.bio}
                  onChangeText={(v) => setField("bio", v)}
                  multiline
                />
              </>
            )}

            {formError && (step === 1 || step === 2) ? (
              <View className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3">
                <Text className="font-sans text-sm text-red-700">{formError}</Text>
              </View>
            ) : null}

            <View className="flex-row gap-3 pt-1">
              {step > 0 ? (
                <Button
                  variant="outline"
                  onPress={() => setStep((s) => s - 1)}
                  className="flex-1"
                >
                  ← Back
                </Button>
              ) : null}

              <Button
                variant="gold"
                className="flex-1"
                loading={isLoading || checking}
                disabled={
                  (step === 0 && !isStep0Valid) || (step === 1 && !isStep1Valid)
                }
                onPress={handleNext}
              >
                {step < 2 ? "Continue →" : "Create Account →"}
              </Button>
            </View>
          </View>

          <View className="mt-5 flex-row items-center justify-center gap-1">
            <Text className="font-sans text-xs text-slate-light">
              Already have an account?
            </Text>
            <Link href={loginHref} asChild>
              <Pressable>
                <Text className="font-sans-semibold text-xs text-gold">Sign in</Text>
              </Pressable>
            </Link>
          </View>

          {/* Lets the fields below the focused one scroll clear of the keyboard. */}
          <View style={{ height: keyboardHeight }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
