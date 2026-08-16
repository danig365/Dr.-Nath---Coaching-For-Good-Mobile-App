import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { API_HOST } from "@/api/config";

// Port of frontend/src/utils/calendarLinks.js. Mirrors the backend
// bookings/calendar.py so in-app and email invitations stay consistent.
//
// The only real change is the .ics path: the web builds a Blob and clicks a
// hidden <a download>. Here we write the file to app storage and hand it to the
// OS share sheet, which is what lets the user add it to Apple Calendar.
const SITE = API_HOST;

// YYYYMMDDTHHMMSSZ
const fmtUTC = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
// 2026-07-09T07:00:00Z
const fmtISO = (d) => new Date(d).toISOString().replace(/\.\d{3}/, "");

function fields(session) {
  const startRaw = session.slot_start || `${session.session_date}T${session.session_time}Z`;
  const startMs = new Date(startRaw).getTime();
  const endMs = session.slot_end
    ? new Date(session.slot_end).getTime()
    : startMs + (session.duration || 60) * 60000;

  return {
    id: session.id,
    start: new Date(startMs),
    end: new Date(endMs),
    title: session.skill_title || "Coaching session",
    details: `Your online coaching session on the Dr. Nath platform. Join at ${SITE}/session/${session.id} (sign in first).`,
    location: "Online — Dr. Nath platform (dr-nath.com)",
  };
}

export function googleCalendarUrl(session) {
  const f = fields(session);
  const dates = `${fmtUTC(f.start)}/${fmtUTC(f.end)}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(f.title)}&dates=${dates}&details=${encodeURIComponent(f.details)}&location=${encodeURIComponent(f.location)}`;
}

export function outlookCalendarUrl(session) {
  const f = fields(session);
  return `https://outlook.office.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${encodeURIComponent(f.title)}&startdt=${fmtISO(f.start)}&enddt=${fmtISO(f.end)}&body=${encodeURIComponent(f.details)}&location=${encodeURIComponent(f.location)}`;
}

/** Build the .ics text for a session. Identical output to the web version. */
export function buildIcs(session) {
  const f = fields(session);
  const esc = (t) =>
    t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Dr. Nath//Coaching for Impact//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:booking-${f.id}@dr-nath.com`,
      `DTSTAMP:${fmtUTC(new Date())}`,
      `DTSTART:${fmtUTC(f.start)}`,
      `DTEND:${fmtUTC(f.end)}`,
      `SUMMARY:${esc(f.title)}`,
      `DESCRIPTION:${esc(f.details)}`,
      `LOCATION:${esc(f.location)}`,
      "STATUS:CONFIRMED",
      "BEGIN:VALARM",
      "TRIGGER:-PT1H",
      "ACTION:DISPLAY",
      "DESCRIPTION:Your coaching session is in 1 hour",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n") + "\r\n"
  );
}

/** Write the .ics to app storage and open the share sheet so the user can add it. */
export async function shareIcs(session) {
  const file = new File(Paths.cache, "session.ics");
  if (file.exists) file.delete();
  file.create();
  file.write(buildIcs(session));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: "text/calendar",
      UTI: "com.apple.ical.ics",
      dialogTitle: "Add to calendar",
    });
  }
  return file.uri;
}
