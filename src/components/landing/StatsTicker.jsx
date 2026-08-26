import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView } from "react-native";

// Animated counters, ported from the Counter + ticker band in
// frontend/src/pages/Home.jsx. The web scrolls the strip continuously with a CSS
// keyframe; on a phone the strip is a horizontal ScrollView the user can swipe,
// which is more useful than an animation they can't stop to read.
const STATS = [
  { value: 500, suffix: "+", label: "Clients Coached" },
  { value: 1200, suffix: "+", label: "Sessions Delivered" },
  { value: 98, suffix: "%", label: "Client Satisfaction" },
  { value: 15, suffix: "+", label: "Years Experience" },
];

function Counter({ end, suffix }) {
  const [count, setCount] = useState(0);
  const timer = useRef(null);

  useEffect(() => {
    const duration = 1600;
    const step = Math.ceil(end / (duration / 16));
    let start = 0;
    timer.current = setInterval(() => {
      start += step;
      if (start >= end) {
        setCount(end);
        clearInterval(timer.current);
      } else {
        setCount(start);
      }
    }, 16);
    return () => clearInterval(timer.current);
  }, [end]);

  return (
    <Text className="font-display text-2xl text-gold">
      {count.toLocaleString()}
      {suffix}
    </Text>
  );
}

export default function StatsTicker() {
  return (
    <View className="bg-navy py-5">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-6 gap-8 items-center"
      >
        {STATS.map((s, i) => (
          <View key={s.label} className="flex-row items-center gap-3">
            <Counter end={s.value} suffix={s.suffix} />
            <Text className="font-sans-medium text-sm text-cream/75">{s.label}</Text>
            {i < STATS.length - 1 ? <Text className="ml-4 text-gold/40">✦</Text> : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
