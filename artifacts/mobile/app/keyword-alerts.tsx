import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
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
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useKeywordAlerts, useAddKeyword, useDeleteKeyword } from "@/hooks/useKeywordAlerts";
import { KeywordBadge } from "@/components/ui/KeywordBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";
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

interface KeywordRowProps {
  id: number;
  keyword: string;
  severity: Severity;
  onDelete: (id: number) => void;
}

const KeywordRow = React.memo(function KeywordRow({ id, keyword, severity, onDelete }: KeywordRowProps) {
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
      <View style={{ flex: 1 }}>
        <KeywordBadge keyword={keyword} severity={severity} />
      </View>
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
  category: typeof PREDEFINED_CATEGORIES[0];
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

export default function KeywordAlertsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: keywords = [], isLoading, refetch, isRefetching } = useKeywordAlerts();
  const addKeyword = useAddKeyword();
  const deleteKeyword = useDeleteKeyword();
  const [newWord, setNewWord] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const existingKeywords = keywords.map((k) => k.keyword.toLowerCase());

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
  },
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
