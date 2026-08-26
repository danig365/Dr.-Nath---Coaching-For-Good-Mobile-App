import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, Modal, ActivityIndicator, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { API_HOST } from "@/api/config";
import { publicApi } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { homeHrefFor } from "@/lib/appMenu";
import { Button } from "@/components/ui";
import GuestHeader from "@/components/GuestHeader";
import StatsTicker from "@/components/landing/StatsTicker";
import NewsletterBand from "@/components/landing/NewsletterBand";
import Testimonials from "@/components/landing/Testimonials";
import { colors } from "@/theme/colors";

// Mobile port of frontend/src/pages/Home.jsx — same sections, same order, same
// copy:
//   guest navbar · hero · stats ticker · who is Dr Nath · newsletter ·
//   offerings · how coaching works · testimonials · final CTA · footer
//
// The web file also defines an FAQ accordion, but it is never rendered in the
// JSX — dead code — so it is not ported here either.

// Stepped equivalent of the web hero's legibility gradient
// (linear-gradient(to top, ...) in frontend/src/pages/Home.jsx): opaque at the
// bottom where the copy sits, nearly clear at the top where her face is.
const HERO_STOPS = [
  [0.0, 0.92],
  [0.08, 0.92],
  [0.4, 0.55],
  [0.7, 0.2],
  [1.0, 0.1],
];

const HERO_BAND_COUNT = 16;

const HERO_WASH = Array.from({ length: HERO_BAND_COUNT }, (_, i) => {
  const from = i / HERO_BAND_COUNT;
  const mid = from + 0.5 / HERO_BAND_COUNT;

  let alpha = HERO_STOPS[HERO_STOPS.length - 1][1];
  for (let k = 1; k < HERO_STOPS.length; k += 1) {
    const [p0, a0] = HERO_STOPS[k - 1];
    const [p1, a1] = HERO_STOPS[k];
    if (mid >= p0 && mid <= p1) {
      alpha = p1 === p0 ? a1 : a0 + ((a1 - a0) * (mid - p0)) / (p1 - p0);
      break;
    }
  }

  return {
    bottom: `${from * 100}%`,
    // A hair over one band tall, so rounding can't leave hairlines between them.
    height: `${100 / HERO_BAND_COUNT + 0.5}%`,
    alpha: alpha.toFixed(3),
  };
});

const HERO_OFFERINGS = [
  "Health and Wellness Coaching",
  "Executive and Leadership Coaching",
  "Business and Entrepreneurship Coaching",
  "Leadership and Management Program",
];

const PROMISES = [
  "Gain real clarity on your values, strengths and direction",
  "Build authentic confidence and leadership presence",
  "Turn insight into a concrete, trackable plan of action",
  "Navigate change and uncertainty with steadiness",
];

const OFFERINGS = [
  {
    icon: "sun",
    title: "Health and Wellness Coaching",
    desc: "Holistic coaching to help you build sustainable habits, manage stress and thrive in every dimension of your health.",
  },
  {
    icon: "users",
    title: "Executive and Leadership Coaching",
    desc: "Develop your leadership presence, sharpen your decision-making and lead with authentic, lasting confidence.",
  },
  {
    icon: "bar-chart-2",
    title: "Business Coaching for Entrepreneurs",
    desc: "Practical coaching for founders: strategy, growth mindset and the resilience to build something that lasts.",
  },
  {
    icon: "award",
    title: "Leadership and Management Program",
    desc: "A structured program for managers and emerging leaders to build the skills that drive teams and organizations forward.",
  },
];

const STEPS = [
  {
    num: "01",
    icon: "book-open",
    title: "Discover Your Goals",
    desc: "We start by exploring your vision, your values and what you would like to move forward.",
  },
  {
    num: "02",
    icon: "calendar",
    title: "Book Your Sessions",
    desc: "Schedule focused 1-on-1 coaching sessions.",
  },
  {
    num: "03",
    icon: "bar-chart-2",
    title: "Grow & Track Impact",
    desc: "Apply tailored frameworks, track real progress and become who you're meant to be.",
  },
];

// Mirrors the footer columns in frontend/src/pages/Home.jsx. "Explore" points at
// on-page anchors on the web (/#who, /#newsletter), so here those entries scroll
// this ScrollView instead of navigating.
const FOOTER = [
  {
    title: "Offerings",
    links: [
      { label: "1-on-1 Coaching", to: "/register" },
      { label: "Skill Programs", to: "/skills" },
      { label: "Smart Match", to: "/match" },
      { label: "Browse Coaches", to: "/coaches" },
    ],
  },
  {
    title: "Explore",
    links: [
      { label: "Who is Dr. Nath", jump: "who" },
      { label: "Newsletter", jump: "newsletter" },
    ],
  },
  {
    title: "Account",
    // Replaced at render for a signed-in visitor — see accountLinks below.
    links: [
      { label: "Sign Up", to: "/register" },
      { label: "Log In", to: "/login" },
      { label: "My Learning", to: "/(client)/learning" },
    ],
  },
];

// "Explore More" opens Dr Nath's full profile — same coach id as the web.
function DrNathModal({ onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    publicApi
      .get("/coaches/51/")
      .then((res) => alive && setProfile(res.data))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const Section = ({ icon, title, items }) =>
    items?.length ? (
      <View className="mb-4 rounded-2xl border border-navy/10 bg-white p-5">
        <View className="mb-3 flex-row items-center gap-2">
          <Feather name={icon} size={14} color={colors.goldDeep} />
          <Text className="text-xs font-sans-semibold uppercase tracking-wider text-gold-deep">
            {title}
          </Text>
        </View>
        <View className="flex-row flex-wrap gap-2">
          {items.map((s) => (
            <View key={s} className="rounded-full border border-gold/20 bg-gold/10 px-3 py-1.5">
              <Text className="font-sans-medium text-xs text-gold-deep">{s}</Text>
            </View>
          ))}
        </View>
      </View>
    ) : null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-cream">
        <View className="flex-row items-center justify-between border-b border-gold/20 px-5 py-4">
          <Text className="font-display text-xl text-navy">Dr. Nath</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Feather name="x" size={22} color={colors.slate} />
          </Pressable>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.gold} />
          </View>
        ) : (
          <ScrollView contentContainerClassName="p-5">
            {profile?.bio ? (
              <Text className="mb-5 font-sans text-base leading-6 text-slate">
                {profile.bio}
              </Text>
            ) : null}
            <Section icon="zap" title="Specialties" items={profile?.specialties} />
            <Section icon="award" title="Certifications" items={profile?.certifications} />
            <Section icon="briefcase" title="Industries" items={profile?.industries} />
            <Section icon="globe" title="Languages" items={profile?.languages} />
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

export default function Landing() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, role } = useAuth();

  // A signed-in visitor can reach this page (the logo, or Android back after
  // login), and every call to action on it assumed they were a stranger:
  // "Sign Up", "Log In", "Get Started" all led to the sign-up form. Signed in,
  // they all point at the account instead.
  const appHref = homeHrefFor(role);
  const joinHref = isAuthenticated ? appHref : "/register";
  // The guest navbar floats over the hero (GuestHeader is absolutely
  // positioned): safe-area inset + py-2 + a 72pt logo.
  const headerHeight = insets.top + 88;
  const scrollRef = useRef(null);
  const offsets = useRef({ top: 0, who: 0, offerings: 0, newsletter: 0 });
  const [showProfile, setShowProfile] = useState(false);

  const jump = (key) =>
    scrollRef.current?.scrollTo({ y: offsets.current[key] ?? 0, animated: true });

  // The guest navbar on other screens can't scroll this page directly, so it
  // navigates here with ?section= instead — the equivalent of the web anchors
  // (/home#who). The target's offset isn't known until it lays out, so the jump
  // happens in capture() rather than in an effect, and only the first time.
  const { section } = useLocalSearchParams();
  const pendingJump = useRef(section);

  const capture = (key) => (e) => {
    offsets.current[key] = e.nativeEvent.layout.y;
    if (pendingJump.current === key) {
      pendingJump.current = null;
      scrollRef.current?.scrollTo({ y: e.nativeEvent.layout.y, animated: false });
    }
  };

  return (
    <View className="flex-1 bg-cream">
      <GuestHeader onJump={jump} floating />

      <ScrollView ref={scrollRef} contentContainerClassName="pb-0">
        {/* ── HERO ── */}
        <View
          onLayout={capture("top")}
          style={{ minHeight: Math.max(600, height * 0.92) }}
          className="bg-navy-deep"
        >
          {/* The photo starts *below* the navbar rather than behind it. Anchored
              at top: 0 the crop put Dr Nath's face under the opaque cream bar;
              insetting by the navbar height slides the whole frame down so her
              face clears it, matching the web hero. */}
          <Image
            source={{ uri: `${API_HOST}/dr-nath-mobile.jpg` }}
            style={{ position: "absolute", top: headerHeight, left: 0, right: 0, bottom: 0 }}
            contentFit="cover"
            contentPosition="top center"
            transition={300}
          />
          {/* Legibility wash. Web uses a CSS gradient here — 0.92 at the
              bottom easing to 0.10 at the top — so the copy stays readable
              without dimming her face. expo-linear-gradient is a native module
              and would force a new dev build, so this steps the same curve
              through stacked bands instead. The flat 35% sheet this replaces
              covered the whole photo, her included. */}
          {HERO_WASH.map((band, i) => (
            <View
              key={i}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: band.bottom,
                height: band.height,
                backgroundColor: `rgba(17,28,49,${band.alpha})`,
              }}
            />
          ))}

          <SafeAreaView edges={["top"]} className="flex-1 justify-end px-7 pb-12 pt-24">
            <Text className="mb-5 text-xs font-sans-semibold uppercase tracking-[3px] text-gold">
              Clarity • Growth • Impact
            </Text>

            <Text className="mb-6 font-display text-5xl leading-[1.05] text-hero-cream">
              Become a better version of yourself.
            </Text>

            <Text className="mb-6 font-sans text-base leading-6 text-hero-cream/85">
              Through a client-centered approach to coaching, Dr Nath partners with you to
              help you find clarity, unlock your potential for growth, and create
              long-lasting impact on you, your teams and others.
            </Text>

            <Text className="mb-3 text-xs font-sans-semibold uppercase tracking-[2px] text-gold">
              Offerings
            </Text>
            <View className="mb-8 gap-1.5">
              {HERO_OFFERINGS.map((o) => (
                <View key={o} className="flex-row items-center gap-2">
                  <Text className="text-gold">•</Text>
                  <Text className="flex-1 font-sans text-base text-hero-cream/85">{o}</Text>
                </View>
              ))}
            </View>

            <Button variant="gold" onPress={() => router.push("/chemistry")} fullWidth>
              Book a Free Chemistry Session →
            </Button>

            <Pressable
              onPress={() => jump("offerings")}
              className="mt-3 items-center rounded-full border border-hero-cream/60 bg-hero-cream/10 py-4"
            >
              <Text className="font-sans-semibold text-base text-hero-cream">
                Explore Offerings →
              </Text>
            </Pressable>
          </SafeAreaView>
        </View>

        {/* ── STATS TICKER ── */}
        <StatsTicker />

        {/* ── WHO IS DR NATH ── */}
        <View onLayout={capture("who")} className="bg-cream px-6 py-14">
          <Text className="mb-4 text-xs font-sans-semibold uppercase tracking-[2px] text-gold-deep">
            Who is Dr. Nath
          </Text>
          <Text className="mb-5 font-display text-4xl leading-[1.1] text-navy">
            A coach who helps you become more you.
          </Text>

          <Text className="mb-5 font-sans text-base leading-7 text-slate">
            Dr. Nath is a certified coach with this strong belief:{" "}
            <Text className="font-sans-bold text-navy">
              You are capable of finding your own solutions.
            </Text>{" "}
            Through her client-centered approach, her coaching sessions are built around
            your stories, your goals and your potential — never a one-size-fits-all
            formula.
          </Text>

          <View className="mb-5 gap-3">
            {PROMISES.map((p) => (
              <View key={p} className="flex-row items-start gap-3">
                <Feather name="check" size={18} color={colors.gold} style={{ marginTop: 2 }} />
                <Text className="flex-1 font-sans text-base leading-6 text-navy">{p}</Text>
              </View>
            ))}
          </View>

          <Text className="mb-7 font-sans text-base leading-7 text-slate">
            Dr. Nath holds a PhD, an MBA, and a coaching certification from leading academic
            institutions in South Africa and the United States of America (USA).
          </Text>

          <Button variant="navy" onPress={() => setShowProfile(true)}>
            Explore More →
          </Button>

          {/* Matches the web container: aspect-[4/5], rounded-[2rem], gold
              border on navy-deep, image cover at 70% center. The fixed-height
              landscape box I had before cropped her off-centre. */}
          <View
            className="mt-8 self-center w-full overflow-hidden rounded-[32px] border border-gold bg-navy-deep"
            style={{ aspectRatio: 4 / 5, maxWidth: 384 }}
          >
            {/* Positioned by hand rather than with contentPosition: that prop
                only accepts keywords ('center', 'top left', ...) or an object,
                so the "70% center" this used to pass was silently ignored and
                the image just sat centred.

                The source is 1672x941 (aspect 1.777). Scaled to the height of a
                4:5 box it is 2.221x the box width, so the box shows 45% of it.
                Her figure is centred around 60.7% of the image width; -88%
                brings that to just left of the middle of the frame. */}
            <Image
              source={{ uri: `${API_HOST}/dr-nath.jpg` }}
              style={{ position: "absolute", top: 0, bottom: 0, left: "-88%", width: "222%" }}
              contentFit="cover"
              transition={300}
            />
          </View>
        </View>

        {/* ── NEWSLETTER ── */}
        <View onLayout={capture("newsletter")}>
          <NewsletterBand />
        </View>

        {/* ── OFFERINGS ── */}
        <View onLayout={capture("offerings")} className="bg-cream-warm px-6 py-14">
          <Text className="mb-4 text-center text-xs font-sans-semibold uppercase tracking-[2px] text-gold-deep">
            What We Offer
          </Text>
          <Text className="mb-10 text-center font-display text-4xl leading-tight text-navy">
            Ways to work together
          </Text>

          <View className="gap-6">
            {OFFERINGS.map((o) => (
              <View key={o.title} className="rounded-2xl border border-gold/15 bg-white p-6">
                <View className="mb-5 h-20 w-20 items-center justify-center rounded-full bg-gold/15">
                  <Feather name={o.icon} size={32} color={colors.goldDeep} />
                </View>
                <Text className="mb-2 font-display text-xl text-navy">{o.title}</Text>
                <Text className="mb-5 font-sans text-base leading-6 text-slate">{o.desc}</Text>
                <Button variant="gold" size="sm" onPress={() => router.push(joinHref)}>
                  Book a Session →
                </Button>
              </View>
            ))}
          </View>
        </View>

        {/* ── HOW COACHING WORKS ── */}
        <View className="bg-cream px-6 py-14">
          <Text className="mb-4 text-center text-xs font-sans-semibold uppercase tracking-[2px] text-gold-deep">
            The Process
          </Text>
          <Text className="mb-10 text-center font-display text-4xl leading-tight text-navy">
            How coaching works
          </Text>

          <View className="gap-8">
            {STEPS.map((s) => (
              <View key={s.num}>
                <Text className="font-display text-5xl text-gold/35">{s.num}</Text>
                <View className="mb-3 mt-4">
                  <Feather name={s.icon} size={32} color={colors.goldDeep} />
                </View>
                <Text className="mb-3 font-display text-2xl text-navy">{s.title}</Text>
                <Text className="font-sans text-base leading-7 text-slate">{s.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── TESTIMONIALS ── */}
        <Testimonials />

        {/* ── FINAL CTA ── */}
        <View className="bg-cream-warm px-6 py-14">
          <Text className="mb-6 text-center font-display text-4xl leading-tight text-navy">
            Ready to begin your transformation?
          </Text>
          <Text className="mb-10 text-center font-sans text-base text-slate">
            Join other professionals.
          </Text>
          <Button variant="gold" onPress={() => router.push(joinHref)} fullWidth>
            {isAuthenticated ? "Go to my account →" : "Get Started →"}
          </Button>
        </View>

        {/* ── FOOTER ── */}
        <View className="bg-navy-deep px-6 pb-10 pt-12">
          <View className="mb-10 gap-8">
            {FOOTER.map((col) => (
              <View key={col.title}>
                <Text className="mb-4 font-display text-xl text-gold">{col.title}</Text>
                <View className="gap-2">
                  {(col.title === "Account" && isAuthenticated
                    ? [{ label: "Go to my account", to: appHref }]
                    : col.links
                  ).map((l) => (
                    <Pressable
                      key={l.label}
                      onPress={() =>
                        l.jump
                          ? jump(l.jump)
                          : // Any sign-up link is meaningless once signed in.
                            router.push(l.to === "/register" ? joinHref : l.to)
                      }
                    >
                      <Text className="font-sans text-sm text-cream/50">{l.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>

          <View className="border-t border-white/10 pt-8">
            <Text className="text-center font-sans text-sm text-cream/30">
              © {new Date().getFullYear()} Dr. Nath · Coaching for Impact. All rights
              reserved.
            </Text>
          </View>
        </View>
      </ScrollView>

      {showProfile ? <DrNathModal onClose={() => setShowProfile(false)} /> : null}
    </View>
  );
}
