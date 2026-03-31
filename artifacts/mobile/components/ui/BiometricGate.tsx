import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/constants/colors";
import { useBiometricLock } from "@/hooks/useBiometricLock";

interface Props {
  children: React.ReactNode;
}

export function BiometricGate({ children }: Props) {
  const colors = useColors();
  const { enabled, isAuthenticated, isLoading, authenticate } = useBiometricLock();

  useEffect(() => {
    if (enabled && !isAuthenticated && !isLoading) {
      authenticate();
    }
  }, [enabled, isAuthenticated, isLoading]);

  if (isLoading || !enabled || isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Ionicons name="finger-print" size={64} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>App Locked</Text>
        <Text style={[styles.sub, { color: colors.secondaryText }]}>
          Authenticate to access WaTracker Pro
        </Text>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={authenticate}
          activeOpacity={0.8}
        >
          <Ionicons name="finger-print" size={20} color="#fff" />
          <Text style={styles.btnText}>Authenticate</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  sub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  btnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
