import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  Dimensions,
  Platform,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import * as THREE from 'three';

import { CarCanvas } from '../src/components/3d/CarCanvas';
import { createCar3D, Car3DObject } from '../src/components/3d/ProceduralCars';
import { createCityEnvironment, CityEnvironment } from '../src/components/3d/CityEnvironment';
import { getCarById } from '../src/resources/carRegistry';
import { useGameStore } from '../src/store/gameStore';
import { soundEngine } from '../src/audio/SoundEngine';
import { missionManager } from '../src/missions/MissionManager';
import { CameraViewMode, SteeringControlMode } from '../src/types';

export default function DriveScreen() {
  const router = useRouter();

  // Zustand State
  const profile = useGameStore((state) => state.profile);
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

  // 3D Scene Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const car3DRef = useRef<Car3DObject | null>(null);
  const cityEnvRef = useRef<CityEnvironment | null>(null);

  // Vehicle Simulation Physics State (Ref for 60fps loop)
  const physicsRef = useRef({
    posX: 0,
    posZ: 0,
    yaw: 0, // vehicle heading in radians
    speedKmh: 0,
    rpm: 850,
    gear: 1,
    throttle: 0,
    brake: 0,
    handbrake: false,
    steeringAngle: 0, // -1 (left) to 1 (right)
    driftAngle: 0,
    isDrifting: false,
    driftPoints: 0,
    cameraMode: 'chase' as CameraViewMode,
    headlightsOn: true,
    hazardsOn: false,
  });

  // UI Mirror State for HUD
  const [hudSpeed, setHudSpeed] = useState(0);
  const [hudRpm, setHudRpm] = useState(850);
  const [hudGear, setHudGear] = useState('1');
  const [hudDriftPoints, setHudDriftPoints] = useState(0);
  const [hudIsDrifting, setHudIsDrifting] = useState(false);
  const [hudHeadlights, setHudHeadlights] = useState(true);
  const [hudHazards, setHudHazards] = useState(false);
  const [hudCameraView, setHudCameraView] = useState<CameraViewMode>('chase');
  const [isPaused, setIsPaused] = useState(false);
  const [activeSteeringMode, setActiveSteeringMode] = useState<SteeringControlMode>(
    settings.steeringMode
  );

  // Mission State
  const activeMission = missionManager.getCurrentMission();
  const [missionTime, setMissionTime] = useState(
    activeMission ? activeMission.timeLimitSec : 0
  );
  const [missionScore, setMissionScore] = useState(0);
  const [missionCompleted, setMissionCompleted] = useState(false);

  // Controls input refs
  const throttlePressed = useRef(false);
  const brakePressed = useRef(false);
  const handbrakePressed = useRef(false);
  const steerLeftPressed = useRef(false);
  const steerRightPressed = useRef(false);

  // On-screen steering wheel rotation
  const wheelRotationDeg = useRef(0);
  const wheelTouchCenter = useRef<{ x: number; y: number }>({ x: 100, y: 100 });

  // Steering wheel PanResponder
  const wheelPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        // center of the 140x140 steering wheel
        wheelTouchCenter.current = {
          x: evt.nativeEvent.pageX,
          y: evt.nativeEvent.pageY,
        };
      },
      onPanResponderMove: (evt) => {
        const dx = evt.nativeEvent.pageX - wheelTouchCenter.current.x;
        // Map horizontal drag to degrees (up to +/- 180 deg)
        const angle = Math.max(-180, Math.min(180, dx * 1.5));
        wheelRotationDeg.current = angle;
        physicsRef.current.steeringAngle = angle / 180;
      },
      onPanResponderRelease: () => {
        // Will spring back to center in update loop
      },
      onPanResponderTerminate: () => {},
    })
  ).current;

  // Accelerometer subscription for Phone Tilt Steering
  useEffect(() => {
    let sub: any = null;
    if (activeSteeringMode === 'tilt') {
      Accelerometer.setUpdateInterval(30);
      sub = Accelerometer.addListener((data) => {
        if (physicsRef.current) {
          // In Landscape orientation: Y-axis or X-axis represents roll
          const rawTilt = Platform.OS === 'android' ? -data.y : data.y;
          const adjustedTilt =
            (rawTilt - (settings.tiltCalibratedOffset || 0)) *
            (settings.tiltSensitivity || 1.4);
          const clampedSteer = Math.max(-1, Math.min(1, adjustedTilt));
          physicsRef.current.steeringAngle = clampedSteer;
        }
      });
    }

    return () => {
      if (sub) sub.remove();
    };
  }, [activeSteeringMode, settings.tiltCalibratedOffset, settings.tiltSensitivity]);

  // Sound Engine Startup
  useEffect(() => {
    soundEngine.startEngine(selectedCarSpec.soundProfile);

    return () => {
      soundEngine.stopEngine();
      soundEngine.stopTireScreech();
    };
  }, [selectedCarSpec.soundProfile]);

  // Scene Ready Callback
  const handleSceneReady = (
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer
  ) => {
    sceneRef.current = scene;
    cameraRef.current = camera;

    // Ambient Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    // Directional Sunlight / Moon Night Light
    const sunLight = new THREE.DirectionalLight(0xe2e8f0, 1.8);
    sunLight.position.set(40, 60, 30);
    sunLight.castShadow = true;
    scene.add(sunLight);

    // City Environment
    const cityEnv = createCityEnvironment();
    scene.add(cityEnv.group);
    cityEnvRef.current = cityEnv;

    // Build and spawn vehicle
    const car3D = createCar3D(selectedCarSpec, currentCustomization);
    scene.add(car3D.group);
    car3DRef.current = car3D;
  };

  // Main 60 FPS Physics & Simulation Loop
  const handleFrame = (time: number, delta: number) => {
    if (isPaused) return;
    const p = physicsRef.current;
    const clampedDelta = Math.min(0.05, delta);

    // 1. Process Steering Input
    if (activeSteeringMode === 'arrows') {
      const targetSteer = steerLeftPressed.current
        ? -1
        : steerRightPressed.current
        ? 1
        : 0;
      p.steeringAngle += (targetSteer - p.steeringAngle) * clampedDelta * 10;
    } else if (activeSteeringMode === 'wheel') {
      // Spring return to center if not touching
      if (!steerLeftPressed.current && !steerRightPressed.current) {
        wheelRotationDeg.current += (0 - wheelRotationDeg.current) * clampedDelta * 12;
        p.steeringAngle = wheelRotationDeg.current / 180;
      }
    }

    // 2. Throttle & Braking
    p.throttle = throttlePressed.current ? 1.0 : 0;
    p.brake = brakePressed.current ? 1.0 : 0;
    p.handbrake = handbrakePressed.current;

    // 3. Engine Dynamics & Speed Calculation
    const maxSpeed = selectedCarSpec.topSpeedKmh;
    const accelRate = (100 / selectedCarSpec.acceleration0to100) * 1.8; // km/h per sec
    const brakeDecel = 65; // km/h per sec
    const frictionDecel = 8; // coasting drag

    if (p.throttle > 0 && !p.handbrake) {
      if (p.gear > 0) {
        p.speedKmh = Math.min(maxSpeed, p.speedKmh + accelRate * clampedDelta);
      } else if (p.gear === -1) {
        // Reverse
        p.speedKmh = Math.max(-45, p.speedKmh - accelRate * 0.5 * clampedDelta);
      }
    } else if (p.brake > 0) {
      if (p.speedKmh > 1) {
        p.speedKmh = Math.max(0, p.speedKmh - brakeDecel * clampedDelta);
      } else if (p.speedKmh < -1) {
        p.speedKmh = Math.min(0, p.speedKmh + brakeDecel * clampedDelta);
      } else {
        // Switch to Reverse when stopped and holding brake
        p.gear = -1;
        p.speedKmh = Math.max(-35, p.speedKmh - 15 * clampedDelta);
      }
    } else {
      // Natural rolling resistance friction
      if (p.speedKmh > 0) {
        p.speedKmh = Math.max(0, p.speedKmh - frictionDecel * clampedDelta);
      } else if (p.speedKmh < 0) {
        p.speedKmh = Math.min(0, p.speedKmh + frictionDecel * clampedDelta);
      }
    }

    // Handbrake Drifting & Friction
    if (p.handbrake) {
      p.speedKmh = Math.max(0, p.speedKmh - brakeDecel * 0.8 * clampedDelta);
    }

    // 4. Automatic Gear Shifting & Live RPM
    const currentSpeedAbs = Math.abs(p.speedKmh);
    if (settings.transmissionMode === 'auto') {
      if (p.gear > 0) {
        if (currentSpeedAbs > 140 && p.gear < 5) {
          p.gear = 5;
          soundEngine.playGearShift();
        } else if (currentSpeedAbs > 105 && p.gear < 4) {
          p.gear = 4;
          soundEngine.playGearShift();
        } else if (currentSpeedAbs > 70 && p.gear < 3) {
          p.gear = 3;
          soundEngine.playGearShift();
        } else if (currentSpeedAbs > 35 && p.gear < 2) {
          p.gear = 2;
          soundEngine.playGearShift();
        } else if (currentSpeedAbs < 25 && p.gear > 1) {
          p.gear = 1;
          soundEngine.playGearShift();
        }
      }
    }

    // Calculate RPM based on gear ratio and speed
    const redline = selectedCarSpec.id === 'bmw_e30' ? 7200 : 6600;
    const idleRpm = 850;
    const gearFactor = Math.max(1, p.gear);
    const speedRatio = currentSpeedAbs / (maxSpeed / (6 - gearFactor));
    p.rpm = Math.min(
      redline,
      Math.max(idleRpm, idleRpm + speedRatio * (redline - idleRpm) + p.throttle * 300)
    );

    // Update sound engine pitch and throttle
    soundEngine.updateRPM(p.rpm, p.throttle, p.gear);

    // 5. Vehicle Turning & Drift Physics
    const speedMs = p.speedKmh / 3.6;
    const turnSensitivity = 1.6;
    const maxSteerAngleRad = 0.52; // ~30 deg
    const wheelSteerRad = p.steeringAngle * maxSteerAngleRad;

    // Detect Drift condition (Handbrake pulled or sharp turn at speed in RWD)
    const isRwd = selectedCarSpec.driveType === 'RWD';
    const driftCondition =
      (p.handbrake || (isRwd && p.throttle > 0.8 && Math.abs(p.steeringAngle) > 0.4)) &&
      currentSpeedAbs > 24;

    if (driftCondition) {
      p.isDrifting = true;
      p.driftAngle += (p.steeringAngle * 0.85 - p.driftAngle) * clampedDelta * 4;
      p.yaw += p.steeringAngle * turnSensitivity * 1.8 * clampedDelta;

      // Drift scoring
      const addedPoints = Math.floor(currentSpeedAbs * Math.abs(p.steeringAngle) * clampedDelta * 10);
      p.driftPoints += addedPoints;
      missionManager.addDriftPoints(addedPoints);

      // Tire screech sound
      soundEngine.playTireScreech(Math.min(1.0, currentSpeedAbs / 60));
    } else {
      if (p.isDrifting) {
        soundEngine.stopTireScreech();
      }
      p.isDrifting = false;
      p.driftAngle += (0 - p.driftAngle) * clampedDelta * 5;

      // Normal Ackermann steering turning
      if (Math.abs(currentSpeedAbs) > 0.5) {
        const turnRadius = 2.7 / Math.tan(Math.max(0.01, Math.abs(wheelSteerRad)));
        const angularVelocity = (speedMs / turnRadius) * Math.sign(wheelSteerRad);
        p.yaw += angularVelocity * clampedDelta * (p.gear >= 0 ? 1 : -1);
      }
    }

    // 6. Update Coordinates (X, Z)
    p.posX += Math.sin(p.yaw + p.driftAngle) * speedMs * clampedDelta;
    p.posZ += Math.cos(p.yaw + p.driftAngle) * speedMs * clampedDelta;

    // Loop road coordinate if far
    if (p.posZ < -380) p.posZ += 760;
    if (p.posZ > 380) p.posZ -= 760;

    // 7. Update 3D Mesh in Scene
    if (car3DRef.current) {
      const carGroup = car3DRef.current.group;
      carGroup.position.set(p.posX, 0, p.posZ);
      carGroup.rotation.y = p.yaw + p.driftAngle;

      // Steer front wheels & spin all wheels
      car3DRef.current.setSteeringAngle(-wheelSteerRad);
      car3DRef.current.spinWheels((speedMs / 0.35) * clampedDelta);
      car3DRef.current.setBraking(p.brake > 0 || p.handbrake);

      // Update 3D cockpit interior dashboard, moving needles, rotating wheel & gear stick
      car3DRef.current.updateCockpitTelemetry(p.speedKmh, p.rpm, p.gear, p.steeringAngle);
    }

    // 8. Update Camera Follow Logic
    if (cameraRef.current) {
      const cam = cameraRef.current;
      const yaw = p.yaw + p.driftAngle;

      switch (p.cameraMode) {
        case 'cockpit':
          // Authentic First-Person Driver POV (seated at driver position looking at dash, wheel & road)
          const driverLateralOffset = -0.38; // Left-hand drive seat
          const driverLongitudinalOffset = 0.04;
          const driverEyeHeight = 1.08;
          const cosY = Math.cos(yaw);
          const sinY = Math.sin(yaw);

          const eyeX = p.posX + cosY * driverLateralOffset + sinY * driverLongitudinalOffset;
          const eyeZ = p.posZ - sinY * driverLateralOffset + cosY * driverLongitudinalOffset;

          cam.position.set(eyeX, driverEyeHeight, eyeZ);
          cam.lookAt(
            eyeX + sinY * 22,
            driverEyeHeight - 0.14,
            eyeZ + cosY * 22
          );
          break;

        case 'hood':
          // Front hood cam
          cam.position.set(
            p.posX + Math.sin(yaw) * 1.5,
            0.85,
            p.posZ + Math.cos(yaw) * 1.5
          );
          cam.lookAt(
            p.posX + Math.sin(yaw) * 25,
            0.7,
            p.posZ + Math.cos(yaw) * 25
          );
          break;

        case 'orbit':
          // Far cinematic high orbit
          cam.position.set(
            p.posX - Math.sin(yaw) * 11,
            5.2,
            p.posZ - Math.cos(yaw) * 11
          );
          cam.lookAt(p.posX, 0.8, p.posZ);
          break;

        case 'chase':
        default:
          // Dynamic chase camera with speed lag
          const chaseDist = 6.2 + Math.min(3.0, currentSpeedAbs / 50);
          const chaseHeight = 2.4;
          const targetCamX = p.posX - Math.sin(yaw) * chaseDist;
          const targetCamZ = p.posZ - Math.cos(yaw) * chaseDist;

          cam.position.x += (targetCamX - cam.position.x) * clampedDelta * 8;
          cam.position.y += (chaseHeight - cam.position.y) * clampedDelta * 8;
          cam.position.z += (targetCamZ - cam.position.z) * clampedDelta * 8;
          cam.lookAt(p.posX, 0.9, p.posZ);
          break;
      }
    }

    // 9. Update City Environment, Traffic & Mission Checkpoints
    if (cityEnvRef.current) {
      cityEnvRef.current.updateAnimation(time, clampedDelta, p.posX, p.posZ, p.speedKmh);

      // Check Ambient Traffic Collision
      if (cityEnvRef.current.checkTrafficCollision(p.posX, p.posZ, 1.8)) {
        soundEngine.playCollision(0.85);
        if (Platform.OS !== 'web') {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          } catch {}
        }
        p.speedKmh = Math.max(0, p.speedKmh * 0.45);
        p.driftPoints = 0;
      }

      const activeCp = missionManager.getActiveCheckpoint();
      if (activeCp) {
        cityEnvRef.current.setCheckpointPosition(activeCp.x, activeCp.z, true);
        const hit = missionManager.checkCheckpointHit(p.posX, p.posZ);
        if (hit) {
          soundEngine.playTurnSignal();
          if (Platform.OS !== 'web') {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {}
          }
        }
      } else {
        cityEnvRef.current.setCheckpointPosition(0, 0, false);
      }
    }

    // 10. Mission Timer Tick
    missionManager.tickTimer(clampedDelta);

    // 11. Mirror to UI HUD state at ~20fps
    if (Math.floor(time * 20) % 2 === 0) {
      setHudSpeed(Math.round(currentSpeedAbs));
      setHudRpm(Math.round(p.rpm));
      setHudGear(p.gear === -1 ? 'R' : p.gear === 0 ? 'N' : `${p.gear}`);
      setHudDriftPoints(p.driftPoints);
      setHudIsDrifting(p.isDrifting);
      setMissionTime(Math.round(missionManager.getRemainingTime()));
      setMissionScore(missionManager.getScore());
    }
  };

  const handleToggleHeadlights = () => {
    physicsRef.current.headlightsOn = !physicsRef.current.headlightsOn;
    setHudHeadlights(physicsRef.current.headlightsOn);
    if (car3DRef.current) {
      car3DRef.current.setHeadlights(physicsRef.current.headlightsOn);
    }
    soundEngine.playTurnSignal();
  };

  const handleToggleHazards = () => {
    physicsRef.current.hazardsOn = !physicsRef.current.hazardsOn;
    setHudHazards(physicsRef.current.hazardsOn);
    if (car3DRef.current) {
      car3DRef.current.setHazards(physicsRef.current.hazardsOn);
    }
    soundEngine.playTurnSignal();
  };

  const handleHonkHorn = () => {
    soundEngine.playHorn();
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch {}
    }

    // High Beam Strobe ("رعاش النور العالي مع الكلاكس")
    if (car3DRef.current) {
      const initialHeadlights = physicsRef.current.headlightsOn;
      const strobeTimers = [0, 75, 150, 225, 300];
      strobeTimers.forEach((delay, idx) => {
        setTimeout(() => {
          if (car3DRef.current) {
            const isStrobeOn = idx % 2 === 0;
            car3DRef.current.setHeadlights(isStrobeOn);
          }
        }, delay);
      });
      // Restore state after strobe completes
      setTimeout(() => {
        if (car3DRef.current) {
          car3DRef.current.setHeadlights(initialHeadlights);
        }
      }, 400);
    }

    // Alert ambient traffic cars ahead to yield lane
    if (cityEnvRef.current) {
      cityEnvRef.current.onPlayerHorn(physicsRef.current.posX, physicsRef.current.posZ);
    }
  };

  const handleCycleCamera = () => {
    const modes: CameraViewMode[] = ['chase', 'cockpit', 'hood', 'orbit'];
    const nextIdx = (modes.indexOf(physicsRef.current.cameraMode) + 1) % modes.length;
    physicsRef.current.cameraMode = modes[nextIdx];
    setHudCameraView(modes[nextIdx]);
    soundEngine.playTurnSignal();
  };

  const handleShiftGear = (dir: 'up' | 'down') => {
    const p = physicsRef.current;
    if (dir === 'up' && p.gear < 5) {
      p.gear += 1;
      soundEngine.playGearShift();
    } else if (dir === 'down' && p.gear > -1) {
      p.gear -= 1;
      soundEngine.playGearShift();
    }
  };

  const handleExitToLobby = () => {
    soundEngine.stopEngine();
    soundEngine.stopTireScreech();
    router.replace('/lobby');
  };

  return (
    <View style={styles.container}>
      {/* 3D Simulation Canvas */}
      <View style={StyleSheet.absoluteFill}>
        <CarCanvas
          onSceneReady={handleSceneReady}
          onFrame={handleFrame}
          enableTouchOrbit={false}
        />
      </View>

      {/* TOP HUD BAR */}
      <View style={styles.topHud}>
        {/* Top Left: Pause / Exit & Car Badge */}
        <View style={styles.topHudLeft}>
          <TouchableOpacity
            style={styles.hudIconBtn}
            onPress={() => setIsPaused(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="pause" size={18} color="#00f0ff" />
          </TouchableOpacity>

          <View style={styles.carHudBadge}>
            <Text style={styles.carHudBadgeName}>{selectedCarSpec.name}</Text>
            <Text style={styles.carHudBadgeDrive}>{selectedCarSpec.driveType} • {selectedCarSpec.transmission}</Text>
          </View>
        </View>

        {/* Top Center: Mission Objective / GPS Arrow */}
        <View style={styles.topHudCenter}>
          {activeMission && (
            <View style={styles.missionHudBox}>
              <View style={styles.missionTitleRow}>
                <Ionicons name="navigate-circle" size={16} color="#00f0ff" />
                <Text style={styles.missionHudTitle}>{activeMission.title}</Text>
              </View>

              <View style={styles.missionStatusRow}>
                {activeMission.timeLimitSec > 0 && (
                  <View style={styles.timerPill}>
                    <Ionicons name="timer-outline" size={12} color="#f59e0b" />
                    <Text style={styles.timerText}>{missionTime}s</Text>
                  </View>
                )}

                {activeMission.type === 'drift' && (
                  <View style={styles.scorePill}>
                    <Ionicons name="flame" size={12} color="#ef4444" />
                    <Text style={styles.scoreText}>
                      {missionScore} / {activeMission.targetScore} PTS
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Drift Banner Popup */}
          {hudIsDrifting && (
            <View style={styles.driftAlertBox}>
              <Text style={styles.driftAlertText}>DRIFTING! +{hudDriftPoints} PTS</Text>
            </View>
          )}
        </View>

        {/* Top Right: Camera View Toggle, Lights, Horn */}
        <View style={styles.topHudRight}>
          <TouchableOpacity
            style={[styles.hudIconBtn, hudHeadlights && styles.hudIconBtnActive]}
            onPress={handleToggleHeadlights}
          >
            <MaterialCommunityIcons
              name="car-light-high"
              size={18}
              color={hudHeadlights ? '#00f0ff' : '#94a3b8'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.hudIconBtn, hudHazards && styles.hudIconBtnActive]}
            onPress={handleToggleHazards}
          >
            <Ionicons
              name="warning-outline"
              size={18}
              color={hudHazards ? '#f59e0b' : '#94a3b8'}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.hudIconBtn} onPress={handleHonkHorn}>
            <MaterialCommunityIcons name="bullhorn-outline" size={18} color="#cbd5e1" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.hudCameraBtn, styles.hudIconBtnActive]}
            onPress={handleCycleCamera}
          >
            <Ionicons name="videocam" size={16} color="#00f0ff" />
            <Text style={styles.cameraBtnText}>{hudCameraView.toUpperCase()}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* TACHOMETER & SPEEDOMETER CLUSTER (CENTER HUD) */}
      <View style={styles.clusterContainer} pointerEvents="none">
        <View style={styles.clusterGlass}>
          {/* Live Speed */}
          <Text style={styles.speedDigital}>{hudSpeed}</Text>
          <Text style={styles.speedUnit}>KM/H</Text>

          {/* Current Gear */}
          <View style={styles.gearBox}>
            <Text style={styles.gearText}>{hudGear}</Text>
          </View>

          {/* RPM Bar */}
          <View style={styles.rpmTrack}>
            <View
              style={[
                styles.rpmFill,
                {
                  width: `${Math.min(100, (hudRpm / 7200) * 100)}%`,
                  backgroundColor: hudRpm > 5800 ? '#ef4444' : '#00f0ff',
                },
              ]}
            />
          </View>
          <Text style={styles.rpmDigital}>{hudRpm} RPM</Text>
        </View>
      </View>

      {/* BOTTOM CONTROLS ROW */}
      <View style={styles.bottomControlsRow}>
        {/* Left Side: Steering Controls */}
        <View style={styles.leftSteeringArea}>
          {activeSteeringMode === 'wheel' && (
            <View
              style={styles.steeringWheelBox}
              {...wheelPanResponder.panHandlers}
            >
              <View
                style={[
                  styles.steeringWheelCircle,
                  { transform: [{ rotate: `${wheelRotationDeg.current}deg` }] },
                ]}
              >
                {/* 3 Wheel Spokes */}
                <View style={styles.wheelSpokeHoriz} />
                <View style={styles.wheelSpokeVert} />
                {/* Center Hub */}
                <View style={styles.wheelCenterHub}>
                  <Text style={styles.wheelBrandText}>{selectedCarSpec.brand}</Text>
                </View>
              </View>
            </View>
          )}

          {activeSteeringMode === 'arrows' && (
            <View style={styles.arrowsRow}>
              <TouchableOpacity
                style={styles.arrowBtn}
                onPressIn={() => (steerLeftPressed.current = true)}
                onPressOut={() => (steerLeftPressed.current = false)}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={36} color="#00f0ff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.arrowBtn}
                onPressIn={() => (steerRightPressed.current = true)}
                onPressOut={() => (steerRightPressed.current = false)}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-forward" size={36} color="#00f0ff" />
              </TouchableOpacity>
            </View>
          )}

          {activeSteeringMode === 'tilt' && (
            <View style={styles.tiltNoticeBox}>
              <MaterialCommunityIcons name="screen-rotation" size={24} color="#00f0ff" />
              <Text style={styles.tiltNoticeText}>TILT PHONE TO STEER</Text>
              <TouchableOpacity
                style={styles.quickCalibrateBtn}
                onPress={() => {
                  updateSettings({ tiltCalibratedOffset: 0 });
                  soundEngine.playTurnSignal();
                }}
              >
                <Text style={styles.quickCalibrateText}>CALIBRATE CENTER</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Quick Steering Mode Switcher */}
          <TouchableOpacity
            style={styles.modePill}
            onPress={() => {
              const modes: SteeringControlMode[] = ['wheel', 'tilt', 'arrows'];
              const next = modes[(modes.indexOf(activeSteeringMode) + 1) % modes.length];
              setActiveSteeringMode(next);
              soundEngine.playTurnSignal();
            }}
          >
            <MaterialCommunityIcons name="steering" size={14} color="#00f0ff" />
            <Text style={styles.modePillText}>{activeSteeringMode.toUpperCase()}</Text>
          </TouchableOpacity>
        </View>

        {/* Right Side: Handbrake, Brake, Gas Pedal */}
        <View style={styles.rightPedalArea}>
          {/* Handbrake E-Brake Button */}
          <TouchableOpacity
            style={styles.handbrakeBtn}
            onPressIn={() => {
              handbrakePressed.current = true;
              soundEngine.playHandbrake();
            }}
            onPressOut={() => (handbrakePressed.current = false)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="car-brake-alert" size={24} color="#f59e0b" />
            <Text style={styles.handbrakeText}>E-BRAKE</Text>
          </TouchableOpacity>

          {/* Foot Brake / Reverse Pedal */}
          <TouchableOpacity
            style={styles.brakePedal}
            onPressIn={() => (brakePressed.current = true)}
            onPressOut={() => (brakePressed.current = false)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#ef4444', '#b91c1c']}
              style={styles.pedalGradient}
            >
              <Text style={styles.pedalText}>BRAKE</Text>
              <Text style={styles.pedalSubText}>REV</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Gas Accelerator Pedal */}
          <TouchableOpacity
            style={styles.gasPedal}
            onPressIn={() => (throttlePressed.current = true)}
            onPressOut={() => (throttlePressed.current = false)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#00f0ff', '#0284c7']}
              style={styles.pedalGradient}
            >
              <Text style={styles.pedalTextGas}>GAS</Text>
              <Ionicons name="speedometer" size={18} color="#030712" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* PAUSE MODAL */}
      <Modal visible={isPaused} transparent animationType="fade">
        <View style={styles.pauseBackdrop}>
          <View style={styles.pauseBox}>
            <Text style={styles.pauseTitle}>GAME PAUSED</Text>
            <Text style={styles.pauseSubTitle}>{selectedCarSpec.name}</Text>

            <View style={styles.pauseStats}>
              <Text style={styles.pauseStatRow}>TOP SPEED: {selectedCarSpec.topSpeedKmh} KM/H</Text>
              <Text style={styles.pauseStatRow}>DRIFT POINTS: {hudDriftPoints}</Text>
            </View>

            <TouchableOpacity
              style={styles.pauseBtnPrimary}
              onPress={() => setIsPaused(false)}
            >
              <Text style={styles.pauseBtnPrimaryText}>RESUME DRIVING</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pauseBtnSecondary}
              onPress={handleExitToLobby}
            >
              <Text style={styles.pauseBtnSecondaryText}>RETURN TO LOBBY</Text>
            </TouchableOpacity>
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
  topHud: {
    position: 'absolute',
    top: 10,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 10,
  },
  topHudLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hudIconBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  hudIconBtnActive: {
    borderColor: '#00f0ff',
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
  },
  hudCameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 8,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cameraBtnText: {
    color: '#00f0ff',
    fontSize: 9,
    fontWeight: '800',
  },
  carHudBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.2)',
  },
  carHudBadgeName: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  carHudBadgeDrive: {
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: '600',
  },
  topHudCenter: {
    alignItems: 'center',
  },
  missionHudBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.25)',
    alignItems: 'center',
  },
  missionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  missionHudTitle: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  missionStatusRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 3,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  timerText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '800',
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  scoreText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '800',
  },
  driftAlertBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
  },
  driftAlertText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  topHudRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clusterContainer: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    zIndex: 5,
  },
  clusterGlass: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.2)',
    width: 140,
  },
  speedDigital: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 34,
  },
  speedUnit: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  gearBox: {
    backgroundColor: 'rgba(0, 240, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
    marginBottom: 4,
  },
  gearText: {
    color: '#00f0ff',
    fontSize: 12,
    fontWeight: '900',
  },
  rpmTrack: {
    width: 110,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 2,
  },
  rpmFill: {
    height: '100%',
  },
  rpmDigital: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  bottomControlsRow: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    zIndex: 10,
  },
  leftSteeringArea: {
    alignItems: 'flex-start',
  },
  steeringWheelBox: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  steeringWheelCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 12,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelSpokeHoriz: {
    position: 'absolute',
    width: 106,
    height: 10,
    backgroundColor: '#475569',
    borderRadius: 4,
  },
  wheelSpokeVert: {
    position: 'absolute',
    width: 10,
    height: 55,
    bottom: 0,
    backgroundColor: '#475569',
    borderRadius: 4,
  },
  wheelCenterHub: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#00f0ff',
  },
  wheelBrandText: {
    color: '#00f0ff',
    fontSize: 8,
    fontWeight: '900',
  },
  arrowsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  arrowBtn: {
    width: 65,
    height: 65,
    borderRadius: 32,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0, 240, 255, 0.4)',
  },
  tiltNoticeBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.3)',
  },
  tiltNoticeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
  },
  quickCalibrateBtn: {
    marginTop: 6,
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  quickCalibrateText: {
    color: '#00f0ff',
    fontSize: 8,
    fontWeight: '800',
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modePillText: {
    color: '#cbd5e1',
    fontSize: 9,
    fontWeight: '800',
  },
  rightPedalArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  handbrakeBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  handbrakeText: {
    color: '#f59e0b',
    fontSize: 8,
    fontWeight: '900',
  },
  brakePedal: {
    width: 60,
    height: 95,
    borderRadius: 10,
    overflow: 'hidden',
  },
  gasPedal: {
    width: 55,
    height: 120,
    borderRadius: 10,
    overflow: 'hidden',
  },
  pedalGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pedalText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  pedalSubText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 9,
    fontWeight: '800',
  },
  pedalTextGas: {
    color: '#030712',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  pauseBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseBox: {
    width: 320,
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.3)',
  },
  pauseTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  pauseSubTitle: {
    color: '#00f0ff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 14,
  },
  pauseStats: {
    width: '100%',
    backgroundColor: 'rgba(2, 6, 23, 0.7)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    gap: 4,
  },
  pauseStatRow: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
  },
  pauseBtnPrimary: {
    width: '100%',
    backgroundColor: '#00f0ff',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  pauseBtnPrimaryText: {
    color: '#030712',
    fontSize: 12,
    fontWeight: '900',
  },
  pauseBtnSecondary: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  pauseBtnSecondaryText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
  },
});
