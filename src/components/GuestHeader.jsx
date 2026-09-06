import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Modal, Animated, Easing } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { API_HOST } from "@/api/config";
import { useAuth } from "@/context/AuthContext";
import { homeHrefFor } from "@/lib/appMenu";
import { colors } from "@/theme/colors";

// Guest navbar, mirroring guestLinks in frontend/src/components/Navbar.jsx:
// Home · Who is Dr Nath · Offerings · Contact.
//
// On web the navbar is global (App.jsx renders it above every route), so every
// signed-out page carries it. Here the signed-in areas get native tab bars
// instead, and pushed routes get the Stack's own header — so this is the header
// for the routes that have neither: the landing page and the (auth) group.
//
// `onJump` is passed only by the landing page, where #who / #offerings scroll
// the page. Elsewhere those links navigate to the landing page and hand it the
// section through ?section=, this app's equivalent of the web anchor.
//
// `floating` overlays the bar on the content below (the landing hero, which
// runs edge to edge beneath it); without it the bar sits in normal flow.
export default function GuestHeader({ onJump, floating = false }) {
  const router = useRouter();
  const { isAuthenticated, role } = useAuth();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!open) return;
    setMounted(true);
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, anim]);

  const dismiss = (then) => {
    setOpen(false);
    Animated.timing(anim, {
      toValue: 0,
      duration: 160,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setMounted(false);
        anim.setValue(0);
        then?.();
      }
    });
  };

  // Each pill eases in slightly after the one above it.
  const pillStyle = (i, total) => {
    const from = (i / (total + 1)) * 0.5;
    const range = anim.interpolate({
      inputRange: [from, Math.min(from + 0.6, 1)],
      outputRange: [0, 1],
      extrapolate: "clamp",
    });
    return {
      opacity: range,
      transform: [
        { translateY: range.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
      ],
    };
  };

  const goSection = (key) =>
    onJump ? onJump(key) : router.push(key === "top" ? "/landing" : `/landing?section=${key}`);

  const go = (fn) => dismiss(fn);

  const LINKS = [
    { label: "Home", action: () => goSection("top") },
    { label: "Who is Dr Nath", action: () => goSection("who") },
    { label: "Offerings", action: () => goSection("offerings") },
    { label: "Contact", action: () => router.push("/contact") },
  ];

  return (
    <>
      {/* Cream -> gold gradient bar, matching navBg in Navbar.jsx. The logo image
          already contains the "Dr. NATH / COACHING FOR IMPACT" wordmark, so no
          separate text sits beside it — as on web. */}
      <SafeAreaView
        edges={["top"]}
        className={floating ? "absolute left-0 right-0 top-0 z-30" : "z-30"}
      >
        {/* navBg on web is a cream -> gold gradient
            (rgba(243,233,205) -> rgba(230,210,156)). Those stops are close
            enough over a 72px bar that a solid midpoint is indistinguishable —
            and it avoids expo-linear-gradient, a native module that would force
            a new dev build. */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#ECE0BE",
          }}
        />
        <View className="flex-row items-center justify-between px-5 py-2">
          <Pressable onPress={() => goSection("top")}>
            <Image
              source={{ uri: `${API_HOST}/dr-nath-logo.png` }}
              style={{ height: 72, width: 150 }}
              contentFit="contain"
              contentPosition="left center"
            />
          </Pressable>

          <Pressable onPress={() => setOpen(true)} hitSlop={10} className="p-1">
            <Feather name="menu" size={26} color={colors.navy} />
          </Pressable>
        </View>
      </SafeAreaView>

      {/* A stack of pills rather than a full-screen list: the guest menu is six
          short, flat items with no state to show, which is the shape this
          treatment suits. The signed-in menu (AppMenu) stays a grouped sheet,
          because sixteen items in five categories is not. */}
      <Modal visible={mounted} transparent animationType="none" onRequestClose={() => dismiss()}>
        <Animated.View style={{ opacity: anim }} className="absolute inset-0">
          <Pressable
            className="flex-1 bg-navy-deep/92"
            onPress={() => dismiss()}
            accessibilityLabel="Close menu"
          />
        </Animated.View>

        <SafeAreaView edges={["top"]} className="flex-1" pointerEvents="box-none">
          <View className="flex-row items-center justify-end px-5" style={{ height: 88 }}>
            <Pressable onPress={() => dismiss()} hitSlop={10} className="p-1">
              <Feather name="x" size={26} color={colors.cream} />
            </Pressable>
          </View>

          <View className="items-end gap-2.5 px-5 pt-2" pointerEvents="box-none">
            {LINKS.map((l, i) => (
              <Animated.View key={l.label} style={pillStyle(i, LINKS.length + 2)}>
                <Pressable
                  onPress={() => go(l.action)}
                  className="rounded-full border border-cream/15 bg-cream/10 px-6 py-3.5 active:bg-cream/20"
                >
                  <Text className="font-sans-semibold text-base text-cream">{l.label}</Text>
                </Pressable>
              </Animated.View>
            ))}

            {/* Web swaps guestLinks for the signed-in nav on this same page
                (flatLinks in Navbar.jsx). Offering "Login" to someone already
                logged in is the mobile version of not doing that. */}
            <Animated.View style={pillStyle(LINKS.length, LINKS.length + 2)} className="mt-3">
              <Pressable
                onPress={() =>
                  go(() =>
                    isAuthenticated
                      ? router.replace(homeHrefFor(role))
                      : router.push("/login")
                  )
                }
                className="rounded-full border border-cream/40 px-7 py-3.5 active:bg-cream/10"
              >
                <Text className="font-sans-bold text-base text-cream">
                  {isAuthenticated ? "Go to my account" : "Login"}
                </Text>
              </Pressable>
            </Animated.View>

            <Animated.View style={pillStyle(LINKS.length + 1, LINKS.length + 2)}>
              <Pressable
                onPress={() => go(() => goSection("newsletter"))}
                className="rounded-full bg-gold px-7 py-3.5 active:bg-gold-light"
              >
                <Text className="font-sans-bold text-base text-navy-deep">
                  Newsletter Sign Up
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}
