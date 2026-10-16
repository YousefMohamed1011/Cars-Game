import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { GameLogo } from '../src/components/brand/GameLogo';
import { soundEngine } from '../src/audio/SoundEngine';

const LOADING_STAGES = [
  'Initializing 3D Graphics Pipeline & WebGL Shaders...',
  'Compiling PBR Clearcoat Materials & Reflection Maps...',
  'Preloading 3D Mesh Geometry: FIAT 132 (2000cc)...',
  'Preloading 3D Mesh Geometry: CHEVROLET OPTRA 2012...',
  'Preloading 3D Mesh Geometry: BMW E30 (325i Drift)...',
  'Synthesizing Multi-layered Exhaust & Audio Buffers...',
  'Synchronizing Cairo Urban Streets & Checkpoints...',
  'Connecting to Server Hub (MENA - Cairo #01)...',
  'Engine Ignition Primed. Ready to Race!',
];

export default function SplashScreen() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Play startup engine crank sound
    soundEngine.playStartupCrank();

    // Animate logo entry
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
    ]).start();

    // Ambient pulsing glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Incremental progress simulation with real stage updates
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + Math.floor(Math.random() * 8) + 4;
        if (next >= 100) {
          clearInterval(interval);
          setStageIndex(LOADING_STAGES.length - 1);
          setTimeout(() => {
            router.replace('/auth');
          }, 600);
          return 100;
        }

        const calculatedStage = Math.min(
          LOADING_STAGES.length - 2,
          Math.floor((next / 100) * (LOADING_STAGES.length - 1))
        );
        setStageIndex(calculatedStage);
        return next;
      });
    }, 120);

    return () => clearInterval(interval);
  }, []);

  const handleSkip = () => {
    router.replace('/auth');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#050811', '#0b1329', '#03050a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Speed Diagonal Decals */}
      <View style={styles.decalContainer}>
        <View style={[styles.decalLine, { top: '15%', opacity: 0.15 }]} />
        <View style={[styles.decalLine, { top: '35%', opacity: 0.08 }]} />
        <View style={[styles.decalLine, { top: '70%', opacity: 0.2 }]} />
      </View>

      {/* Main Animated Logo */}
      <Animated.View
        style={[
          styles.logoWrapper,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }, { scale: pulseAnim }],
          },
        ]}
      >
        <GameLogo width={520} height={130} showSubtitle={true} />
      </Animated.View>

      {/* Loading Progress Section */}
      <View style={styles.progressContainer}>
        <View style={styles.progressMeta}>
          <Text style={styles.stageText}>
            {LOADING_STAGES[stageIndex]}
          </Text>
          <Text style={styles.percentageText}>{progress}%</Text>
        </View>

        {/* Progress Bar Track */}
        <View style={styles.progressBarTrack}>
          <LinearGradient
            colors={['#00f0ff', '#38bdf8', '#0284c7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressBarFill, { width: `${progress}%` }]}
          />
        </View>

        {/* System Badges */}
        <View style={styles.footerRow}>
          <View style={styles.badge}>
            <View style={styles.activeDot} />
            <Text style={styles.badgeText}>THREE.JS PBR V8.4</Text>
          </View>

          <View style={styles.badge}>
            <View style={styles.activeDot} />
            <Text style={styles.badgeText}>AUDIO SYNTH RUNNING</Text>
          </View>

          <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.7}>
            <Text style={styles.skipButtonText}>TAP TO SKIP ▶</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#050811',
  },
  decalContainer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  decalLine: {
    position: 'absolute',
    left: -100,
    width: '150%',
    height: 3,
    backgroundColor: '#00f0ff',
    transform: [{ rotate: '-12deg' }],
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  progressContainer: {
    width: '68%',
    maxWidth: 620,
    marginTop: 10,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stageText: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'System',
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  percentageText: {
    color: '#00f0ff',
    fontSize: 14,
    fontFamily: 'System',
    fontWeight: '800',
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.25)',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  badgeText: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  skipButton: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.4)',
  },
  skipButtonText: {
    color: '#00f0ff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
