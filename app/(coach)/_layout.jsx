import { Tabs } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { colors } from "@/theme/colors";
import RequireAuth from "@/components/RequireAuth";

// Coach tab bar. Admin tools are deliberately not in the mobile app — they stay
// on the web, where the big screen suits them.
export default function CoachLayout() {
  return (
    <RequireAuth coachOnly>
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
          name="clients"
          options={{
            title: "Clients",
            tabBarIcon: ({ color, size }) => <Feather name="users" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="availability"
          options={{
            title: "Availability",
            tabBarIcon: ({ color, size }) => <Feather name="clock" size={size} color={color} />,
          }}
        />
        {/* Workspace (resource library, agreements, forms) takes the fifth slot
            rather than Profile: a coach edits their profile rarely but reaches
            client documents constantly. Profile stays one tap away from the
            dashboard. */}
        <Tabs.Screen
          name="resources"
          options={{
            title: "Workspace",
            tabBarIcon: ({ color, size }) => (
              <Feather name="folder" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen name="profile" options={{ href: null, title: "Profile" }} />
        <Tabs.Screen name="skills" options={{ href: null, title: "My Skills" }} />
        <Tabs.Screen name="agreements" options={{ href: null, title: "Agreements" }} />
        <Tabs.Screen name="forms" options={{ href: null, title: "Forms" }} />
      </Tabs>
    </RequireAuth>
  );
}
