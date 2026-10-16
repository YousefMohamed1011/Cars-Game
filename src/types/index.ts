export type DriveType = 'RWD' | 'FWD' | 'AWD';

export type SteeringControlMode = 'tilt' | 'wheel' | 'arrows';

export type CameraViewMode = 'chase' | 'cockpit' | 'hood' | 'orbit';

export interface CarSpecs {
  id: string;
  name: string;
  brand: string;
  year: number;
  engine: string;
  horsepower: number;
  topSpeedKmh: number;
  acceleration0to100: number; // in seconds
  driveType: DriveType;
  transmission: '5-Speed Manual' | 'Automatic' | '6-Speed Manual';
  gearRatios: number[];
  finalDriveRatio: number;
  weightKg: number;
  price: number;
  unlocked: boolean;
  defaultColor: string;
  defaultRimColor: string;
  tagline: string;
  description: string;
  soundProfile: 'classic_twincam' | 'modern_inline4' | 'aggressive_inline6';
}

export interface CarCustomization {
  bodyColor: string;
  rimColor: string;
  windowTint: number; // 0 (clear) to 1 (limo tint)
  suspensionHeight: number; // -0.05 (slammed) to 0.05 (raised)
  neonUnderglow: string | null; // hex color or null for off
  headlightTint: string;
  engineTuneLevel: number; // 1 to 3
}

export interface PlayerProfile {
  username: string;
  avatarId: string;
  level: number;
  xp: number;
  maxXp: number;
  cash: number;
  selectedCarId: string;
  serverRegion: string;
  customizations: Record<string, CarCustomization>;
}

export interface GameSettings {
  steeringMode: SteeringControlMode;
  tiltSensitivity: number; // 0.5 to 2.5
  tiltCalibratedOffset: number; // offset in degrees/rads
  soundVolume: number; // 0 to 1
  sfxVolume: number;
  musicVolume: number;
  hapticsEnabled: boolean;
  graphicsQuality: 'low' | 'medium' | 'high';
  transmissionMode: 'auto' | 'manual';
}

export interface Mission {
  id: string;
  title: string;
  subtitle: string;
  carId: string;
  rewardCash: number;
  rewardXp: number;
  timeLimitSec: number;
  type: 'delivery' | 'time_attack' | 'drift' | 'parking' | 'free_roam';
  description: string;
  targetScore?: number;
  checkpoints: { x: number; z: number }[];
  completed: boolean;
}

export interface DrivingState {
  speedKmh: number;
  rpm: number;
  gear: number; // -1 for Reverse, 0 for Neutral, 1-5 for gears
  throttle: number;
  brake: number;
  handbrake: boolean;
  steeringAngle: number; // -1 (left) to 1 (right)
  headlightsOn: boolean;
  hazardsOn: boolean;
  driftPoints: number;
  isDrifting: boolean;
  cameraView: CameraViewMode;
}
