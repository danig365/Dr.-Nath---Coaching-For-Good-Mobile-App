import { api } from "@/api/client";

// Mobile port of frontend/src/utils/syncTimezone.js — same policy, same
// endpoints, so a coach and a client see the same times on both platforms.
//
// Returns the timezone every screen should render session times in:
//   - the profile timezone when explicitly set (i.e. not the 'UTC' default)
//   - otherwise the device timezone
//
// Backfill policy (unchanged from web): CLIENTS have no timezone UI, so their
// device timezone is silently saved to their profile, keeping email reminders
// correct. COACHES are never auto-saved — their timezone drives slot generation,
// so they confirm it explicitly on the Availability screen.
export function deviceTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    // Hermes ships Intl, but never let a timezone lookup break startup.
    return "UTC";
  }
}

export async function syncTimezone() {
  const deviceTz = deviceTimezone();
  try {
    const me = await api.get("/profile/");
    const profile = me.data?.profile || {};
    const current = profile.timezone;
    const isSet = current && current !== "UTC";

    if (!isSet && profile.role === "client" && deviceTz !== "UTC") {
      await api.patch("/profile/", { profile: { timezone: deviceTz } });
      return deviceTz;
    }
    return isSet ? current : deviceTz;
  } catch {
    return deviceTz;
  }
}

export default syncTimezone;
