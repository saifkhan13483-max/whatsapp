import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  RefreshControl,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  Modal,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useContacts, useAddContact, useToggleFavorite } from "@/hooks/useContacts";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/providers/AuthProvider";
import { BadgeCount } from "@/components/ui/BadgeCount";
import { AvatarCircle } from "@/components/ui/AvatarCircle";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { EmptyState } from "@/components/ui/EmptyState";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";
import { formatRelativeTime } from "@/lib/formatters";
import type { Contact } from "@/components/ui/ContactCard";

type FilterKey = "all" | "online" | "offline" | "favorites" | "recent" | "high" | "never";

const FILTERS: { label: string; key: FilterKey }[] = [
  { label: "All", key: "all" },
  { label: "Online", key: "online" },
  { label: "Offline", key: "offline" },
  { label: "Favorites", key: "favorites" },
  { label: "Recent", key: "recent" },
  { label: "High Activity", key: "high" },
  { label: "Never Seen", key: "never" },
];

const QUICK_ACTIONS = [
  { icon: "bar-chart" as const, label: "Reports", route: "/reports" },
  { icon: "shield-checkmark" as const, label: "Keywords", route: "/keyword-alerts" },
  { icon: "people" as const, label: "Groups", route: "/contact-groups" },
  { icon: "git-compare" as const, label: "Compare", route: "/compare" },
  { icon: "time" as const, label: "Timeline", route: "/activity-timeline" },
  { icon: "diamond" as const, label: "Upgrade", route: "/subscription" },
];

const Sparkline = React.memo(function Sparkline({ values }: { values: number[] }) {
  const colors = useColors();
  if (!values || values.length < 2) return <View style={{ width: 48 }} />;
  const max = Math.max(...values, 1);
  const barW = 4;
  const gap = 2;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: 24, gap }}>
      {values.slice(-8).map((v, i) => (
        <View
          key={i}
          style={{
            width: barW,
            height: Math.max(3, (v / max) * 24),
            borderRadius: 2,
            backgroundColor: colors.primary + (i === values.slice(-8).length - 1 ? "ff" : "55"),
          }}
        />
      ))}
    </View>
  );
});

const EnhancedContactCard = React.memo(function EnhancedContactCard({
  contact,
  isFavorite,
  onPress,
  onFavorite,
}: {
  contact: Contact & { sessionCount?: number; sparkline?: number[] };
  isFavorite: boolean;
  onPress: () => void;
  onFavorite: () => void;
}) {
  const colors = useColors();

  return (
    <TouchableOpacity
      style={[styles.contactCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`Contact ${contact.name}, ${contact.isOnline ? "online" : "offline"}`}
      accessibilityRole="button"
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(contact.name, undefined, [
          { text: isFavorite ? "Unfavorite" : "Add to Favorites", onPress: onFavorite },
          { text: "View Details", onPress },
          { text: "Cancel", style: "cancel" },
        ]);
      }}
    >
      <View style={styles.contactLeft}>
        <AvatarCircle name={contact.name} isOnline={contact.isOnline} size={44} />
      </View>
      <View style={styles.contactInfo}>
        <Text style={[typography.bodyMedium, { color: colors.text }]} numberOfLines={1}>
          {contact.name}
        </Text>
        <Text style={[typography.caption, { color: colors.secondaryText }]} numberOfLines={1}>
          {contact.isOnline
            ? "Online now"
            : contact.lastSeen
            ? `Last seen ${formatRelativeTime(contact.lastSeen)}`
            : contact.phoneNumber}
        </Text>
      </View>
      <View style={styles.contactRight}>
        <Sparkline values={contact.sparkline ?? [0, 1, 2, 1, 3, 2, 1, 2]} />
        <TouchableOpacity
          onPress={onFavorite}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ marginTop: 4 }}
          accessibilityLabel={isFavorite ? `Remove ${contact.name} from favorites` : `Add ${contact.name} to favorites`}
          accessibilityRole="button"
        >
          <Ionicons
            name={isFavorite ? "star" : "star-outline"}
            size={14}
            color={isFavorite ? colors.warning : colors.muted}
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

function AddContactSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const addContact = useAddContact();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const slideY = useSharedValue(400);

  React.useEffect(() => {
    if (visible) {
      slideY.value = withSpring(0, { damping: 18, stiffness: 200 });
    } else {
      slideY.value = withTiming(400, { duration: 200 });
    }
  }, [visible]);

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
  }));

  async function handleAdd() {
    if (!name.trim() || !phone.trim()) return;
    try {
      await addContact.mutateAsync({ name: name.trim(), phoneNumber: phone.trim() });
      setName("");
      setPhone("");
      onClose();
    } catch {
      Alert.alert("Error", "Could not add contact");
    }
  }

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.card,
            paddingBottom: insets.bottom + spacing.base,
          },
          slideStyle,
        ]}
      >
        <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
        <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.xl }]}>Add Contact</Text>

        <Text style={[styles.fieldLabel, { color: colors.secondaryText }]}>Name</Text>
        <TextInput
          style={[styles.sheetInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
          placeholder="Contact name"
          placeholderTextColor={colors.muted}
          value={name}
          onChangeText={setName}
          accessibilityLabel="Contact name input"
        />

        <Text style={[styles.fieldLabel, { color: colors.secondaryText }]}>Phone Number</Text>
        <TextInput
          style={[styles.sheetInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
          placeholder="+1 234 567 8900"
          placeholderTextColor={colors.muted}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          accessibilityLabel="Phone number input"
        />

        <TouchableOpacity
          style={[styles.sheetBtn, { backgroundColor: colors.primary }]}
          onPress={handleAdd}
          disabled={addContact.isPending}
          accessibilityLabel="Start tracking this contact"
          accessibilityRole="button"
        >
          <Ionicons name="person-add" size={18} color={colors.headerText} />
          <Text style={[styles.sheetBtnText, { color: colors.headerText }]}>Start Tracking</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { user } = useAuth();

  const { data: contacts = [], isLoading, refetch } = useContacts();
  const { data: notifications = [] } = useNotifications();
  const toggleFavorite = useToggleFavorite();

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  const searchProgress = useSharedValue(0);

  const onlineContacts = contacts.filter((c) => (c as any).isOnline);
  const unreadCount = notifications.filter((n) => !n.read).length;

  function toggleSearch() {
    const next = !searchVisible;
    if (next) {
      setSearchVisible(true);
      searchProgress.value = 0;
      searchProgress.value = withTiming(1, { duration: 250 });
    } else {
      setSearchQuery("");
      setSearchVisible(false);
      searchProgress.value = 0;
    }
  }

  const searchAnimStyle = useAnimatedStyle(() => ({
    width: `${searchProgress.value * 100}%` as any,
  }));

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  function handleFavorite(id: number) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    toggleFavorite.mutate(id);
  }

  const filteredContacts = contacts.filter((c) => {
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filter === "online") return (c as any).isOnline;
    if (filter === "offline") return !(c as any).isOnline;
    if (filter === "favorites") return favorites.has(c.id);
    if (filter === "recent") return !!(c as any).lastSeen;
    if (filter === "high") return ((c as any).sessionCount ?? 0) >= 5;
    if (filter === "never") return !(c as any).lastSeen && !(c as any).isOnline;
    return true;
  });

  const renderContact = useCallback(
    ({ item }: { item: Contact }) => (
      <EnhancedContactCard
        contact={item as any}
        isFavorite={favorites.has(item.id)}
        onPress={() => router.push(`/contact/${item.id}`)}
        onFavorite={() => handleFavorite(item.id)}
      />
    ),
    [favorites]
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient
        colors={[colors.primaryDarkest, colors.primaryDark] as string[]}
        style={[styles.header, { paddingTop: topPad + spacing.sm }]}
      >
        <View style={styles.headerRow}>
          {searchVisible ? (
            <Animated.View style={[styles.searchExpanded, searchAnimStyle]}>
              <Ionicons name="search" size={18} color={colors.headerText + "B3"} />
              <TextInput
                autoFocus
                style={[styles.searchInput, { color: colors.headerText }]}
                placeholder="Search contacts..."
                placeholderTextColor={colors.headerText + "80"}
                value={searchQuery}
                onChangeText={setSearchQuery}
                accessibilityLabel="Search contacts"
              />
              <TouchableOpacity
                onPress={toggleSearch}
                accessibilityLabel="Close search"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={18} color={colors.headerText + "B3"} />
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <>
              <View>
                <Text style={[typography.caption, { color: colors.headerText + "BF" }]}>
                  Welcome back
                </Text>
                <Text style={[typography.h3, { color: colors.headerText }]}>
                  {user?.username ?? "WaTracker"}
                </Text>
              </View>
              <View style={styles.headerIcons}>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={toggleSearch}
                  accessibilityLabel="Search contacts"
                  accessibilityRole="button"
                >
                  <Ionicons name="search-outline" size={22} color={colors.headerText} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconBtn, { position: "relative" }]}
                  onPress={() => router.push("/(tabs)/notifications")}
                  accessibilityLabel={`Notifications, ${unreadCount} unread`}
                  accessibilityRole="button"
                >
                  <Ionicons name="notifications-outline" size={22} color={colors.headerText} />
                  {unreadCount > 0 && (
                    <View style={[styles.notifBadge, { backgroundColor: colors.danger }]}>
                      <BadgeCount count={unreadCount} />
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => router.push("/family-dashboard")}
                  accessibilityLabel="Family dashboard"
                  accessibilityRole="button"
                >
                  <Ionicons name="people-outline" size={22} color={colors.headerText} />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.miniStat}>
            <Text style={[typography.h2, { color: colors.headerText }]}>{contacts.length}</Text>
            <Text style={[typography.small, { color: colors.headerText + "BF" }]}>Tracked</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.miniStat}>
            <Text style={[typography.h2, { color: colors.headerText }]}>{onlineContacts.length}</Text>
            <Text style={[typography.small, { color: colors.headerText + "BF" }]}>Online Now</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.miniStat}>
            <Text style={[typography.h2, { color: colors.headerText }]}>{unreadCount}</Text>
            <Text style={[typography.small, { color: colors.headerText + "BF" }]}>Alerts</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.chipRow, { backgroundColor: colors.surface }]}
        contentContainerStyle={{ paddingHorizontal: spacing.base, gap: spacing.sm, paddingVertical: spacing.sm }}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.chip,
              {
                backgroundColor: filter === f.key ? colors.primary : colors.card,
                borderColor: filter === f.key ? colors.primary : colors.border,
              },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setFilter(f.key);
            }}
            accessibilityLabel={`Filter by ${f.label}`}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f.key }}
          >
            <Text
              style={[
                typography.caption,
                { color: filter === f.key ? colors.headerText : colors.secondaryText },
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.quickActionsRow, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingHorizontal: spacing.base, gap: spacing.sm, paddingVertical: spacing.sm }}
      >
        {QUICK_ACTIONS.map((a) => (
          <TouchableOpacity
            key={a.label}
            style={[styles.quickPill, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(a.route as any)}
            accessibilityLabel={a.label}
            accessibilityRole="button"
          >
            <Ionicons name={a.icon} size={15} color={colors.primary} />
            <Text style={[typography.caption, { color: colors.text }]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderContact}
        contentContainerStyle={{
          paddingHorizontal: spacing.base,
          paddingTop: spacing.sm,
          paddingBottom: Platform.OS === "web" ? 120 : 100,
          gap: spacing.sm,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: spacing.sm }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonLoader key={i} width="100%" height={68} borderRadius={12} />
              ))}
            </View>
          ) : (
            <EmptyState
              icon="person-add-outline"
              title="No contacts tracked"
              subtitle="Tap the + button to add your first contact to monitor"
            />
          )
        }
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, bottom: (Platform.OS === "web" ? 80 : insets.bottom + 80), shadowColor: colors.shadow }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setAddSheetVisible(true);
        }}
        activeOpacity={0.85}
        accessibilityLabel="Add new contact"
        accessibilityRole="button"
      >
        <Ionicons name="add" size={28} color={colors.headerText} />
      </TouchableOpacity>

      <AddContactSheet visible={addSheetVisible} onClose={() => setAddSheetVisible(false)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    paddingBottom: spacing.base,
  },
  headerIcons: { flexDirection: "row", gap: 4 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  notifBadge: { position: "absolute", top: 4, right: 4, borderRadius: 8 },
  searchExpanded: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingHorizontal: spacing.base,
    paddingVertical: 8,
    overflow: "hidden",
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    paddingVertical: 2,
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    padding: spacing.base,
  },
  miniStat: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.3)" },
  chipRow: { flexGrow: 0 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickActionsRow: { flexGrow: 0 },
  quickPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.base,
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.md,
  },
  contactLeft: {},
  contactInfo: { flex: 1, gap: 2 },
  contactRight: { alignItems: "center", gap: 2 },
  fab: {
    position: "absolute",
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: spacing.xl,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  sheetInput: {
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginBottom: spacing.sm,
  },
  sheetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.base,
    borderRadius: 10,
    marginTop: spacing.sm,
  },
  sheetBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
