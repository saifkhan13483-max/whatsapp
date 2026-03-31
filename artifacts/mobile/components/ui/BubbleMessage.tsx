import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/constants/colors";

export interface Message {
  id: number;
  text: string;
  timestamp: string;
  isMine: boolean;
  status?: "sent" | "delivered" | "read";
}

interface Props {
  message: Message;
}

export function BubbleMessage({ message }: Props) {
  const colors = useColors();
  const { text, timestamp, isMine, status } = message;

  return (
    <View style={[styles.wrapper, isMine ? styles.myWrapper : styles.theirWrapper]}>
      <View
        style={[
          styles.bubble,
          isMine
            ? [styles.myBubble, { backgroundColor: colors.primaryDark }]
            : [styles.theirBubble, { backgroundColor: colors.card }],
        ]}
      >
        <Text style={[styles.text, { color: isMine ? "#e9edef" : colors.text }]}>{text}</Text>
        <View style={styles.meta}>
          <Text style={[styles.time, { color: isMine ? "rgba(233,237,239,0.7)" : colors.secondaryText }]}>
            {timestamp}
          </Text>
          {isMine && status && (
            <Text style={styles.status}>
              {status === "read" ? "✓✓" : status === "delivered" ? "✓✓" : "✓"}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 12,
    marginVertical: 2,
  },
  myWrapper: { alignItems: "flex-end" },
  theirWrapper: { alignItems: "flex-start" },
  bubble: {
    maxWidth: "78%",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  myBubble: { borderBottomRightRadius: 4 },
  theirBubble: { borderBottomLeftRadius: 4 },
  text: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 4,
  },
  time: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  status: {
    fontSize: 11,
    color: "#34B7F1",
  },
});
