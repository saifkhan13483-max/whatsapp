import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
  RefreshControl,
  Modal,
  Alert,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";

import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { AvatarCircle } from "@/components/ui/AvatarCircle";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";
import { formatTimeLabel } from "@/lib/formatters";

interface ViewOnceItem {
  id: number;
  contactName: string;
  type: "image" | "video" | "voice";
  recoveredAt: string;
  url?: string;
  fileSize?: string;
  isNew?: boolean;
}

const FILTER_OPTIONS = [
  { label: "All", value: "all", icon: "albums" },
  { label: "Photos", value: "image", icon: "image" },
  { label: "Videos", value: "video", icon: "videocam" },
  { label: "Voice", value: "voice", icon: "mic" },
];

function MediaTypeIcon({ type, size = 32, color }: { type: ViewOnceItem["type"]; size?: number; color: string }) {
  const iconName = type === "image" ? "image" : type === "video" ? "videocam" : "mic";
  return <Ionicons name={iconName} size={size} color={color} />;
}

export default function ViewOnceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [activeFilter, setActiveFilter] = useState("all");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const numColumns = width >= 600 ? 4 : 3;
  const gap = spacing.sm;
  const cellSize = (width - spacing.base * 2 - gap * (numColumns - 1)) / numColumns;

  const {
    data: rawItems = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<ViewOnceItem[]>({
    queryKey: ["view-once"],
    queryFn: () => apiFetch<ViewOnceItem[]>("/view-once").catch(() => []),
  });

  const filtered = useMemo(
    () =>
      rawItems
        .filter((item) => activeFilter === "all" || item.type === activeFilter)
        .sort((a, b) => {
          const tA = new Date(a.recoveredAt).getTime();
          const tB = new Date(b.recoveredAt).getTime();
          return sortOrder === "newest" ? tB - tA : tA - tB;
        }),
    [rawItems, activeFilter, sortOrder]
  );

  const counts = useMemo(
    () => ({
      image: rawItems.filter((i) => i.type === "image").length,
      video: rawItems.filter((i) => i.type === "video").length,
      voice: rawItems.filter((i) => i.type === "voice").length,
    }),
    [rawItems]
  );

  const toggleSelect = useCallback((id: number) => {
    Haptics.selectionAsync();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleLongPress = useCallback(
    (id: number) => {
      if (!selectMode) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSelectMode(true);
        setSelectedIds(new Set([id]));
      }
    },
    [selectMode]
  );

  const cancelSelect = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const selectAll = useCallback(() => {
    Haptics.selectionAsync();
    setSelectedIds(new Set(filtered.map((i) => i.id)));
  }, [filtered]);

  const shareSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert("Sharing not available", "File sharing is not supported on this device.");
      return;
    }
    Alert.alert(
      "Share Media",
      `Share ${selectedIds.size} item${selectedIds.size > 1 ? "s" : ""}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Share",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            cancelSelect();
          },
        },
      ]
    );
  }, [selectedIds, cancelSelect]);

  const openViewer = useCallback(
    (index: number) => {
      if (!selectMode) {
        setViewerIndex(index);
        setViewerOpen(true);
      }
    },
    [selectMode]
  );

  const typeColor = (type: ViewOnceItem["type"]) => {
    if (type === "image") return colors.blue;
    if (type === "video") return colors.purple;
    return colors.primary;
  };

  const renderCell = useCallback(
    ({ item, index }: { item: ViewOnceItem; index: number }) => {
      const isSelected = selectedIds.has(item.id);
      const tc = typeColor(item.type);

      return (
        <TouchableOpacity
          style={[
            styles.cell,
            {
              width: cellSize,
              height: cellSize,
              backgroundColor: colors.card,
              borderColor: isSelected ? colors.primary : colors.border,
              borderWidth: isSelected ? 2.5 : StyleSheet.hairlineWidth,
            },
          ]}
          onPress={() => {
            if (selectMode) toggleSelect(item.id);
            else openViewer(index);
          }}
          onLongPress={() => handleLongPress(item.id)}
          activeOpacity={0.8}
          accessibilityLabel={`${item.type} from ${item.contactName}, recovered ${formatTimeLabel(item.recoveredAt)}`}
          accessibilityRole="button"
        >
          {/* Thumbnail area */}
          <View style={[styles.thumbnail, { backgroundColor: tc + "18" }]}>
            <MediaTypeIcon type={item.type} size={cellSize * 0.32} color={tc} />
            {item.type === "video" && (
              <View style={[styles.playOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
                <Ionicons name="play" size={16} color="#fff" />
              </View>
            )}
          </View>

          {/* New dot */}
          {item.isNew && (
            <View style={[styles.newDot, { backgroundColor: colors.danger }]} />
          )}

          {/* Select checkbox */}
          {selectMode && (
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: isSelected ? colors.primary : "rgba(0,0,0,0.5)",
                  borderColor: isSelected ? colors.primary : "#fff",
                },
              ]}
            >
              {isSelected && <Ionicons name="checkmark" size={11} color="#fff" />}
            </View>
          )}

          {/* Contact avatar */}
          <View style={styles.avatarOverlay}>
            <AvatarCircle name={item.contactName} size={18} />
          </View>

          {/* Time */}
          <View style={styles.timeOverlay}>
            <Text style={styles.timeText}>{formatTimeLabel(item.recoveredAt)}</Text>
          </View>
        </TouchableOpacity>
      );
    },
    [selectMode, selectedIds, colors, cellSize, toggleSelect, handleLongPress, openViewer]
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient
        colors={[colors.primaryDarkest, colors.primaryDark] as [string, string]}
        style={[styles.header, { paddingTop: topPad + spacing.sm }]}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.h3, { color: "#fff" }]}>View Once Media</Text>
            <Text style={[typography.small, { color: "rgba(255,255,255,0.7)" }]}>
              {rawItems.length} recovered item{rawItems.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setSortOrder((s) => (s === "newest" ? "oldest" : "newest"))}
            accessibilityLabel={`Sort by ${sortOrder === "newest" ? "oldest" : "newest"}`}
            accessibilityRole="button"
          >
            <Ionicons
              name={sortOrder === "newest" ? "arrow-down" : "arrow-up"}
              size={20}
              color="#fff"
            />
          </TouchableOpacity>
        </View>

        {/* Stats pills */}
        <View style={styles.statsRow}>
          {[
            { type: "image", label: "Photos", count: counts.image, color: colors.blue },
            { type: "video", label: "Videos", count: counts.video, color: colors.purple },
            { type: "voice", label: "Voice", count: counts.voice, color: colors.primary },
          ].map((s) => (
            <View key={s.type} style={[styles.statPill, { backgroundColor: s.color + "30" }]}>
              <MediaTypeIcon type={s.type as any} size={14} color={s.color} />
              <Text style={[typography.small, { color: s.color, fontFamily: "Inter_600SemiBold" }]}>
                {s.count} {s.label}
              </Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* Filter chips */}
      <View style={[styles.chipRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {FILTER_OPTIONS.map((f) => {
          const active = activeFilter === f.value;
          return (
            <TouchableOpacity
              key={f.value}
              style={[
                styles.chip,
                { borderColor: active ? colors.primary : "transparent", backgroundColor: active ? colors.primary + "12" : "transparent" },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveFilter(f.value);
              }}
            >
              <Ionicons name={f.icon as any} size={13} color={active ? colors.primary : colors.secondaryText} />
              <Text style={[typography.caption, { color: active ? colors.primary : colors.secondaryText, fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Info banner */}
      <View style={[styles.infoBanner, { backgroundColor: colors.purple + "12", borderColor: colors.purple + "35" }]}>
        <Ionicons name="shield-checkmark" size={15} color={colors.purple} />
        <Text style={[typography.small, { color: colors.purple, flex: 1 }]}>
          View-once media recovered before disappearing from WhatsApp
        </Text>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={[styles.skeletonGrid, { gap }]}>
          {Array.from({ length: numColumns * 3 }).map((_, i) => (
            <SkeletonLoader key={i} width={cellSize} height={cellSize} borderRadius={10} />
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="eye-off-outline"
          title="No media found"
          subtitle={
            activeFilter !== "all"
              ? `No ${activeFilter === "image" ? "photos" : activeFilter === "video" ? "videos" : "voice notes"} recovered yet`
              : "Recovered images, videos, and voice notes will appear here"
          }
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          numColumns={numColumns}
          key={numColumns}
          columnWrapperStyle={{ gap }}
          renderItem={renderCell}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          contentContainerStyle={{
            paddingHorizontal: spacing.base,
            paddingTop: spacing.sm,
            paddingBottom: Platform.OS === "web" ? 120 : selectMode ? 120 : 80,
            gap,
          }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Select mode bar */}
      {selectMode && (
        <View
          style={[
            styles.selectBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: Platform.OS === "web" ? spacing.base : insets.bottom + spacing.sm,
            },
          ]}
        >
          <TouchableOpacity onPress={cancelSelect} style={styles.selectBarBtn}>
            <Text style={[typography.bodyMedium, { color: colors.danger }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[typography.caption, { color: colors.secondaryText, flex: 1, textAlign: "center" }]}>
            {selectedIds.size} selected
          </Text>
          <TouchableOpacity onPress={selectAll} style={styles.selectBarBtn}>
            <Text style={[typography.bodyMedium, { color: colors.primary }]}>Select All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={shareSelected}
            style={[
              styles.shareBtn,
              { backgroundColor: selectedIds.size > 0 ? colors.primary : colors.muted },
            ]}
            disabled={selectedIds.size === 0}
          >
            <Feather name="share-2" size={17} color="#fff" />
            <Text style={[typography.bodyMedium, { color: "#fff" }]}>
              Share{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Full-screen viewer */}
      <Modal
        visible={viewerOpen}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setViewerOpen(false)}
      >
        <View style={[styles.viewerRoot, { backgroundColor: "#000" }]}>
          {/* Header */}
          <View style={[styles.viewerHeader, { paddingTop: Platform.OS === "web" ? 20 : insets.top + 8 }]}>
            <TouchableOpacity
              onPress={() => setViewerOpen(false)}
              style={styles.viewerBtn}
              accessibilityLabel="Close viewer"
            >
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            {filtered[viewerIndex] && (
              <View style={{ flex: 1, paddingHorizontal: spacing.md }}>
                <Text style={[typography.bodyMedium, { color: "#fff" }]}>
                  {filtered[viewerIndex].contactName}
                </Text>
                <Text style={[typography.caption, { color: "rgba(255,255,255,0.65)" }]}>
                  {formatTimeLabel(filtered[viewerIndex].recoveredAt)} ·{" "}
                  {filtered[viewerIndex].type === "image"
                    ? "Photo"
                    : filtered[viewerIndex].type === "video"
                    ? "Video"
                    : "Voice Note"}
                </Text>
              </View>
            )}
            <TouchableOpacity
              onPress={async () => {
                const canShare = await Sharing.isAvailableAsync();
                if (canShare) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                else Alert.alert("Sharing not available");
              }}
              style={styles.viewerBtn}
              accessibilityLabel="Share media"
            >
              <Feather name="share-2" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Media placeholder */}
          <View style={styles.viewerMedia}>
            {filtered[viewerIndex] && (
              <View style={{ alignItems: "center", gap: spacing.base }}>
                <View
                  style={[
                    styles.mediaPreviewBox,
                    { backgroundColor: typeColor(filtered[viewerIndex].type) + "25", borderColor: typeColor(filtered[viewerIndex].type) + "50" },
                  ]}
                >
                  <MediaTypeIcon
                    type={filtered[viewerIndex].type}
                    size={64}
                    color={typeColor(filtered[viewerIndex].type)}
                  />
                </View>
                <Text style={[typography.body, { color: "rgba(255,255,255,0.85)", textAlign: "center" }]}>
                  {filtered[viewerIndex].type === "image"
                    ? "Photo"
                    : filtered[viewerIndex].type === "video"
                    ? "Video"
                    : "Voice Note"}
                </Text>
                <Text style={[typography.caption, { color: "rgba(255,255,255,0.5)", textAlign: "center" }]}>
                  Recovered from {filtered[viewerIndex].contactName}
                </Text>
              </View>
            )}
          </View>

          {/* Navigation */}
          <View style={styles.viewerNav}>
            <TouchableOpacity
              style={[styles.navBtn, { opacity: viewerIndex > 0 ? 1 : 0.3 }]}
              onPress={() => setViewerIndex((i) => Math.max(i - 1, 0))}
              disabled={viewerIndex <= 0}
            >
              <Ionicons name="chevron-back" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={[typography.caption, { color: "rgba(255,255,255,0.6)" }]}>
              {viewerIndex + 1} / {filtered.length}
            </Text>
            <TouchableOpacity
              style={[styles.navBtn, { opacity: viewerIndex < filtered.length - 1 ? 1 : 0.3 }]}
              onPress={() => setViewerIndex((i) => Math.min(i + 1, filtered.length - 1))}
              disabled={viewerIndex >= filtered.length - 1}
            >
              <Ionicons name="chevron-forward" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Bottom padding for home indicator */}
          <View style={{ height: Platform.OS === "web" ? 20 : insets.bottom }} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: 20,
  },
  chipRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    padding: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
  },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: spacing.base,
  },
  cell: {
    borderRadius: 10,
    overflow: "hidden",
  },
  thumbnail: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  playOverlay: {
    position: "absolute",
    borderRadius: 20,
    padding: 7,
  },
  newDot: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  checkbox: {
    position: "absolute",
    top: 5,
    left: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarOverlay: {
    position: "absolute",
    bottom: 4,
    left: 4,
  },
  timeOverlay: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  timeText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Inter_400Regular",
  },
  selectBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  selectBarBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  shareBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: 10,
  },
  viewerRoot: { flex: 1 },
  viewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  viewerBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  viewerMedia: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaPreviewBox: {
    width: 160,
    height: 160,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  viewerNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  navBtn: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
});
