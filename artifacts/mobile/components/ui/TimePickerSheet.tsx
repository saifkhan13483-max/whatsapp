import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  visible: boolean;
  title?: string;
  value: string;
  onSelect: (time: string) => void;
  onClose: () => void;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

export function TimePickerSheet({ visible, title = "Select Time", value, onSelect, onClose }: Props) {
  const colors = useColors();
  const timeParts = (value || "00:00").split(":").map(Number);
  const [hour, setHour] = useState(timeParts[0] ?? 0);
  const [minute, setMinute] = useState(timeParts[1] ?? 0);

  function confirm() {
    onSelect(`${pad(hour)}:${pad(minute)}`);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.cancel, { color: colors.secondaryText }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.pickers}>
            <View style={styles.pickerCol}>
              <Text style={[styles.pickerLabel, { color: colors.secondaryText }]}>Hour</Text>
              <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                {HOURS.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[
                      styles.item,
                      h === hour && { backgroundColor: colors.primary + "22" },
                    ]}
                    onPress={() => setHour(h)}
                  >
                    <Text
                      style={[
                        styles.itemText,
                        { color: h === hour ? colors.primary : colors.text },
                      ]}
                    >
                      {pad(h)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <Text style={[styles.colon, { color: colors.text }]}>:</Text>
            <View style={styles.pickerCol}>
              <Text style={[styles.pickerLabel, { color: colors.secondaryText }]}>Min</Text>
              <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                {MINUTES.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.item,
                      m === minute && { backgroundColor: colors.primary + "22" },
                    ]}
                    onPress={() => setMinute(m)}
                  >
                    <Text
                      style={[
                        styles.itemText,
                        { color: m === minute ? colors.primary : colors.text },
                      ]}
                    >
                      {pad(m)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
            onPress={confirm}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  cancel: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  pickers: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
  },
  pickerCol: {
    flex: 1,
    maxWidth: 100,
  },
  pickerLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    marginBottom: 8,
  },
  scroll: {
    height: 180,
  },
  item: {
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  itemText: {
    fontSize: 18,
    fontFamily: "Inter_500Medium",
  },
  colon: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    marginTop: 40,
  },
  confirmBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
