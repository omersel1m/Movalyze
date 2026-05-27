import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Search, Dumbbell, BarChart2, User } from 'lucide-react-native';

import HomeScreen from '../screens/HomeScreen';
import ExploreScreen from '../screens/ExploreScreen';
import WorkoutNavigator from './WorkoutNavigator';
import StatsScreen from '../screens/stats/StatsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

export type TabParamList = {
  Home: undefined;
  Explore: undefined;
  Workout: undefined;
  Stats: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

type TabIconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const TAB_ICONS: Record<string, TabIconComponent> = {
  Home,
  Explore: Search,
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
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Ana Sayfa' }} />
      <Tab.Screen name="Explore" component={ExploreScreen} options={{ title: 'Keşfet' }} />
      <Tab.Screen name="Workout" component={WorkoutNavigator} options={{ title: 'Antrenman' }} />
      <Tab.Screen name="Stats" component={StatsScreen} options={{ title: 'İstatistik' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
    </Tab.Navigator>
  );
}
