import { View, Text, Pressable, ScrollView } from "react-native";
import { usePathname, useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/colors";

// Port of frontend/src/components/WorkspaceTabs.jsx — the sub-navigation shared
// by Resources / Agreements / Forms.
//
// Coach sees Library + Client Submissions (the two Resources sub-sections)
// alongside Agreements and Forms; client sees Resources, Agreements and Forms.
// Horizontally scrollable, since four pills don't fit a phone width.
export default function WorkspaceTabs({ inbox = false }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isCoach } = useAuth();

  const onResources = pathname.endsWith("/resources");

  const tabs = isCoach()
    ? [
        {
          label: "Library",
          icon: "folder",
          path: "/(coach)/resources",
          active: onResources && !inbox,
        },
        {
          label: "Client Submissions",
          icon: "inbox",
          path: "/(coach)/resources?tab=inbox",
          active: onResources && inbox,
        },
        {
          label: "Agreements",
          icon: "file-text",
          path: "/(coach)/agreements",
          active: pathname.endsWith("/agreements"),
        },
        {
          label: "Forms",
          icon: "edit-3",
          path: "/(coach)/forms",
          active: pathname.endsWith("/forms"),
        },
      ]
    : [
        {
          label: "Resources",
          icon: "folder",
          path: "/(client)/resources",
          active: onResources,
        },
        {
          label: "Agreements",
          icon: "file-text",
          path: "/(client)/agreements",
          active: pathname.endsWith("/agreements"),
        },
        {
          label: "Forms",
          icon: "edit-3",
          path: "/(client)/forms",
          active: pathname.endsWith("/forms"),
        },
      ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 pb-1"
      className="mb-6 -mx-1 px-1"
    >
      {tabs.map((t) => (
        <Pressable
          key={t.label}
          onPress={() => router.push(t.path)}
          className={`flex-row items-center gap-2 rounded-full px-4 py-2 ${
            t.active ? "bg-gold" : "border border-gold/25 bg-white"
          }`}
        >
          <Feather
            name={t.icon}
            size={14}
            color={t.active ? colors.navyDeep : colors.slate}
          />
          <Text
            className={`font-sans-semibold text-sm ${
              t.active ? "text-navy-deep" : "text-slate"
            }`}
          >
            {t.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
