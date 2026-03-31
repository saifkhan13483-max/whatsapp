import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/constants/colors";
import { setItem, StorageKeys } from "@/lib/storage";
import * as Haptics from "expo-haptics";

const { width } = Dimensions.get("window");

const slides = [
  {
    icon: "eye" as const,
    color: "#25D366",
    title: "Track WhatsApp Activity",
    description:
      "Monitor when your contacts come online and offline in real time, with detailed session history and statistics.",
  },
  {
    icon: "shield-checkmark" as const,
    color: "#34B7F1",
    title: "Parental Controls",
    description:
      "Keep your family safe. Set keyword alerts, monitor chat activity, and get instant notifications for suspicious content.",
  },
  {
    icon: "image" as const,
    color: "#7C4DFF",
    title: "View Once Recovery",
    description:
      "Recover view-once photos and videos that disappear after viewing. Never miss important media again.",
  },
  {
    icon: "notifications" as const,
    color: "#FFC107",
    title: "Smart Alerts",
    description:
      "Get notified when contacts come online at unusual hours, exceed time limits, or trigger keyword alerts.",
  },
];

export default function OnboardingScreen() {
  const colors = useColors();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [current, setCurrent] = useState(0);

  function goNext() {
    Haptics.selectionAsync();
    if (current < slides.length - 1) {
      const next = current + 1;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setCurrent(next);
    } else {
      finish();
    }
  }

  function skip() {
    finish();
  }

  async function finish() {
    await setItem(StorageKeys.ONBOARDING_DONE, true);
    router.replace("/auth");
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity style={styles.skipBtn} onPress={skip}>
        <Text style={[styles.skipText, { color: colors.secondaryText }]}>Skip</Text>
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={styles.scroll}
      >
        {slides.map((slide, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            <LinearGradient
              colors={[slide.color + "22", "transparent"]}
              style={styles.iconContainer}
            >
              <Ionicons name={slide.icon} size={80} color={slide.color} />
            </LinearGradient>
            <Text style={[styles.title, { color: colors.text }]}>{slide.title}</Text>
            <Text style={[styles.description, { color: colors.secondaryText }]}>
              {slide.description}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i === current ? colors.primary : colors.border,
                  width: i === current ? 20 : 8,
                },
              ]}
            />
          ))}
        </View>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={goNext}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>
            {current === slides.length - 1 ? "Get Started" : "Next"}
          </Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipBtn: {
    position: "absolute",
    top: 56,
    right: 24,
    zIndex: 10,
  },
  skipText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  scroll: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingTop: 80,
    gap: 24,
  },
  iconContainer: {
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
  description: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 24,
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
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
