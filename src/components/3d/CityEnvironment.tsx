import * as THREE from 'three';
import { createRoadSystem, RoadSystem } from '../../world/RoadSystem';
import { createTrafficManager, TrafficManager, NearMissEvent } from '../../world/TrafficManager';

/**
 * CityEnvironment.tsx
 * Integrated Cairo Highway Environment with Endless Road Streaming,
 * cannon-es physical curbs, multi-lane AI traffic, and the River Nile Corniche.
 */

export interface CityEnvironment {
  group: THREE.Group;
  checkpointMesh: THREE.Mesh;
  roadSystem: RoadSystem;
  trafficManager: TrafficManager;
  setCheckpointPosition: (x: number, z: number, visible: boolean) => void;
  updateAnimation: (
    time: number,
    delta?: number,
    playerX?: number,
    playerZ?: number,
    playerSpeedKmh?: number
  ) => void;
  checkTrafficCollision: (playerX: number, playerZ: number, playerRadius?: number) => boolean;
  checkCurbCollision: (playerX: number, playerZ: number, playerRadius?: number) => { collided: boolean; normalX: number };
  onPlayerHorn: (playerX: number, playerZ: number) => void;
  dispose: () => void;
}

export function createCityEnvironment(onNearMiss?: (evt: NearMissEvent) => void): CityEnvironment {
  const root = new THREE.Group();
  root.name = 'CairoCityEnvironment_Root';

  // 1. Endless 4-Lane Urban Highway System (8 Chunks x 80m = 640m with cannon-es Curbs)
  const roadSystem = createRoadSystem();
  root.add(roadSystem.rootGroup);

  // 2. Intelligent Multi-Lane AI Traffic (10-14 vehicles with lane changes & near-miss detection)
  const trafficManager = createTrafficManager(onNearMiss);
  root.add(trafficManager.rootGroup);

  // 3. The River Nile Promenade & Corniche (Left side of highway)
  const nileGroup = new THREE.Group();
  nileGroup.name = 'RiverNile_Corniche';

  const nileWaterGeo = new THREE.PlaneGeometry(160, 1200, 32, 64);
  const nileWaterMat = new THREE.MeshStandardMaterial({
    color: 0x054d5c,
    roughness: 0.12,
    metalness: 0.88,
    transparent: true,
    opacity: 0.94,
  });
  const nileWater = new THREE.Mesh(nileWaterGeo, nileWaterMat);
  nileWater.rotation.x = -Math.PI / 2;
  nileWater.position.set(-95, -0.6, 0);
  nileGroup.add(nileWater);

  // Nile Promenade baluster fence along x = -13.0
  const balusterGeo = new THREE.BoxGeometry(0.3, 0.9, 0.3);
  const balusterMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.85 });
  for (let z = -600; z < 600; z += 6) {
    const baluster = new THREE.Mesh(balusterGeo, balusterMat);
    baluster.position.set(-13.0, 0.55, z);
    nileGroup.add(baluster);

    // Warm brass river lamps every 24m
    if (z % 24 === 0) {
      const lampHeadGeo = new THREE.SphereGeometry(0.2, 12, 12);
      const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffe082 });
      const lampHead = new THREE.Mesh(lampHeadGeo, lampHeadMat);
      lampHead.position.set(-13.0, 1.2, z);
      nileGroup.add(lampHead);
    }
  }

  // Promenade rail beam
  const railGeo = new THREE.BoxGeometry(0.25, 0.12, 1200);
  const railMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.7 });
  const rail = new THREE.Mesh(railGeo, railMat);
  rail.position.set(-13.0, 1.0, 0);
  nileGroup.add(rail);

  // Floating Feluccas on the Nile
  const feluccaPositions = [
    { x: -35, z: -280 },
    { x: -50, z: -80 },
    { x: -38, z: 140 },
    { x: -65, z: 350 },
  ];
  const feluccaMeshes: THREE.Group[] = [];
  const boatMat = new THREE.MeshStandardMaterial({ color: 0x5a3825, roughness: 0.9 });
  const sailMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.6, side: THREE.DoubleSide });

  feluccaPositions.forEach((pos, idx) => {
    const felucca = new THREE.Group();
    felucca.position.set(pos.x, -0.4, pos.z);

    // Wooden hull
    const hullGeo = new THREE.CylinderGeometry(1.6, 1.1, 8.5, 8);
    hullGeo.rotateX(Math.PI / 2);
    const hull = new THREE.Mesh(hullGeo, boatMat);
    felucca.add(hull);

    // Mast
    const mastGeo = new THREE.CylinderGeometry(0.08, 0.12, 9.0, 8);
    const mast = new THREE.Mesh(mastGeo, boatMat);
    mast.position.set(0, 4.5, -0.5);
    mast.rotation.x = -0.15;
    felucca.add(mast);

    // Triangular white sail
    const sailShape = new THREE.Shape();
    sailShape.moveTo(0, 0.5);
    sailShape.lineTo(0, 8.5);
    sailShape.lineTo(4.5, 1.2);
    sailShape.closePath();
    const sailGeo = new THREE.ShapeGeometry(sailShape);
    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.position.set(0.1, 0, -0.5);
    felucca.add(sail);

    nileGroup.add(felucca);
    feluccaMeshes.push(felucca);
  });

  root.add(nileGroup);

  // 4. Mission Holographic Checkpoint Marker
  const cpGroup = new THREE.Group();
  cpGroup.name = 'HolographicCheckpoint';

  const ringGeo = new THREE.TorusGeometry(3.6, 0.22, 16, 36);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.85,
    wireframe: true,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.2;
  cpGroup.add(ring);

  const pillarGeo = new THREE.CylinderGeometry(3.5, 3.5, 4.0, 24, 1, true);
  const pillarMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
  });
  const pillar = new THREE.Mesh(pillarGeo, pillarMat);
  pillar.position.y = 2.0;
  cpGroup.add(pillar);

  const cpLight = new THREE.PointLight(0x00f0ff, 6, 16);
  cpLight.position.y = 2.0;
  cpGroup.add(cpLight);

  cpGroup.position.set(0, 0, -50);
  root.add(cpGroup);

  return {
    group: root,
    checkpointMesh: ring,
    roadSystem,
    trafficManager,

    setCheckpointPosition: (x: number, z: number, visible: boolean) => {
      cpGroup.position.set(x, 0, z);
      cpGroup.visible = visible;
    },

    updateAnimation: (
      time: number,
      delta: number = 0.016,
      playerX: number = 0,
      playerZ: number = 0,
      playerSpeedKmh: number = 0
    ) => {
      // 1. Recycle and advance endless road chunks
      roadSystem.updateChunks(playerZ);

      // 2. Advance intelligent AI traffic
      trafficManager.update(time, delta, playerX, playerZ, playerSpeedKmh);

      // 3. Animate Checkpoint Hologram
      ring.rotation.z = time * 1.5;
      ring.position.y = 1.2 + Math.sin(time * 3) * 0.3;
      pillar.material.opacity = 0.2 + Math.sin(time * 4) * 0.1;

      // 4. Animate Feluccas bobbing on Nile waves
      feluccaMeshes.forEach((felucca, idx) => {
        felucca.position.y = -0.4 + Math.sin(time * 1.8 + idx * 1.2) * 0.08;
        felucca.rotation.z = Math.sin(time * 1.4 + idx) * 0.04;
      });
    },

    checkTrafficCollision: (playerX: number, playerZ: number, playerRadius: number = 1.6): boolean => {
      return trafficManager.checkCollision(playerX, playerZ, playerRadius) !== null;
    },

    checkCurbCollision: (playerX: number, playerZ: number, playerRadius: number = 0.95) => {
      return roadSystem.checkCurbCollision(playerX, playerZ, playerRadius);
    },

    onPlayerHorn: (playerX: number, playerZ: number) => {
      // Horn alerts AI traffic to change lane
    },

    dispose: () => {
      roadSystem.dispose();
      trafficManager.dispose();
      root.clear();
    },
  };
}
