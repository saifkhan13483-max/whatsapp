import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";
import type { ConnectionStatus } from "@/hooks/useWhatsAppConnection";
import { formatRelativeTime } from "@/lib/formatters";

interface ConnectionStatusCardProps {
  status: ConnectionStatus;
  phoneNumber?: string;
  connectedAt?: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onContinueSetup?: () => void;
  onReconnect?: () => void;
  isDisconnecting?: boolean;
  isReconnecting?: boolean;
}

export function ConnectionStatusCard({
  status,
  phoneNumber,
  connectedAt,
  onConnect,
  onDisconnect,
  onContinueSetup,
  onReconnect,
  isDisconnecting,
  isReconnecting,
}: ConnectionStatusCardProps) {
  const colors = useColors();

  const configs = {
    not_connected: {
      bg: colors.surface,
      borderColor: colors.border,
      iconName: "link-off" as const,
      iconColor: colors.muted,
      title: "Not Connected",
      subtitle: "Link your WhatsApp account to start monitoring",
    },
    pending_pairing: {
      bg: colors.warning + "15",
      borderColor: colors.warning + "60",
      iconName: "clock" as const,
      iconColor: colors.warning,
      title: "Pairing in Progress...",
      subtitle: "Waiting for you to enter the code in WhatsApp",
    },
    connected: {
      bg: colors.primary + "10",
      borderColor: colors.primary + "40",
      iconName: "check-circle" as const,
      iconColor: colors.primary,
      title: "Connected",
      subtitle: phoneNumber ?? "WhatsApp linked",
    },
    disconnected: {
      bg: colors.danger + "10",
      borderColor: colors.danger + "40",
      iconName: "alert-circle" as const,
      iconColor: colors.danger,
      title: "Connection Lost",
      subtitle: "Your WhatsApp session was disconnected",
    },
  };

  const cfg = configs[status];

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: cfg.bg, borderColor: cfg.borderColor },
      ]}
    >
      <View style={styles.topRow}>
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: cfg.iconColor + "20" },
          ]}
        >
          <Feather name={cfg.iconName} size={22} color={cfg.iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.bodyMedium, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
            {cfg.title}
          </Text>
          <Text style={[typography.caption, { color: colors.secondaryText }]} numberOfLines={1}>
            {cfg.subtitle}
          </Text>
          {status === "connected" && connectedAt && (
            <Text style={[typography.small, { color: colors.secondaryText }]}>
              Connected {formatRelativeTime(connectedAt)}
            </Text>
          )}
        </View>
        {status === "connected" && (
          <View style={[styles.connectedDot, { backgroundColor: colors.primary }]} />
        )}
      </View>

      <View style={styles.actions}>
        {status === "not_connected" && (
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.primary }]}
            onPress={onConnect}
            accessibilityLabel="Connect WhatsApp"
            accessibilityRole="button"
          >
            <Feather name="link" size={15} color="#fff" />
            <Text style={[typography.bodyMedium, { color: "#fff" }]}>Connect Now</Text>
          </TouchableOpacity>
        )}

        {status === "pending_pairing" && (
          <TouchableOpacity
            style={[styles.btn, styles.btnOutlined, { borderColor: colors.warning }]}
            onPress={onContinueSetup ?? onConnect}
            accessibilityLabel="Continue WhatsApp setup"
            accessibilityRole="button"
          >
            <Text style={[typography.bodyMedium, { color: colors.warning }]}>Continue Setup</Text>
          </TouchableOpacity>
        )}

        {status === "connected" && (
          <TouchableOpacity
            style={[styles.btn, styles.btnOutlined, { borderColor: colors.danger + "80" }]}
            onPress={onDisconnect}
            disabled={isDisconnecting}
            accessibilityLabel="Disconnect WhatsApp"
            accessibilityRole="button"
          >
            {isDisconnecting ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <>
                <Feather name="link-off" size={14} color={colors.danger} />
                <Text style={[typography.bodyMedium, { color: colors.danger }]}>Disconnect</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {status === "disconnected" && (
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.primary }]}
            onPress={onReconnect}
            disabled={isReconnecting}
            accessibilityLabel="Reconnect WhatsApp"
            accessibilityRole="button"
          >
            {isReconnecting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="refresh" size={15} color="#fff" />
                <Text style={[typography.bodyMedium, { color: "#fff" }]}>Reconnect</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.base,
    gap: spacing.base,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  connectedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  actions: {
    flexDirection: "row",
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: spacing.base,
    borderRadius: 8,
  },
  btnPrimary: {},
  btnOutlined: {
    borderWidth: 1.5,
    backgroundColor: "transparent",
  },
});
