import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useKeywordAlerts, useAddKeyword, useDeleteKeyword } from "@/hooks/useKeywordAlerts";
import { KeywordBadge } from "@/components/ui/KeywordBadge";
import { AvatarCircle } from "@/components/ui/AvatarCircle";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";
import { apiFetch } from "@/lib/api";
import type { Severity } from "@/components/ui/KeywordBadge";

const SEVERITIES: Severity[] = ["low", "medium", "high"];

const SEV_COLORS: Record<Severity, string> = {
  low: "#4CAF50",
  medium: "#FFC107",
  high: "#FF3B30",
};

const PREDEFINED_CATEGORIES = [
  {
    id: "safety",
    label: "Safety",
    icon: "shield-outline" as const,
    keywords: ["help me", "emergency", "danger", "hurt", "abuse", "scared", "follow me"],
  },
  {
    id: "substances",
    label: "Substances",
    icon: "flask-outline" as const,
    keywords: ["drugs", "alcohol", "weed", "pills", "get high", "dealer"],
  },
  {
    id: "bullying",
    label: "Bullying",
    icon: "warning-outline" as const,
    keywords: ["hate you", "kill yourself", "nobody likes you", "loser", "ugly", "freak"],
  },
  {
    id: "location",
    label: "Location",
    icon: "location-outline" as const,
    keywords: ["meet me", "come alone", "don't tell", "secret place", "address"],
  },
];

interface KeywordMatchNotification {
  id: number;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  contactId?: number;
  contactName?: string;
  keyword?: string;
}

function useKeywordMatches() {
  return useQuery<KeywordMatchNotification[]>({
    queryKey: ["notifications", "keyword-matches"],
    queryFn: () =>
      apiFetch<{ notifications: KeywordMatchNotification[] }>(
        "/notifications?filter=keyword&page=1"
      )
        .then((res) => {
          if (Array.isArray(res)) return res;
          return (res as any).notifications ?? [];
        })
        .catch(() => []),
    staleTime: 30000,
  });
}

interface KeywordRowProps {
  id: number;
  keyword: string;
  severity: Severity;
  matchCount?: number;
  onDelete: (id: number) => void;
}

const KeywordRow = React.memo(function KeywordRow({
  id,
  keyword,
  severity,
  matchCount,
  onDelete,
}: KeywordRowProps) {
  const colors = useColors();
  const handleDelete = useCallback(() => {
    Alert.alert("Delete Keyword", `Remove "${keyword}" from alerts?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          onDelete(id);
        },
      },
    ]);
  }, [id, keyword, onDelete]);

  return (
    <View style={[styles.kwRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.kwBadgeWrap}>
        <KeywordBadge keyword={keyword} severity={severity} />
      </View>
      {matchCount !== undefined && matchCount > 0 && (
        <View style={[styles.matchCountBadge, { backgroundColor: SEV_COLORS[severity] + "22", borderColor: SEV_COLORS[severity] + "55" }]}>
          <Ionicons name="notifications-outline" size={11} color={SEV_COLORS[severity]} />
          <Text style={[styles.matchCountText, { color: SEV_COLORS[severity] }]}>
            {matchCount} {matchCount === 1 ? "hit" : "hits"}
          </Text>
        </View>
      )}
      <TouchableOpacity
        onPress={handleDelete}
        style={styles.deleteBtn}
        accessibilityLabel={`Delete keyword ${keyword}`}
        accessibilityRole="button"
      >
        <Ionicons name="trash-outline" size={18} color={colors.danger} />
      </TouchableOpacity>
    </View>
  );
});

interface CategorySectionProps {
  category: (typeof PREDEFINED_CATEGORIES)[0];
  existingKeywords: string[];
  onAdd: (keyword: string) => void;
}

const CategorySection = React.memo(function CategorySection({
  category,
  existingKeywords,
  onAdd,
}: CategorySectionProps) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.catSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity
        style={styles.catHeader}
        onPress={() => {
          Haptics.selectionAsync();
          setExpanded((v) => !v);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${category.label} category, ${expanded ? "collapse" : "expand"}`}
        accessibilityState={{ expanded }}
      >
        <Ionicons name={category.icon} size={18} color={colors.primary} />
        <Text style={[styles.catLabel, { color: colors.text }]}>{category.label}</Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.secondaryText}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.catKeywords}>
          {category.keywords.map((kw) => {
            const already = existingKeywords.includes(kw.toLowerCase());
            return (
              <TouchableOpacity
                key={kw}
                style={[
                  styles.suggestChip,
                  {
                    backgroundColor: already ? colors.primary + "22" : colors.background,
                    borderColor: already ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => !already && onAdd(kw)}
                disabled={already}
                accessibilityRole="button"
                accessibilityLabel={already ? `${kw} already added` : `Add keyword ${kw}`}
              >
                <Text style={[styles.suggestText, { color: already ? colors.primary : colors.text }]}>
                  {kw}
                </Text>
                {already ? (
                  <Ionicons name="checkmark" size={12} color={colors.primary} />
                ) : (
                  <Ionicons name="add" size={12} color={colors.secondaryText} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
});

interface RecentMatchRowProps {
  item: KeywordMatchNotification;
  onPress: () => void;
}

const RecentMatchRow = React.memo(function RecentMatchRow({ item, onPress }: RecentMatchRowProps) {
  const colors = useColors();
  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(item.createdAt), { addSuffix: true });
    } catch {
      return "";
    }
  })();

  const keywordFromBody = item.keyword ?? (() => {
    const match = item.body?.match(/'([^']+)'/);
    return match ? match[1] : null;
  })();

  return (
    <TouchableOpacity
      style={[styles.matchRow, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityLabel={`Keyword match: ${item.title}`}
      accessibilityRole="button"
    >
      <View style={[styles.matchIconWrap, { backgroundColor: "#FF980022" }]}>
        <Ionicons name="search" size={16} color="#FF9800" />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.matchTitleRow}>
          {keywordFromBody && (
            <View style={[styles.matchKeywordChip, { backgroundColor: "#FF980018", borderColor: "#FF980044" }]}>
              <Text style={[styles.matchKeywordText, { color: "#FF9800" }]}>{keywordFromBody}</Text>
            </View>
          )}
          {item.contactName && (
            <Text style={[styles.matchContact, { color: colors.text }]} numberOfLines={1}>
              in chat with {item.contactName}
            </Text>
          )}
        </View>
        <Text style={[styles.matchPreview, { color: colors.secondaryText }]} numberOfLines={2}>
          {item.body}
        </Text>
      </View>
      <View style={styles.matchMeta}>
        <Text style={[styles.matchTime, { color: colors.muted }]}>{timeAgo}</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.muted} />
      </View>
    </TouchableOpacity>
  );
});

export default function KeywordAlertsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: keywords = [], isLoading, refetch, isRefetching } = useKeywordAlerts();
  const { data: recentMatches = [], isLoading: matchesLoading } = useKeywordMatches();
  const addKeyword = useAddKeyword();
  const deleteKeyword = useDeleteKeyword();
  const [newWord, setNewWord] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const existingKeywords = keywords.map((k) => k.keyword.toLowerCase());

  const matchCountByKeyword: Record<string, number> = {};
  recentMatches.forEach((m) => {
    const kw = m.keyword ?? (() => {
      const match = m.body?.match(/'([^']+)'/);
      return match ? match[1] : null;
    })();
    if (kw) {
      matchCountByKeyword[kw.toLowerCase()] = (matchCountByKeyword[kw.toLowerCase()] ?? 0) + 1;
    }
  });

  const handleAdd = useCallback(async (word?: string) => {
    const kw = (word ?? newWord).trim();
    if (!kw) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await addKeyword.mutateAsync({ keyword: kw, severity });
      if (!word) setNewWord("");
    } catch {
      Alert.alert("Error", "Could not add keyword. Please try again.");
    }
  }, [newWord, severity, addKeyword]);

  const handleDelete = useCallback((id: number) => {
    deleteKeyword.mutate(id);
  }, [deleteKeyword]);

  const handleInfoPress = useCallback(() => {
    Alert.alert(
      "Keyword Alerts",
      "Keyword Alerts notify you when specific words or phrases appear in monitored conversations. Set severity levels to prioritize alerts.\n\nLow: Informational\nMedium: Attention needed\nHigh: Immediate action required",
      [{ text: "Got it", style: "default" }]
    );
  }, []);

  const handleMatchPress = useCallback((item: KeywordMatchNotification) => {
    if (item.contactId) {
      router.push(`/chat/${item.contactId}` as any);
    } else {
      router.push("/(tabs)/notifications" as any);
    }
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: topPad + spacing.sm }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={colors.headerText} />
        </TouchableOpacity>
        <Text style={[typography.h3, { color: colors.headerText, flex: 1, textAlign: "center" }]}>
          Keyword Alerts
        </Text>
        <TouchableOpacity
          onPress={handleInfoPress}
          style={styles.backBtn}
          accessibilityLabel="About keyword alerts"
          accessibilityRole="button"
        >
          <Ionicons name="information-circle-outline" size={22} color={colors.headerText} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 140 : 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      >
        {isLoading ? (
          <View style={{ padding: spacing.base, gap: spacing.base }}>
            <SkeletonLoader width="100%" height={60} borderRadius={12} />
            <SkeletonLoader width="100%" height={60} borderRadius={12} />
            <SkeletonLoader width="100%" height={60} borderRadius={12} />
          </View>
        ) : keywords.length === 0 ? (
          <EmptyState
            icon="shield-outline"
            title="No keyword alerts"
            subtitle="Add keywords below to receive alerts when they appear in monitored conversations"
          />
        ) : (
          <View style={{ padding: spacing.base, gap: spacing.sm }}>
            <Text style={[typography.labelBold, { color: colors.text, marginBottom: spacing.sm }]}>
              Active Keywords ({keywords.length})
            </Text>
            {keywords.map((kw) => (
              <KeywordRow
                key={kw.id}
                id={kw.id}
                keyword={kw.keyword}
                severity={kw.severity}
                matchCount={matchCountByKeyword[kw.keyword.toLowerCase()]}
                onDelete={handleDelete}
              />
            ))}
          </View>
        )}

        <View style={{ padding: spacing.base, gap: spacing.sm }}>
          <Text style={[typography.labelBold, { color: colors.text, marginBottom: spacing.sm }]}>
            Predefined Categories
          </Text>
          {PREDEFINED_CATEGORIES.map((cat) => (
            <CategorySection
              key={cat.id}
              category={cat}
              existingKeywords={existingKeywords}
              onAdd={(kw) => handleAdd(kw)}
            />
          ))}
        </View>

        <View style={{ padding: spacing.base, paddingTop: 0, gap: spacing.sm }}>
          <Text style={[typography.labelBold, { color: colors.text, marginBottom: spacing.sm }]}>
            Recent Matches
          </Text>
          {matchesLoading ? (
            <View style={{ gap: spacing.sm }}>
              <SkeletonLoader width="100%" height={68} borderRadius={12} />
              <SkeletonLoader width="100%" height={68} borderRadius={12} />
            </View>
          ) : recentMatches.length === 0 ? (
            <View style={[styles.noMatchesBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="checkmark-circle-outline" size={28} color={colors.muted} />
              <Text style={[styles.noMatchesText, { color: colors.secondaryText }]}>
                No keyword matches yet
              </Text>
              <Text style={[typography.caption, { color: colors.muted, textAlign: "center" }]}>
                Matches will appear here when keywords are detected in monitored conversations
              </Text>
            </View>
          ) : (
            <>
              {recentMatches.slice(0, 8).map((item) => (
                <RecentMatchRow
                  key={item.id}
                  item={item}
                  onPress={() => handleMatchPress(item)}
                />
              ))}
              {recentMatches.length > 8 && (
                <TouchableOpacity
                  style={[styles.viewAllBtn, { borderColor: colors.primary }]}
                  onPress={() => router.push("/(tabs)/notifications" as any)}
                  accessibilityRole="button"
                  accessibilityLabel="View all keyword matches"
                >
                  <Text style={[styles.viewAllText, { color: colors.primary }]}>
                    View all {recentMatches.length} matches in Notifications
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <View
        style={[
          styles.addSection,
          { backgroundColor: colors.card, borderTopColor: colors.border },
        ]}
      >
        <View style={[styles.inputRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Type a keyword to watch..."
            placeholderTextColor={colors.muted}
            value={newWord}
            onChangeText={setNewWord}
            returnKeyType="done"
            onSubmitEditing={() => handleAdd()}
            accessibilityLabel="New keyword input"
          />
        </View>
        <View style={styles.sevRow}>
          {SEVERITIES.map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.sevChip,
                { backgroundColor: severity === s ? SEV_COLORS[s] : "transparent", borderColor: SEV_COLORS[s] },
              ]}
              onPress={async () => {
                await Haptics.selectionAsync();
                setSeverity(s);
              }}
              accessibilityRole="radio"
              accessibilityLabel={`${s} severity`}
              accessibilityState={{ checked: severity === s }}
            >
              <Text style={{ color: severity === s ? colors.headerText : SEV_COLORS[s], fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
                {s.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary, opacity: addKeyword.isPending ? 0.65 : 1 }]}
          onPress={() => handleAdd()}
          disabled={addKeyword.isPending || !newWord.trim()}
          accessibilityLabel="Add keyword alert"
          accessibilityRole="button"
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.headerText} />
          <Text style={[typography.bodyMedium, { color: colors.headerText }]}>
            {addKeyword.isPending ? "Adding..." : "Add Alert"}
          </Text>
        </TouchableOpacity>
      </View>
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
  kwRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingRight: spacing.sm,
    gap: spacing.sm,
  },
  kwBadgeWrap: { flex: 1 },
  matchCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  matchCountText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  deleteBtn: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  catSection: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  catHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.base,
  },
  catLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  catKeywords: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    padding: spacing.base,
    paddingTop: 0,
  },
  suggestChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  suggestText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  matchRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 64,
  },
  matchIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  matchTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  matchKeywordChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  matchKeywordText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  matchContact: { fontSize: 12, fontFamily: "Inter_500Medium" },
  matchPreview: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  matchMeta: { alignItems: "flex-end", gap: 4, flexShrink: 0 },
  matchTime: { fontSize: 10, fontFamily: "Inter_400Regular" },
  noMatchesBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  noMatchesText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  viewAllText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  addSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing.base,
    gap: spacing.sm,
  },
  inputRow: { borderRadius: 10, borderWidth: 1 },
  input: {
    padding: spacing.md,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    minHeight: 44,
  },
  sevRow: { flexDirection: "row", gap: spacing.sm },
  sevChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 10,
    minHeight: 44,
  },
});
