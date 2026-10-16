import { CarSpecs, CarCustomization } from '../types';

export const CAR_REGISTRY: CarSpecs[] = [
  {
    id: 'fiat_132',
    name: 'FIAT 132 (2000cc)',
    brand: 'FIAT',
    year: 1978,
    engine: '2.0L DOHC Naturally Aspirated 4-Cylinder',
    horsepower: 112,
    topSpeedKmh: 175,
    acceleration0to100: 10.8,
    driveType: 'RWD',
    transmission: '5-Speed Manual',
    gearRatios: [3.67, 2.10, 1.36, 1.00, 0.88],
    finalDriveRatio: 3.9,
    weightKg: 1140,
    price: 35000,
    unlocked: true,
    defaultColor: '#214E34', // Forest Metallic Green
    defaultRimColor: '#D1D5DB', // Classic silver alloy
    tagline: 'Classic Italian Muscle & DOHC Heritage',
    description: 'Iconic 1970s Italian executive sedan featuring an authentic Lampredi twin-cam 2000cc engine, genuine rear-wheel drive mechanical feedback, vintage chrome bumpers, and classic body roll dynamics.',
    soundProfile: 'classic_twincam',
  },
  {
    id: 'optra_2012',
    name: 'CHEVROLET OPTRA 2012',
    brand: 'CHEVROLET',
    year: 2012,
    engine: '1.6L E-TEC II DOHC 16V',
    horsepower: 107,
    topSpeedKmh: 188,
    acceleration0to100: 11.5,
    driveType: 'FWD',
    transmission: 'Automatic',
    gearRatios: [2.86, 1.56, 1.00, 0.70, 0.55],
    finalDriveRatio: 4.1,
    weightKg: 1220,
    price: 48000,
    unlocked: true,
    defaultColor: '#0A0A0A', // Obsidian Gloss Black
    defaultRimColor: '#E5E7EB', // 5-spoke silver alloy
    tagline: 'Reliable Urban Workhorse & Smooth Cruiser',
    description: 'A staple of modern metropolitan city streets, delivering dependable front-wheel drive stability, silky smooth hydraulic damping, distinctive split front grille with gold bowtie emblem, and effortless daily cruising.',
    soundProfile: 'modern_inline4',
  },
  {
    id: 'bmw_e30',
    name: 'BMW E30 (325i)',
    brand: 'BMW',
    year: 1988,
    engine: '2.5L M20B25 Inline-6',
    horsepower: 168,
    topSpeedKmh: 218,
    acceleration0to100: 7.7,
    driveType: 'RWD',
    transmission: '5-Speed Manual',
    gearRatios: [3.83, 2.20, 1.40, 1.00, 0.81],
    finalDriveRatio: 3.73,
    weightKg: 1180,
    price: 95000,
    unlocked: true,
    defaultColor: '#C0C4C8', // Metallic Titanium Silver
    defaultRimColor: '#F3F4F6', // BBS cross-spoke mesh
    tagline: 'The Ultimate Drift & Precision Driving Machine',
    description: 'The legendary German icon renowned worldwide for near 50:50 weight distribution, raspy naturally aspirated inline-6 wail, M-Tech aero styling, quad round headlights, and razor-sharp oversteer drift handling.',
    soundProfile: 'aggressive_inline6',
  },
];

export const DEFAULT_CUSTOMIZATIONS: Record<string, CarCustomization> = {
  fiat_132: {
    bodyColor: '#214E34',
    rimColor: '#D1D5DB',
    windowTint: 0.15,
    suspensionHeight: 0.0,
    neonUnderglow: null,
    headlightTint: '#FFF8E7',
    engineTuneLevel: 1,
  },
  optra_2012: {
    bodyColor: '#0A0A0A',
    rimColor: '#E5E7EB',
    windowTint: 0.5,
    suspensionHeight: 0.0,
    neonUnderglow: null,
    headlightTint: '#FFFFFF',
    engineTuneLevel: 1,
  },
  bmw_e30: {
    bodyColor: '#C0C4C8',
    rimColor: '#F3F4F6',
    windowTint: 0.35,
    suspensionHeight: -0.02,
    neonUnderglow: '#00E5FF',
    headlightTint: '#FFFEE0',
    engineTuneLevel: 1,
  },
};

export const COLOR_PALETTE = [
  { name: 'Forest Green', hex: '#214E34' },
  { name: 'Obsidian Black', hex: '#0A0A0A' },
  { name: 'Titanium Silver', hex: '#C0C4C8' },
  { name: 'Cairo Desert Sand', hex: '#C2A370' },
  { name: 'Midnight Navy Blue', hex: '#0F1E36' },
  { name: 'Rosso Corsa Red', hex: '#B91C1C' },
  { name: 'Nardo Grey', hex: '#707780' },
  { name: 'Acid Neon Yellow', hex: '#DFFF00' },
  { name: 'Cyber Cyan', hex: '#00E5FF' },
  { name: 'Pure Pearl White', hex: '#F9FAFB' },
];

export const NEON_COLORS = [
  { name: 'Off', hex: null },
  { name: 'Cyber Cyan', hex: '#00E5FF' },
  { name: 'Electric Purple', hex: '#A855F7' },
  { name: 'Lime Green', hex: '#22C55E' },
  { name: 'Blaze Orange', hex: '#F97316' },
  { name: 'Crimson Red', hex: '#EF4444' },
  { name: 'Cold White', hex: '#E0F2FE' },
];

export const getCarById = (id: string): CarSpecs => {
  return CAR_REGISTRY.find((car) => car.id === id) || CAR_REGISTRY[0];
};
