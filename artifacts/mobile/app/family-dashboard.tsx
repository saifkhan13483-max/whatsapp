import React, { useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Platform,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useFamilyDashboard } from "@/hooks/useFamilyDashboard";
import { AvatarCircle } from "@/components/ui/AvatarCircle";
import { ActivityRing } from "@/components/ui/ActivityRing";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { EmptyState } from "@/components/ui/EmptyState";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";
import { formatDuration } from "@/lib/formatters";
import type { FamilyMember } from "@/hooks/useFamilyDashboard";

type DateRange = "today" | "week";

function getMemberColor(colors: ReturnType<typeof useColors>, i: number): string {
  const palette: string[] = [
    colors.primary,
    colors.blue,
    colors.purple,
    colors.warning,
    colors.danger,
    colors.success,
  ];
  return palette[i % palette.length];
}

const MiniRing = React.memo(function MiniRing({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const progress = useSharedValue(0);
  const pct = Math.min(value / Math.max(max, 1), 1);
  useEffect(() => {
    progress.value = withTiming(pct, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [pct]);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 360}deg` }],
  }));
  return (
    <View style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          position: "absolute",
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 3,
          borderColor: color + "30",
        }}
      />
      <Animated.View
        style={[
          {
            position: "absolute",
            width: 28,
            height: 28,
            borderRadius: 14,
            borderWidth: 3,
            borderColor: color,
            borderRightColor: "transparent",
            borderBottomColor: "transparent",
          },
          animStyle,
        ]}
      />
    </View>
  );
});

interface MemberCardProps {
  member: FamilyMember;
  color: string;
  maxMinutes: number;
  onPress: () => void;
}

const FamilyMemberCard = React.memo(function FamilyMemberCard({
  member,
  color,
  maxMinutes,
  onPress,
}: MemberCardProps) {
  const colors = useColors();
  const trendUp = member.minutesToday > (member.minutesYesterday ?? 0);
  const trendDown = member.minutesToday < (member.minutesYesterday ?? 0);
  return (
    <TouchableOpacity
      style={[styles.memberCard, { backgroundColor: colors.card, borderColor: color + "55" }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel={`${member.name}, ${formatDuration(member.minutesToday)} today`}
      accessibilityRole="button"
    >
      <AvatarCircle name={member.name} size={52} isOnline={member.isOnline} />
      <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
        {member.name}
      </Text>
      <Text style={[styles.memberTime, { color: color }]}>
        {formatDuration(member.minutesToday)}
      </Text>
      <View style={styles.memberFooter}>
        <MiniRing value={member.minutesToday} max={maxMinutes || 1} color={color} />
        {trendUp ? (
          <Ionicons name="trending-up" size={13} color={colors.danger} accessibilityLabel="Usage increased" />
        ) : trendDown ? (
          <Ionicons name="trending-down" size={13} color={colors.success} accessibilityLabel="Usage decreased" />
        ) : (
          <Ionicons name="remove" size={13} color={colors.muted} />
        )}
      </View>
    </TouchableOpacity>
  );
});

interface HBarProps {
  name: string;
  minutes: number;
  maxMinutes: number;
  color: string;
  onPress: () => void;
}

const HBar = React.memo(function HBar({ name, minutes, maxMinutes, color, onPress }: HBarProps) {
  const colors = useColors();
  const progress = useSharedValue(0);
  const pct = Math.min(minutes / Math.max(maxMinutes, 1), 1);
  useEffect(() => {
    progress.value = withTiming(pct, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [pct]);
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` as any }));
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.hbarRow}
      accessibilityLabel={`${name}: ${formatDuration(minutes)}`}
      accessibilityRole="button"
    >
      <Text style={[styles.hbarName, { color: colors.text }]} numberOfLines={1}>
        {name}
      </Text>
      <View style={[styles.hbarTrack, { backgroundColor: colors.border }]}>
        <Animated.View style={[styles.hbarFill, { backgroundColor: color }, barStyle]} />
      </View>
      <Text style={[styles.hbarVal, { color: color }]}>{formatDuration(minutes)}</Text>
    </TouchableOpacity>
  );
});

export default function FamilyDashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [dateRange, setDateRange] = React.useState<DateRange>("today");
  const { data: summary, isLoading, refetch, isRefetching } = useFamilyDashboard();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const maxMinutes = useMemo(() => {
    if (!summary?.members.length) return 1;
    return Math.max(...summary.members.map((m) => m.minutesToday), 1);
  }, [summary]);

  const sortedMembers = useMemo(() => {
    if (!summary?.members) return [];
    return [...summary.members].sort((a, b) => b.minutesToday - a.minutesToday);
  }, [summary]);

  const heatmapData = useMemo(() => {
    return Array.from({ length: 24 }, (_, h) => {
      let count = 0;
      summary?.members.forEach((m) => {
        if (m.sessions) {
          m.sessions.forEach((s) => {
            const start = new Date(s.startTime).getHours();
            const end = new Date(s.endTime).getHours();
            if (h >= start && h <= end) count++;
          });
        }
      });
      return count;
    });
  }, [summary]);

  const handleRangeToggle = useCallback(async (r: DateRange) => {
    await Haptics.selectionAsync();
    setDateRange(r);
  }, []);

  const handleMemberPress = useCallback((id: number) => {
    router.push(`/contact/${id}` as any);
  }, []);

  const combinedTimeline = useMemo(() => {
    if (!summary?.members) return [];
    return summary.members
      .filter((m) => m.sessions && m.sessions.length > 0)
      .flatMap((m, mi) =>
        (m.sessions || []).map((s, si) => ({
          key: `${m.id}-${si}`,
          name: m.name,
          memberIdx: mi,
          start: new Date(s.startTime),
          end: new Date(s.endTime),
        }))
      )
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 20);
  }, [summary]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: topPad + spacing.sm }]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={colors.headerText} />
        </TouchableOpacity>
        <Text style={[typography.h3, { color: colors.headerText, flex: 1, textAlign: "center" }]}>
          Family Dashboard
        </Text>
        <View style={styles.backBtn} />
      </View>

      <View style={[styles.rangeRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {(["today", "week"] as DateRange[]).map((r) => (
          <TouchableOpacity
            key={r}
            style={[
              styles.rangeChip,
              {
                backgroundColor: dateRange === r ? colors.primary : "transparent",
                borderColor: colors.primary,
              },
            ]}
            onPress={() => handleRangeToggle(r)}
            accessibilityRole="button"
            accessibilityLabel={r === "today" ? "Today" : "This week"}
            accessibilityState={{ selected: dateRange === r }}
          >
            <Text style={[styles.rangeText, { color: dateRange === r ? colors.headerText : colors.primary }]}>
              {r === "today" ? "Today" : "Week"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={{ padding: spacing.base, gap: spacing.base }}>
          <SkeletonLoader width="100%" height={200} borderRadius={16} />
          <SkeletonLoader width="100%" height={120} borderRadius={12} />
          <SkeletonLoader width="100%" height={160} borderRadius={12} />
        </View>
      ) : !summary || summary.members.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No family members"
          subtitle="Add contacts to see the family activity overview"
          actionLabel="Add Contacts"
          onAction={() => router.back()}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.base, gap: spacing.base, paddingBottom: Platform.OS === "web" ? 120 : 96 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.overviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[typography.h2, { color: colors.text, textAlign: "center" }]}>
              {formatDuration(summary.totalMinutesToday)}
            </Text>
            <Text style={[typography.caption, { color: colors.secondaryText, textAlign: "center" }]}>
              Total Family Screen Time Today
            </Text>
            <View style={styles.ringWrap}>
              <ActivityRing
                value={summary.totalMinutesToday}
                max={summary.totalLimitMinutes || 480}
                size={130}
                strokeWidth={13}
                color={colors.primary}
                label={`${Math.min(Math.round((summary.totalMinutesToday / Math.max(summary.totalLimitMinutes || 480, 1)) * 100), 100)}%`}
                sublabel="of limit"
              />
            </View>
            <Text style={[typography.bodyMedium, { color: colors.secondaryText, textAlign: "center" }]}>
              {summary.onlineNow} of {summary.totalContacts} members online now
            </Text>
          </View>

          <View>
            <Text style={[typography.labelBold, { color: colors.text, marginBottom: spacing.md }]}>
              Family Members
            </Text>
            <FlatList
              data={summary.members}
              horizontal
              keyExtractor={(item) => String(item.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm }}
              renderItem={({ item, index }) => (
                <FamilyMemberCard
                  member={item}
                  color={getMemberColor(colors, index)}
                  maxMinutes={maxMinutes}
                  onPress={() => handleMemberPress(item.id)}
                />
              )}
              scrollEnabled={summary.members.length > 0}
            />
          </View>

          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[typography.labelBold, { color: colors.text, marginBottom: spacing.md }]}>
              Usage Comparison
            </Text>
            {sortedMembers.map((m, i) => (
              <HBar
                key={m.id}
                name={m.name}
                minutes={m.minutesToday}
                maxMinutes={maxMinutes}
                color={getMemberColor(colors, i)}
                onPress={() => handleMemberPress(m.id)}
              />
            ))}
          </View>

          {combinedTimeline.length > 0 && (
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[typography.labelBold, { color: colors.text, marginBottom: spacing.md }]}>
                Family Activity Timeline
              </Text>
              {(() => {
                const nowTime = new Date();
                let nowInserted = false;
                const rows: React.ReactNode[] = [];
                combinedTimeline.forEach((ev) => {
                  if (!nowInserted && ev.start > nowTime) {
                    nowInserted = true;
                    rows.push(
                      <View key="now-indicator" style={[styles.nowRow, { borderColor: colors.danger }]}>
                        <View style={[styles.nowDot, { backgroundColor: colors.danger }]} />
                        <Text style={[styles.nowText, { color: colors.danger }]}>
                          Now — {nowTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Text>
                        <View style={[styles.nowLine, { backgroundColor: colors.danger + "44" }]} />
                      </View>
                    );
                  }
                  rows.push(
                    <View key={ev.key} style={styles.tlRow}>
                      <View style={[styles.tlDot, { backgroundColor: getMemberColor(colors, ev.memberIdx) }]} />
                      <Text style={[styles.tlTime, { color: colors.secondaryText }]}>
                        {ev.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {" — "}
                        {ev.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                      <Text style={[styles.tlName, { color: getMemberColor(colors, ev.memberIdx) }]} numberOfLines={1}>
                        {ev.name}
                      </Text>
                    </View>
                  );
                });
                if (!nowInserted) {
                  rows.push(
                    <View key="now-indicator-end" style={[styles.nowRow, { borderColor: colors.danger }]}>
                      <View style={[styles.nowDot, { backgroundColor: colors.danger }]} />
                      <Text style={[styles.nowText, { color: colors.danger }]}>
                        Now — {nowTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                      <View style={[styles.nowLine, { backgroundColor: colors.danger + "44" }]} />
                    </View>
                  );
                }
                return rows;
              })()}
            </View>
          )}

          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[typography.labelBold, { color: colors.text, marginBottom: spacing.sm }]}>
              Peak Family Activity
            </Text>
            <Text style={[typography.caption, { color: colors.secondaryText, marginBottom: spacing.md }]}>
              Highlighted = 2+ members online simultaneously
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={styles.hmRow}>
                  {heatmapData.map((count, h) => (
                    <View
                      key={h}
                      style={[
                        styles.hmCell,
                        {
                          backgroundColor: colors.primary,
                          opacity: count === 0 ? 0.07 : count >= 2 ? 0.9 : 0.35,
                          borderWidth: count >= 2 ? 1 : 0,
                          borderColor: colors.primary,
                        },
                      ]}
                      accessibilityLabel={`${h}:00 — ${count} members active`}
                    />
                  ))}
                </View>
                <View style={styles.hmLabels}>
                  {[0, 4, 8, 12, 16, 20].map((h) => (
                    <Text
                      key={h}
                      style={[styles.hmLabel, { color: colors.secondaryText, left: h * 14 }]}
                    >
                      {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
                    </Text>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  rangeRow: {
    flexDirection: "row",
    padding: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rangeChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  rangeText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  overviewCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  ringWrap: { alignItems: "center", justifyContent: "center", marginVertical: spacing.sm },
  memberCard: {
    width: 100,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: spacing.sm,
    alignItems: "center",
    gap: 5,
  },
  memberName: { fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  memberTime: { fontSize: 13, fontFamily: "Inter_700Bold" },
  memberFooter: { flexDirection: "row", alignItems: "center", gap: 4 },
  sectionCard: { borderRadius: 12, borderWidth: 1, padding: spacing.base },
  hbarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  hbarName: { width: 72, fontSize: 12, fontFamily: "Inter_500Medium" },
  hbarTrack: { flex: 1, height: 10, borderRadius: 5, overflow: "hidden" },
  hbarFill: { height: "100%", borderRadius: 5 },
  hbarVal: { width: 44, fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  tlRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  tlDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  tlTime: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
  tlName: { fontSize: 12, fontFamily: "Inter_600SemiBold", maxWidth: 90 },
  nowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
    borderTopWidth: 1.5,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  nowDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  nowText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  nowLine: { flex: 1, height: 1.5, borderRadius: 1 },
  hmRow: { flexDirection: "row", gap: 2 },
  hmCell: { width: 12, height: 16, borderRadius: 2 },
  hmLabels: { position: "relative", height: 18, marginTop: 4 },
  hmLabel: { position: "absolute", fontSize: 9, fontFamily: "Inter_400Regular" },
});
