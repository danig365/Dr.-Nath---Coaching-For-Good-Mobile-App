import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  Animated,
  Easing,
} from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { isUpcomingSession } from "@/lib/sessionTiming";
import { useAppMenuVisible } from "@/lib/appMenu";
import { colors } from "@/theme/colors";

// The only navigation in the signed-in app. There is no tab bar: every page is
// reached from this sheet, which is why nothing may ever be missing from it.
//
// The groups mirror coachGroups / clientGroups in
// frontend/src/components/Navbar.jsx, so someone who knows the website finds
// things under the same headings. Account is the one addition to both: web
// keeps My Profile in an avatar dropdown, and a phone has no avatar dropdown.
//
// It opens from the bottom rather than a top-left hamburger because that is
// where the thumb already is on a large phone.
const COACH_GROUPS = [
  {
    label: "Sessions",
    items: [
      { icon: "calendar", label: "My Sessions", href: "/(coach)/sessions", badge: "upcoming" },
      { icon: "clock", label: "My Availability", href: "/(coach)/availability" },
      { icon: "users", label: "Group Sessions", href: "/group-sessions" },
    ],
  },
  {
    label: "Clients",
    items: [
      { icon: "user-check", label: "My Clients", href: "/(coach)/clients" },
      { icon: "compass", label: "Coaches", href: "/coaches" },
    ],
  },
  {
    label: "Offerings",
    items: [
      { icon: "award", label: "My Skills", href: "/(coach)/skills" },
      { icon: "plus-circle", label: "Add Skill", href: "/add-skill" },
    ],
  },
  {
    label: "Workspace",
    items: [
      // Library, Client Submissions, Agreements and Forms are sub-tabs across
      // the top of the Resources screen (WorkspaceTabs), exactly as on web, so
      // they are not repeated here.
      { icon: "folder", label: "Resources", href: "/(coach)/resources" },
      { icon: "target", label: "Milestones", href: "/milestones" },
      { icon: "activity", label: "Habits", href: "/habits" },
    ],
  },
  {
    label: "Account",
    items: [
      // Contact is a guest-only link on web (guestLinks in Navbar.jsx, gated by
      // `!isAuthenticated`), so it is not in a signed-in menu here either. The
      // page still exists and the landing header still links to it.
      { icon: "user", label: "My Profile", href: "/(coach)/profile" },
    ],
  },
];

const CLIENT_GROUPS = [
  { label: null, items: [{ icon: "home", label: "Home", href: "/(client)/dashboard" }] },
  {
    label: "Sessions",
    items: [
      { icon: "book-open", label: "My Learning", href: "/(client)/learning", badge: "upcoming" },
      // Web files this under "Coaches" as "Browse Skills". That labelling is what
      // sent a real client hunting for how to book, so here it keeps the name of
      // the thing it does and sits where someone looks for sessions.
      { icon: "plus-circle", label: "Book a Session", href: "/(client)/book" },
      { icon: "users", label: "Group Sessions", href: "/group-sessions" },
    ],
  },
  {
    label: "Coaches",
    items: [
      { icon: "user-check", label: "Browse Coaches", href: "/coaches" },
      { icon: "search", label: "Find Match", href: "/match" },
    ],
  },
  {
    label: "Workspace",
    items: [
      // Agreements and Forms are sub-tabs of the Resources screen, as on web.
      { icon: "folder", label: "Resources", href: "/(client)/resources" },
      { icon: "target", label: "Milestones", href: "/milestones" },
      { icon: "activity", label: "Habits", href: "/habits" },
    ],
  },
  {
    label: "Account",
    items: [
      { icon: "user", label: "My Profile", href: "/(client)/profile" },
    ],
  },
];

// Groups render as `/(coach)/x` or `/(client)/x` but the router reports the
// pathname without the group segment.
const toPathname = (href) => href.replace("/(coach)", "").replace("/(client)", "");

export default function AppMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { firstName, user, role } = useAuth();
  const visible = useAppMenuVisible();

  const isCoach = role === "coach" || role === "mentor";
  const groups = isCoach ? COACH_GROUPS : CLIENT_GROUPS;

  const [mounted, setMounted] = useState(false);
  const [upcoming, setUpcoming] = useState(0);
  const fetched = useRef(false);
  const anim = useRef(new Animated.Value(0)).current;

  // Only when the sheet is first opened — a coach shouldn't pay for a bookings
  // request on every screen just to render a badge.
  const loadBadge = useCallback(async () => {
    if (fetched.current) return;
    fetched.current = true;
    try {
      const res = await api.get("/bookings/");
      const all = Array.isArray(res.data) ? res.data : (res.data.results ?? []);
      setUpcoming(all.filter(isUpcomingSession).length);
    } catch {
      setUpcoming(0);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    Animated.timing(anim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [mounted, anim]);

  const open = () => {
    loadBadge();
    setMounted(true);
  };

  const close = (then) => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
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

  // `navigate` rather than `push`: returning to a screen already in the stack
  // pops back to it instead of stacking a second copy, which is what a tab bar
  // would have done.
  const go = (href) => close(() => router.navigate(href));

  if (!visible) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [520, 0] });

  return (
    <>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel="Open navigation menu"
        style={{ bottom: insets.bottom + 20 }}
        className="absolute left-1/2 -ml-[62px] w-[124px] flex-row items-center justify-center gap-2 rounded-full border border-gold/40 bg-navy-deep py-3 active:bg-navy"
      >
        <Feather name="menu" size={16} color={colors.gold} />
        <Text className="font-sans-bold text-sm text-cream">Menu</Text>
      </Pressable>

      <Modal
        visible={mounted}
        transparent
        animationType="none"
        onRequestClose={() => close()}
        statusBarTranslucent
      >
        <View className="flex-1 justify-end">
          <Animated.View style={{ opacity: anim }} className="absolute inset-0">
            <Pressable
              onPress={() => close()}
              accessibilityLabel="Close menu"
              className="flex-1 bg-navy-deep/70"
            />
          </Animated.View>

          <Animated.View
            style={{ transform: [{ translateY }], maxHeight: "80%" }}
            className="overflow-hidden rounded-t-3xl bg-navy-deep"
          >
            <View className="mt-2.5 h-1 w-10 self-center rounded-full bg-gold/50" />

            <View className="border-b border-gold/15 px-5 pb-3 pt-2">
              <Text className="text-[10px] font-sans-bold uppercase tracking-[3px] text-gold">
                {isCoach ? "Coach" : "Client"}
              </Text>
              <Text className="font-display text-xl text-cream">
                {firstName || user?.username || "Menu"}
              </Text>
            </View>

            <ScrollView
              contentContainerStyle={{ paddingBottom: insets.bottom + 18, paddingTop: 4 }}
            >
              {groups.map((group, gi) => (
                <View key={group.label ?? `g${gi}`}>
                  {group.label ? (
                    <Text className="px-5 pb-1 pt-3 text-[10px] font-sans-bold uppercase tracking-[3px] text-gold/75">
                      {group.label}
                    </Text>
                  ) : null}

                  {group.items.map((item) => {
                    const active = pathname === toPathname(item.href);
                    return (
                      <Pressable
                        key={item.href}
                        onPress={() => go(item.href)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        className={`flex-row items-center gap-3 px-5 py-2.5 active:bg-white/10 ${
                          active ? "border-l-[3px] border-gold bg-gold/15 pl-[17px]" : ""
                        }`}
                      >
                        <Feather name={item.icon} size={17} color={colors.gold} />
                        <Text className="flex-1 font-sans text-[15px] text-cream">
                          {item.label}
                        </Text>

                        {item.badge === "upcoming" && upcoming > 0 ? (
                          <View className="rounded-full bg-gold px-2 py-0.5">
                            <Text className="font-sans-bold text-xs text-navy-deep">
                              {upcoming > 99 ? "99+" : upcoming}
                            </Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}
