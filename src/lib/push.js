import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

import { api } from "@/api/client";

// Push notification registration.
//
// Pairs with backend/notifications/push.py: the app obtains an Expo push token
// and POSTs it to /api/notifications/devices/, and the server pushes through
// Expo — so no APNs/FCM credentials are needed on the VPS.
//
// Registration happens after sign-in (the endpoint is authenticated) and the
// token is retired on sign-out, so a shared device stops receiving the previous
// user's notifications.

let cachedToken = null;

// Show notifications while the app is foregrounded, not just in the tray.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Obtain the Expo push token, asking permission if needed. Null if unavailable. */
export async function getPushToken() {
  if (cachedToken) return cachedToken;

  // Simulators/emulators can't receive push — don't prompt for nothing.
  if (!Device.isDevice) return null;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Session reminders",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    // EAS builds carry the project id in extra.eas.projectId; getExpoPushToken
    // needs it to mint a token.
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId ??
      undefined;

    const res = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    cachedToken = res.data;
    return cachedToken;
  } catch {
    // Push is a nice-to-have — never let it break sign-in.
    return null;
  }
}

/** Register this device against the signed-in user. Safe to call repeatedly. */
export async function registerForPush() {
  const token = await getPushToken();
  if (!token) return false;
  try {
    await api.post("/notifications/devices/", { token, platform: Platform.OS });
    return true;
  } catch {
    return false;
  }
}

/** Retire this device's token — call on sign-out. */
export async function unregisterForPush() {
  const token = cachedToken;
  if (!token) return;
  try {
    await api.post("/notifications/devices/unregister/", { token });
  } catch {
    /* best effort — the server also retires tokens Expo rejects */
  }
}
