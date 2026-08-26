import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";

import { colors } from "@/theme/colors";

// Auto-advancing quote carousel, ported from TestimonialCarousel in
// frontend/src/pages/Home.jsx — same quotes, same 4.5s interval, same dots.
const TESTIMONIALS = [
  {
    quote:
      "Dr. Nath helped me find clarity I'd been chasing for years. In three months I went from feeling stuck to leading my own team.",
    author: "Sarah M.",
    role: "VP of Operations",
  },
  {
    quote:
      "The most grounded, practical coaching I've ever experienced. Every session moved me forward — no fluff, real impact.",
    author: "James K.",
    role: "Founder & Entrepreneur",
  },
  {
    quote:
      "I finally understand my own values and how to build a career around them. It genuinely changed the way I lead.",
    author: "Priya R.",
    role: "Product Director",
  },
];

export default function Testimonials() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const t = setInterval(
      () => setCurrent((i) => (i + 1) % TESTIMONIALS.length),
      4500
    );
    return () => clearInterval(t);
  }, []);

  const t = TESTIMONIALS[current];

  return (
    <View className="bg-cream px-6 py-12">
      <View className="rounded-3xl border border-gold/15 bg-cream-warm px-6 py-10">
        <Text className="mb-2 font-display text-5xl leading-none text-gold">“</Text>

        <Text className="mb-6 text-center font-display text-xl leading-8 text-navy">
          {t.quote}
        </Text>
        <Text className="text-center font-sans-bold text-base text-navy">{t.author}</Text>
        <Text className="text-center font-sans text-sm text-gold-deep">{t.role}</Text>

        <View className="mt-8 flex-row justify-center gap-2">
          {TESTIMONIALS.map((_, i) => (
            <Pressable
              key={i}
              onPress={() => setCurrent(i)}
              accessibilityLabel={`Testimonial ${i + 1}`}
              hitSlop={8}
              style={{
                height: 8,
                width: i === current ? 24 : 8,
                borderRadius: 4,
                backgroundColor: i === current ? colors.goldDeep : "rgba(27,43,74,0.25)",
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
