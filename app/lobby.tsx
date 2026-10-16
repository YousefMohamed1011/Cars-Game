import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import * as THREE from 'three';
import * as Haptics from 'expo-haptics';

import { GameLogo } from '../src/components/brand/GameLogo';
import { CarCanvas } from '../src/components/3d/CarCanvas';
import { createCar3D, Car3DObject } from '../src/components/3d/ProceduralCars';
import {
  CAR_REGISTRY,
  COLOR_PALETTE,
  NEON_COLORS,
  getCarById,
} from '../src/resources/carRegistry';
import { useGameStore } from '../src/store/gameStore';
import { soundEngine } from '../src/audio/SoundEngine';
import { MISSIONS_LIST, missionManager } from '../src/missions/MissionManager';
import { SteeringControlMode } from '../src/types';
import { updateService, UpdateCheckResult } from '../src/services/UpdateService';

export default function LobbyScreen() {
  const router = useRouter();

  // Zustand State
  const profile = useGameStore((state) => state.profile);
  const selectCar = useGameStore((state) => state.selectCar);
  const updateCarCustomization = useGameStore((state) => state.updateCarCustomization);
  const settings = useGameStore((state) => state.settings);
  const updateSettings = useGameStore((state) => state.updateSettings);

  const selectedCarSpec = getCarById(profile.selectedCarId);
  const currentCustomization =
    profile.customizations[profile.selectedCarId] || {
      bodyColor: selectedCarSpec.defaultColor,
      rimColor: selectedCarSpec.defaultRimColor,
      windowTint: 0.2,
      suspensionHeight: 0,
      neonUnderglow: null,
      headlightTint: '#FFFFFF',
      engineTuneLevel: 1,
    };

  // Modals & Sidebar Active Tab
  const [activeTab, setActiveTab] = useState<
    'lobby' | 'garage' | 'map' | 'missions' | 'server'
  >('lobby');
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Auto-Update & OTA State
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdatingOta, setIsUpdatingOta] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateStatusMsg, setUpdateStatusMsg] = useState('');

  // Auto check for updates on startup
  useEffect(() => {
    updateService.checkForUpdates().then((res) => {
      setUpdateInfo(res);
      if (res.isUpdateAvailable) {
        setShowUpdateModal(true);
      }
    });
  }, []);

  const handleManualCheckUpdates = async () => {
    setUpdateStatusMsg('Checking server for updates...');
    const res = await updateService.checkForUpdates();
    setUpdateInfo(res);
    if (res.isUpdateAvailable) {
      setShowUpdateModal(true);
      setUpdateStatusMsg('');
    } else {
      setUpdateStatusMsg(`Latest version installed (v${res.currentVersion})`);
    }
  };

  const handleApplyOtaUpdate = async () => {
    setIsUpdatingOta(true);
    setUpdateProgress(20);
    const success = await updateService.downloadAndApplyOtaUpdate((p) => {
      setUpdateProgress(p);
    });
    if (!success) {
      setIsUpdatingOta(false);
      setUpdateStatusMsg('OTA bundle applied or requires direct APK download.');
    }
  };

  const handleDownloadApkMediafire = () => {
    updateService.openDownloadLink(updateInfo?.apkDownloadUrl);
  };

  // 3D Scene Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const currentCar3DRef = useRef<Car3DObject | null>(null);
  const orbitAngleRef = useRef<{ theta: number; phi: number }>({
    theta: 0.7,
    phi: 0.32,
  });
  const orbitRadiusRef = useRef<number>(6.4);

  // Initialize and spawn car in 3D scene
  const handleSceneReady = (
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer
  ) => {
    sceneRef.current = scene;
    cameraRef.current = camera;

    // Ambient Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    // Directional Sunlight / Street Key Light
    const dirLight = new THREE.DirectionalLight(0xe0f2fe, 2.2);
    dirLight.position.set(10, 15, 8);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Warm street flood light
    const fillLight = new THREE.DirectionalLight(0xfef08a, 1.2);
    fillLight.position.set(-10, 8, -6);
    scene.add(fillLight);

    // Cyan Neon Rim Fill Light
    const cyanLight = new THREE.PointLight(0x00f0ff, 3.5, 20);
    cyanLight.position.set(0, 1.5, -4);
    scene.add(cyanLight);

    // Showroom / Asphalt Stage Platform
    const stageGeo = new THREE.CylinderGeometry(8, 8.4, 0.3, 48);
    const stageMat = new THREE.MeshStandardMaterial({
      color: 0x111622,
      roughness: 0.75,
      metalness: 0.2,
    });
    const stage = new THREE.Mesh(stageGeo, stageMat);
    stage.position.y = -0.15;
    stage.receiveShadow = true;
    scene.add(stage);

    // Outer Glowing Neon Ring on Floor
    const ringGeo = new THREE.RingGeometry(7.7, 7.9, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);

    // Build and add current car
    spawnCarInScene(scene, selectedCarSpec, currentCustomization);
    updateCameraOrbit();
  };

  const spawnCarInScene = (scene: THREE.Scene, specs: any, custom: any) => {
    if (currentCar3DRef.current) {
      scene.remove(currentCar3DRef.current.group);
    }
    const car3D = createCar3D(specs, custom);
    car3D.group.position.set(0, 0, 0);
    car3D.setHeadlights(true);
    car3D.setBraking(false);
    scene.add(car3D.group);
    currentCar3DRef.current = car3D;
  };

  // Switch car model when selected
  useEffect(() => {
    if (sceneRef.current) {
      spawnCarInScene(sceneRef.current, selectedCarSpec, currentCustomization);
    }
  }, [profile.selectedCarId]);

  // Update customization live
  useEffect(() => {
    if (currentCar3DRef.current) {
      currentCar3DRef.current.updateCustomization(currentCustomization);
    }
  }, [currentCustomization]);

  const updateCameraOrbit = () => {
    if (!cameraRef.current) return;
    const { theta, phi } = orbitAngleRef.current;
    const r = orbitRadiusRef.current;

    const x = r * Math.sin(phi) * Math.sin(theta);
    const y = r * Math.cos(phi);
    const z = r * Math.sin(phi) * Math.cos(theta);

    cameraRef.current.position.set(x, Math.max(0.8, y), z);
    cameraRef.current.lookAt(0, 0.75, 0);
  };

  const handleOrbitRotate = (dx: number, dy: number) => {
    orbitAngleRef.current.theta += dx * 0.008;
    orbitAngleRef.current.phi = Math.max(
      0.15,
      Math.min(Math.PI / 2.1, orbitAngleRef.current.phi - dy * 0.008)
    );
    updateCameraOrbit();
  };

  // Frame animation loop
  const handleFrame = (time: number, delta: number) => {
    // Slowly auto-rotate car or camera if not interacting
    orbitAngleRef.current.theta += delta * 0.08;
    updateCameraOrbit();
  };

  const handleSelectCar = (carId: string) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.selectionAsync();
      } catch {}
    }
    soundEngine.playTurnSignal();
    selectCar(carId);
  };

  const handleStartDriving = (missionId?: string) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch {}
    }
    soundEngine.playStartupCrank();
    if (missionId) {
      missionManager.startMission(missionId);
    } else {
      missionManager.startMission('mission_free_roam');
    }
    router.push('/drive');
  };

  return (
    <View style={styles.container}>
      {/* 3D Background Showroom Canvas with 360 Orbit */}
      <View style={StyleSheet.absoluteFill}>
        <CarCanvas
          onSceneReady={handleSceneReady}
          onFrame={handleFrame}
          enableTouchOrbit={true}
          onOrbitRotate={handleOrbitRotate}
        />
      </View>

      {/* Dark Vignette Overlay */}
      <LinearGradient
        colors={['rgba(7,11,20,0.85)', 'rgba(7,11,20,0.1)', 'rgba(7,11,20,0.92)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* TOP BAR */}
      <View style={styles.topBar}>
        {/* Top Left: Logo & Navigation Sidebar Tabs */}
        <View style={styles.topLeft}>
          <GameLogo width={280} height={68} showSubtitle={false} />
          <View style={styles.navRow}>
            {(
              [
                { id: 'lobby', label: 'MAIN LOBBY', icon: 'home-outline' },
                { id: 'garage', label: 'GARAGE / CUSTOMIZE', icon: 'construct-outline' },
                { id: 'map', label: 'STREETS / MAP', icon: 'map-outline' },
                { id: 'missions', label: 'MISSIONS', icon: 'trophy-outline' },
                { id: 'server', label: 'SERVER HUB', icon: 'server-outline' },
              ] as const
            ).map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[styles.navTab, activeTab === tab.id && styles.navTabActive]}
                onPress={() => {
                  setActiveTab(tab.id);
                  soundEngine.playTurnSignal();
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={14}
                  color={activeTab === tab.id ? '#00f0ff' : '#94a3b8'}
                />
                <Text
                  style={[
                    styles.navTabText,
                    activeTab === tab.id && styles.navTabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Top Right: Player Profile HUD */}
        <View style={styles.topRight}>
          <View style={styles.profileBadge}>
            <View style={styles.avatarMini}>
              <MaterialCommunityIcons name="racing-helmet" size={18} color="#00f0ff" />
            </View>
            <View style={styles.profileInfo}>
              <View style={styles.userRow}>
                <Text style={styles.userNameText}>{profile.username || 'USER'}</Text>
                <View style={styles.levelPill}>
                  <Text style={styles.levelPillText}>LV. {profile.level}</Text>
                </View>
              </View>

              {/* XP Progress Bar */}
              <View style={styles.xpTrack}>
                <View
                  style={[
                    styles.xpFill,
                    { width: `${Math.min(100, (profile.xp / profile.maxXp) * 100)}%` },
                  ]}
                />
              </View>
            </View>

            {/* Currency Pill */}
            <View style={styles.currencyPill}>
              <FontAwesome5 name="coins" size={12} color="#f59e0b" />
              <Text style={styles.currencyText}>
                {profile.cash.toLocaleString()}
              </Text>
            </View>

            {/* Update Notification Badge if available */}
            {updateInfo?.isUpdateAvailable && (
              <TouchableOpacity
                style={styles.updateAvailableBtn}
                onPress={() => setShowUpdateModal(true)}
              >
                <Ionicons name="cloud-download" size={13} color="#f59e0b" />
                <Text style={styles.updateAvailableText}>UPDATE v{updateInfo.latestVersion}</Text>
              </TouchableOpacity>
            )}

            {/* Server Status Badge */}
            <View style={styles.serverStatusBadge}>
              <View style={styles.greenPulse} />
              <Text style={styles.serverStatusText}>INTEGRATED ACTIVE</Text>
            </View>

            {/* Settings Button */}
            <TouchableOpacity
              style={styles.settingsIconBtn}
              onPress={() => setShowSettingsModal(true)}
            >
              <Ionicons name="settings-sharp" size={18} color="#cbd5e1" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* BOTTOM BAR */}
      <View style={styles.bottomBar}>
        {/* Bottom Left: Server Hub Widget */}
        <View style={styles.bottomLeft}>
          <View style={styles.serverHubWidget}>
            <View style={styles.serverHubHeader}>
              <Text style={styles.serverHubTitle}>SERVER HUB (INTEGRATION v1.4)</Text>
              <View style={styles.activeTag}>
                <View style={styles.greenDot} />
                <Text style={styles.activeTagText}>ACTIVE</Text>
              </View>
            </View>

            <View style={styles.serverDetailsRow}>
              <Text style={styles.serverDetailLabel}>ROOM ID:</Text>
              <Text style={styles.serverDetailValue}>#0429</Text>
              <Text style={styles.serverDivider}>|</Text>
              <Text style={styles.serverDetailLabel}>MULTIPLAYER LOBBY</Text>
            </View>

            <View style={styles.playerCountRow}>
              <Ionicons name="people" size={14} color="#00f0ff" />
              <Text style={styles.playerCountText}>PLAYERS: 3/4</Text>
              <Text style={styles.pingSmall}>• 14ms CAIRO</Text>
            </View>
          </View>
        </View>

        {/* Bottom Center: Car Selector Carousel */}
        <View style={styles.bottomCenter}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContainer}
          >
            {CAR_REGISTRY.map((car, idx) => {
              const isSelected = profile.selectedCarId === car.id;
              return (
                <TouchableOpacity
                  key={car.id}
                  style={[
                    styles.carCard,
                    isSelected && styles.carCardSelected,
                  ]}
                  onPress={() => handleSelectCar(car.id)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={
                      isSelected
                        ? ['rgba(0, 240, 255, 0.25)', 'rgba(15, 23, 42, 0.95)']
                        : ['rgba(15, 23, 42, 0.85)', 'rgba(2, 6, 23, 0.95)']
                    }
                    style={styles.carCardGradient}
                  >
                    <View style={styles.carCardHeader}>
                      <Text
                        style={[
                          styles.carCardNumber,
                          isSelected && styles.carCardNumberSelected,
                        ]}
                      >
                        {idx + 1}.
                      </Text>
                      <Text
                        style={[
                          styles.carCardName,
                          isSelected && styles.carCardNameSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {car.name}
                      </Text>
                    </View>

                    <View style={styles.carSpecsMini}>
                      <Text style={styles.miniSpecTag}>{car.driveType}</Text>
                      <Text style={styles.miniSpecTag}>{car.horsepower} HP</Text>
                      <Text style={styles.miniSpecTag}>{car.topSpeedKmh} KM/H</Text>
                    </View>

                    {isSelected && (
                      <View style={styles.selectedRibbon}>
                        <Ionicons name="checkmark-circle" size={12} color="#00f0ff" />
                        <Text style={styles.selectedRibbonText}>CURRENT</Text>
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Bottom Right: Action CTAs */}
        <View style={styles.bottomRight}>
          <View style={styles.ctaRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setActiveTab('garage')}
              activeOpacity={0.7}
            >
              <Ionicons name="color-palette-outline" size={16} color="#00f0ff" />
              <Text style={styles.secondaryBtnText}>CAR SELECT</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setShowSettingsModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="options-outline" size={16} color="#cbd5e1" />
              <Text style={styles.secondaryBtnText}>SETTINGS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryDriveCta}
              onPress={() => handleStartDriving()}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#00f0ff', '#0284c7', '#0369a1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryDriveGradient}
              >
                <Text style={styles.primaryDriveText}>START DRIVING</Text>
                <Ionicons name="play" size={18} color="#030712" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* GARAGE / CUSTOMIZE MODAL */}
      <Modal visible={activeTab === 'garage'} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.garageModalBox}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <MaterialCommunityIcons name="car-wrench" size={24} color="#00f0ff" />
                <Text style={styles.modalTitle}>GARAGE & PERFORMANCE TUNING</Text>
              </View>
              <TouchableOpacity
                onPress={() => setActiveTab('lobby')}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#cbd5e1" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Selected Car Details */}
              <View style={styles.garageCarBanner}>
                <View>
                  <Text style={styles.garageCarName}>{selectedCarSpec.name}</Text>
                  <Text style={styles.garageCarTagline}>{selectedCarSpec.tagline}</Text>
                </View>
                <View style={styles.garageStatsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>POWER</Text>
                    <Text style={styles.statValue}>{selectedCarSpec.horsepower} HP</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>TOP SPEED</Text>
                    <Text style={styles.statValue}>{selectedCarSpec.topSpeedKmh} KM/H</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>0-100 KM/H</Text>
                    <Text style={styles.statValue}>{selectedCarSpec.acceleration0to100}s</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>DRIVETRAIN</Text>
                    <Text style={styles.statValue}>{selectedCarSpec.driveType}</Text>
                  </View>
                </View>
              </View>

              {/* Paint Color Picker */}
              <Text style={styles.configSectionTitle}>BODY CLEARCOAT PAINT</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorPaletteScroll}>
                {COLOR_PALETTE.map((c) => {
                  const isSelected = currentCustomization.bodyColor === c.hex;
                  return (
                    <TouchableOpacity
                      key={c.hex}
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: c.hex },
                        isSelected && styles.colorSwatchSelected,
                      ]}
                      onPress={() => {
                        updateCarCustomization(profile.selectedCarId, { bodyColor: c.hex });
                        soundEngine.playTurnSignal();
                      }}
                    >
                      {isSelected && <Ionicons name="checkmark" size={16} color="#ffffff" />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Neon Underglow Color Picker */}
              <Text style={styles.configSectionTitle}>NEON UNDERGLOW ILLUMINATION</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorPaletteScroll}>
                {NEON_COLORS.map((n) => {
                  const isSelected = currentCustomization.neonUnderglow === n.hex;
                  return (
                    <TouchableOpacity
                      key={n.name}
                      style={[
                        styles.neonPill,
                        isSelected && styles.neonPillSelected,
                      ]}
                      onPress={() => {
                        updateCarCustomization(profile.selectedCarId, { neonUnderglow: n.hex });
                        soundEngine.playTurnSignal();
                      }}
                    >
                      <View
                        style={[
                          styles.neonDot,
                          { backgroundColor: n.hex || '#475569' },
                        ]}
                      />
                      <Text style={styles.neonPillText}>{n.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Suspension Height Preset */}
              <Text style={styles.configSectionTitle}>SUSPENSION STANCE & CAMBER</Text>
              <View style={styles.presetRow}>
                {[
                  { label: 'Slammed Track (-25mm)', val: -0.025 },
                  { label: 'Factory OEM (0mm)', val: 0 },
                  { label: 'Raised Rough Road (+20mm)', val: 0.02 },
                ].map((preset) => {
                  const isSelected = currentCustomization.suspensionHeight === preset.val;
                  return (
                    <TouchableOpacity
                      key={preset.label}
                      style={[styles.presetBtn, isSelected && styles.presetBtnSelected]}
                      onPress={() => {
                        updateCarCustomization(profile.selectedCarId, { suspensionHeight: preset.val });
                        soundEngine.playGearShift();
                      }}
                    >
                      <Text style={[styles.presetBtnText, isSelected && styles.presetBtnTextSelected]}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Window Tint Preset */}
              <Text style={styles.configSectionTitle}>PRIVACY WINDOW TINT</Text>
              <View style={styles.presetRow}>
                {[
                  { label: 'Clear 15%', val: 0.15 },
                  { label: 'Smoke 50%', val: 0.5 },
                  { label: 'Limo Black 85%', val: 0.85 },
                ].map((tint) => {
                  const isSelected = currentCustomization.windowTint === tint.val;
                  return (
                    <TouchableOpacity
                      key={tint.label}
                      style={[styles.presetBtn, isSelected && styles.presetBtnSelected]}
                      onPress={() => {
                        updateCarCustomization(profile.selectedCarId, { windowTint: tint.val });
                        soundEngine.playTurnSignal();
                      }}
                    >
                      <Text style={[styles.presetBtnText, isSelected && styles.presetBtnTextSelected]}>
                        {tint.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MISSIONS MODAL */}
      <Modal visible={activeTab === 'missions'} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.missionsModalBox}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="trophy" size={24} color="#00f0ff" />
                <Text style={styles.modalTitle}>STREET MISSIONS & OBJECTIVES</Text>
              </View>
              <TouchableOpacity
                onPress={() => setActiveTab('lobby')}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#cbd5e1" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.missionsList}>
                {MISSIONS_LIST.map((mission) => {
                  const reqCar = getCarById(mission.carId);
                  return (
                    <View key={mission.id} style={styles.missionCard}>
                      <View style={styles.missionCardLeft}>
                        <View style={styles.missionHeaderRow}>
                          <Text style={styles.missionCardTitle}>{mission.title}</Text>
                          <View style={styles.missionTypeBadge}>
                            <Text style={styles.missionTypeText}>
                              {mission.type.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.missionCardSub}>{mission.subtitle}</Text>
                        <Text style={styles.missionCardDesc}>{mission.description}</Text>

                        <View style={styles.missionRewardsRow}>
                          <View style={styles.rewardItem}>
                            <FontAwesome5 name="coins" size={11} color="#f59e0b" />
                            <Text style={styles.rewardText}>+{mission.rewardCash.toLocaleString()} EGP</Text>
                          </View>
                          <View style={styles.rewardItem}>
                            <Ionicons name="star" size={12} color="#00f0ff" />
                            <Text style={styles.rewardText}>+{mission.rewardXp} XP</Text>
                          </View>
                          {mission.timeLimitSec > 0 && (
                            <View style={styles.rewardItem}>
                              <Ionicons name="timer-outline" size={12} color="#94a3b8" />
                              <Text style={styles.rewardText}>{mission.timeLimitSec}s TIME LIMIT</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.missionStartBtn}
                        onPress={() => {
                          if (mission.carId !== 'any') {
                            selectCar(mission.carId);
                          }
                          handleStartDriving(mission.id);
                        }}
                      >
                        <LinearGradient
                          colors={['#00f0ff', '#0284c7']}
                          style={styles.missionStartGradient}
                        >
                          <Text style={styles.missionStartBtnText}>ACCEPT & DRIVE</Text>
                          <Ionicons name="arrow-forward" size={16} color="#030712" />
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* SETTINGS MODAL */}
      <Modal visible={showSettingsModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.settingsModalBox}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="settings-sharp" size={22} color="#00f0ff" />
                <Text style={styles.modalTitle}>CONTROLS & LOBBY SETTINGS</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowSettingsModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#cbd5e1" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Steering Mode Picker */}
              <Text style={styles.configSectionTitle}>PRIMARY STEERING CONTROL MODE</Text>
              <View style={styles.steeringModeRow}>
                {[
                  {
                    id: 'wheel' as SteeringControlMode,
                    title: 'STEERING WHEEL',
                    desc: 'Interactive rotating draggable wheel with auto-centering',
                    icon: 'steering',
                  },
                  {
                    id: 'tilt' as SteeringControlMode,
                    title: 'PHONE TILT / GYRO',
                    desc: 'Smooth accelerometer landscape tilting',
                    icon: 'screen-rotation',
                  },
                  {
                    id: 'arrows' as SteeringControlMode,
                    title: 'TOUCH ARROWS',
                    desc: 'Dual left/right directional touch buttons',
                    icon: 'swap-horizontal',
                  },
                ].map((mode) => {
                  const isSelected = settings.steeringMode === mode.id;
                  return (
                    <TouchableOpacity
                      key={mode.id}
                      style={[
                        styles.steeringOptionCard,
                        isSelected && styles.steeringOptionCardSelected,
                      ]}
                      onPress={() => {
                        updateSettings({ steeringMode: mode.id });
                        soundEngine.playTurnSignal();
                      }}
                    >
                      <MaterialCommunityIcons
                        name={mode.icon as any}
                        size={28}
                        color={isSelected ? '#00f0ff' : '#94a3b8'}
                      />
                      <Text
                        style={[
                          styles.steeringOptionTitle,
                          isSelected && styles.steeringOptionTitleSelected,
                        ]}
                      >
                        {mode.title}
                      </Text>
                      <Text style={styles.steeringOptionDesc}>{mode.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Tilt Sensitivity & Calibration */}
              {settings.steeringMode === 'tilt' && (
                <View style={styles.tiltCalibrationBox}>
                  <Text style={styles.configSectionTitle}>GYROSCOPE CALIBRATION</Text>
                  <View style={styles.tiltActionsRow}>
                    <TouchableOpacity
                      style={styles.calibrateBtn}
                      onPress={() => {
                        updateSettings({ tiltCalibratedOffset: 0 });
                        soundEngine.playGearShift();
                      }}
                    >
                      <Ionicons name="refresh" size={16} color="#00f0ff" />
                      <Text style={styles.calibrateBtnText}>CALIBRATE HORIZONTAL CENTER</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Sound Volume Sliders */}
              <Text style={styles.configSectionTitle}>MASTER AUDIO VOLUME</Text>
              <View style={styles.volumeRow}>
                {[0.2, 0.5, 0.8, 1.0].map((vol) => {
                  const isSelected = settings.soundVolume === vol;
                  return (
                    <TouchableOpacity
                      key={vol}
                      style={[
                        styles.volBtn,
                        isSelected && styles.volBtnSelected,
                      ]}
                      onPress={() => {
                        updateSettings({ soundVolume: vol });
                        soundEngine.setVolume(vol);
                        soundEngine.playTurnSignal();
                      }}
                    >
                      <Text
                        style={[
                          styles.volBtnText,
                          isSelected && styles.volBtnTextSelected,
                        ]}
                      >
                        {Math.round(vol * 100)}%
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Game Version & Updates Section */}
              <Text style={styles.configSectionTitle}>GAME VERSION & OVER-THE-AIR UPDATES</Text>
              <View style={styles.updateSettingsCard}>
                <View style={styles.updateVersionRow}>
                  <View>
                    <Text style={styles.updateVersionTitle}>LIFE ON WHEELS 3D</Text>
                    <Text style={styles.updateVersionSub}>Current Installed: v{updateService.getCurrentVersion()}</Text>
                  </View>
                  <View style={styles.otaBadge}>
                    <View style={styles.greenDot} />
                    <Text style={styles.otaBadgeText}>OTA AUTO-UPDATES READY</Text>
                  </View>
                </View>

                {updateStatusMsg ? (
                  <Text style={styles.updateStatusText}>{updateStatusMsg}</Text>
                ) : null}

                <View style={styles.updateActionButtonsRow}>
                  <TouchableOpacity
                    style={styles.checkUpdateBtn}
                    onPress={handleManualCheckUpdates}
                  >
                    <Ionicons name="refresh" size={16} color="#00f0ff" />
                    <Text style={styles.checkUpdateBtnText}>CHECK FOR UPDATES</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.mediafireBtn}
                    onPress={handleDownloadApkMediafire}
                  >
                    <Ionicons name="download-outline" size={16} color="#f59e0b" />
                    <Text style={styles.mediafireBtnText}>DOWNLOAD APK (MEDIAFIRE)</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* UPDATE MODAL */}
      <Modal visible={showUpdateModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.updateModalBox}>
            <View style={styles.updateModalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="cloud-download" size={24} color="#00f0ff" />
                <Text style={styles.modalTitle}>NEW UPDATE AVAILABLE</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowUpdateModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#cbd5e1" />
              </TouchableOpacity>
            </View>

            <View style={styles.updateModalBody}>
              {/* Version Comparison */}
              <View style={styles.versionCompareRow}>
                <View style={styles.verBadge}>
                  <Text style={styles.verBadgeLabel}>CURRENT</Text>
                  <Text style={styles.verBadgeVal}>v{updateInfo?.currentVersion || '1.0.0'}</Text>
                </View>

                <Ionicons name="arrow-forward" size={20} color="#00f0ff" />

                <View style={[styles.verBadge, styles.verBadgeNew]}>
                  <Text style={styles.verBadgeLabel}>LATEST</Text>
                  <Text style={styles.verBadgeValNew}>v{updateInfo?.latestVersion || '1.1.0'}</Text>
                </View>
              </View>

              {/* Changelog */}
              <Text style={styles.changelogTitle}>WHAT'S NEW IN THIS UPDATE:</Text>
              <ScrollView style={styles.changelogScroll}>
                {(updateInfo?.changelog && updateInfo.changelog.length > 0
                  ? updateInfo.changelog
                  : [
                      'Brand new features & vehicle physics updates',
                      'Improved 3D realistic graphics & lighting',
                      'Engine sound & performance optimizations',
                      'Over-the-Air hot-patching without app reinstallation',
                    ]
                ).map((item, i) => (
                  <View key={i} style={styles.changelogItem}>
                    <Ionicons name="checkmark-circle" size={14} color="#00f0ff" />
                    <Text style={styles.changelogText}>{item}</Text>
                  </View>
                ))}
              </ScrollView>

              {/* Progress Bar (if downloading) */}
              {isUpdatingOta && (
                <View style={styles.updateProgressContainer}>
                  <Text style={styles.updateProgressText}>
                    Downloading & applying update... {updateProgress}%
                  </Text>
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${updateProgress}%` },
                      ]}
                    />
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.updateButtonsRow}>
                <TouchableOpacity
                  style={styles.applyOtaBtn}
                  onPress={handleApplyOtaUpdate}
                  disabled={isUpdatingOta}
                >
                  <LinearGradient
                    colors={['#00f0ff', '#0284c7']}
                    style={styles.applyOtaGradient}
                  >
                    <Ionicons name="flash" size={18} color="#030712" />
                    <Text style={styles.applyOtaText}>
                      {isUpdatingOta
                        ? 'UPDATING...'
                        : 'UPDATE NOW (WITHOUT REINSTALL)'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.downloadApkFullBtn}
                  onPress={handleDownloadApkMediafire}
                >
                  <Ionicons name="logo-android" size={18} color="#10b981" />
                  <Text style={styles.downloadApkFullText}>
                    DOWNLOAD FULL APK (MEDIAFIRE)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070b14',
  },
  topBar: {
    position: 'absolute',
    top: 10,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 10,
  },
  topLeft: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  navRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    padding: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  navTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  navTabActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.4)',
  },
  navTabText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  navTabTextActive: {
    color: '#00f0ff',
    fontWeight: '800',
  },
  topRight: {
    alignItems: 'flex-end',
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.25)',
    gap: 10,
  },
  avatarMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(2, 6, 23, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#00f0ff',
  },
  profileInfo: {
    width: 90,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userNameText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  levelPill: {
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  levelPillText: {
    color: '#00f0ff',
    fontSize: 9,
    fontWeight: '800',
  },
  xpTrack: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: '#00f0ff',
  },
  currencyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 6, 23, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  currencyText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '800',
  },
  serverStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  greenPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  serverStatusText: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  settingsIconBtn: {
    padding: 4,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    zIndex: 10,
  },
  bottomLeft: {
    width: '26%',
  },
  serverHubWidget: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.2)',
  },
  serverHubHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  serverHubTitle: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  activeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  greenDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10b981',
  },
  activeTagText: {
    color: '#10b981',
    fontSize: 8,
    fontWeight: '800',
  },
  serverDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  serverDetailLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '600',
  },
  serverDetailValue: {
    color: '#00f0ff',
    fontSize: 10,
    fontWeight: '800',
  },
  serverDivider: {
    color: '#475569',
    fontSize: 9,
  },
  playerCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 5,
  },
  playerCountText: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '700',
  },
  pingSmall: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: '700',
  },
  bottomCenter: {
    width: '42%',
    alignItems: 'center',
  },
  carouselContainer: {
    gap: 8,
    paddingHorizontal: 4,
  },
  carCard: {
    width: 145,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  carCardSelected: {
    borderColor: '#00f0ff',
    transform: [{ scale: 1.04 }],
  },
  carCardGradient: {
    padding: 8,
  },
  carCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  carCardNumber: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
  },
  carCardNumberSelected: {
    color: '#00f0ff',
  },
  carCardName: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  carCardNameSelected: {
    color: '#ffffff',
    fontWeight: '800',
  },
  carSpecsMini: {
    flexDirection: 'row',
    gap: 4,
  },
  miniSpecTag: {
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: '600',
    backgroundColor: 'rgba(2, 6, 23, 0.7)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  selectedRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  selectedRibbonText: {
    color: '#00f0ff',
    fontSize: 8,
    fontWeight: '800',
  },
  bottomRight: {
    width: '30%',
    alignItems: 'flex-end',
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  secondaryBtnText: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '700',
  },
  primaryDriveCta: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  primaryDriveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryDriveText: {
    color: '#030712',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  garageModalBox: {
    width: '85%',
    maxHeight: '90%',
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.3)',
    overflow: 'hidden',
  },
  missionsModalBox: {
    width: '85%',
    maxHeight: '90%',
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.3)',
    overflow: 'hidden',
  },
  settingsModalBox: {
    width: '78%',
    maxHeight: '88%',
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.3)',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  garageCarBanner: {
    backgroundColor: 'rgba(2, 6, 23, 0.7)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  garageCarName: {
    color: '#00f0ff',
    fontSize: 16,
    fontWeight: '900',
  },
  garageCarTagline: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
    marginBottom: 8,
  },
  garageStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    alignItems: 'center',
  },
  statLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '700',
  },
  statValue: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  configSectionTitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 10,
    marginBottom: 8,
  },
  colorPaletteScroll: {
    marginBottom: 10,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderColor: '#00f0ff',
    transform: [{ scale: 1.15 }],
  },
  neonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(2, 6, 23, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  neonPillSelected: {
    borderColor: '#00f0ff',
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
  },
  neonDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  neonPillText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.7)',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  presetBtnSelected: {
    borderColor: '#00f0ff',
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
  },
  presetBtnText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
  },
  presetBtnTextSelected: {
    color: '#00f0ff',
    fontWeight: '800',
  },
  missionsList: {
    gap: 10,
  },
  missionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 6, 23, 0.8)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  missionCardLeft: {
    flex: 1,
    marginRight: 12,
  },
  missionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  missionCardTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  missionTypeBadge: {
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  missionTypeText: {
    color: '#00f0ff',
    fontSize: 8,
    fontWeight: '800',
  },
  missionCardSub: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  missionCardDesc: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 4,
    lineHeight: 14,
  },
  missionRewardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rewardText: {
    color: '#e2e8f0',
    fontSize: 10,
    fontWeight: '700',
  },
  missionStartBtn: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  missionStartGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  missionStartBtnText: {
    color: '#030712',
    fontSize: 11,
    fontWeight: '900',
  },
  steeringModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  steeringOptionCard: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.8)',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  steeringOptionCardSelected: {
    borderColor: '#00f0ff',
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
  },
  steeringOptionTitle: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 6,
  },
  steeringOptionTitleSelected: {
    color: '#00f0ff',
  },
  steeringOptionDesc: {
    color: '#64748b',
    fontSize: 8,
    textAlign: 'center',
    marginTop: 4,
  },
  tiltCalibrationBox: {
    marginBottom: 12,
  },
  tiltActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  calibrateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.3)',
  },
  calibrateBtnText: {
    color: '#00f0ff',
    fontSize: 10,
    fontWeight: '700',
  },
  volumeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  volBtn: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.8)',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  volBtnSelected: {
    borderColor: '#00f0ff',
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
  },
  volBtnText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  volBtnTextSelected: {
    color: '#00f0ff',
    fontWeight: '800',
  },
  updateAvailableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  updateAvailableText: {
    color: '#f59e0b',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  updateSettingsCard: {
    backgroundColor: 'rgba(2, 6, 23, 0.8)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.25)',
    marginBottom: 10,
  },
  updateVersionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  updateVersionTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  updateVersionSub: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2,
  },
  otaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  otaBadgeText: {
    color: '#10b981',
    fontSize: 8,
    fontWeight: '800',
  },
  updateStatusText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 8,
  },
  updateActionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  checkUpdateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.4)',
  },
  checkUpdateBtnText: {
    color: '#00f0ff',
    fontSize: 10,
    fontWeight: '800',
  },
  mediafireBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  mediafireBtnText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '800',
  },
  updateModalBox: {
    width: '68%',
    maxWidth: 540,
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 240, 255, 0.4)',
    overflow: 'hidden',
  },
  updateModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  updateModalBody: {
    padding: 16,
  },
  versionCompareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(2, 6, 23, 0.7)',
    paddingVertical: 8,
    borderRadius: 10,
  },
  verBadge: {
    alignItems: 'center',
  },
  verBadgeNew: {},
  verBadgeLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
  },
  verBadgeVal: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '800',
  },
  verBadgeValNew: {
    color: '#00f0ff',
    fontSize: 15,
    fontWeight: '900',
  },
  changelogTitle: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  changelogScroll: {
    maxHeight: 90,
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  changelogItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  changelogText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
    flex: 1,
  },
  updateProgressContainer: {
    marginBottom: 10,
  },
  updateProgressText: {
    color: '#00f0ff',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00f0ff',
  },
  updateButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  applyOtaBtn: {
    flex: 1.2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  applyOtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  applyOtaText: {
    color: '#030712',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  downloadApkFullBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  downloadApkFullText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '800',
  },
});
