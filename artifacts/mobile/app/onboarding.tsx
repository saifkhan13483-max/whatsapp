import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { setItem, StorageKeys } from "@/lib/storage";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";

const { width } = Dimensions.get("window");

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const flatRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const SLIDES = [
    {
      icon: "shield-checkmark" as const,
      color: colors.primary,
      title: "Track Any Contact",
      description: "Monitor WhatsApp activity in real-time with zero setup. See when your contacts come online and offline.",
    },
    {
      icon: "notifications" as const,
      color: colors.blue,
      title: "Smart Alerts",
      description: "Get instant notifications for late-night activity, long sessions, and keywords you care about.",
    },
    {
      icon: "bar-chart" as const,
      color: colors.evening,
      title: "Detailed Reports",
      description: "Visual charts, heatmaps, and exportable CSV reports to understand activity patterns at a glance.",
    },
    {
      icon: "people" as const,
      color: colors.purple,
      title: "Family Dashboard",
      description: "Monitor your entire family from one unified view. Keep your loved ones safe online.",
    },
    {
      icon: "lock-closed" as const,
      color: colors.danger,
      title: "Privacy First",
      description: "Biometric lock, encrypted data, and full control over your information. Your privacy is protected.",
    },
  ];

  function goNext() {
    Haptics.selectionAsync();
    if (currentIndex < SLIDES.length - 1) {
      const next = currentIndex + 1;
      flatRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentIndex(next);
    } else {
      finish();
    }
  }

  async function finish() {
    await setItem(StorageKeys.ONBOARDING_DONE, true);
    router.replace("/(tabs)" as any);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <TouchableOpacity
        style={[styles.skipBtn, { top: insets.top + 16 }]}
        onPress={finish}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel="Skip onboarding"
        accessibilityRole="button"
      >
        <Text style={[typography.bodyMedium, { color: colors.secondaryText }]}>Skip</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <LinearGradient
              colors={[item.color + "22", "transparent"] as string[]}
              style={styles.iconWrap}
            >
              <Ionicons name={item.icon} size={80} color={item.color} />
            </LinearGradient>
            <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.desc, { color: colors.secondaryText }]}>{item.description}</Text>
          </View>
        )}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => {
            const isActive = i === currentIndex;
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: isActive ? colors.primary : colors.border,
                    width: isActive ? 24 : 8,
                  },
                ]}
              />
            );
          })}
        </View>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={goNext}
          activeOpacity={0.85}
          accessibilityLabel={currentIndex === SLIDES.length - 1 ? "Get started" : "Next slide"}
          accessibilityRole="button"
        >
          <Text style={[styles.btnText, { color: colors.headerText }]}>
            {currentIndex === SLIDES.length - 1 ? "Get Started" : "Next"}
          </Text>
          <Ionicons
            name={currentIndex === SLIDES.length - 1 ? "checkmark" : "arrow-forward"}
            size={18}
            color={colors.headerText}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  skipBtn: {
    position: "absolute",
    right: spacing.xl,
    zIndex: 10,
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingTop: 80,
    gap: 24,
  },
  iconWrap: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  desc: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  btnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
