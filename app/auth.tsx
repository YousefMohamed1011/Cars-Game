import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GameLogo } from '../src/components/brand/GameLogo';
import { useGameStore } from '../src/store/gameStore';
import { soundEngine } from '../src/audio/SoundEngine';

const AVATARS = [
  { id: 'avatar_1', icon: 'racing-helmet', name: 'Carbon Viper', color: '#00f0ff' },
  { id: 'avatar_2', icon: 'car-sports', name: 'Cairo Stig', color: '#f59e0b' },
  { id: 'avatar_3', icon: 'steering', name: 'Apex Hunter', color: '#ef4444' },
  { id: 'avatar_4', icon: 'speedometer', name: 'Redline Pro', color: '#10b981' },
  { id: 'avatar_5', icon: 'trophy-award', name: 'Street Champion', color: '#a855f7' },
  { id: 'avatar_6', icon: 'shield-car', name: 'Bavaria Drift', color: '#38bdf8' },
];

const SERVER_REGIONS = [
  { id: 'cairo_01', name: 'MENA - Cairo #01', ping: '12ms', status: 'Optimal' },
  { id: 'frankfurt_03', name: 'Europe - Frankfurt #03', ping: '45ms', status: 'Good' },
  { id: 'virginia_02', name: 'US East - Virginia #02', ping: '110ms', status: 'Fair' },
  { id: 'tokyo_01', name: 'Asia - Tokyo #01', ping: '158ms', status: 'Active' },
];

export default function AuthScreen() {
  const router = useRouter();
  const profile = useGameStore((state) => state.profile);
  const setProfile = useGameStore((state) => state.setProfile);

  const [authMode, setAuthMode] = useState<'guest' | 'account'>('guest');
  const [username, setUsername] = useState(profile.username || 'ApexRider_EG');
  const [selectedAvatar, setSelectedAvatar] = useState(profile.avatarId || 'avatar_1');
  const [selectedRegion, setSelectedRegion] = useState(profile.serverRegion || 'MENA - Cairo #01');
  const [password, setPassword] = useState('');

  const handleRandomizeName = () => {
    const prefixes = ['Cairo', 'Apex', 'Drift', 'Turbo', 'Night', 'Giza', 'Redline'];
    const suffixes = ['Rider', 'King', 'Demon', 'E30', '132', 'Phantom', 'Ghost'];
    const randomName = `${prefixes[Math.floor(Math.random() * prefixes.length)]}_${suffixes[Math.floor(Math.random() * suffixes.length)]}${Math.floor(Math.random() * 90 + 10)}`;
    setUsername(randomName);
    soundEngine.playTurnSignal();
  };

  const handleEnterLobby = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }
    soundEngine.playGearShift();

    // Save profile updates
    setProfile({
      username: username.trim() || 'Driver_01',
      avatarId: selectedAvatar,
      serverRegion: selectedRegion,
    });

    router.replace('/lobby');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#070b14', '#0d162a', '#05070c']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.contentRow}>
        {/* Left Column: Game Brand & Server Selection */}
        <View style={styles.leftColumn}>
          <GameLogo width={340} height={85} showSubtitle={true} />

          <View style={styles.serverCard}>
            <View style={styles.serverHeaderRow}>
              <View style={styles.liveBadge}>
                <View style={styles.pulseDot} />
                <Text style={styles.liveText}>GLOBAL SERVER NETWORK</Text>
              </View>
              <Text style={styles.protocolText}>TCP/UDP V1.4</Text>
            </View>

            <Text style={styles.sectionLabel}>SELECT MULTIPLAYER REGION</Text>
            <View style={styles.regionList}>
              {SERVER_REGIONS.map((region) => {
                const isSelected = selectedRegion === region.name;
                return (
                  <TouchableOpacity
                    key={region.id}
                    style={[
                      styles.regionItem,
                      isSelected && styles.regionItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedRegion(region.name);
                      soundEngine.playTurnSignal();
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.regionMeta}>
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={16}
                        color={isSelected ? '#00f0ff' : '#64748b'}
                      />
                      <Text
                        style={[
                          styles.regionName,
                          isSelected && styles.regionNameSelected,
                        ]}
                      >
                        {region.name}
                      </Text>
                    </View>
                    <View style={styles.pingRow}>
                      <Text
                        style={[
                          styles.pingText,
                          {
                            color:
                              parseInt(region.ping) < 50
                                ? '#10b981'
                                : parseInt(region.ping) < 120
                                ? '#f59e0b'
                                : '#ef4444',
                          },
                        ]}
                      >
                        {region.ping}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Right Column: Driver Profile & Auth Setup */}
        <View style={styles.rightColumn}>
          <View style={styles.authCard}>
            {/* Mode Switcher Tabs */}
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabButton, authMode === 'guest' && styles.tabButtonActive]}
                onPress={() => setAuthMode('guest')}
              >
                <Ionicons
                  name="flash"
                  size={16}
                  color={authMode === 'guest' ? '#00f0ff' : '#94a3b8'}
                />
                <Text
                  style={[
                    styles.tabButtonText,
                    authMode === 'guest' && styles.tabButtonTextActive,
                  ]}
                >
                  QUICK GUEST ENTRY
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, authMode === 'account' && styles.tabButtonActive]}
                onPress={() => setAuthMode('account')}
              >
                <Ionicons
                  name="person"
                  size={16}
                  color={authMode === 'account' ? '#00f0ff' : '#94a3b8'}
                />
                <Text
                  style={[
                    styles.tabButtonText,
                    authMode === 'account' && styles.tabButtonTextActive,
                  ]}
                >
                  ACCOUNT LOGIN
                </Text>
              </TouchableOpacity>
            </View>

            {/* Username Input */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Text style={styles.inputLabel}>DRIVER CALL-SIGN / USERNAME</Text>
                <TouchableOpacity onPress={handleRandomizeName} style={styles.randomBtn}>
                  <Ionicons name="dice-outline" size={14} color="#00f0ff" />
                  <Text style={styles.randomBtnText}>RANDOMIZE</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons
                  name="card-account-details-outline"
                  size={20}
                  color="#00f0ff"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Enter racer name..."
                  placeholderTextColor="#64748b"
                  maxLength={18}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            {authMode === 'account' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>DRIVER PASSCODE</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color="#00f0ff"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter security key..."
                    placeholderTextColor="#64748b"
                    secureTextEntry
                  />
                </View>
              </View>
            )}

            {/* Avatar Selector */}
            <View style={styles.avatarSection}>
              <Text style={styles.inputLabel}>SELECT RACING AVATAR</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.avatarList}
              >
                {AVATARS.map((av) => {
                  const isSelected = selectedAvatar === av.id;
                  return (
                    <TouchableOpacity
                      key={av.id}
                      style={[
                        styles.avatarItem,
                        isSelected && styles.avatarItemSelected,
                      ]}
                      onPress={() => {
                        setSelectedAvatar(av.id);
                        soundEngine.playTurnSignal();
                      }}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.avatarIconBox,
                          { borderColor: isSelected ? '#00f0ff' : 'rgba(255,255,255,0.1)' },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={av.icon as any}
                          size={24}
                          color={av.color}
                        />
                      </View>
                      <Text
                        style={[
                          styles.avatarName,
                          isSelected && styles.avatarNameSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {av.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Enter Lobby Primary CTA */}
            <TouchableOpacity
              style={styles.primaryCta}
              onPress={handleEnterLobby}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#00f0ff', '#0284c7', '#0369a1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryCtaGradient}
              >
                <Text style={styles.primaryCtaText}>ENTER 3D LOBBY & STREETS</Text>
                <Ionicons name="speedometer" size={20} color="#030712" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070b14',
    paddingHorizontal: 28,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  leftColumn: {
    width: '42%',
    height: '100%',
    justifyContent: 'space-between',
  },
  serverCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.2)',
  },
  serverHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 6,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  liveText: {
    color: '#e2e8f0',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  protocolText: {
    color: '#00f0ff',
    fontSize: 10,
    fontWeight: '700',
  },
  sectionLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  regionList: {
    gap: 6,
  },
  regionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  regionItemSelected: {
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    borderColor: '#00f0ff',
  },
  regionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  regionName: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  regionNameSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  pingRow: {
    alignItems: 'flex-end',
  },
  pingText: {
    fontSize: 11,
    fontWeight: '700',
  },
  rightColumn: {
    width: '55%',
    height: '100%',
    justifyContent: 'center',
  },
  authCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(2, 6, 23, 0.7)',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.4)',
  },
  tabButtonText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  tabButtonTextActive: {
    color: '#00f0ff',
    fontWeight: '800',
  },
  inputGroup: {
    marginBottom: 10,
  },
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  inputLabel: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  randomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  randomBtnText: {
    color: '#00f0ff',
    fontSize: 10,
    fontWeight: '700',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 6, 23, 0.8)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.3)',
    paddingHorizontal: 12,
    height: 42,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  avatarSection: {
    marginBottom: 14,
  },
  avatarList: {
    gap: 10,
    paddingVertical: 4,
  },
  avatarItem: {
    alignItems: 'center',
    width: 72,
  },
  avatarItemSelected: {},
  avatarIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(2, 6, 23, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 4,
  },
  avatarName: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  avatarNameSelected: {
    color: '#00f0ff',
    fontWeight: '800',
  },
  primaryCta: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
  },
  primaryCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  primaryCtaText: {
    color: '#030712',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
});
