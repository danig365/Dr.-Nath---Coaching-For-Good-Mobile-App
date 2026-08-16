import { useEffect, useState } from "react";
import { View, Text, Modal, Pressable, ScrollView, ActivityIndicator } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { Button } from "@/components/ui";
import { downloadFile } from "@/lib/download";
import { colors } from "@/theme/colors";

// Port of frontend/src/components/SessionSummaryModal.jsx.
//
// Read-only view of the AI-generated session summary (E7). Opened from the
// completed-session cards on My Learning (client) and My Sessions (coach).

function StatTile({ label, value }) {
  return (
    <View className="flex-1 rounded-xl border border-gold/20 bg-cream p-3">
      <Text className="text-center font-sans-bold text-lg text-navy">
        {value != null && value !== "" ? value : "—"}
      </Text>
      <Text className="mt-0.5 text-center text-[10px] uppercase tracking-wider text-slate-light">
        {label}
      </Text>
    </View>
  );
}

function Bullet({ children }) {
  return (
    <View className="flex-row items-start gap-2">
      <View className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gold" />
      <Text className="flex-1 font-sans text-sm text-navy">{children}</Text>
    </View>
  );
}

export default function SessionSummaryModal({ session, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api
      .get(`/bookings/${session.id}/ai-summary/`)
      .then((res) => {
        if (alive) setData(res.data);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [session.id]);

  const hasContent =
    data &&
    (data.summary || (data.key_points || []).length || (data.action_items || []).length);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-navy-deep/60 p-4">
        <View className="max-h-[90%] w-full max-w-lg rounded-2xl bg-white">
          <View className="flex-row items-center justify-between border-b border-gold/20 p-5">
            <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-gold/15">
                <Feather name="file-text" size={17} color={colors.gold} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-display text-lg text-navy" numberOfLines={1}>
                  AI session summary
                </Text>
                <Text className="mt-0.5 font-sans text-xs text-slate">
                  {session.skill_title}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={8} className="rounded-full bg-navy/5 p-1.5">
              <Feather name="x" size={16} color={colors.slate} />
            </Pressable>
          </View>

          {loading ? (
            <View className="items-center py-16">
              <ActivityIndicator color={colors.gold} />
            </View>
          ) : !hasContent ? (
            <View className="p-8">
              <Text className="text-center font-sans text-sm text-slate">
                No AI summary is available for this session.
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerClassName="p-5 gap-5">
              {data.summary ? (
                <View>
                  <Text className="mb-1.5 text-xs font-sans-semibold uppercase tracking-wider text-gold-deep">
                    Overview
                  </Text>
                  <Text className="font-sans text-sm leading-6 text-navy">
                    {data.summary}
                  </Text>
                </View>
              ) : null}

              {data.analytics &&
              (data.analytics.meeting_score != null ||
                (data.analytics.deep_dive || []).length > 0) ? (
                <View>
                  <Text className="mb-2 text-xs font-sans-semibold uppercase tracking-wider text-gold-deep">
                    Meeting analytics
                  </Text>

                  <View className="mb-3 flex-row gap-2">
                    <StatTile
                      label="Meeting score"
                      value={
                        data.analytics.meeting_score != null
                          ? `${data.analytics.meeting_score}`
                          : null
                      }
                    />
                    <StatTile
                      label="Engagement"
                      value={
                        data.analytics.engagement != null
                          ? `${data.analytics.engagement}`
                          : null
                      }
                    />
                    <StatTile label="Sentiment" value={data.analytics.sentiment} />
                  </View>

                  {(data.analytics.deep_dive || []).length > 0 ? (
                    <View className="gap-2.5">
                      {data.analytics.deep_dive.map((d, i) => (
                        <View key={i}>
                          <View className="mb-1 flex-row items-center justify-between">
                            <Text className="font-sans-semibold text-xs text-navy">
                              {d.indicator}
                            </Text>
                            {d.score != null ? (
                              <Text className="font-sans-bold text-xs text-gold-deep">
                                {d.score}
                              </Text>
                            ) : null}
                          </View>
                          {d.score != null ? (
                            <View className="h-1.5 overflow-hidden rounded-full bg-gold/15">
                              <View
                                className="h-full rounded-full bg-gold"
                                style={{ width: `${d.score}%` }}
                              />
                            </View>
                          ) : null}
                          {d.explanation ? (
                            <Text className="mt-1 font-sans text-xs leading-5 text-slate">
                              {d.explanation}
                            </Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {(data.analytics.topics || []).length > 0 ? (
                    <View className="mt-3 flex-row flex-wrap gap-1.5">
                      {data.analytics.topics.map((t, i) => (
                        <View key={i} className="rounded-full bg-slate/10 px-2 py-0.5">
                          <Text className="text-[11px] text-slate">{t}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}

              {(data.key_points || []).length > 0 ? (
                <View>
                  <Text className="mb-1.5 text-xs font-sans-semibold uppercase tracking-wider text-gold-deep">
                    Key points
                  </Text>
                  <View className="gap-1.5">
                    {data.key_points.map((p, i) => (
                      <Bullet key={i}>{p}</Bullet>
                    ))}
                  </View>
                </View>
              ) : null}

              {(data.action_items || []).length > 0 ? (
                <View>
                  <Text className="mb-1.5 text-xs font-sans-semibold uppercase tracking-wider text-gold-deep">
                    Action items
                  </Text>
                  <View className="gap-1.5">
                    {data.action_items.map((p, i) => (
                      <View key={i} className="flex-row items-start gap-2">
                        <Feather
                          name="check-circle"
                          size={14}
                          color={colors.gold}
                          style={{ marginTop: 2 }}
                        />
                        <Text className="flex-1 font-sans text-sm text-navy">{p}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {(data.reflection_points || []).length > 0 ? (
                <View>
                  <Text className="mb-1.5 text-xs font-sans-semibold uppercase tracking-wider text-gold-deep">
                    Points to reflect on
                  </Text>
                  <View className="gap-1.5">
                    {data.reflection_points.map((p, i) => (
                      <Bullet key={i}>{p}</Bullet>
                    ))}
                  </View>
                </View>
              ) : null}

              {data.has_transcript ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() =>
                    downloadFile(
                      `/bookings/${session.id}/transcript/`,
                      `transcript-session-${session.id}.txt`
                    )
                  }
                >
                  <Feather name="download" size={13} color={colors.goldDeep} />
                  <Text className="font-sans-semibold text-sm text-gold-deep">
                    Download transcript
                  </Text>
                </Button>
              ) : null}

              <Text className="pt-1 text-[11px] leading-5 text-slate-light">
                Generated automatically from the session transcript. Scores are AI
                estimates and may not be perfectly accurate — please treat them as a
                helpful aid.
              </Text>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
