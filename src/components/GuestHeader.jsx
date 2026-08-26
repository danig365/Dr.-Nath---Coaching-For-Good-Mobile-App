import { useState } from "react";
import { View, Text, Pressable, Modal } from "react-native";
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

  const goSection = (key) =>
    onJump ? onJump(key) : router.push(key === "top" ? "/landing" : `/landing?section=${key}`);

  const go = (fn) => {
    setOpen(false);
    fn();
  };

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

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-navy-deep/95" onPress={() => setOpen(false)}>
          <SafeAreaView edges={["top"]} className="flex-1">
            <View className="flex-row justify-end px-5 py-3">
              <Pressable onPress={() => setOpen(false)} hitSlop={10} className="p-1">
                <Feather name="x" size={26} color={colors.cream} />
              </Pressable>
            </View>

            <View className="mt-6 px-8">
              {LINKS.map((l) => (
                <Pressable
                  key={l.label}
                  onPress={() => go(l.action)}
                  className="border-b border-white/10 py-5"
                >
                  <Text className="font-display text-2xl text-cream">{l.label}</Text>
                </Pressable>
              ))}

              {/* Web swaps guestLinks for the signed-in nav on this same page
                  (flatLinks in Navbar.jsx). Offering "Login" to someone already
                  logged in is the mobile version of not doing that. */}
              <Pressable
                onPress={() =>
                  go(() =>
                    isAuthenticated
                      ? router.replace(homeHrefFor(role))
                      : router.push("/login")
                  )
                }
                className="mt-8 items-center rounded-full border border-cream/40 py-4"
              >
                <Text className="font-sans-bold text-base text-cream">
                  {isAuthenticated ? "Go to my account" : "Login"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => go(() => goSection("newsletter"))}
                className="mt-3 items-center rounded-full bg-gold py-4"
              >
                <Text className="font-sans-bold text-base text-navy-deep">
                  Newsletter Sign Up
                </Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </Pressable>
      </Modal>
    </>
  );
}
