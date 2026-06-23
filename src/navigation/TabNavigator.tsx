import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Utensils, Dumbbell, BarChart2, User } from 'lucide-react-native';

import NutritionNavigator from './NutritionNavigator';
import WorkoutNavigator from './WorkoutNavigator';
import StatsScreen from '../screens/stats/StatsScreen';
import ProfileNavigator from './ProfileNavigator';

export type TabParamList = {
  Nutrition: undefined;
  Workout: undefined;
  Stats: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

type TabIconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const TAB_ICONS: Record<string, TabIconComponent> = {
  Nutrition: Utensils,
  Workout: Dumbbell,
  Stats: BarChart2,
  Profile: User,
};

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          const IconComponent = TAB_ICONS[route.name];
          return <IconComponent size={size} color={color} strokeWidth={1.75} />;
        },
        headerShown: false,
      })}>
      <Tab.Screen name="Nutrition" component={NutritionNavigator} options={{ title: 'Beslenme' }} />
      <Tab.Screen name="Workout" component={WorkoutNavigator} options={{ title: 'Antrenman' }} />
      <Tab.Screen name="Stats" component={StatsScreen} options={{ title: 'İstatistik' }} />
      <Tab.Screen name="Profile" component={ProfileNavigator} options={{ title: 'Profil' }} />
    </Tab.Navigator>
  );
}
