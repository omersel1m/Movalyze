import React from 'react';

type LucideIconComponent = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

interface IconProps {
  icon: LucideIconComponent;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export default function Icon({
  icon: IconComponent,
  size = 22,
  color = '#1A1A2E',
  strokeWidth = 1.75,
}: IconProps) {
  return <IconComponent size={size} color={color} strokeWidth={strokeWidth} />;
}
