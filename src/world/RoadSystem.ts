import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {
  createAsphaltTexture,
  createCurbTexture,
  createBuildingTexture,
} from '../graphics/TextureGenerator';

/**
 * RoadSystem.ts
 * Endless 4-lane urban highway chunk manager synchronized with cannon-es physics.
 * 8 active recycled segments (80m each = 640m total).
 */

export interface RoadChunk {
  index: number;
  zCenter: number;
  group: THREE.Group;
  leftCurbBody: CANNON.Body;
  rightCurbBody: CANNON.Body;
  streetlights: THREE.PointLight[];
  setZ: (z: number) => void;
}

export interface RoadSystem {
  rootGroup: THREE.Group;
  physicsWorld: CANNON.World;
  updateChunks: (playerZ: number) => void;
  checkCurbCollision: (playerX: number, playerZ: number, carHalfWidth?: number) => { collided: boolean; normalX: number };
  dispose: () => void;
}

const CHUNK_COUNT = 8;
const CHUNK_LENGTH = 80;
const ROAD_WIDTH = 16;
const CURB_HALF_X = 8.2; // Left curb at -8.2, Right curb at +8.2

export function createRoadSystem(physicsWorld?: CANNON.World): RoadSystem {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'EndlessRoadSystem';

  // If no external cannon world passed, create an internal one
  const world = physicsWorld || new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });

  // Shared Procedural Textures
  const asphaltTex = createAsphaltTexture(512, 512);
  const curbTex = createCurbTexture(256, 64, 'black_yellow');
  const buildingBeigeTex = createBuildingTexture(512, 512, 'beige_concrete');
  const buildingBrickTex = createBuildingTexture(512, 512, 'red_brick');

  // Shared Materials
  const asphaltMat = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    roughness: 0.85,
    metalness: 0.12,
  });

  const curbMat = new THREE.MeshStandardMaterial({
    map: curbTex,
    roughness: 0.88,
  });

  const sidewalkMat = new THREE.MeshStandardMaterial({
    color: 0x9ca3af,
    roughness: 0.92,
  });

  const lampPostMat = new THREE.MeshStandardMaterial({
    color: 0x2b2d30,
    metalness: 0.8,
    roughness: 0.3,
  });

  const sodiumEmissiveMat = new THREE.MeshStandardMaterial({
    color: 0xffb347,
    emissive: 0xff9900,
    emissiveIntensity: 2.2,
  });

  const greenSignMat = new THREE.MeshStandardMaterial({
    color: 0x065f46, // Egyptian highway highway green
    roughness: 0.4,
  });

  /**
   * Builds an 80m road chunk
   */
  function buildChunk(chunkIndex: number, initialZ: number): RoadChunk {
    const chunkGroup = new THREE.Group();
    chunkGroup.name = `RoadChunk_${chunkIndex}`;
    chunkGroup.position.z = initialZ;

    const streetlights: THREE.PointLight[] = [];

    // 1. 4-Lane Asphalt Road Surface (16m wide x 80m long)
    const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, CHUNK_LENGTH);
    const roadMesh = new THREE.Mesh(roadGeo, asphaltMat);
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.receiveShadow = true;
    chunkGroup.add(roadMesh);

    // 2. Center Double Yellow Line
    [-0.15, 0.15].forEach((offset) => {
      const lineGeo = new THREE.PlaneGeometry(0.12, CHUNK_LENGTH);
      const lineMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(offset, 0.015, 0);
      chunkGroup.add(line);
    });

    // 3. Dashed White Lane Dividers (Lanes at -6m, -2m, 2m, 6m)
    [-4.0, 4.0].forEach((dividerX) => {
      for (let z = -CHUNK_LENGTH / 2; z < CHUNK_LENGTH / 2; z += 10) {
        const dashGeo = new THREE.PlaneGeometry(0.16, 5.0);
        const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const dash = new THREE.Mesh(dashGeo, dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(dividerX, 0.015, z + 2.5);
        chunkGroup.add(dash);
      }
    });

    // 4. Solid White Outer Road Edge Lines
    [-7.8, 7.8].forEach((edgeX) => {
      const edgeGeo = new THREE.PlaneGeometry(0.2, CHUNK_LENGTH);
      const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const edge = new THREE.Mesh(edgeGeo, edgeMat);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(edgeX, 0.015, 0);
      chunkGroup.add(edge);
    });

    // 5. Raised Sidewalks & Egyptian Curbs
    [-CURB_HALF_X, CURB_HALF_X].forEach((curbX) => {
      // Curbstone (painted black/yellow)
      const curbGeo = new THREE.BoxGeometry(0.45, 0.28, CHUNK_LENGTH);
      const curb = new THREE.Mesh(curbGeo, curbMat);
      curb.position.set(curbX, 0.14, 0);
      curb.castShadow = true;
      curb.receiveShadow = true;
      chunkGroup.add(curb);

      // Raised concrete sidewalk slab
      const sideX = curbX < 0 ? curbX - 2.8 : curbX + 2.8;
      const walkGeo = new THREE.BoxGeometry(5.2, 0.24, CHUNK_LENGTH);
      const walk = new THREE.Mesh(walkGeo, sidewalkMat);
      walk.position.set(sideX, 0.12, 0);
      walk.receiveShadow = true;
      chunkGroup.add(walk);
    });

    // 6. Glowing Sodium-Vapor Orange Streetlamps (spaced every 25m)
    for (let zOffset = -CHUNK_LENGTH / 2 + 12.5; zOffset < CHUNK_LENGTH / 2; zOffset += 25) {
      [-9.8, 9.8].forEach((poleX) => {
        const lampGroup = new THREE.Group();
        lampGroup.position.set(poleX, 0, zOffset);

        // Vertical pole
        const poleGeo = new THREE.CylinderGeometry(0.1, 0.14, 7.5, 8);
        const pole = new THREE.Mesh(poleGeo, lampPostMat);
        pole.position.y = 3.75;
        lampGroup.add(pole);

        // Curved horizontal arm extending over the road
        const armGeo = new THREE.BoxGeometry(2.4, 0.08, 0.08);
        const arm = new THREE.Mesh(armGeo, lampPostMat);
        const armDir = poleX < 0 ? 1 : -1;
        arm.position.set(armDir * 1.0, 7.3, 0);
        lampGroup.add(arm);

        // Sodium Lamp Lantern
        const lanternGeo = new THREE.BoxGeometry(0.7, 0.18, 0.35);
        const lantern = new THREE.Mesh(lanternGeo, sodiumEmissiveMat);
        lantern.position.set(armDir * 2.0, 7.15, 0);
        lampGroup.add(lantern);

        // PointLight for warm orange street glow
        const light = new THREE.PointLight(0xffaa44, 2.2, 28, 1.4);
        light.position.set(armDir * 2.0, 6.8, 0);
        lampGroup.add(light);
        streetlights.push(light);

        chunkGroup.add(lampGroup);
      });
    }

    // 7. Overhead Highway Metal Gantry Sign (every 2nd chunk)
    if (chunkIndex % 2 === 0) {
      const gantryGroup = new THREE.Group();
      gantryGroup.position.set(0, 0, 0);

      // Left & right truss towers
      [-8.8, 8.8].forEach((towerX) => {
        const towerGeo = new THREE.BoxGeometry(0.4, 8.2, 0.4);
        const tower = new THREE.Mesh(towerGeo, lampPostMat);
        tower.position.set(towerX, 4.1, 0);
        gantryGroup.add(tower);
      });

      // Cross beam
      const beamGeo = new THREE.BoxGeometry(18.0, 0.6, 0.6);
      const beam = new THREE.Mesh(beamGeo, lampPostMat);
      beam.position.set(0, 7.8, 0);
      gantryGroup.add(beam);

      // Signboard
      const signGeo = new THREE.BoxGeometry(8.5, 2.2, 0.1);
      const sign = new THREE.Mesh(signGeo, greenSignMat);
      sign.position.set(0, 6.8, 0.3);
      gantryGroup.add(sign);

      chunkGroup.add(gantryGroup);
    }

    // 8. Egyptian Residential Brick / Concrete Buildings (on both sides)
    const buildingStyles = [buildingBeigeTex, buildingBrickTex];
    [-17.5, 17.5].forEach((bldgX, sideIdx) => {
      for (let bz = -CHUNK_LENGTH / 2 + 18; bz < CHUNK_LENGTH / 2; bz += 36) {
        const height = 18 + ((chunkIndex * 7 + sideIdx * 5) % 14);
        const width = 28;
        const depth = 22;

        const bldgGeo = new THREE.BoxGeometry(width, height, depth);
        const mat = new THREE.MeshStandardMaterial({
          map: buildingStyles[(chunkIndex + sideIdx) % 2],
          roughness: 0.85,
        });
        const building = new THREE.Mesh(bldgGeo, mat);
        building.position.set(bldgX < 0 ? bldgX - width * 0.4 : bldgX + width * 0.4, height / 2, bz);
        building.castShadow = true;
        building.receiveShadow = true;
        chunkGroup.add(building);
      }
    });

    rootGroup.add(chunkGroup);

    // 9. Physical cannon-es Curbs Box Colliders
    const curbShape = new CANNON.Box(new CANNON.Vec3(0.3, 0.3, CHUNK_LENGTH / 2));
    const leftCurbBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      position: new CANNON.Vec3(-CURB_HALF_X, 0.15, initialZ),
      shape: curbShape,
    });
    const rightCurbBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      position: new CANNON.Vec3(CURB_HALF_X, 0.15, initialZ),
      shape: curbShape,
    });

    world.addBody(leftCurbBody);
    world.addBody(rightCurbBody);

    return {
      index: chunkIndex,
      zCenter: initialZ,
      group: chunkGroup,
      leftCurbBody,
      rightCurbBody,
      streetlights,
      setZ: (newZ: number) => {
        chunkGroup.position.z = newZ;
        leftCurbBody.position.z = newZ;
        rightCurbBody.position.z = newZ;
      },
    };
  }

  // Initialize 8 chunks spanning from -80 to +560 meters
  const chunks: RoadChunk[] = [];
  const startZ = -CHUNK_LENGTH; // rear chunk
  for (let i = 0; i < CHUNK_COUNT; i++) {
    const z = startZ + i * CHUNK_LENGTH;
    chunks.push(buildChunk(i, z));
  }

  /**
   * Recycles rear chunks to the front seamlessly as player drives forward
   */
  function updateChunks(playerZ: number) {
    // Sort chunks by zCenter
    chunks.sort((a, b) => a.zCenter - b.zCenter);

    const rearChunk = chunks[0];
    const frontChunk = chunks[chunks.length - 1];

    // If player has moved past the rear chunk by more than 1 chunk length
    if (playerZ - rearChunk.zCenter > CHUNK_LENGTH * 1.5) {
      const newFrontZ = frontChunk.zCenter + CHUNK_LENGTH;
      rearChunk.zCenter = newFrontZ;
      rearChunk.setZ(newFrontZ);
    }
    // In reverse driving
    else if (rearChunk.zCenter - playerZ > CHUNK_LENGTH * 0.5) {
      const newRearZ = rearChunk.zCenter - CHUNK_LENGTH;
      frontChunk.zCenter = newRearZ;
      frontChunk.setZ(newRearZ);
    }
  }

  /**
   * Precise lateral curb bounding collision check
   */
  function checkCurbCollision(
    playerX: number,
    playerZ: number,
    carHalfWidth = 0.95
  ): { collided: boolean; normalX: number } {
    if (playerX - carHalfWidth < -CURB_HALF_X) {
      return { collided: true, normalX: 1.0 }; // Bounced right
    }
    if (playerX + carHalfWidth > CURB_HALF_X) {
      return { collided: true, normalX: -1.0 }; // Bounced left
    }
    return { collided: false, normalX: 0 };
  }

  function dispose() {
    chunks.forEach((c) => {
      world.removeBody(c.leftCurbBody);
      world.removeBody(c.rightCurbBody);
    });
    rootGroup.clear();
  }

  return {
    rootGroup,
    physicsWorld: world,
    updateChunks,
    checkCurbCollision,
    dispose,
  };
}
