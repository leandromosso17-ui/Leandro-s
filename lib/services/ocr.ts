import { addDays, startOfDay } from 'date-fns';

import type { ScanExtractedMedicine, ScanResult } from '@/lib/types';

/**
 * Prescription OCR boundary.
 *
 * The demo uses `mockPrescriptionScanner`, which walks through realistic
 * pipeline stages and returns structured medicines. Swapping in a real service
 * (Google Document AI, AWS Textract, Mindee, or an LLM vision endpoint) only
 * requires another implementation of `PrescriptionScanner`.
 */
export type ScanStage = {
  key: 'upload' | 'enhance' | 'ocr' | 'structure' | 'schedule';
  label: string;
  /** Rough duration used by the processing screen. */
  ms: number;
};

export const SCAN_STAGES: ScanStage[] = [
  { key: 'upload', label: 'Reading the document', ms: 900 },
  { key: 'enhance', label: 'Cleaning up the image', ms: 800 },
  { key: 'ocr', label: 'Recognising the text', ms: 1100 },
  { key: 'structure', label: 'Finding medicines and dosages', ms: 1000 },
  { key: 'schedule', label: 'Building the schedule', ms: 800 },
];

export type ScanInput = {
  /** Local file uri on native, data url on web. Optional in the demo. */
  uri?: string;
  sourceLabel: string;
};

export type PrescriptionScanner = {
  name: string;
  scan: (
    input: ScanInput,
    onStage?: (stage: ScanStage, index: number) => void,
  ) => Promise<ScanResult>;
};

function isScanExtractedMedicine(value: unknown): value is ScanExtractedMedicine {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'strength' in value &&
    'purpose' in value &&
    'form' in value &&
    'unitsPerIntake' in value &&
    'times' in value &&
    'frequencyLabel' in value &&
    'packSize' in value &&
    'instruction' in value &&
    'foodRule' in value &&
    'prescriber' in value &&
    'color' in value &&
    'confidence' in value &&
    'predictedRunoutISO' in value &&
    typeof value.name === 'string' &&
    typeof value.strength === 'string' &&
    typeof value.purpose === 'string' &&
    typeof value.form === 'string' &&
    typeof value.unitsPerIntake === 'number' &&
    Array.isArray(value.times) &&
    typeof value.frequencyLabel === 'string' &&
    typeof value.packSize === 'number' &&
    typeof value.instruction === 'string' &&
    typeof value.foodRule === 'string' &&
    typeof value.prescriber === 'string' &&
    typeof value.color === 'string' &&
    typeof value.confidence === 'number' &&
    typeof value.predictedRunoutISO === 'string'
  );
}

function isScanResult(value: unknown): value is ScanResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'sourceLabel' in value &&
    'scannedAt' in value &&
    'documentType' in value &&
    'medicines' in value &&
    typeof value.id === 'string' &&
    typeof value.sourceLabel === 'string' &&
    typeof value.scannedAt === 'string' &&
    typeof value.documentType === 'string' &&
    Array.isArray(value.medicines) &&
    value.medicines.every(isScanExtractedMedicine)
  );
}

function mockedMedicines(now: Date): ScanExtractedMedicine[] {
  const runout = (days: number) => addDays(startOfDay(now), days).toISOString();

  return [
    {
      name: 'Levotirox',
      strength: '75 mcg',
      purpose: 'Thyroid support',
      form: 'tablet',
      unitsPerIntake: 1,
      times: ['07:00'],
      frequencyLabel: 'Once daily, empty stomach',
      packSize: 50,
      instruction: 'Take 1 tablet 30 minutes before breakfast',
      foodRule: 'before-food',
      prescriber: 'Dr. Elena Bruni',
      color: 'cream',
      confidence: 0.97,
      predictedRunoutISO: runout(50),
    },
    {
      name: 'Gastroprot',
      strength: '20 mg',
      purpose: 'Stomach protection',
      form: 'capsule',
      unitsPerIntake: 1,
      times: ['07:30'],
      frequencyLabel: 'Once daily, before breakfast',
      packSize: 28,
      instruction: 'Take 1 capsule before breakfast',
      foodRule: 'before-food',
      prescriber: 'Dr. Elena Bruni',
      color: 'blue',
      confidence: 0.94,
      predictedRunoutISO: runout(28),
    },
    {
      name: 'Artrolen',
      strength: '400 mg',
      purpose: 'Joint pain',
      form: 'tablet',
      unitsPerIntake: 1,
      times: ['13:00', '20:00'],
      frequencyLabel: 'Twice daily, with meals',
      packSize: 24,
      instruction: 'Take 1 tablet with lunch and dinner',
      foodRule: 'with-food',
      prescriber: 'Dr. Elena Bruni',
      color: 'gold',
      confidence: 0.88,
      predictedRunoutISO: runout(12),
    },
  ];
}

export const mockPrescriptionScanner: PrescriptionScanner = {
  name: 'mock-ocr',
  async scan(input, onStage) {
    for (const [index, stage] of SCAN_STAGES.entries()) {
      onStage?.(stage, index);
      await new Promise((resolve) => setTimeout(resolve, stage.ms));
    }

    const now = new Date();
    return {
      id: `scan_${now.getTime()}`,
      sourceLabel: input.sourceLabel,
      scannedAt: now.toISOString(),
      documentType: 'prescription',
      medicines: mockedMedicines(now),
    };
  },
};

/** Real OCR placeholder: point `EXPO_PUBLIC_OCR_ENDPOINT` at your backend route. */
export const httpPrescriptionScanner: PrescriptionScanner = {
  name: 'http-ocr',
  async scan(input, onStage) {
    const endpoint = process.env.EXPO_PUBLIC_OCR_ENDPOINT;
    if (!endpoint) {
      throw new Error('OCR endpoint is not configured yet');
    }

    onStage?.(SCAN_STAGES[0], 0);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`OCR service responded with ${response.status}`);
    }

    const body: unknown = await response.json();
    if (!isScanResult(body)) {
      throw new Error('OCR service returned an unexpected response shape');
    }

    return body;
  },
};

export function getPrescriptionScanner(): PrescriptionScanner {
  return process.env.EXPO_PUBLIC_OCR_ENDPOINT ? httpPrescriptionScanner : mockPrescriptionScanner;
}
