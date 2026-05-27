export type ExerciseMeta = {
  slug: string;
  name: string;
  categorySlug: 'fitness' | 'therapy' | 'pilates';
};

export const EXERCISES: ExerciseMeta[] = [
  { slug: 'biceps-curl', name: 'Biceps Curl', categorySlug: 'fitness' },
  { slug: 'neck-mobility', name: 'Neck Mobility', categorySlug: 'therapy' },
  { slug: 'breathing-control', name: 'Breathing Control', categorySlug: 'pilates' },
];
