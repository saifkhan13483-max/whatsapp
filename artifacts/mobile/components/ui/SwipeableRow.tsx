import React, { useRef } from "react";
import { View, TouchableOpacity, Text, StyleSheet, Animated as RNAnimated } from "react-native";
import { GestureHandlerRootView, Swipeable } from "react-native-gesture-handler";
import { useColors } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";

interface Action {
  label: string;
  icon: string;
  color: string;
  onPress: () => void;
}

interface Props {
  children: React.ReactNode;
  rightActions?: Action[];
  leftActions?: Action[];
}

export function SwipeableRow({ children, rightActions = [], leftActions = [] }: Props) {
  const colors = useColors();
  const swipeRef = useRef<Swipeable>(null);

  const renderRight = (prog: RNAnimated.AnimatedInterpolation<number>) => (
    <View style={styles.actionsContainer}>
      {rightActions.map((action, i) => (
        <TouchableOpacity
          key={i}
          style={[styles.action, { backgroundColor: action.color }]}
          onPress={() => {
            swipeRef.current?.close();
            action.onPress();
          }}
          activeOpacity={0.8}
        >
          <Ionicons name={action.icon as any} size={20} color="#fff" />
          <Text style={styles.actionLabel}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderLeft = (prog: RNAnimated.AnimatedInterpolation<number>) => (
    <View style={styles.actionsContainer}>
      {leftActions.map((action, i) => (
        <TouchableOpacity
          key={i}
          style={[styles.action, { backgroundColor: action.color }]}
          onPress={() => {
            swipeRef.current?.close();
            action.onPress();
          }}
          activeOpacity={0.8}
        >
          <Ionicons name={action.icon as any} size={20} color="#fff" />
          <Text style={styles.actionLabel}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={rightActions.length ? renderRight : undefined}
      renderLeftActions={leftActions.length ? renderLeft : undefined}
      overshootRight={false}
      overshootLeft={false}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  actionsContainer: {
    flexDirection: "row",
  },
  action: {
    width: 72,
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  actionLabel: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
});
