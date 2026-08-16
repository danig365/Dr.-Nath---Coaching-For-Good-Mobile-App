import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, AudioPresets } from "livekit-client";
import { AudioSession } from "@livekit/react-native";

// Shared LiveKit room lifecycle for every call screen (1:1, group, guest).
//
// Ported from the room setup in frontend/src/pages/SessionCallLiveKit.jsx and
// GroupCallLiveKit.jsx, which duplicate it. Same Room options, same events.
//
// Two mobile-specific additions:
//   - AudioSession.start/stopAudioSession() — the native audio session has no
//     web equivalent; without it audio routing and the earpiece/speaker switch
//     misbehave, and on iOS the mic may not open at all.
//   - `trackRefs` are shaped as LiveKit TrackReference objects, which is what
//     the RN <VideoTrack> component renders from (the web attaches MediaStreams
//     to <video> elements instead).

/** Build the TrackReference shape <VideoTrack> expects. */
const toTrackRef = (participant, publication, source) =>
  publication ? { participant, publication, source } : undefined;

export function useCallRoom() {
  const roomRef = useRef(null);
  const joiningRef = useRef(false);

  const [state, setState] = useState("idle"); // idle | connecting | connected | ended
  const [participants, setParticipants] = useState({}); // sid -> { name, identity, videoRef }
  const [localVideoRef, setLocalVideoRef] = useState(undefined);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [mediaError, setMediaError] = useState("");
  const [netPoor, setNetPoor] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  // What the user *wants* — re-applied after reconnects, as on web.
  const micWantRef = useRef(true);
  const camWantRef = useRef(true);

  const refreshLocal = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const lp = room.localParticipant;
    const camPub = lp.getTrackPublication(Track.Source.Camera);
    setLocalVideoRef(toTrackRef(lp, camPub, Track.Source.Camera));
  }, []);

  const upsertParticipant = useCallback((p) => {
    setParticipants((prev) => ({
      ...prev,
      [p.sid]: {
        ...(prev[p.sid] || {}),
        name: p.name || p.identity,
        identity: p.identity,
        participant: p,
        videoRef: toTrackRef(
          p,
          p.getTrackPublication(Track.Source.Camera),
          Track.Source.Camera
        ),
      },
    }));
  }, []);

  const dropParticipant = useCallback((p) => {
    setParticipants((prev) => {
      const next = { ...prev };
      delete next[p.sid];
      return next;
    });
  }, []);

  /**
   * Connect to a room.
   * @param {{url: string, token: string}} creds from the backend token endpoint
   */
  const connect = useCallback(
    async ({ url, token }) => {
      if (joiningRef.current || roomRef.current) return;
      joiningRef.current = true;
      setState("connecting");
      setMediaError("");

      try {
        // Native audio session first — LiveKit requires it before publishing.
        await AudioSession.startAudioSession();

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          // Explicit echo cancellation / noise suppression to stop feedback
          // loops (especially when both sides are in the same room).
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          // Audio tuned for spoken conversation on imperfect networks — this is
          // a coaching call, not music. RED sends redundant audio so a dropped
          // packet doesn't punch a hole in the speech.
          publishDefaults: {
            audioPreset: AudioPresets.speech,
            red: true,
            dtx: true,
          },
        });

        room
          .on(RoomEvent.ParticipantConnected, upsertParticipant)
          .on(RoomEvent.ParticipantDisconnected, dropParticipant)
          .on(RoomEvent.TrackSubscribed, (_t, _pub, participant) =>
            upsertParticipant(participant)
          )
          .on(RoomEvent.TrackUnsubscribed, (_t, _pub, participant) =>
            upsertParticipant(participant)
          )
          .on(RoomEvent.LocalTrackPublished, refreshLocal)
          .on(RoomEvent.LocalTrackUnpublished, refreshLocal)
          .on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
            if (participant?.isLocal) setNetPoor(quality === "poor");
          })
          .on(RoomEvent.Reconnecting, () => setReconnecting(true))
          .on(RoomEvent.Reconnected, async () => {
            setReconnecting(false);
            // Re-apply the user's mic/cam intent — a reconnect can silently
            // republish in the wrong state.
            try {
              await room.localParticipant.setMicrophoneEnabled(micWantRef.current);
              await room.localParticipant.setCameraEnabled(camWantRef.current);
            } catch {
              /* non-fatal */
            }
            refreshLocal();
          });

        await room.connect(url, token);
        roomRef.current = room;

        // Publish according to intent; a failure here must not drop the call —
        // the user stays connected and can retry, matching the web behaviour.
        try {
          await room.localParticipant.setMicrophoneEnabled(micWantRef.current);
          await room.localParticipant.setCameraEnabled(camWantRef.current);
        } catch {
          setMediaError(
            "We couldn't turn on your camera/microphone. You're still connected — check the app's camera permission and tap Retry."
          );
        }

        // Seed anyone already in the room.
        room.remoteParticipants.forEach(upsertParticipant);
        refreshLocal();
        setState("connected");
      } catch (err) {
        setState("idle");
        throw err;
      } finally {
        joiningRef.current = false;
      }
    },
    [upsertParticipant, dropParticipant, refreshLocal]
  );

  const disconnect = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    joiningRef.current = false;
    try {
      room?.disconnect();
    } catch {
      /* noop */
    }
    try {
      await AudioSession.stopAudioSession();
    } catch {
      /* noop */
    }
    setParticipants({});
    setLocalVideoRef(undefined);
    setState("ended");
  }, []);

  const toggleMic = useCallback(async () => {
    const next = !micWantRef.current;
    micWantRef.current = next;
    setMicOn(next);
    try {
      await roomRef.current?.localParticipant.setMicrophoneEnabled(next);
    } catch {
      /* keep the UI in the requested state; LiveKit retries on reconnect */
    }
  }, []);

  const toggleCam = useCallback(async () => {
    const next = !camWantRef.current;
    camWantRef.current = next;
    setCamOn(next);
    try {
      await roomRef.current?.localParticipant.setCameraEnabled(next);
      refreshLocal();
    } catch {
      /* as above */
    }
  }, [refreshLocal]);

  /** Retry publishing after a camera/mic failure. */
  const retryMedia = useCallback(async () => {
    setMediaError("");
    try {
      await roomRef.current?.localParticipant.setMicrophoneEnabled(micWantRef.current);
      await roomRef.current?.localParticipant.setCameraEnabled(camWantRef.current);
      refreshLocal();
    } catch {
      setMediaError(
        "Still couldn't start your camera/microphone. Check the app's permissions in Settings."
      );
    }
  }, [refreshLocal]);

  /** Send a data message to everyone in the room (used for call signalling). */
  const publishData = useCallback((obj) => {
    try {
      const payload = new TextEncoder().encode(JSON.stringify(obj));
      roomRef.current?.localParticipant.publishData(payload, { reliable: true });
    } catch {
      /* noop */
    }
  }, []);

  // Always tear the room down on unmount — an orphaned room keeps the mic open.
  useEffect(() => {
    return () => {
      try {
        roomRef.current?.disconnect();
      } catch {
        /* noop */
      }
      roomRef.current = null;
      AudioSession.stopAudioSession().catch(() => {});
    };
  }, []);

  return {
    room: roomRef,
    state,
    participants,
    localVideoRef,
    micOn,
    camOn,
    mediaError,
    netPoor,
    reconnecting,
    connect,
    disconnect,
    toggleMic,
    toggleCam,
    retryMedia,
    publishData,
  };
}

export default useCallRoom;
