import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PlayerProfile,
  GameSettings,
  DrivingState,
  CarCustomization,
  CameraViewMode,
  SteeringControlMode,
} from '../types';
import { DEFAULT_CUSTOMIZATIONS, getCarById } from '../resources/carRegistry';

const STORAGE_KEY = '@life_on_wheels_profile_v1';
const SETTINGS_KEY = '@life_on_wheels_settings_v1';

interface GameStore {
  // Player Profile
  profile: PlayerProfile;
  setProfile: (profile: Partial<PlayerProfile>) => void;
  addCash: (amount: number) => void;
  addXp: (amount: number) => void;
  selectCar: (carId: string) => void;
  updateCarCustomization: (carId: string, custom: Partial<CarCustomization>) => void;

  // Settings
  settings: GameSettings;
  updateSettings: (settings: Partial<GameSettings>) => void;
  calibrateTilt: (currentOffset: number) => void;

  // Driving Telemetry
  driving: DrivingState;
  updateDriving: (state: Partial<DrivingState>) => void;
  resetDriving: () => void;
  cycleCameraView: () => void;

  // Active Mission
  activeMissionId: string | null;
  setActiveMissionId: (missionId: string | null) => void;

  // Persistence
  loadStoredData: () => Promise<void>;
  saveStoredData: () => Promise<void>;
}

const DEFAULT_PROFILE: PlayerProfile = {
  username: 'ApexRider_EG',
  avatarId: 'avatar_1',
  level: 150,
  xp: 8450,
  maxXp: 10000,
  cash: 189000,
  selectedCarId: 'fiat_132',
  serverRegion: 'MENA - Cairo #01',
  customizations: { ...DEFAULT_CUSTOMIZATIONS },
};

const DEFAULT_SETTINGS: GameSettings = {
  steeringMode: 'wheel',
  tiltSensitivity: 1.4,
  tiltCalibratedOffset: 0,
  soundVolume: 0.9,
  sfxVolume: 1.0,
  musicVolume: 0.7,
  hapticsEnabled: true,
  graphicsQuality: 'high',
  transmissionMode: 'auto',
};

const DEFAULT_DRIVING: DrivingState = {
  speedKmh: 0,
  rpm: 850, // idle RPM
  gear: 1,
  throttle: 0,
  brake: 0,
  handbrake: false,
  steeringAngle: 0,
  headlightsOn: true,
  hazardsOn: false,
  driftPoints: 0,
  isDrifting: false,
  cameraView: 'chase',
};

const CAMERA_VIEWS: CameraViewMode[] = ['chase', 'cockpit', 'hood', 'orbit'];

export const useGameStore = create<GameStore>((set, get) => ({
  profile: DEFAULT_PROFILE,
  settings: DEFAULT_SETTINGS,
  driving: DEFAULT_DRIVING,
  activeMissionId: null,

  setProfile: (updates) => {
    set((state) => ({
      profile: { ...state.profile, ...updates },
    }));
    get().saveStoredData();
  },

  addCash: (amount) => {
    set((state) => ({
      profile: {
        ...state.profile,
        cash: Math.max(0, state.profile.cash + amount),
      },
    }));
    get().saveStoredData();
  },

  addXp: (amount) => {
    set((state) => {
      let newXp = state.profile.xp + amount;
      let newLevel = state.profile.level;
      let maxXp = state.profile.maxXp;

      while (newXp >= maxXp) {
        newXp -= maxXp;
        newLevel += 1;
        maxXp = Math.floor(maxXp * 1.15);
      }

      return {
        profile: {
          ...state.profile,
          level: newLevel,
          xp: newXp,
          maxXp,
        },
      };
    });
    get().saveStoredData();
  },

  selectCar: (carId) => {
    set((state) => ({
      profile: { ...state.profile, selectedCarId: carId },
    }));
    get().saveStoredData();
  },

  updateCarCustomization: (carId, custom) => {
    set((state) => {
      const current = state.profile.customizations[carId] || DEFAULT_CUSTOMIZATIONS[carId] || {
        bodyColor: '#214E34',
        rimColor: '#D1D5DB',
        windowTint: 0.2,
        suspensionHeight: 0,
        neonUnderglow: null,
        headlightTint: '#FFFFFF',
        engineTuneLevel: 1,
      };

      return {
        profile: {
          ...state.profile,
          customizations: {
            ...state.profile.customizations,
            [carId]: { ...current, ...custom },
          },
        },
      };
    });
    get().saveStoredData();
  },

  updateSettings: (updates) => {
    set((state) => ({
      settings: { ...state.settings, ...updates },
    }));
    try {
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(get().settings));
    } catch {
      // ignore in offline/test environment
    }
  },

  calibrateTilt: (currentOffset) => {
    set((state) => ({
      settings: { ...state.settings, tiltCalibratedOffset: currentOffset },
    }));
    try {
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(get().settings));
    } catch {
      // ignore
    }
  },

  updateDriving: (updates) => {
    set((state) => ({
      driving: { ...state.driving, ...updates },
    }));
  },

  resetDriving: () => {
    set({ driving: { ...DEFAULT_DRIVING } });
  },

  cycleCameraView: () => {
    set((state) => {
      const currentIndex = CAMERA_VIEWS.indexOf(state.driving.cameraView);
      const nextIndex = (currentIndex + 1) % CAMERA_VIEWS.length;
      return {
        driving: {
          ...state.driving,
          cameraView: CAMERA_VIEWS[nextIndex],
        },
      };
    });
  },

  setActiveMissionId: (missionId) => {
    set({ activeMissionId: missionId });
  },

  loadStoredData: async () => {
    try {
      const [savedProfile, savedSettings] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(SETTINGS_KEY),
      ]);

      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        set((state) => ({
          profile: {
            ...state.profile,
            ...parsed,
            customizations: {
              ...DEFAULT_CUSTOMIZATIONS,
              ...(parsed.customizations || {}),
            },
          },
        }));
      }

      if (savedSettings) {
        set((state) => ({
          settings: { ...state.settings, ...JSON.parse(savedSettings) },
        }));
      }
    } catch (e) {
      console.warn('Failed to load stored profile/settings:', e);
    }
  },

  saveStoredData: async () => {
    try {
      const state = get();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state.profile));
    } catch (e) {
      console.warn('Failed to save profile:', e);
    }
  },
}));
