import React from "react";
import { View, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useColors } from "@/hooks/useColors";

interface Props {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
}

export function ProgressRing({ progress, size = 80, strokeWidth = 8, color, label }: Props) {
  const colors = useColors();
  const tint = color ?? colors.primary;
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const stroke = circ * (1 - Math.min(Math.max(progress, 0), 1));
  const cx = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={colors.border}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={tint}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circ}`}
          strokeDashoffset={stroke}
          strokeLinecap="round"
          rotation="-90"
          origin={`${cx}, ${cx}`}
        />
      </Svg>
      {label ? (
        <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.text }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}
