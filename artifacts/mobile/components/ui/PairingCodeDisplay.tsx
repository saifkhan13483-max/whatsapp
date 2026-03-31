import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
} from "react-native-reanimated";
import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";

interface PairingCodeDisplayProps {
  code: string;
  expiresAt: string;
  onRequestNew: () => void;
  isLoadingNew?: boolean;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function PairingCodeDisplay({
  code,
  expiresAt,
  onRequestNew,
  isLoadingNew,
}: PairingCodeDisplayProps) {
  const colors = useColors();
  const [remainingMs, setRemainingMs] = useState(() => new Date(expiresAt).getTime() - Date.now());
  const [copied, setCopied] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const shakeX = useSharedValue(0);
  const copiedOpacity = useSharedValue(0);

  const isExpired = remainingMs <= 0;
  const isUrgent = remainingMs > 0 && remainingMs < 30_000;

  useEffect(() => {
    setRemainingMs(new Date(expiresAt).getTime() - Date.now());
    intervalRef.current = setInterval(() => {
      setRemainingMs(new Date(expiresAt).getTime() - Date.now());
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [expiresAt]);

  useEffect(() => {
    if (isUrgent && !isExpired) {
      shakeX.value = withRepeat(
        withSequence(
          withTiming(-4, { duration: 60 }),
          withTiming(4, { duration: 60 }),
          withTiming(0, { duration: 60 }),
        ),
        -1,
        false,
      );
    } else {
      shakeX.value = withTiming(0, { duration: 100 });
    }
  }, [isUrgent, isExpired]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const copiedStyle = useAnimatedStyle(() => ({
    opacity: copiedOpacity.value,
  }));

  async function handleCopy() {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    copiedOpacity.value = withSequence(
      withTiming(1, { duration: 150 }),
      withTiming(1, { duration: 1200 }),
      withTiming(0, { duration: 300 }),
    );
    setTimeout(() => setCopied(false), 1800);
  }

  const group1 = code.slice(0, 4).split("");
  const group2 = code.slice(4, 8).split("");

  return (
    <View style={styles.container}>
      <View style={styles.codeRow}>
        {group1.map((char, i) => (
          <View
            key={`g1-${i}`}
            style={[
              styles.charCell,
              { backgroundColor: colors.surface, borderColor: colors.primary },
            ]}
          >
            <Text
              style={[
                styles.charText,
                { color: colors.primary },
              ]}
            >
              {char}
            </Text>
          </View>
        ))}

        <Text style={[styles.dash, { color: colors.secondaryText }]}>—</Text>

        {group2.map((char, i) => (
          <View
            key={`g2-${i}`}
            style={[
              styles.charCell,
              { backgroundColor: colors.surface, borderColor: colors.primary },
            ]}
          >
            <Text style={[styles.charText, { color: colors.primary }]}>{char}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.copyBtn, { borderColor: colors.primary }]}
        onPress={handleCopy}
        activeOpacity={0.7}
      >
        <Feather name="copy" size={15} color={colors.primary} />
        <Text style={[typography.bodyMedium, { color: colors.primary }]}>
          {copied ? "Copied!" : "Copy Code"}
        </Text>
      </TouchableOpacity>

      <Animated.View style={[styles.copiedMsg, copiedStyle]}>
        <Text style={[typography.small, { color: colors.primary }]}>Code copied to clipboard</Text>
      </Animated.View>

      {isExpired ? (
        <View style={styles.expiredContainer}>
          <Text style={[typography.bodyMedium, { color: colors.danger, textAlign: "center" }]}>
            Code Expired
          </Text>
          <TouchableOpacity
            style={[styles.requestNewBtn, { borderColor: colors.primary }]}
            onPress={onRequestNew}
            disabled={isLoadingNew}
            activeOpacity={0.7}
          >
            {isLoadingNew ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[typography.bodyMedium, { color: colors.primary }]}>
                Request New Code
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.View style={shakeStyle}>
          <Text
            style={[
              typography.caption,
              {
                color: isUrgent ? colors.danger : colors.secondaryText,
                textAlign: "center",
                marginTop: spacing.sm,
              },
            ]}
          >
            Code expires in {formatCountdown(remainingMs)}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: spacing.sm,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  charCell: {
    width: 40,
    height: 52,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  charText: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    lineHeight: 34,
  },
  dash: {
    fontSize: 20,
    marginHorizontal: 4,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.base,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    marginTop: 4,
  },
  copiedMsg: {
    minHeight: 16,
  },
  expiredContainer: {
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  requestNewBtn: {
    paddingHorizontal: spacing.base,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    minWidth: 160,
  },
});
