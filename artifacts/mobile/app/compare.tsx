import React, { useState, useCallback, useMemo } from "react";
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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useContacts } from "@/hooks/useContacts";
import { useCompare } from "@/hooks/useCompare";
import { AvatarCircle } from "@/components/ui/AvatarCircle";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { EmptyState } from "@/components/ui/EmptyState";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";
import { formatDuration } from "@/lib/formatters";
import type { ComparisonData } from "@/hooks/useCompare";

function getMemberColor(colors: ReturnType<typeof useColors>, i: number): string {
  const palette = [colors.primary, colors.blue, colors.purple, colors.warning];
  return palette[i % palette.length];
}

function computeOverlap(a: number[], b: number[]): number {
  if (!a.length || !b.length) return 0;
  const maxA = Math.max(...a, 1);
  const maxB = Math.max(...b, 1);
  let similarity = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const na = a[i] / maxA;
    const nb = b[i] / maxB;
    similarity += 1 - Math.abs(na - nb);
  }
  return Math.round((similarity / Math.min(a.length, b.length)) * 100);
}

interface StatPillProps {
  label: string;
  value: string;
  color: string;
}
const StatPill = React.memo(function StatPill({ label, value, color }: StatPillProps) {
  const colors = useColors();
  return (
    <View style={[styles.statPill, { backgroundColor: color + "18", borderColor: color + "44" }]}>
      <Text style={[styles.statVal, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.secondaryText }]}>{label}</Text>
    </View>
  );
});

interface GroupBarProps {
  data: ComparisonData[];
  dayIndex: number;
  maxVal: number;
  colors: ReturnType<typeof useColors>;
}
const GroupBar = React.memo(function GroupBar({ data, dayIndex, maxVal, colors }: GroupBarProps) {
  return (
    <View style={styles.groupBarWrap}>
      <View style={styles.groupBarCols}>
        {data.map((d, ci) => {
          const val = d.weeklyData?.[dayIndex] ?? 0;
          const pct = Math.min(val / Math.max(maxVal, 1), 1);
          const color = getMemberColor(colors, ci);
          const height = Math.max(pct * 80, 2);
          return (
            <View key={d.contactId} style={[styles.gBar, { height, backgroundColor: color }]} />
          );
        })}
      </View>
      <Text style={[styles.gbLabel, { color: colors.secondaryText }]}>
        {["M", "T", "W", "T", "F", "S", "S"][dayIndex]}
      </Text>
    </View>
  );
});

interface ContactChipProps {
  name: string;
  selected: boolean;
  color: string;
  onPress: () => void;
}
const ContactChip = React.memo(function ContactChip({ name, selected, color, onPress }: ContactChipProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[
        styles.contactChip,
        { backgroundColor: selected ? color + "22" : colors.card, borderColor: selected ? color : colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityLabel={`${selected ? "Deselect" : "Select"} ${name}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
    >
      <AvatarCircle name={name} size={34} />
      <Text style={[styles.chipName, { color: selected ? color : colors.text }]} numberOfLines={1}>
        {name}
      </Text>
      {selected && <Ionicons name="checkmark-circle" size={15} color={color} />}
    </TouchableOpacity>
  );
});

export default function CompareScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: contacts = [] } = useContacts();
  const [selected, setSelected] = useState<number[]>([]);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: comparison = [], isLoading, refetch } = useCompare(selected);

  const toggleContact = useCallback(async (id: number) => {
    await Haptics.selectionAsync();
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  }, []);

  const patternInsights = useMemo(() => {
    if (comparison.length < 2) return null;
    let mostSimilar = { a: "", b: "", pct: 0 };
    let mostDiff = { a: "", b: "", pct: 100 };
    for (let i = 0; i < comparison.length; i++) {
      for (let j = i + 1; j < comparison.length; j++) {
        const a = comparison[i];
        const b = comparison[j];
        const wd = a.weeklyData && b.weeklyData ? computeOverlap(a.weeklyData, b.weeklyData) : 50;
        if (wd > mostSimilar.pct) mostSimilar = { a: a.name, b: b.name, pct: wd };
        if (wd < mostDiff.pct) mostDiff = { a: a.name, b: b.name, pct: wd };
      }
    }
    return { mostSimilar, mostDiff };
  }, [comparison]);

  const maxWeeklyVal = useMemo(() => {
    if (!comparison.length) return 1;
    return Math.max(...comparison.flatMap((d) => d.weeklyData ?? []), 1);
  }, [comparison]);

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
          Compare Contacts
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.base, gap: spacing.base, paddingBottom: Platform.OS === "web" ? 120 : 96 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
      >
        <View>
          <Text style={[typography.labelBold, { color: colors.text, marginBottom: spacing.sm }]}>
            Select 2–4 contacts to compare
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {contacts.map((c, i) => {
              const sel = selected.includes(c.id);
              const selIdx = selected.indexOf(c.id);
              const color = sel ? getMemberColor(colors, selIdx) : colors.border;
              return (
                <ContactChip
                  key={c.id}
                  name={c.name}
                  selected={sel}
                  color={sel ? getMemberColor(colors, selIdx) : colors.muted}
                  onPress={() => toggleContact(c.id)}
                />
              );
            })}
          </ScrollView>
        </View>

        {selected.length < 2 ? (
          <EmptyState
            icon="people-outline"
            title="Select contacts to compare"
            subtitle="Choose 2–4 contacts above to compare their activity side by side"
          />
        ) : isLoading ? (
          <View style={{ gap: spacing.base }}>
            <SkeletonLoader width="100%" height={120} borderRadius={12} />
            <SkeletonLoader width="100%" height={160} borderRadius={12} />
            <SkeletonLoader width="100%" height={100} borderRadius={12} />
          </View>
        ) : comparison.length === 0 ? (
          <EmptyState
            icon="bar-chart-outline"
            title="No data yet"
            subtitle="Comparison data appears once contacts have activity"
          />
        ) : (
          <>
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[typography.labelBold, { color: colors.text, marginBottom: spacing.md }]}>
                Stats Comparison
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.statCols}>
                  {comparison.map((d, i) => {
                    const color = getMemberColor(colors, i);
                    const peakHr = d.peakHour ?? 0;
                    const peakLabel =
                      peakHr === 0 ? "12am" : peakHr < 12 ? `${peakHr}am` : peakHr === 12 ? "12pm" : `${peakHr - 12}pm`;
                    return (
                      <View key={d.contactId} style={styles.statCol}>
                        <View style={[styles.statColorBar, { backgroundColor: color }]} />
                        <AvatarCircle name={d.name} size={40} />
                        <Text style={[styles.statName, { color: colors.text }]} numberOfLines={1}>
                          {d.name}
                        </Text>
                        <StatPill label="Online Time" value={formatDuration(d.totalOnlineMinutes)} color={color} />
                        <StatPill label="Avg Session" value={formatDuration(d.avgSessionDuration ?? 0)} color={color} />
                        <StatPill label="Peak Hour" value={peakLabel} color={color} />
                        <StatPill label="Sessions" value={String(d.sessionsCount)} color={color} />
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.legendRow}>
                {comparison.map((d, i) => (
                  <View key={d.contactId} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: getMemberColor(colors, i) }]} />
                    <Text style={[styles.legendName, { color: colors.text }]} numberOfLines={1}>
                      {d.name}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={[typography.labelBold, { color: colors.text, marginBottom: spacing.md, marginTop: spacing.sm }]}>
                Weekly Activity
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chartArea}>
                  <View style={styles.chartBars}>
                    {Array.from({ length: 7 }, (_, di) => (
                      <GroupBar
                        key={di}
                        data={comparison}
                        dayIndex={di}
                        maxVal={maxWeeklyVal}
                        colors={colors}
                      />
                    ))}
                  </View>
                </View>
              </ScrollView>
            </View>

            {patternInsights && (
              <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[typography.labelBold, { color: colors.text, marginBottom: spacing.md }]}>
                  Pattern Analysis
                </Text>
                <View style={[styles.insightRow, { borderColor: colors.success + "44", backgroundColor: colors.success + "12" }]}>
                  <Ionicons name="git-merge-outline" size={18} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.insightTitle, { color: colors.text }]}>Most Similar</Text>
                    <Text style={[styles.insightBody, { color: colors.secondaryText }]}>
                      {patternInsights.mostSimilar.a} & {patternInsights.mostSimilar.b} (
                      {patternInsights.mostSimilar.pct}% pattern overlap)
                    </Text>
                  </View>
                </View>
                <View style={[styles.insightRow, { borderColor: colors.warning + "44", backgroundColor: colors.warning + "12" }]}>
                  <Ionicons name="git-branch-outline" size={18} color={colors.warning} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.insightTitle, { color: colors.text }]}>Most Different</Text>
                    <Text style={[styles.insightBody, { color: colors.secondaryText }]}>
                      {patternInsights.mostDiff.a} & {patternInsights.mostDiff.b} (
                      {patternInsights.mostDiff.pct}% pattern overlap)
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[typography.labelBold, { color: colors.text, marginBottom: spacing.md }]}>
                Simultaneous Online
              </Text>
              {comparison.length >= 2 && (
                <View style={styles.simultaneousRow}>
                  <Ionicons name="time-outline" size={20} color={colors.blue} />
                  <Text style={[styles.simText, { color: colors.secondaryText }]}>
                    {comparison[0].name} and {comparison[1].name} share similar activity windows based on their weekly patterns.
                    Enable session-level tracking to see exact overlap times.
                  </Text>
                </View>
              )}
              {comparison.map((d, i) => {
                const next = comparison[i + 1];
                if (!next) return null;
                const overlap = d.weeklyData && next.weeklyData
                  ? computeOverlap(d.weeklyData, next.weeklyData)
                  : 0;
                return (
                  <View key={`${d.contactId}-${next.contactId}`} style={[styles.overlapCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                      <AvatarCircle name={d.name} size={28} />
                      <AvatarCircle name={next.name} size={28} />
                      <Text style={[styles.overlapNames, { color: colors.text }]}>
                        {d.name} & {next.name}
                      </Text>
                    </View>
                    <View style={[styles.overlapPct, { backgroundColor: colors.primary + "22" }]}>
                      <Text style={[styles.overlapPctText, { color: colors.primary }]}>{overlap}%</Text>
                      <Text style={[styles.overlapPctLabel, { color: colors.secondaryText }]}>overlap</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
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
  contactChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 24,
    borderWidth: 1.5,
    maxWidth: 150,
    minWidth: 80,
  },
  chipName: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  sectionCard: { borderRadius: 12, borderWidth: 1, padding: spacing.base },
  statCols: { flexDirection: "row", gap: spacing.base },
  statCol: { width: 120, alignItems: "center", gap: spacing.sm },
  statColorBar: { width: 40, height: 4, borderRadius: 2 },
  statName: { fontSize: 12, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  statPill: {
    width: "100%",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
  },
  statVal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { fontSize: 12, fontFamily: "Inter_500Medium" },
  chartArea: { paddingBottom: spacing.sm },
  chartBars: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, height: 100 },
  groupBarWrap: { alignItems: "center", gap: 4 },
  groupBarCols: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 80 },
  gBar: { width: 8, borderRadius: 3, minHeight: 2 },
  gbLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
  insightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  insightTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  insightBody: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, marginTop: 2 },
  simultaneousRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
    alignItems: "flex-start",
  },
  simText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 20 },
  overlapCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  overlapNames: { fontSize: 13, fontFamily: "Inter_500Medium" },
  overlapPct: { alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  overlapPctText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  overlapPctLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
});
