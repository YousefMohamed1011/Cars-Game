import { Mission } from '../types';
import { useGameStore } from '../store/gameStore';

export const MISSIONS_LIST: Mission[] = [
  {
    id: 'mission_optra_vip',
    title: 'Daily VIP Street Delivery',
    subtitle: 'Smooth Metropolitan Transit',
    carId: 'optra_2012',
    rewardCash: 12500,
    rewardXp: 1800,
    timeLimitSec: 90,
    type: 'delivery',
    description:
      'Transport high-profile VIP clients across Cairo & urban financial district checkpoints. Maintain high speed while avoiding collisions to secure the full 5-star clean driving bonus!',
    checkpoints: [
      { x: 0, z: -40 },
      { x: 45, z: -80 },
      { x: -30, z: -140 },
      { x: 0, z: -200 },
    ],
    completed: false,
  },
  {
    id: 'mission_fiat_timeattack',
    title: '2000cc Classic Time Attack',
    subtitle: 'Lampredi DOHC Urban Sprint',
    carId: 'fiat_132',
    rewardCash: 16000,
    rewardXp: 2400,
    timeLimitSec: 65,
    type: 'time_attack',
    description:
      'Push the raw naturally aspirated 2.0L twin-cam Fiat 132 to its absolute limits! Execute rapid manual gear shifts, conquer the long avenue straight, and set the city record time.',
    checkpoints: [
      { x: 10, z: -50 },
      { x: -35, z: -110 },
      { x: 40, z: -160 },
      { x: 0, z: -220 },
    ],
    completed: false,
  },
  {
    id: 'mission_e30_drift',
    title: 'E30 Midnight Drift Master',
    subtitle: 'Oversteer & Tandem Style Challenge',
    carId: 'bmw_e30',
    rewardCash: 22000,
    rewardXp: 3200,
    timeLimitSec: 80,
    type: 'drift',
    targetScore: 4500,
    description:
      'Unleash the aggressive inline-6 BMW E30! Rip the handbrake, counter-steer through urban roundabouts, chain consecutive slide transitions, and achieve at least 4,500 drift points.',
    checkpoints: [
      { x: 25, z: -40 },
      { x: -25, z: -90 },
      { x: 30, z: -150 },
      { x: -10, z: -210 },
    ],
    completed: false,
  },
  {
    id: 'mission_precision_parking',
    title: 'Precision Urban Parking',
    subtitle: 'Tight Alleyways & Spatial Mastery',
    carId: 'fiat_132',
    rewardCash: 9500,
    rewardXp: 1200,
    timeLimitSec: 50,
    type: 'parking',
    description:
      'Maneuver through narrow city alleys and park perfectly inside the marked bay without hitting the curbs or surrounding vehicles.',
    checkpoints: [
      { x: 15, z: -35 },
      { x: 0, z: -85 },
    ],
    completed: false,
  },
  {
    id: 'mission_free_roam',
    title: 'Open City Free Roam',
    subtitle: 'Endless Highway & Cruising',
    carId: 'any',
    rewardCash: 5000,
    rewardXp: 800,
    timeLimitSec: 0, // unlimited
    type: 'free_roam',
    description:
      'Explore the vibrant 3D urban city, test all steering configurations, perform burnouts and high-speed highway pulls without timers or restrictions.',
    checkpoints: [],
    completed: false,
  },
];

export class MissionManager {
  private static instance: MissionManager;
  private currentMission: Mission | null = null;
  private currentCheckpointIndex: number = 0;
  private timeRemaining: number = 0;
  private currentScore: number = 0;
  private isMissionActive: boolean = false;

  private constructor() {}

  public static getInstance(): MissionManager {
    if (!MissionManager.instance) {
      MissionManager.instance = new MissionManager();
    }
    return MissionManager.instance;
  }

  public getMissions(): Mission[] {
    return MISSIONS_LIST;
  }

  public getMissionById(id: string): Mission | undefined {
    return MISSIONS_LIST.find((m) => m.id === id);
  }

  public startMission(missionId: string): boolean {
    const mission = this.getMissionById(missionId);
    if (!mission) return false;

    this.currentMission = mission;
    this.currentCheckpointIndex = 0;
    this.timeRemaining = mission.timeLimitSec;
    this.currentScore = 0;
    this.isMissionActive = true;

    useGameStore.getState().setActiveMissionId(missionId);
    return true;
  }

  public getCurrentMission(): Mission | null {
    return this.currentMission;
  }

  public getActiveCheckpoint(): { x: number; z: number } | null {
    if (!this.currentMission || !this.isMissionActive) return null;
    if (this.currentCheckpointIndex < this.currentMission.checkpoints.length) {
      return this.currentMission.checkpoints[this.currentCheckpointIndex];
    }
    return null;
  }

  public checkCheckpointHit(carX: number, carZ: number): boolean {
    if (!this.currentMission || !this.isMissionActive) return false;
    const target = this.getActiveCheckpoint();
    if (!target) return false;

    const dx = carX - target.x;
    const dz = carZ - target.z;
    const distSq = dx * dx + dz * dz;

    // Checkpoint radius: 7 meters
    if (distSq < 49) {
      this.currentCheckpointIndex++;
      if (this.currentCheckpointIndex >= this.currentMission.checkpoints.length) {
        // If all checkpoints passed
        if (this.currentMission.type !== 'drift' || this.currentScore >= (this.currentMission.targetScore || 0)) {
          this.completeMission();
        }
      }
      return true;
    }
    return false;
  }

  public addDriftPoints(points: number) {
    if (!this.currentMission || !this.isMissionActive) return;
    this.currentScore += points;
  }

  public getScore(): number {
    return this.currentScore;
  }

  public getRemainingTime(): number {
    return this.timeRemaining;
  }

  public tickTimer(deltaSec: number): boolean {
    if (!this.currentMission || !this.isMissionActive) return true;
    if (this.currentMission.timeLimitSec <= 0) return true; // free roam

    this.timeRemaining -= deltaSec;
    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.failMission();
      return false;
    }
    return true;
  }

  public completeMission() {
    if (!this.currentMission) return;
    this.isMissionActive = false;
    this.currentMission.completed = true;

    // Reward player
    const store = useGameStore.getState();
    store.addCash(this.currentMission.rewardCash);
    store.addXp(this.currentMission.rewardXp);
  }

  public failMission() {
    this.isMissionActive = false;
  }

  public cancelMission() {
    this.isMissionActive = false;
    this.currentMission = null;
    useGameStore.getState().setActiveMissionId(null);
  }
}

export const missionManager = MissionManager.getInstance();
