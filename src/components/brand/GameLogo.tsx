import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
  G,
  Path,
  Rect,
  Circle,
} from 'react-native-svg';

interface GameLogoProps {
  width?: number;
  height?: number;
  showSubtitle?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const GameLogo: React.FC<GameLogoProps> = ({
  width = 360,
  height = 90,
  showSubtitle = true,
  style,
}) => {
  // 400x100 viewBox
  return (
    <View style={[styles.container, style]}>
      <Svg width={width} height={height} viewBox="0 0 460 110" fill="none">
        <Defs>
          {/* Main Title Gradient: Cyan to Chrome White */}
          <LinearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#00F0FF" />
            <Stop offset="35%" stopColor="#E0F7FA" />
            <Stop offset="70%" stopColor="#38BDF8" />
            <Stop offset="100%" stopColor="#0284C7" />
          </LinearGradient>

          {/* Golden Subtitle Gradient */}
          <LinearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#F59E0B" />
            <Stop offset="50%" stopColor="#FDE68A" />
            <Stop offset="100%" stopColor="#D97706" />
          </LinearGradient>

          {/* Racing Slash Stripes Gradient */}
          <LinearGradient id="stripeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#EF4444" stopOpacity="0.9" />
            <Stop offset="50%" stopColor="#F59E0B" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#00F0FF" stopOpacity="0.7" />
          </LinearGradient>

          {/* Dark Glass Backing Shadow */}
          <LinearGradient id="shadowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#0F172A" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#020617" stopOpacity="0.95" />
          </LinearGradient>
        </Defs>

        {/* Ambient Glow / Background Slanted Plaque */}
        <Path
          d="M 20 10 L 450 10 L 430 100 L 0 100 Z"
          fill="url(#shadowGrad)"
          stroke="#00F0FF"
          strokeWidth="1.5"
          strokeOpacity="0.4"
        />

        {/* Dynamic Speed Streaks / Carbon Fiber Accents */}
        <G opacity="0.85">
          <Path d="M 32 18 L 52 18 L 42 36 L 22 36 Z" fill="url(#stripeGrad)" />
          <Path d="M 58 18 L 78 18 L 68 36 L 48 36 Z" fill="url(#stripeGrad)" />
          <Path d="M 84 18 L 104 18 L 94 36 L 74 36 Z" fill="url(#stripeGrad)" />
        </G>

        {/* Racing Wheel Icon badge on Left */}
        <G transform="translate(42, 60)">
          <Circle cx="0" cy="0" r="16" stroke="#00F0FF" strokeWidth="2.5" fill="#090D16" />
          <Circle cx="0" cy="0" r="6" fill="#F59E0B" />
          {/* 3 Wheel Spokes */}
          <Rect x="-1.5" y="-14" width="3" height="8" fill="#E2E8F0" />
          <Rect x="-1.5" y="6" width="3" height="8" fill="#E2E8F0" />
          <Rect x="-14" y="-1.5" width="8" height="3" fill="#E2E8F0" />
          <Rect x="6" y="-1.5" width="8" height="3" fill="#E2E8F0" />
          {/* Rim Bolt */}
          <Circle cx="0" cy="0" r="2.5" fill="#FFFFFF" />
        </G>

        {/* Main Title: "LIFE ON WHEELS" with Racing Italicized Slant */}
        <G transform="skewX(-14)">
          {/* Deep Shadow */}
          <SvgText
            x="96"
            y="56"
            fontSize="36"
            fontWeight="900"
            fontFamily="System"
            letterSpacing="3"
            fill="#030712"
            opacity="0.95"
          >
            LIFE ON WHEELS
          </SvgText>

          {/* Glowing Stroke Outline */}
          <SvgText
            x="94"
            y="54"
            fontSize="36"
            fontWeight="900"
            fontFamily="System"
            letterSpacing="3"
            fill="none"
            stroke="#00E5FF"
            strokeWidth="3"
            strokeOpacity="0.4"
          >
            LIFE ON WHEELS
          </SvgText>

          {/* Foreground Radiant Gradient */}
          <SvgText
            x="94"
            y="54"
            fontSize="36"
            fontWeight="900"
            fontFamily="System"
            letterSpacing="3"
            fill="url(#titleGrad)"
          >
            LIFE ON WHEELS
          </SvgText>
        </G>

        {/* Subtitle: "THE REAL LIFE SIMULATOR" */}
        {showSubtitle && (
          <G transform="skewX(-14)">
            {/* Speed divider line */}
            <Path
              d="M 96 66 L 415 66"
              stroke="#38BDF8"
              strokeWidth="1.5"
              strokeOpacity="0.6"
            />
            {/* Gold Accented Subtitle */}
            <SvgText
              x="96"
              y="86"
              fontSize="14.5"
              fontWeight="800"
              fontFamily="System"
              letterSpacing="5.5"
              fill="url(#goldGrad)"
            >
              THE REAL LIFE SIMULATOR
            </SvgText>
          </G>
        )}

        {/* Right Corner Hazard Corner Notch */}
        <Path
          d="M 436 20 L 446 20 L 436 40 L 426 40 Z"
          fill="#00F0FF"
          opacity="0.7"
        />
        <Path
          d="M 422 20 L 432 20 L 422 40 L 412 40 Z"
          fill="#38BDF8"
          opacity="0.4"
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
