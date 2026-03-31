import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format, subDays, addDays, parseISO } from "date-fns";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useActivityTimeline } from "@/hooks/useCompare";
import { AvatarCircle } from "@/components/ui/AvatarCircle";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { EmptyState } from "@/components/ui/EmptyState";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";

const HOUR_HEIGHT = 56;
const LABEL_WIDTH = 44;
const TRACK_WIDTH = 80;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getMemberColor(colors: ReturnType<typeof useColors>, i: number): string {
  const palette = [colors.primary, colors.blue, colors.purple, colors.warning, colors.danger, colors.success];
  return palette[i % palette.length];
}

interface Session {
  startHour: number;
  startMin: number;
  durationMins: number;
}

function eventsToSessions(
  events: Array<{ time: string; status: "online" | "offline" }>
): Session[] {
  const sessions: Session[] = [];
  let onlineTime: Date | null = null;
  for (const ev of events) {
    const t = new Date(ev.time);
    if (ev.status === "online") {
      onlineTime = t;
    } else if (ev.status === "offline" && onlineTime) {
      const durationMins = Math.max(1, Math.round((t.getTime() - onlineTime.getTime()) / 60000));
      sessions.push({
        startHour: onlineTime.getHours(),
        startMin: onlineTime.getMinutes(),
        durationMins,
      });
      onlineTime = null;
    }
  }
  if (onlineTime) {
    const now = new Date();
    const durationMins = Math.max(1, Math.round((now.getTime() - onlineTime.getTime()) / 60000));
    sessions.push({
      startHour: onlineTime.getHours(),
      startMin: onlineTime.getMinutes(),
      durationMins,
    });
  }
  return sessions;
}

interface ContactTrackProps {
  name: string;
  sessions: Session[];
  color: string;
  isFiltered: boolean;
}

const ContactTrack = React.memo(function ContactTrack({ name, sessions, color, isFiltered }: ContactTrackProps) {
  const colors = useColors();
  if (isFiltered) return null;
  return (
    <View style={{ width: TRACK_WIDTH, position: "relative" }}>
      {sessions.map((s, i) => {
        const topOffset = (s.startHour + s.startMin / 60) * HOUR_HEIGHT;
        const barHeight = Math.max((s.durationMins / 60) * HOUR_HEIGHT, 4);
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              top: topOffset,
              height: barHeight,
              left: 4,
              right: 4,
              backgroundColor: color,
              borderRadius: 4,
              justifyContent: "center",
              overflow: "hidden",
            }}
            accessibilityLabel={`${name} online for ${s.durationMins} minutes starting at ${s.startHour}:${String(s.startMin).padStart(2, "0")}`}
          >
            {barHeight > 20 && (
              <Text style={[styles.barLabel, { color: colors.headerText }]} numberOfLines={1}>
                {name}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
});

interface ContactFilterChipProps {
  name: string;
  color: string;
  visible: boolean;
  onToggle: () => void;
}

const ContactFilterChip = React.memo(function ContactFilterChip({ name, color, visible, onToggle }: ContactFilterChipProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[
        styles.filterChip,
        { backgroundColor: visible ? color + "22" : colors.card, borderColor: visible ? color : colors.border },
      ]}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityLabel={`${visible ? "Hide" : "Show"} ${name}`}
      accessibilityState={{ checked: visible }}
    >
      <View style={[styles.filterDot, { backgroundColor: visible ? color : colors.muted }]} />
      <Text style={[styles.filterName, { color: visible ? color : colors.secondaryText }]} numberOfLines={1}>
        {name}
      </Text>
    </TouchableOpacity>
  );
});

export default function ActivityTimelineScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState(new Date());
  const [hiddenIds, setHiddenIds] = useState<number[]>([]);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const dateStr = format(date, "yyyy-MM-dd");
  const { data = [], isLoading, refetch, isRefetching } = useActivityTimeline(dateStr);
  const isToday = dateStr === format(new Date(), "yyyy-MM-dd");

  const now = new Date();
  const nowTop = (now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT;

  const prevDay = useCallback(async () => {
    await Haptics.selectionAsync();
    setDate((d) => subDays(d, 1));
  }, []);

  const nextDay = useCallback(async () => {
    if (isToday) return;
    await Haptics.selectionAsync();
    setDate((d) => addDays(d, 1));
  }, [isToday]);

  const toggleContact = useCallback(async (id: number) => {
    await Haptics.selectionAsync();
    setHiddenIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }, []);

  const contactsWithSessions = useMemo(() =>
    data.map((c, i) => ({
      ...c,
      sessions: eventsToSessions(c.events),
      color: getMemberColor(colors, i),
    })),
    [data, colors]
  );

  const summary = useMemo(() => {
    const activeContacts = contactsWithSessions.filter((c) => c.sessions.length > 0);
    const totalSessions = activeContacts.reduce((s, c) => s + c.sessions.length, 0);
    const totalMins = activeContacts.reduce(
      (sum, c) => sum + c.sessions.reduce((s2, sess) => s2 + sess.durationMins, 0),
      0
    );
    return { activeContacts: activeContacts.length, totalSessions, totalMins };
  }, [contactsWithSessions]);

  const visibleContacts = contactsWithSessions.filter((c) => !hiddenIds.includes(c.contactId));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + spacing.sm, backgroundColor: colors.headerBg }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color={colors.headerText} />
        </TouchableOpacity>
        <Text style={[typography.h3, { color: colors.headerText, flex: 1, textAlign: "center" }]}>
          Activity Timeline
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.datePicker, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={prevDay}
          style={styles.navBtn}
          accessibilityLabel="Previous day"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={[styles.dateLabel, { color: colors.text }]}>
            {isToday ? "Today" : format(date, "EEEE, MMM d")}
          </Text>
          <Text style={[typography.caption, { color: colors.secondaryText }]}>
            {format(date, "yyyy")}
          </Text>
        </View>
        <TouchableOpacity
          onPress={nextDay}
          style={styles.navBtn}
          disabled={isToday}
          accessibilityLabel="Next day"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-forward" size={22} color={isToday ? colors.muted : colors.primary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ padding: spacing.base, gap: spacing.base }}>
          <SkeletonLoader width="100%" height={60} borderRadius={10} />
          <SkeletonLoader width="100%" height={400} borderRadius={10} />
        </View>
      ) : data.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="No activity"
          subtitle={`No contacts were active on ${format(date, "MMMM d, yyyy")}`}
        />
      ) : (
        <>
          <View style={[styles.summaryBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: colors.primary }]}>{summary.activeContacts}</Text>
              <Text style={[styles.summaryLbl, { color: colors.secondaryText }]}>Contacts</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: colors.blue }]}>{summary.totalSessions}</Text>
              <Text style={[styles.summaryLbl, { color: colors.secondaryText }]}>Sessions</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: colors.purple }]}>
                {Math.floor(summary.totalMins / 60)}h {summary.totalMins % 60}m
              </Text>
              <Text style={[styles.summaryLbl, { color: colors.secondaryText }]}>Total</Text>
            </View>
          </View>

          {contactsWithSessions.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {contactsWithSessions.map((c) => (
                <ContactFilterChip
                  key={c.contactId}
                  name={c.name}
                  color={c.color}
                  visible={!hiddenIds.includes(c.contactId)}
                  onToggle={() => toggleContact(c.contactId)}
                />
              ))}
            </ScrollView>
          )}

          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          >
            <View style={[styles.timelineContainer, { paddingBottom: spacing.lg }]}>
              <View style={{ height: 24 * HOUR_HEIGHT, flexDirection: "row" }}>
                <View style={{ width: LABEL_WIDTH }}>
                  {HOURS.map((h) => (
                    <View key={h} style={{ height: HOUR_HEIGHT, justifyContent: "flex-start", paddingTop: 4 }}>
                      <Text style={[styles.hourLabel, { color: colors.secondaryText }]}>
                        {h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={{ flex: 1, position: "relative" }}>
                  {HOURS.map((h) => (
                    <View
                      key={h}
                      style={[
                        styles.hourLine,
                        {
                          top: h * HOUR_HEIGHT,
                          borderTopColor: h % 6 === 0 ? colors.border : colors.border + "55",
                          borderTopWidth: h % 6 === 0 ? 1 : StyleSheet.hairlineWidth,
                        },
                      ]}
                    />
                  ))}

                  <View style={styles.tracksRow}>
                    {contactsWithSessions.map((c) => (
                      <ContactTrack
                        key={c.contactId}
                        name={c.name}
                        sessions={c.sessions}
                        color={c.color}
                        isFiltered={hiddenIds.includes(c.contactId)}
                      />
                    ))}
                  </View>

                  {isToday && (
                    <View style={[styles.nowLine, { top: nowTop, borderColor: colors.danger }]}>
                      <View style={[styles.nowDot, { backgroundColor: colors.danger }]} />
                      <Text style={[styles.nowLabel, { color: colors.danger }]}>Now</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  datePicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  dateLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  summaryBar: {
    flexDirection: "row",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryItem: { flex: 1, alignItems: "center", paddingVertical: 4 },
  summaryVal: { fontSize: 18, fontFamily: "Inter_700Bold" },
  summaryLbl: { fontSize: 11, fontFamily: "Inter_400Regular" },
  summaryDivider: { width: 1, marginVertical: 4 },
  filterRow: {
    gap: spacing.sm,
    padding: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  filterDot: { width: 8, height: 8, borderRadius: 4 },
  filterName: { fontSize: 12, fontFamily: "Inter_500Medium" },
  timelineContainer: { padding: spacing.base },
  hourLine: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  tracksRow: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    flexDirection: "row",
    gap: 2,
  },
  hourLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  barLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    paddingHorizontal: 3,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  nowLine: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 2,
    flexDirection: "row",
    alignItems: "center",
  },
  nowDot: { width: 8, height: 8, borderRadius: 4, marginTop: -4 },
  nowLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    marginLeft: 4,
    marginTop: -4,
  },
});
