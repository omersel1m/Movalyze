export type ExerciseMeta = {
  slug: string;
  name: string;
  categorySlug: 'fitness' | 'therapy' | 'pilates';
};

export const EXERCISES: ExerciseMeta[] = [
  { slug: 'biceps-curl', name: 'Biceps Curl', categorySlug: 'fitness' },
  { slug: 'knee-raise', name: 'Knee Raise', categorySlug: 'pilates' },
  { slug: 'shoulder-abduction', name: 'Shoulder Abduction', categorySlug: 'therapy' },
  { slug: 'neck-mobility', name: 'Neck Mobility', categorySlug: 'therapy' },
  { slug: 'breathing-control', name: 'Breathing Control', categorySlug: 'pilates' },
];
