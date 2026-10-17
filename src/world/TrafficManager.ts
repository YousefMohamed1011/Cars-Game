import * as THREE from 'three';

/**
 * TrafficManager.ts
 * Multi-Lane AI Traffic Engine with lane changing, turn signals,
 * bounding-box physics, and high-speed weaving / near-miss ("غرز") detector.
 */

export interface TrafficCar {
  id: number;
  type: 'taxi' | 'microbus' | 'sedan_silver' | 'sedan_black' | 'hatchback_red';
  group: THREE.Group;
  wheels: THREE.Group[];
  taillights: THREE.Mesh[];
  turnSignals: { left: THREE.Mesh[]; right: THREE.Mesh[] };
  x: number;
  z: number;
  laneIndex: number;
  targetLaneIndex: number;
  speedMs: number;
  length: number;
  width: number;
  height: number;
  laneChangeProgress: number; // 0 to 1
  laneChangeTimer: number;
  isChangingLane: boolean;
  isBraking: boolean;
  nearMissed: boolean; // Flag to prevent multiple near-miss triggers per pass
}

export interface NearMissEvent {
  points: number;
  trafficId: number;
  distance: number;
  playerSpeedKmh: number;
}

export interface TrafficManager {
  rootGroup: THREE.Group;
  update: (time: number, delta: number, playerX: number, playerZ: number, playerSpeedKmh: number) => void;
  checkCollision: (playerX: number, playerZ: number, playerRadius?: number) => TrafficCar | null;
  onNearMiss?: (event: NearMissEvent) => void;
  dispose: () => void;
}

// 4 Highway Lanes (meters from center)
const HIGHWAY_LANES = [-6.0, -2.0, 2.0, 6.0];

export function createTrafficManager(onNearMissCallback?: (evt: NearMissEvent) => void): TrafficManager {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'AITrafficManager_Group';

  const trafficCars: TrafficCar[] = [];
  const TOTAL_TRAFFIC = 12; // 10-14 vehicles

  // Reusable materials
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.8, roughness: 0.2 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.1, metalness: 0.3 });

  function buildTrafficMesh(type: TrafficCar['type']): {
    group: THREE.Group;
    wheels: THREE.Group[];
    taillights: THREE.Mesh[];
    turnSignals: { left: THREE.Mesh[]; right: THREE.Mesh[] };
    length: number;
    width: number;
    height: number;
  } {
    const group = new THREE.Group();
    const wheels: THREE.Group[] = [];
    const taillights: THREE.Mesh[] = [];
    const turnSignals = { left: [] as THREE.Mesh[], right: [] as THREE.Mesh[] };

    let length = 4.4;
    let width = 1.8;
    let height = 1.35;
    let bodyColor = 0xe2e8f0;

    if (type === 'taxi') {
      bodyColor = 0xffffff;
    } else if (type === 'microbus') {
      length = 5.2;
      width = 1.95;
      height = 2.05;
      bodyColor = 0xf8fafc;
    } else if (type === 'sedan_silver') {
      bodyColor = 0x94a3b8;
    } else if (type === 'sedan_black') {
      bodyColor = 0x0f172a;
    } else if (type === 'hatchback_red') {
      length = 3.9;
      width = 1.75;
      height = 1.38;
      bodyColor = 0xdc2626;
    }

    const bodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor,
      metalness: 0.75,
      roughness: 0.25,
    });

    // 1. Main Vehicle Body
    const bodyGeo = new THREE.BoxGeometry(width, height * 0.55, length);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = height * 0.45;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // 2. Cabin / Roof Glass
    const cabinGeo = new THREE.BoxGeometry(width * 0.88, height * 0.48, length * 0.55);
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0, height * 0.85, -length * 0.05);
    group.add(cabin);

    // Egyptian Taxi Checker Decals (for Taxi)
    if (type === 'taxi') {
      const checkerGeo = new THREE.BoxGeometry(width * 1.01, 0.12, length * 0.8);
      const checkerMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
      const checker = new THREE.Mesh(checkerGeo, checkerMat);
      checker.position.set(0, height * 0.48, 0);
      group.add(checker);

      // Yellow Taxi Roof Sign
      const signGeo = new THREE.BoxGeometry(0.55, 0.16, 0.25);
      const signMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.8,
      });
      const sign = new THREE.Mesh(signGeo, signMat);
      sign.position.set(0, height * 1.15, 0);
      group.add(sign);
    }

    // Microbus Roof Luggage Rack (for Microbus)
    if (type === 'microbus') {
      const rackGeo = new THREE.BoxGeometry(width * 0.85, 0.15, length * 0.5);
      const rackMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
      const rack = new THREE.Mesh(rackGeo, rackMat);
      rack.position.set(0, height * 1.12, 0);
      group.add(rack);
    }

    // 3. Headlights (Front is +Z)
    [-width * 0.38, width * 0.38].forEach((xOffset) => {
      const lampGeo = new THREE.BoxGeometry(0.28, 0.14, 0.05);
      const lampMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffeedd,
        emissiveIntensity: 1.2,
      });
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(xOffset, height * 0.48, length * 0.5);
      group.add(lamp);
    });

    // 4. Taillights (Rear is -Z)
    [-width * 0.38, width * 0.38].forEach((xOffset) => {
      const tailGeo = new THREE.BoxGeometry(0.26, 0.14, 0.04);
      const tailMat = new THREE.MeshStandardMaterial({
        color: 0x990000,
        emissive: 0x770000,
        emissiveIntensity: 0.8,
      });
      const tail = new THREE.Mesh(tailGeo, tailMat);
      tail.position.set(xOffset, height * 0.48, -length * 0.5);
      group.add(tail);
      taillights.push(tail);

      // Turn signal amber light
      const turnGeo = new THREE.BoxGeometry(0.1, 0.14, 0.042);
      const turnMat = new THREE.MeshStandardMaterial({
        color: 0x221100,
        emissive: 0x000000,
      });
      const turn = new THREE.Mesh(turnGeo, turnMat);
      const tX = xOffset > 0 ? xOffset + 0.14 : xOffset - 0.14;
      turn.position.set(tX, height * 0.48, -length * 0.5);
      group.add(turn);

      if (xOffset < 0) {
        turnSignals.left.push(turn);
      } else {
        turnSignals.right.push(turn);
      }
    });

    // 5. Wheels
    const wRadius = 0.33;
    const wWidth = 0.22;
    const wheelPositions = [
      [-width * 0.48, wRadius, length * 0.3],
      [width * 0.48, wRadius, length * 0.3],
      [-width * 0.48, wRadius, -length * 0.3],
      [width * 0.48, wRadius, -length * 0.3],
    ];

    wheelPositions.forEach(([wx, wy, wz]) => {
      const wGroup = new THREE.Group();
      wGroup.position.set(wx, wy, wz);

      const tireGeo = new THREE.CylinderGeometry(wRadius, wRadius, wWidth, 14);
      tireGeo.rotateZ(Math.PI / 2);
      const tire = new THREE.Mesh(tireGeo, tireMat);
      wGroup.add(tire);

      const rimGeo = new THREE.CylinderGeometry(wRadius * 0.65, wRadius * 0.65, wWidth * 1.02, 10);
      rimGeo.rotateZ(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      wGroup.add(rim);

      group.add(wGroup);
      wheels.push(wGroup);
    });

    return { group, wheels, taillights, turnSignals, length, width, height };
  }

  // Types distribution
  const carTypes: TrafficCar['type'][] = [
    'taxi', 'taxi', 'microbus', 'microbus',
    'sedan_silver', 'sedan_black', 'hatchback_red', 'taxi',
    'sedan_silver', 'microbus', 'hatchback_red', 'sedan_black'
  ];

  // Initialize cars spread along the highway
  carTypes.forEach((type, i) => {
    const meshData = buildTrafficMesh(type);
    const laneIndex = i % 4;
    const x = HIGHWAY_LANES[laneIndex];
    // Initial spacing ahead of player (from 30m to 320m)
    const z = 30 + i * 26 + (Math.random() * 8 - 4);

    // Speed based on lane: Lane 0 (left) fastest, Lane 3 (right) slowest
    const baseSpeedKmh = [95, 82, 70, 55][laneIndex] + (Math.random() * 12 - 6);
    const speedMs = baseSpeedKmh / 3.6;

    meshData.group.position.set(x, 0, z);
    rootGroup.add(meshData.group);

    trafficCars.push({
      id: i,
      type,
      group: meshData.group,
      wheels: meshData.wheels,
      taillights: meshData.taillights,
      turnSignals: meshData.turnSignals,
      x,
      z,
      laneIndex,
      targetLaneIndex: laneIndex,
      speedMs,
      length: meshData.length,
      width: meshData.width,
      height: meshData.height,
      laneChangeProgress: 0,
      laneChangeTimer: 6 + Math.random() * 10,
      isChangingLane: false,
      isBraking: false,
      nearMissed: false,
    });
  });

  /**
   * Main Traffic Simulation Frame
   */
  function update(
    time: number,
    delta: number,
    playerX: number,
    playerZ: number,
    playerSpeedKmh: number
  ) {
    const clampedDelta = Math.min(0.05, delta);
    const turnBlink = Math.floor(time * 3.5) % 2 === 0;

    trafficCars.forEach((car) => {
      // 1. Advance position along road
      car.z += car.speedMs * clampedDelta;

      // 2. Wheel rotation
      car.wheels.forEach((w) => {
        w.rotation.x += (car.speedMs / 0.33) * clampedDelta;
      });

      // 3. Lane Changing Logic
      car.laneChangeTimer -= clampedDelta;
      if (car.laneChangeTimer <= 0 && !car.isChangingLane) {
        // Decide whether to change lane
        const canGoLeft = car.laneIndex > 0;
        const canGoRight = car.laneIndex < 3;
        const direction = Math.random() > 0.5 ? 1 : -1;

        if (direction < 0 && canGoLeft) {
          car.targetLaneIndex = car.laneIndex - 1;
          car.isChangingLane = true;
          car.laneChangeProgress = 0;
        } else if (direction > 0 && canGoRight) {
          car.targetLaneIndex = car.laneIndex + 1;
          car.isChangingLane = true;
          car.laneChangeProgress = 0;
        }
        car.laneChangeTimer = 8 + Math.random() * 14;
      }

      if (car.isChangingLane) {
        car.laneChangeProgress += clampedDelta * 0.45; // ~2.2 seconds to complete
        const startX = HIGHWAY_LANES[car.laneIndex];
        const targetX = HIGHWAY_LANES[car.targetLaneIndex];
        // Smooth sine interpolation
        const t = Math.min(1.0, car.laneChangeProgress);
        const smoothT = 0.5 - 0.5 * Math.cos(t * Math.PI);
        car.x = startX + (targetX - startX) * smoothT;

        // Turn signals blinking
        const isLeft = car.targetLaneIndex < car.laneIndex;
        const activeSignals = isLeft ? car.turnSignals.left : car.turnSignals.right;
        const inactiveSignals = isLeft ? car.turnSignals.right : car.turnSignals.left;

        activeSignals.forEach((mesh) => {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.emissive.set(turnBlink ? 0xf59e0b : 0x000000);
          mat.emissiveIntensity = turnBlink ? 1.8 : 0;
        });
        inactiveSignals.forEach((mesh) => {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = 0;
        });

        if (car.laneChangeProgress >= 1.0) {
          car.laneIndex = car.targetLaneIndex;
          car.x = targetX;
          car.isChangingLane = false;
          // Turn off turn signals
          [...car.turnSignals.left, ...car.turnSignals.right].forEach((mesh) => {
            (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
          });
        }
      }

      // 4. Update 3D Group Transform
      car.group.position.set(car.x, 0, car.z);

      // 5. Seamless recycling when far behind or far ahead
      if (playerZ - car.z > 80) {
        // Respawn ahead
        car.z = playerZ + 240 + Math.random() * 80;
        car.laneIndex = Math.floor(Math.random() * 4);
        car.targetLaneIndex = car.laneIndex;
        car.x = HIGHWAY_LANES[car.laneIndex];
        car.isChangingLane = false;
        car.nearMissed = false;
      } else if (car.z - playerZ > 360) {
        // Respawn closer
        car.z = playerZ - 60 - Math.random() * 20;
        car.laneIndex = Math.floor(Math.random() * 4);
        car.targetLaneIndex = car.laneIndex;
        car.x = HIGHWAY_LANES[car.laneIndex];
        car.isChangingLane = false;
        car.nearMissed = false;
      }

      // 6. Near-Miss / Weaving ("غرز") Detection
      // Occurs when passing within 1.2m laterally at > 80 km/h without collision
      if (playerSpeedKmh > 80 && !car.nearMissed) {
        const dx = Math.abs(playerX - car.x);
        const dz = Math.abs(playerZ - car.z);

        // Lateral clearance < 1.25m from vehicle flank and longitudinal overlap
        const lateralClearance = dx - (car.width * 0.5 + 0.9);
        const longitudinalOverlap = dz < (car.length * 0.5 + 2.0);

        if (longitudinalOverlap && lateralClearance > 0 && lateralClearance < 1.25) {
          car.nearMissed = true;
          if (onNearMissCallback) {
            onNearMissCallback({
              points: 500,
              trafficId: car.id,
              distance: Math.max(0.1, lateralClearance),
              playerSpeedKmh,
            });
          }
        }
      }
    });
  }

  /**
   * Bounding Box Collision Check against player car
   */
  function checkCollision(playerX: number, playerZ: number, playerRadius = 1.0): TrafficCar | null {
    for (const car of trafficCars) {
      const halfW = car.width * 0.5 + playerRadius * 0.75;
      const halfL = car.length * 0.5 + playerRadius * 0.85;

      if (Math.abs(playerX - car.x) < halfW && Math.abs(playerZ - car.z) < halfL) {
        return car;
      }
    }
    return null;
  }

  function dispose() {
    rootGroup.clear();
    trafficCars.length = 0;
  }

  return {
    rootGroup,
    update,
    checkCollision,
    onNearMiss: onNearMissCallback,
    dispose,
  };
}
