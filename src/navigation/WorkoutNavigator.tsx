import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CategoryScreen from '../screens/workout/CategoryScreen';
import ExerciseListScreen from '../screens/workout/ExerciseListScreen';

export type WorkoutStackParamList = {
  CategoryList: undefined;
  ExerciseList: {
    categoryId: string;
    categoryName: string;
    categoryColor: string;
  };
};

const Stack = createNativeStackNavigator<WorkoutStackParamList>();

export default function WorkoutNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CategoryList" component={CategoryScreen} />
      <Stack.Screen name="ExerciseList" component={ExerciseListScreen} />
    </Stack.Navigator>
  );
}
