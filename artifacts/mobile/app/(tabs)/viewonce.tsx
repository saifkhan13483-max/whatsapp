import React, { useState, useCallback } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
  RefreshControl,
  Modal,
  Dimensions,
  Alert,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";

import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";
import { GradientHeader } from "@/components/ui/GradientHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { ChipFilter } from "@/components/ui/ChipFilter";
import { AvatarCircle } from "@/components/ui/AvatarCircle";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";
import { formatTimeLabel } from "@/lib/formatters";

const { width: SCREEN_W } = Dimensions.get("window");
const CELL_SIZE = (SCREEN_W - spacing.base * 2 - spacing.sm * 2) / 3;

interface ViewOnceItem {
  id: number;
  contactName: string;
  type: "image" | "video" | "voice";
  recoveredAt: string;
  fileSize?: string;
  isNew?: boolean;
  thumbnailUrl?: string;
}

const FILTER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Photos", value: "image" },
  { label: "Videos", value: "video" },
  { label: "Voice", value: "voice" },
];

export default function ViewOnceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const {
    data: items = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<ViewOnceItem[]>({
    queryKey: ["view-once"],
    queryFn: () => apiFetch<ViewOnceItem[]>("/view-once").catch(() => []),
  });

  const filtered = items
    .filter((item) => activeFilter === "all" || item.type === activeFilter)
    .sort((a, b) => {
      const tA = new Date(a.recoveredAt).getTime();
      const tB = new Date(b.recoveredAt).getTime();
      return sortOrder === "newest" ? tB - tA : tA - tB;
    });

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

  const downloadSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert("Sharing not available", "File sharing is not supported on this device.");
      return;
    }
    Alert.alert(
      "Download",
      `Share ${selectedIds.size} item${selectedIds.size > 1 ? "s" : ""}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Share",
          onPress: async () => {
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

  const typeIcon = (type: ViewOnceItem["type"]) => {
    if (type === "image") return "image";
    if (type === "video") return "videocam";
    return "mic";
  };

  const typeColor = (type: ViewOnceItem["type"]) => {
    if (type === "image") return colors.blue;
    if (type === "video") return colors.purple;
    return colors.primary;
  };

  const renderCell = useCallback(
    ({ item, index }: { item: ViewOnceItem; index: number }) => {
      const isSelected = selectedIds.has(item.id);
      return (
        <TouchableOpacity
          style={[
            styles.cell,
            {
              backgroundColor: colors.card,
              borderColor: isSelected ? colors.primary : colors.border,
              borderWidth: isSelected ? 2 : StyleSheet.hairlineWidth,
            },
          ]}
          onPress={() => {
            if (selectMode) toggleSelect(item.id);
            else openViewer(index);
          }}
          onLongPress={() => handleLongPress(item.id)}
          activeOpacity={0.8}
          accessibilityLabel={`${item.type} from ${item.contactName}`}
          accessibilityRole="button"
        >
          {/* Type icon as thumbnail placeholder */}
          <View
            style={[
              styles.thumbnail,
              { backgroundColor: typeColor(item.type) + "20" },
            ]}
          >
            <Ionicons name={typeIcon(item.type)} size={32} color={typeColor(item.type)} />
            {item.type === "video" && (
              <View style={styles.playOverlay}>
                <Ionicons name="play" size={18} color="#fff" />
              </View>
            )}
          </View>

          {/* New indicator */}
          {item.isNew && (
            <View style={[styles.newDot, { backgroundColor: colors.purple }]} />
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
              {isSelected && (
                <Ionicons name="checkmark" size={12} color="#fff" />
              )}
            </View>
          )}

          {/* Contact avatar bottom-left */}
          <View style={styles.avatarOverlay}>
            <AvatarCircle name={item.contactName} size={20} />
          </View>

          {/* Timestamp bottom-right */}
          <View style={styles.timeOverlay}>
            <Text style={styles.timeText}>
              {formatTimeLabel(item.recoveredAt)}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [selectMode, selectedIds, colors, toggleSelect, handleLongPress, openViewer]
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <GradientHeader
        title="View Once"
        subtitle={`${items.length} recovered item${items.length !== 1 ? "s" : ""}`}
        rightAction={{
          icon: sortOrder === "newest" ? "time-outline" : "time",
          onPress: () =>
            setSortOrder((s) => (s === "newest" ? "oldest" : "newest")),
        }}
      />

      {/* Filter chips */}
      <ChipFilter
        options={FILTER_OPTIONS}
        selected={activeFilter}
        onSelect={setActiveFilter}
      />

      {/* Info banner */}
      <View
        style={[
          styles.infoBanner,
          {
            backgroundColor: colors.purple + "15",
            borderColor: colors.purple + "40",
          },
        ]}
      >
        <Ionicons name="information-circle" size={16} color={colors.purple} />
        <Text style={[typography.small, { color: colors.purple, flex: 1 }]}>
          View-once media recovered before it disappeared from WhatsApp
        </Text>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 9 }).map((_, i) => (
            <SkeletonLoader
              key={i}
              width={CELL_SIZE}
              height={CELL_SIZE}
              borderRadius={8}
            />
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="eye-off-outline"
          title="No view-once media"
          subtitle="Recovered images, videos, and voice notes will appear here"
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          numColumns={3}
          columnWrapperStyle={{ gap: spacing.sm }}
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
            paddingBottom: Platform.OS === "web" ? 120 : 80,
            gap: spacing.sm,
          }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Select mode bottom bar */}
      {selectMode && (
        <View
          style={[
            styles.selectBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom:
                Platform.OS === "web" ? spacing.base : insets.bottom + spacing.sm,
            },
          ]}
        >
          <TouchableOpacity onPress={cancelSelect} style={styles.selectBarBtn}>
            <Text style={[typography.bodyMedium, { color: colors.danger }]}>
              Cancel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={selectAll} style={styles.selectBarBtn}>
            <Text style={[typography.bodyMedium, { color: colors.primary }]}>
              Select All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={downloadSelected}
            style={[
              styles.downloadBtn,
              {
                backgroundColor:
                  selectedIds.size > 0 ? colors.primary : colors.muted,
              },
            ]}
            disabled={selectedIds.size === 0}
          >
            <Feather name="download" size={18} color="#fff" />
            <Text style={[typography.bodyMedium, { color: "#fff" }]}>
              Share {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Full-screen viewer modal */}
      <Modal
        visible={viewerOpen}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setViewerOpen(false)}
      >
        <View style={[styles.viewerRoot, { backgroundColor: "#000" }]}>
          {/* Viewer header */}
          <View
            style={[
              styles.viewerHeader,
              { paddingTop: Platform.OS === "web" ? 20 : insets.top + 8 },
            ]}
          >
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
                <Text style={[typography.caption, { color: "rgba(255,255,255,0.7)" }]}>
                  {formatTimeLabel(filtered[viewerIndex].recoveredAt)}
                </Text>
              </View>
            )}
            <TouchableOpacity
              onPress={async () => {
                const canShare = await Sharing.isAvailableAsync();
                if (canShare) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              style={styles.viewerBtn}
              accessibilityLabel="Share media"
            >
              <Ionicons name="download-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Media placeholder */}
          <View style={styles.viewerMedia}>
            {filtered[viewerIndex] && (
              <>
                <Ionicons
                  name={typeIcon(filtered[viewerIndex].type)}
                  size={80}
                  color="rgba(255,255,255,0.3)"
                />
                <Text
                  style={[
                    typography.caption,
                    { color: "rgba(255,255,255,0.5)", marginTop: spacing.md },
                  ]}
                >
                  {filtered[viewerIndex].type === "image"
                    ? "Photo"
                    : filtered[viewerIndex].type === "video"
                    ? "Video"
                    : "Voice Note"}{" "}
                  preview
                </Text>
              </>
            )}
          </View>

          {/* Prev/next navigation */}
          <View style={styles.viewerNav}>
            <TouchableOpacity
              style={[styles.navBtn, { opacity: viewerIndex < filtered.length - 1 ? 1 : 0.3 }]}
              onPress={() =>
                setViewerIndex((i) => Math.min(i + 1, filtered.length - 1))
              }
              disabled={viewerIndex >= filtered.length - 1}
            >
              <Ionicons name="chevron-back" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={[typography.caption, { color: "rgba(255,255,255,0.6)" }]}>
              {viewerIndex + 1} / {filtered.length}
            </Text>
            <TouchableOpacity
              style={[styles.navBtn, { opacity: viewerIndex > 0 ? 1 : 0.3 }]}
              onPress={() => setViewerIndex((i) => Math.max(i - 1, 0))}
              disabled={viewerIndex <= 0}
            >
              <Ionicons name="chevron-forward" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
  },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    padding: spacing.base,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 8,
    overflow: "hidden",
  },
  thumbnail: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  playOverlay: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 20,
    padding: 6,
  },
  newDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  checkbox: {
    position: "absolute",
    top: 6,
    left: 6,
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
    backgroundColor: "rgba(0,0,0,0.5)",
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  downloadBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: 10,
  },
  viewerRoot: {
    flex: 1,
  },
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
  },
  viewerMedia: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  viewerNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xl,
  },
  navBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
});
