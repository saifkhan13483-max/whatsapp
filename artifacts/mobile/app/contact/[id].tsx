import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  TextInput,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";
import { useContact, useDeleteContact, useUpdateContact, useToggleFavorite } from "@/hooks/useContacts";
import { useContactStats, useHourlyData, useContactSessions } from "@/hooks/useSessions";
import { AvatarCircle } from "@/components/ui/AvatarCircle";
import { AnimatedRing } from "@/components/ui/AnimatedRing";
import { StatCard } from "@/components/ui/StatCard";
import { HeatmapGrid } from "@/components/ui/HeatmapGrid";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";
import { formatDuration } from "@/lib/formatters";
import type { Session } from "@/hooks/useSessions";

const RANGE_OPTIONS = ["Today", "Week", "Month"];
const RANGE_KEYS = ["today", "week", "month"] as const;

function formatTimer(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function groupSessionsByDate(sessions: Session[]): { title: string; data: Session[] }[] {
  const map: Record<string, Session[]> = {};
  for (const s of sessions) {
    const d = s.startTime.slice(0, 10);
    if (!map[d]) map[d] = [];
    map[d].push(s);
  }
  return Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateStr, data]) => {
      const date = parseISO(dateStr);
      const title = isToday(date) ? "Today" : isYesterday(date) ? "Yesterday" : format(date, "EEE, MMM d");
      return { title, data };
    });
}

const SessionRow = React.memo(function SessionRow({ session, colors }: { session: Session; colors: any }) {
  const start = format(parseISO(session.startTime), "HH:mm");
  const end = session.endTime ? format(parseISO(session.endTime), "HH:mm") : "—";
  return (
    <View style={[styles.sessionRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.sessionDot, { backgroundColor: colors.primary }]} />
      <View style={{ flex: 1 }}>
        <Text style={[typography.caption, { color: colors.text }]}>
          {start} — {end}
        </Text>
      </View>
      <View style={[styles.durationChip, { backgroundColor: colors.primary + "18" }]}>
        <Text style={[styles.durationText, { color: colors.primary }]}>
          {formatDuration(session.durationMinutes)}
        </Text>
      </View>
    </View>
  );
});

const WeeklyBarChart = React.memo(function WeeklyBarChart({ hourly, colors }: { hourly: { hour: number; value: number }[]; colors: any }) {
  const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
  const dayData = DAYS.map((_, dayIdx) => {
    const dayHour = hourly.filter((h) => {
      const simulatedDay = h.hour % 7;
      return simulatedDay === dayIdx;
    });
    const total = dayHour.reduce((s, h) => s + h.value, 0);
    const day = hourly.filter((h) => {
      const hr = h.hour % 24;
      const simulatedDay = Math.floor(h.hour / 24) % 7;
      return simulatedDay === dayIdx && hr >= 6 && hr < 18;
    }).reduce((s, h) => s + h.value, 0);
    const evening = hourly.filter((h) => {
      const hr = h.hour % 24;
      const simulatedDay = Math.floor(h.hour / 24) % 7;
      return simulatedDay === dayIdx && hr >= 18 && hr < 22;
    }).reduce((s, h) => s + h.value, 0);
    const night = total - day - evening;
    return { label: DAYS[dayIdx], total, day, evening, night: Math.max(0, night) };
  });

  const maxVal = Math.max(...dayData.map((d) => d.total), 1);
  const chartH = 80;

  return (
    <View style={styles.weekChart}>
      {dayData.map((d, i) => {
        const totalH = (d.total / maxVal) * chartH;
        const dayH = (d.day / maxVal) * chartH;
        const evH = (d.evening / maxVal) * chartH;
        const nightH = Math.max(0, totalH - dayH - evH);
        return (
          <View key={i} style={styles.barWrap}>
            <View style={[styles.barContainer, { height: chartH }]}>
              <View style={{ flex: 1, justifyContent: "flex-end" }}>
                <View style={{ height: nightH, backgroundColor: colors.purple, borderRadius: 2 }} />
                <View style={{ height: evH, backgroundColor: colors.evening, borderRadius: 2 }} />
                <View style={{ height: dayH, backgroundColor: colors.primary, borderRadius: 2 }} />
              </View>
            </View>
            <Text style={[styles.dayLabel, { color: colors.secondaryText }]}>{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
});

export default function ContactDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const contactId = parseInt(id ?? "0", 10);

  const [rangeIdx, setRangeIdx] = useState(0);
  const range = RANGE_KEYS[rangeIdx];
  const [isFavorite, setIsFavorite] = useState(false);
  const [timerSecs, setTimerSecs] = useState(0);
  const [notes, setNotes] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const noteTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveOpacity = useSharedValue(0);
  const saveAnimStyle = useAnimatedStyle(() => ({
    opacity: saveOpacity.value,
  }));

  const { data: contact, isLoading: loadingContact } = useContact(contactId);
  const { data: stats } = useContactStats(contactId, range);
  const { data: hourly = [] } = useHourlyData(contactId);
  const { data: sessions = [] } = useContactSessions(contactId);
  const deleteContact = useDeleteContact();
  const updateContact = useUpdateContact();
  const toggleFavorite = useToggleFavorite();

  useEffect(() => {
    if (contact?.notes) setNotes(contact.notes);
  }, [contact?.notes]);

  useEffect(() => {
    if (!(contact as any)?.isOnline) {
      setTimerSecs(0);
      return;
    }
    const activeSession = sessions.find((s) => !s.endTime);
    const elapsed = activeSession
      ? Math.max(0, Math.floor((Date.now() - new Date(activeSession.startTime).getTime()) / 1000))
      : 0;
    setTimerSecs(elapsed);
    const t = setInterval(() => setTimerSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [(contact as any)?.isOnline, sessions.length]);

  function handleFavoriteToggle() {
    setIsFavorite((f) => !f);
    toggleFavorite.mutate(contactId);
  }

  function handleNotesChange(text: string) {
    setNotes(text);
    setNoteSaved(false);
    if (noteTimeout.current) clearTimeout(noteTimeout.current);
    noteTimeout.current = setTimeout(() => {
      updateContact.mutate({ id: contactId, notes: text });
      setNoteSaved(true);
      saveOpacity.value = withSequence(
        withTiming(1, { duration: 200 }),
        withDelay(1500, withTiming(0, { duration: 300 }))
      );
    }, 1000);
  }

  function handleDelete() {
    Alert.alert("Delete Contact", `Remove ${contact?.name} from tracking?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteContact.mutateAsync(contactId);
          router.back();
        },
      },
    ]);
  }

  const heatmapData = Array.from({ length: 7 * 24 }, (_, i) => {
    const h = hourly.find((x) => x.hour === i % 24);
    return h?.value ?? 0;
  });

  const sections = groupSessionsByDate(sessions);

  const longestSession = sessions.reduce((max, s) => Math.max(max, s.durationMinutes ?? 0), 0);

  if (loadingContact) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.navBar, { paddingTop: Platform.OS === "web" ? 67 : insets.top, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
        </View>
        <View style={{ padding: spacing.base, gap: spacing.base }}>
          <SkeletonLoader width="100%" height={160} borderRadius={16} />
          <SkeletonLoader width="100%" height={80} borderRadius={12} />
        </View>
      </View>
    );
  }

  if (!contact) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background }]}>
        <Text style={[typography.body, { color: colors.secondaryText }]}>Contact not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[typography.caption, { color: colors.primary }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOnline = !!(contact as any).isOnline;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.navBar,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            paddingTop: Platform.OS === "web" ? 67 : insets.top,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.navBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h3, { color: colors.text, flex: 1, textAlign: "center" }]} numberOfLines={1}>
          {contact.name}
        </Text>
        <TouchableOpacity
          onPress={handleFavoriteToggle}
          style={styles.navBtn}
          accessibilityLabel={isFavorite ? "Remove from favorites" : "Add to favorites"}
          accessibilityRole="button"
        >
          <Ionicons
            name={isFavorite ? "star" : "star-outline"}
            size={22}
            color={isFavorite ? colors.warning : colors.muted}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleDelete}
          style={styles.navBtn}
          accessibilityLabel="Delete contact"
          accessibilityRole="button"
        >
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : 80 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.avatarWrap}>
            {isOnline && (
              <View style={StyleSheet.absoluteFill}>
                <AnimatedRing size={88} color={colors.online} thickness={3} />
              </View>
            )}
            <AvatarCircle name={contact.name} size={72} isOnline={isOnline} />
          </View>
          <Text style={[typography.h3, { color: colors.text }]}>{contact.name}</Text>
          <Text style={[typography.caption, { color: colors.secondaryText }]}>{contact.phoneNumber}</Text>

          {isOnline ? (
            <View style={[styles.timerBadge, { backgroundColor: colors.online + "18" }]}>
              <View style={[styles.statusDot, { backgroundColor: colors.online }]} />
              <Text style={[typography.caption, { color: colors.online, fontFamily: "Inter_600SemiBold" }]}>
                Online · {formatTimer(timerSecs)}
              </Text>
            </View>
          ) : (
            <View style={[styles.timerBadge, { backgroundColor: colors.muted + "18" }]}>
              <View style={[styles.statusDot, { backgroundColor: colors.offline }]} />
              <Text style={[typography.caption, { color: colors.secondaryText }]}>
                {(contact as any).lastSeen
                  ? `Last seen ${format(parseISO((contact as any).lastSeen), "MMM d HH:mm")}`
                  : "Offline"}
              </Text>
            </View>
          )}

          <View style={[styles.alertRow, { borderTopColor: colors.border }]}>
            <Text style={[typography.caption, { color: colors.secondaryText }]}>Alert notifications</Text>
            <ToggleSwitch
              value={contact.alertEnabled}
              onValueChange={(v) => updateContact.mutate({ id: contactId, alertEnabled: v })}
            />
          </View>
        </View>

        <View style={styles.rangePicker}>
          {RANGE_OPTIONS.map((label, i) => (
            <TouchableOpacity
              key={label}
              style={[
                styles.rangeBtn,
                {
                  backgroundColor: rangeIdx === i ? colors.primary : colors.card,
                  borderColor: rangeIdx === i ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setRangeIdx(i)}
              accessibilityLabel={`View ${label} data`}
              accessibilityRole="button"
              accessibilityState={{ selected: rangeIdx === i }}
            >
              <Text style={[typography.caption, { color: rangeIdx === i ? colors.headerText : colors.secondaryText }]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.base, gap: spacing.sm, paddingVertical: 2 }}
        >
          <StatCard
            label="Total Time"
            value={stats ? formatDuration(stats.totalMinutes) : "--"}
            icon="time-outline"
            color={colors.primary}
          />
          <StatCard
            label="Sessions"
            value={stats ? String(stats.totalSessions) : "--"}
            icon="repeat-outline"
            color={colors.blue}
          />
          <StatCard
            label="Avg Session"
            value={stats ? formatDuration(stats.avgSessionMinutes) : "--"}
            icon="hourglass-outline"
            color={colors.warning}
          />
          <StatCard
            label="Longest"
            value={longestSession ? formatDuration(longestSession) : "--"}
            icon="trophy-outline"
            color={colors.danger}
          />
        </ScrollView>

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={[typography.labelBold, { color: colors.text }]}>Activity Timeline</Text>
            <TouchableOpacity onPress={() => router.push(`/activity-timeline?contactId=${contactId}` as any)}>
              <Text style={[typography.caption, { color: colors.primary }]}>View in Timeline</Text>
            </TouchableOpacity>
          </View>
          {sections.length === 0 ? (
            <View style={[styles.noData, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[typography.caption, { color: colors.secondaryText }]}>No sessions recorded yet</Text>
            </View>
          ) : (
            sections.slice(0, 3).map((sec) => (
              <View key={sec.title} style={{ marginBottom: spacing.sm }}>
                <Text style={[styles.sectionDate, { color: colors.secondaryText }]}>{sec.title}</Text>
                {sec.data.map((s) => (
                  <SessionRow key={s.id} session={s} colors={colors} />
                ))}
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={[typography.labelBold, { color: colors.text, marginBottom: spacing.md }]}>
            Weekly Activity
          </Text>
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <WeeklyBarChart hourly={hourly} colors={colors} />
            <View style={styles.legend}>
              {[
                { color: colors.primary, label: "Day" },
                { color: colors.evening, label: "Evening" },
                { color: colors.purple, label: "Night" },
              ].map((l) => (
                <View key={l.label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                  <Text style={[typography.small, { color: colors.secondaryText }]}>{l.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[typography.labelBold, { color: colors.text, marginBottom: spacing.md }]}>
            Peak Hours Heatmap
          </Text>
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <HeatmapGrid data={heatmapData} color={colors.primary} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[typography.labelBold, { color: colors.text, marginBottom: spacing.md }]}>
            Predicted Activity
          </Text>
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {stats?.peakHour != null ? (
              <View style={styles.predictRow}>
                <Ionicons name="bulb-outline" size={20} color={colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, { color: colors.text }]}>
                    Most active around {stats.peakHour}:00
                  </Text>
                  <Text style={[typography.caption, { color: colors.secondaryText }]}>
                    Based on historical patterns over the past week
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={[typography.caption, { color: colors.muted, textAlign: "center", padding: spacing.base }]}>
                Not enough data to predict patterns yet
              </Text>
            )}
            {stats?.onlineStreak != null && stats.onlineStreak > 1 && (
              <View style={[styles.predictRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: 4 }]}>
                <Ionicons name="flame-outline" size={20} color={colors.danger} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, { color: colors.text }]}>
                    {stats.onlineStreak}-day active streak
                  </Text>
                  <Text style={[typography.caption, { color: colors.secondaryText }]}>
                    Online every day this week
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={[typography.labelBold, { color: colors.text }]}>Notes</Text>
            <Animated.View style={saveAnimStyle}>
              <View style={styles.savedBadge}>
                <Ionicons name="checkmark" size={12} color={colors.online} />
                <Text style={[styles.savedText, { color: colors.online }]}>Saved</Text>
              </View>
            </Animated.View>
          </View>
          <TextInput
            style={[
              styles.notesInput,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
            ]}
            multiline
            placeholder="Add notes about this contact..."
            placeholderTextColor={colors.muted}
            value={notes}
            onChangeText={handleNotesChange}
            textAlignVertical="top"
            accessibilityLabel="Contact notes"
          />
        </View>

        <View style={{ paddingHorizontal: spacing.base, gap: spacing.sm, paddingBottom: spacing.xl }}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push(`/reports?contactId=${contactId}`)}
            accessibilityLabel="View full report"
            accessibilityRole="button"
          >
            <Ionicons name="bar-chart" size={18} color={colors.headerText} />
            <Text style={[typography.bodyMedium, { color: colors.headerText }]}>View Full Report</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
            onPress={() => router.push(`/chat/${contactId}`)}
            accessibilityLabel="View chat history"
            accessibilityRole="button"
          >
            <Ionicons name="chatbubbles-outline" size={18} color={colors.primary} />
            <Text style={[typography.bodyMedium, { color: colors.primary }]}>View Chat</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  profileCard: {
    margin: spacing.base,
    padding: spacing.xl,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    gap: spacing.md,
  },
  avatarWrap: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
  },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 24,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rangePicker: {
    flexDirection: "row",
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  rangeBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  section: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.xl,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sectionDate: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sessionDot: { width: 8, height: 8, borderRadius: 4 },
  durationChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  durationText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  noData: {
    padding: spacing.base,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  chartCard: {
    padding: spacing.base,
    borderRadius: 12,
    borderWidth: 1,
  },
  weekChart: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  barWrap: { flex: 1, alignItems: "center" },
  barContainer: { width: "100%", justifyContent: "flex-end" },
  dayLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.base,
    marginTop: spacing.sm,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  predictRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  notesInput: {
    padding: spacing.base,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 100,
    lineHeight: 20,
  },
  savedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  savedText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.base,
    borderRadius: 10,
  },
});
