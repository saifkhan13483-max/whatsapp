import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useBiometricLock } from "@/hooks/useBiometricLock";
import { spacing } from "@/constants/spacing";
import { typography } from "@/constants/typography";

interface Props {
  children: React.ReactNode;
}

export function BiometricGate({ children }: Props) {
  const colors = useColors();
  const { enabled, isAuthenticated, isLoading, authenticate } = useBiometricLock();
  const [authError, setAuthError] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    if (enabled && !isAuthenticated && !isLoading) {
      handleAuthenticate();
    }
  }, [enabled, isAuthenticated, isLoading]);

  async function handleAuthenticate() {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    setAuthError(false);
    const success = await authenticate();
    if (!success) {
      setAuthError(true);
    }
    setIsAuthenticating(false);
  }

  if (isLoading || !enabled || isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + "20" }]}>
          <Ionicons name="finger-print" size={56} color={colors.primary} />
        </View>

        <Text style={[typography.h2, { color: colors.text, textAlign: "center" }]}>
          App Locked
        </Text>
        <Text style={[typography.body, { color: colors.secondaryText, textAlign: "center", lineHeight: 22 }]}>
          Authenticate to access WaTracker Pro
        </Text>

        {authError && (
          <View style={[styles.errorBox, { backgroundColor: colors.danger + "18", borderColor: colors.danger + "44" }]}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]}>
              Authentication failed. Please try again.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary, opacity: isAuthenticating ? 0.65 : 1 }]}
          onPress={handleAuthenticate}
          activeOpacity={0.8}
          disabled={isAuthenticating}
          accessibilityLabel="Authenticate with biometrics"
          accessibilityRole="button"
        >
          <Ionicons name="finger-print" size={20} color="#fff" />
          <Text style={styles.btnText}>
            {isAuthenticating ? "Authenticating..." : "Unlock with Biometrics"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.passcodeBtn, { borderColor: colors.border }]}
          onPress={handleAuthenticate}
          activeOpacity={0.7}
          disabled={isAuthenticating}
          accessibilityLabel="Use passcode"
          accessibilityRole="button"
        >
          <Ionicons name="keypad-outline" size={16} color={colors.secondaryText} />
          <Text style={[styles.passcodeBtnText, { color: colors.secondaryText }]}>
            Use Passcode
          </Text>
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
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 20,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.base,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    width: "100%",
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 10,
    width: "100%",
    minHeight: 48,
  },
  btnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  passcodeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 10,
    borderWidth: 1.5,
    width: "100%",
    minHeight: 44,
  },
  passcodeBtnText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
