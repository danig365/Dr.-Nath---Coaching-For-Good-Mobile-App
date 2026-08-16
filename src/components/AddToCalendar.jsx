import { useState } from "react";
import { View, Text, Pressable, Modal, Linking } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { googleCalendarUrl, outlookCalendarUrl, shareIcs } from "@/lib/calendarLinks";
import { toast } from "@/lib/toast";
import { colors } from "@/theme/colors";

// Port of frontend/src/components/AddToCalendar.jsx.
//
// Same three destinations — Google / Outlook / Apple(.ics). The web uses a
// click-outside dropdown; a bottom sheet is the mobile equivalent.
export default function AddToCalendar({ session }) {
  const [open, setOpen] = useState(false);

  const openUrl = async (url) => {
    setOpen(false);
    try {
      await Linking.openURL(url);
    } catch {
      toast.error("Couldn't open your calendar.");
    }
  };

  const onIcs = async () => {
    setOpen(false);
    try {
      await shareIcs(session);
    } catch {
      toast.error("Couldn't create the calendar file.");
    }
  };

  const Item = ({ label, onPress }) => (
    <Pressable
      onPress={onPress}
      className="border-b border-gold/10 px-5 py-4 active:bg-cream"
    >
      <Text className="font-sans-medium text-base text-navy">{label}</Text>
    </Pressable>
  );

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center gap-1.5 rounded-full border border-gold/25 bg-gold/10 px-4 py-2"
      >
        <Feather name="calendar" size={13} color={colors.goldDeep} />
        <Text className="font-sans-semibold text-xs text-gold-deep">Add to Calendar</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-navy-deep/50"
          onPress={() => setOpen(false)}
        >
          <Pressable className="rounded-t-3xl bg-white pb-8 pt-2">
            <View className="mb-2 self-center h-1 w-10 rounded-full bg-cream-warm" />
            <Text className="px-5 py-3 font-display text-xl text-navy">
              Add to Calendar
            </Text>
            <Item label="Google Calendar" onPress={() => openUrl(googleCalendarUrl(session))} />
            <Item label="Outlook" onPress={() => openUrl(outlookCalendarUrl(session))} />
            <Item label="Apple / Download (.ics)" onPress={onIcs} />
            <Pressable onPress={() => setOpen(false)} className="px-5 py-4">
              <Text className="font-sans-semibold text-base text-slate">Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
