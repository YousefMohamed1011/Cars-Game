import * as THREE from 'three';
import { CameraViewMode } from '../types';
import { createEnvMap } from './TextureGenerator';

/**
 * SceneSetup.ts
 * AAA Lighting, Tone Mapping, Golden-Hour Atmospheric Fog, and Dynamic Camera Physics
 */

export interface DynamicCameraState {
  posX: number;
  posZ: number;
  yaw: number;
  driftAngle: number;
  speedKmh: number;
  steeringAngle: number;
  cameraMode: CameraViewMode;
}

export interface DynamicCameraController {
  update: (camera: THREE.PerspectiveCamera, delta: number, state: DynamicCameraState) => void;
  triggerNearMissShake: (intensity?: number) => void;
}

/**
 * Configures the WebGLRenderer and Scene with ACESFilmic Tone Mapping and Golden-Hour Lighting
 */
export function setupSceneGraphics(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer
) {
  // 1. ACES Filmic Tone Mapping & High Dynamic Exposure
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // 2. Sunset / Golden-Hour Atmospheric Fog & Background
  const sunsetHorizonColor = new THREE.Color(0xd99b66);
  const twilightZenithColor = new THREE.Color(0x2b213a);

  scene.background = twilightZenithColor;
  scene.fog = new THREE.FogExp2(sunsetHorizonColor.getHex(), 0.0038);

  // 3. Procedural Sky / Environment Reflection Map
  const envMap = createEnvMap(256, 128);
  scene.environment = envMap;

  // 4. Warm Directional Sunlight (Golden-Hour Low Angle)
  const sunLight = new THREE.DirectionalLight(0xffa855, 2.4);
  sunLight.position.set(45, 38, 55);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 180;
  const shadowDist = 35;
  sunLight.shadow.camera.left = -shadowDist;
  sunLight.shadow.camera.right = shadowDist;
  sunLight.shadow.camera.top = shadowDist;
  sunLight.shadow.camera.bottom = -shadowDist;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);

  // 5. Ambient & Hemisphere Lighting
  const ambientLight = new THREE.AmbientLight(0xffeedd, 0.7);
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(0x554477, 0x2a1e16, 0.65);
  scene.add(hemiLight);

  return { envMap, sunLight };
}

/**
 * Dynamic Camera Physics Controller
 * Speed-dependent FOV, lateral G-force tilt, spring damping, and weave vibration
 */
export function createDynamicCameraController(): DynamicCameraController {
  let nearMissShake = 0;
  let currentCamX = 0;
  let currentCamY = 2.4;
  let currentCamZ = -6.5;

  return {
    triggerNearMissShake: (intensity = 1.0) => {
      nearMissShake = Math.max(nearMissShake, intensity);
    },

    update: (camera: THREE.PerspectiveCamera, delta: number, state: DynamicCameraState) => {
      const clampedDelta = Math.min(0.05, delta);
      const totalYaw = state.yaw + state.driftAngle;
      const speedAbs = Math.abs(state.speedKmh);

      // Decay near-miss camera shake
      if (nearMissShake > 0) {
        nearMissShake = Math.max(0, nearMissShake - clampedDelta * 3.5);
      }

      // Asphalt high-speed micro-vibration
      const roadVibe = (speedAbs / 200) * 0.02 * (Math.random() - 0.5);
      const shakeOffset = (nearMissShake * 0.12 + roadVibe);

      switch (state.cameraMode) {
        case 'cockpit': {
          // Dynamic FOV in cockpit: 65° to 80°
          const targetFov = 65 + Math.min(15, (speedAbs / 180) * 15);
          camera.fov += (targetFov - camera.fov) * clampedDelta * 6;
          camera.updateProjectionMatrix();

          // Authentic First-Person Driver POV: Seated at driver position looking through windshield
          const driverLateralOffset = -0.42; // Left-hand seat
          const driverLongitudinalOffset = 0.05;
          const driverEyeHeight = 1.08 + (shakeOffset * 0.5);

          const cosY = Math.cos(totalYaw);
          const sinY = Math.sin(totalYaw);

          const eyeX = state.posX + cosY * driverLateralOffset + sinY * driverLongitudinalOffset;
          const eyeZ = state.posZ - sinY * driverLateralOffset + cosY * driverLongitudinalOffset;

          camera.position.set(eyeX, driverEyeHeight, eyeZ);

          // Lateral G-force head tilt
          const gTilt = -state.steeringAngle * 0.06;
          camera.rotation.z = gTilt;

          camera.lookAt(
            eyeX + sinY * 25,
            driverEyeHeight - 0.12,
            eyeZ + cosY * 25
          );
          break;
        }

        case 'hood': {
          camera.fov = 72;
          camera.updateProjectionMatrix();

          const sinY = Math.sin(totalYaw);
          const cosY = Math.cos(totalYaw);

          camera.position.set(
            state.posX + sinY * 1.6,
            0.85 + shakeOffset,
            state.posZ + cosY * 1.6
          );
          camera.lookAt(
            state.posX + sinY * 30,
            0.7,
            state.posZ + cosY * 30
          );
          break;
        }

        case 'orbit': {
          camera.fov = 55;
          camera.updateProjectionMatrix();

          const orbitDist = 11.0;
          const sinY = Math.sin(totalYaw);
          const cosY = Math.cos(totalYaw);

          camera.position.set(
            state.posX - sinY * orbitDist,
            5.2,
            state.posZ - cosY * orbitDist
          );
          camera.lookAt(state.posX, 0.8, state.posZ);
          break;
        }

        case 'chase':
        default: {
          // Dynamic FOV: 60° expanding to 78° at top speed
          const targetFov = 60 + Math.min(18, (speedAbs / 200) * 18);
          camera.fov += (targetFov - camera.fov) * clampedDelta * 5;
          camera.updateProjectionMatrix();

          // Distance and height lag with speed
          const chaseDist = 6.2 + Math.min(3.2, speedAbs / 45);
          const chaseHeight = 2.45 + (shakeOffset * 0.8);

          const sinY = Math.sin(totalYaw);
          const cosY = Math.cos(totalYaw);

          const targetCamX = state.posX - sinY * chaseDist;
          const targetCamZ = state.posZ - cosY * chaseDist;

          // Smooth spring damping
          currentCamX += (targetCamX - currentCamX) * clampedDelta * 8.5;
          currentCamY += (chaseHeight - currentCamY) * clampedDelta * 8.5;
          currentCamZ += (targetCamZ - currentCamZ) * clampedDelta * 8.5;

          camera.position.set(currentCamX, currentCamY, currentCamZ);

          // Lateral G-force camera tilt when cornering/drifting
          const lateralRoll = -state.steeringAngle * 0.08 - (state.driftAngle * 0.14);
          camera.rotation.z = lateralRoll;

          // Look at target ahead of the car hood
          camera.lookAt(state.posX + sinY * 2.5, 0.95, state.posZ + cosY * 2.5);
          break;
        }
      }
    },
  };
}
