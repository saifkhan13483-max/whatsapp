import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Platform,
  RefreshControl,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useContacts } from "@/hooks/useContacts";
import { useReport, exportReport } from "@/hooks/useReports";
import { ChipFilter } from "@/components/ui/ChipFilter";
import { StatCard } from "@/components/ui/StatCard";
import { BarChart } from "@/components/ui/BarChart";
import { HeatmapGrid } from "@/components/ui/HeatmapGrid";
import { DurationChip } from "@/components/ui/DurationChip";
import { AvatarCircle } from "@/components/ui/AvatarCircle";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { EmptyState } from "@/components/ui/EmptyState";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";
import { formatDuration, formatHour } from "@/lib/formatters";
import { format } from "date-fns";

const RANGE_OPTIONS = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
];

type SortKey = "date" | "start" | "end" | "duration";
type SortDir = "asc" | "desc";

interface SessionRow {
  id: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  date: string;
}

export default function ReportsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ contactId?: string }>();

  const { data: contacts = [] } = useContacts();
  const [selectedId, setSelectedId] = useState<number>(
    params.contactId ? parseInt(params.contactId, 10) : 0
  );
  const [range, setRange] = useState("week");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);

  const activeId = selectedId || (contacts[0]?.id ?? 0);
  const { data: report, isLoading, refetch, isRefetching } = useReport(activeId, range);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("desc");
      }
      Haptics.selectionAsync();
    },
    [sortKey]
  );

  const sessions: SessionRow[] = report?.sessions ?? [];

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      let valA: string | number, valB: string | number;
      if (sortKey === "duration") {
        valA = a.durationMinutes;
        valB = b.durationMinutes;
      } else if (sortKey === "start") {
        valA = a.startTime;
        valB = b.startTime;
      } else if (sortKey === "end") {
        valA = a.endTime;
        valB = b.endTime;
      } else {
        valA = a.date;
        valB = b.date;
      }
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [sessions, sortKey, sortDir]);

  const heatmapData: number[] = report?.hourlyHeatmap ?? new Array(7 * 24).fill(0);

  const handleExportCSV = async () => {
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Not supported", "Sharing is not available on this device.");
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const blob = await exportReport(activeId);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const { FileSystem } = await import("expo-file-system");
        const uri = FileSystem.cacheDirectory + `report-${activeId}-${Date.now()}.csv`;
        await FileSystem.writeAsStringAsync(uri, base64!, { encoding: FileSystem.EncodingType.Base64 });
        await Sharing.shareAsync(uri, { mimeType: "text/csv", dialogTitle: "Export Activity Report" });
      };
      reader.readAsDataURL(blob);
    } catch {
      Alert.alert("Export failed", "Could not export the report. Please try again.");
    }
  };

  const handleNavigateToCompare = () => {
    const ids = selectedContactIds.length > 0 ? selectedContactIds : [activeId];
    router.push(`/compare?contactIds=${ids.join(",")}` as any);
  };

  const SortHeader = ({
    label,
    sortK,
  }: {
    label: string;
    sortK: SortKey;
  }) => (
    <TouchableOpacity
      style={styles.sortHeader}
      onPress={() => handleSort(sortK)}
    >
      <Text style={[typography.small, { color: colors.secondaryText, fontFamily: "Inter_600SemiBold" }]}>
        {label.toUpperCase()}
      </Text>
      {sortKey === sortK && (
        <Ionicons
          name={sortDir === "asc" ? "arrow-up" : "arrow-down"}
          size={12}
          color={colors.primary}
        />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.primaryDarkest,
            paddingTop: topPad + spacing.sm,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.btn}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text
          style={[typography.h3, { color: "#fff", flex: 1, textAlign: "center" }]}
        >
          Activity Reports
        </Text>
        <TouchableOpacity
          style={styles.btn}
          onPress={handleExportCSV}
          accessibilityLabel="Export CSV"
        >
          <Feather name="download" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Contact picker */}
      <View
        style={[
          styles.contactPicker,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.base, paddingVertical: spacing.sm }}
        >
          {contacts.map((c) => {
            const isActive = activeId === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={styles.avatarPickerItem}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedId(c.id);
                }}
                accessibilityLabel={`Select ${c.name}`}
              >
                <View
                  style={[
                    styles.avatarRing,
                    {
                      borderColor: isActive ? colors.primary : "transparent",
                    },
                  ]}
                >
                  <AvatarCircle name={c.name} size={40} />
                </View>
                <Text
                  style={[
                    typography.small,
                    {
                      color: isActive ? colors.primary : colors.secondaryText,
                      fontFamily: isActive ? "Inter_600SemiBold" : "Inter_400Regular",
                      textAlign: "center",
                    },
                  ]}
                  numberOfLines={1}
                >
                  {c.name.split(" ")[0]}
                </Text>
              </TouchableOpacity>
            );
          })}
          {contacts.length >= 2 && (
            <TouchableOpacity
              style={[styles.compareBtn, { backgroundColor: colors.primary + "15", borderColor: colors.primary }]}
              onPress={handleNavigateToCompare}
            >
              <Ionicons name="bar-chart" size={16} color={colors.primary} />
              <Text style={[typography.small, { color: colors.primary }]}>Compare</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* Range filter */}
      <ChipFilter options={RANGE_OPTIONS} selected={range} onSelect={setRange} />

      {/* Content */}
      {contacts.length === 0 ? (
        <EmptyState
          icon="bar-chart-outline"
          title="No contacts"
          subtitle="Add contacts to see activity reports"
        />
      ) : isLoading ? (
        <ScrollView contentContainerStyle={{ padding: spacing.base, gap: spacing.base }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonLoader key={i} width="100%" height={120} borderRadius={12} />
          ))}
        </ScrollView>
      ) : !report ? (
        <EmptyState
          icon="bar-chart-outline"
          title="No activity data"
          subtitle="No sessions recorded in this period"
        />
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: spacing.base,
            gap: spacing.base,
            paddingBottom: Platform.OS === "web" ? 120 : 80,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Summary stats */}
          <View style={styles.statsGrid}>
            <StatCard
              label="Total Time"
              value={formatDuration(report.totalMinutes ?? 0)}
              icon="time"
              color={colors.primary}
            />
            <StatCard
              label="Daily Average"
              value={formatDuration(
                Math.round((report.totalMinutes ?? 0) / (range === "today" ? 1 : range === "week" ? 7 : 30))
              )}
              icon="trending-up"
              color={colors.blue}
            />
            <StatCard
              label="Sessions"
              value={String(report.totalSessions ?? 0)}
              icon="refresh-circle"
              color={colors.purple}
            />
            <StatCard
              label="Peak Hour"
              value={formatHour(report.peakHour ?? 0)}
              icon="moon"
              color={colors.warning}
            />
          </View>

          {/* Daily usage bar chart */}
          {(report.dailyBreakdown?.length ?? 0) > 0 && (
            <View
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.sm }]}>
                Daily Usage
              </Text>
              <BarChart
                data={report.dailyBreakdown.map((d: any) => ({
                  label: d.date ? format(new Date(d.date), "EEE") : "",
                  value: d.minutes ?? 0,
                }))}
                height={140}
                color={colors.primary}
              />
            </View>
          )}

          {/* Hourly heatmap */}
          <View
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.sm }]}>
              Activity Heatmap
            </Text>
            <Text style={[typography.caption, { color: colors.secondaryText, marginBottom: spacing.md }]}>
              Hours active across days of week
            </Text>
            <HeatmapGrid data={heatmapData} color={colors.primary} />
            {/* Legend */}
            <View style={styles.heatmapLegend}>
              <Text style={[typography.small, { color: colors.secondaryText }]}>Less</Text>
              {[0.1, 0.3, 0.5, 0.7, 0.9].map((op) => (
                <View
                  key={op}
                  style={[
                    styles.legendDot,
                    { backgroundColor: colors.primary, opacity: op },
                  ]}
                />
              ))}
              <Text style={[typography.small, { color: colors.secondaryText }]}>More</Text>
            </View>
          </View>

          {/* Sessions table */}
          {sortedSessions.length > 0 && (
            <View
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.sm }]}>
                Sessions
              </Text>

              {/* Table header */}
              <View
                style={[
                  styles.tableHeader,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <SortHeader label="Date" sortK="date" />
                <SortHeader label="Start" sortK="start" />
                <SortHeader label="End" sortK="end" />
                <SortHeader label="Duration" sortK="duration" />
              </View>

              {/* Session rows */}
              {sortedSessions.slice(0, 20).map((session, idx) => (
                <View
                  key={session.id}
                  style={[
                    styles.tableRow,
                    {
                      backgroundColor:
                        idx % 2 === 0 ? colors.card : colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[typography.caption, { color: colors.secondaryText, flex: 1 }]}
                  >
                    {session.date}
                  </Text>
                  <Text
                    style={[typography.caption, { color: colors.text, flex: 1, textAlign: "center" }]}
                  >
                    {session.startTime}
                  </Text>
                  <Text
                    style={[typography.caption, { color: colors.text, flex: 1, textAlign: "center" }]}
                  >
                    {session.endTime}
                  </Text>
                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <DurationChip minutes={session.durationMinutes} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Export & share buttons */}
          <View style={styles.exportRow}>
            <TouchableOpacity
              style={[styles.exportBtn, { backgroundColor: colors.primary }]}
              onPress={handleExportCSV}
              accessibilityLabel="Export CSV"
            >
              <Feather name="download" size={18} color="#fff" />
              <Text style={[typography.bodyMedium, { color: "#fff" }]}>Export CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.exportBtn, { backgroundColor: colors.blue + "20", borderColor: colors.blue, borderWidth: 1 }]}
              onPress={handleExportCSV}
              accessibilityLabel="Share report"
            >
              <Feather name="share-2" size={18} color={colors.blue} />
              <Text style={[typography.bodyMedium, { color: colors.blue }]}>Share Report</Text>
            </TouchableOpacity>
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
  btn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  contactPicker: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarPickerItem: {
    alignItems: "center",
    gap: 4,
    width: 56,
  },
  avatarRing: {
    borderWidth: 2,
    borderRadius: 24,
    padding: 2,
  },
  compareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 24,
    borderWidth: 1,
    alignSelf: "center",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  card: {
    padding: spacing.base,
    borderRadius: 12,
    borderWidth: 1,
  },
  heatmapLegend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  tableHeader: {
    flexDirection: "row",
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  sortHeader: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exportRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  exportBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.base,
    borderRadius: 12,
  },
});
