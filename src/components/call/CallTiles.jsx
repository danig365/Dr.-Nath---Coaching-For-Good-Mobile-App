import { View, Text } from "react-native";
import { VideoTrack } from "@livekit/react-native";
import Feather from "@expo/vector-icons/Feather";

import { colors } from "@/theme/colors";

// Mobile equivalent of frontend/src/components/CallTiles.jsx.
//
// The web attaches MediaStreams to <video> elements; React Native renders a
// native surface via <VideoTrack trackRef=…>. When there's no video track (cam
// off, or not yet subscribed) we fall back to an initial, as on web.

function Initial({ name, size = "text-3xl" }) {
  return (
    <View className="flex-1 items-center justify-center bg-navy-soft">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-gold">
        <Text className={`font-display ${size} text-navy-deep`}>
          {(name || "?").charAt(0).toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

export function RemoteTile({ entry, style }) {
  const hasVideo = !!entry?.videoRef?.publication?.track;

  return (
    <View
      className="overflow-hidden rounded-2xl border border-gold/20 bg-navy-deep"
      style={style}
    >
      {hasVideo ? (
        <VideoTrack trackRef={entry.videoRef} style={{ flex: 1 }} objectFit="cover" />
      ) : (
        <Initial name={entry?.name} />
      )}

      <View className="absolute bottom-2 left-2 rounded-full bg-navy-deep/70 px-2.5 py-1">
        <Text className="font-sans-medium text-xs text-cream" numberOfLines={1}>
          {entry?.name || "Participant"}
        </Text>
      </View>
    </View>
  );
}

export function LocalTile({ trackRef, camOn, micOn, name, style }) {
  const hasVideo = camOn && !!trackRef?.publication?.track;

  return (
    <View
      className="overflow-hidden rounded-2xl border-2 border-gold/40 bg-navy-deep"
      style={style}
    >
      {hasVideo ? (
        <VideoTrack
          trackRef={trackRef}
          style={{ flex: 1 }}
          objectFit="cover"
          mirror
          zOrder={1}
        />
      ) : (
        <Initial name={name} size="text-xl" />
      )}

      <View className="absolute bottom-1.5 left-1.5 flex-row items-center gap-1 rounded-full bg-navy-deep/70 px-2 py-0.5">
        <Feather
          name={micOn ? "mic" : "mic-off"}
          size={10}
          color={micOn ? colors.cream : "#EF4444"}
        />
        <Text className="font-sans-medium text-[10px] text-cream">You</Text>
      </View>
    </View>
  );
}

/** Round control button used along the bottom of a call. */
export function CallButton({ icon, onPress, active = true, danger = false, label }) {
  return (
    <View className="items-center gap-1">
      <View
        className={`h-14 w-14 items-center justify-center rounded-full ${
          danger ? "bg-red-600" : active ? "bg-white/15" : "bg-white"
        }`}
      >
        <Feather
          name={icon}
          size={22}
          color={danger ? "#fff" : active ? colors.cream : colors.navyDeep}
          onPress={onPress}
          suppressHighlighting
        />
      </View>
      {label ? (
        <Text className="font-sans text-[10px] text-slate-light">{label}</Text>
      ) : null}
    </View>
  );
}
