import { Tabs } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { colors } from "@/theme/colors";
import RequireAuth from "@/components/RequireAuth";

// Client tab bar. Coaches get a different set — see app/(coach)/_layout.jsx.
export default function ClientLayout() {
  return (
    <RequireAuth>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.navy },
          headerTintColor: colors.cream,
          headerTitleStyle: { fontFamily: "PlayfairDisplay_400Regular" },
          tabBarActiveTintColor: colors.goldDeep,
          tabBarInactiveTintColor: colors.slateLight,
          tabBarStyle: { backgroundColor: colors.cream, borderTopColor: colors.creamWarm },
          tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 11 },
          sceneStyle: { backgroundColor: colors.cream },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="sessions"
          options={{
            title: "Sessions",
            tabBarIcon: ({ color, size }) => <Feather name="calendar" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="learning"
          options={{
            title: "Learning",
            tabBarIcon: ({ color, size }) => <Feather name="target" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="resources"
          options={{
            title: "Resources",
            tabBarIcon: ({ color, size }) => <Feather name="folder" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
          }}
        />

        {/* Sub-sections of the workspace, reached via WorkspaceTabs from the
            Resources tab rather than getting tab bar slots of their own. */}
        <Tabs.Screen name="agreements" options={{ href: null, title: "Agreements" }} />
        <Tabs.Screen name="forms" options={{ href: null, title: "Forms" }} />
      </Tabs>
    </RequireAuth>
  );
}
