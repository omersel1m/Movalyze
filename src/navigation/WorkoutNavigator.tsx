import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CategoryScreen from '../screens/workout/CategoryScreen';
import ExerciseListScreen from '../screens/workout/ExerciseListScreen';
import ExerciseCameraScreen from '../features/workout/screens/ExerciseCameraScreen';

export type WorkoutStackParamList = {
  CategoryList: undefined;
  ExerciseList: {
    categoryId: string;
    categoryName: string;
    categoryColor: string;
  };
  ExerciseCamera: {
    exerciseId: string;
    exerciseName: string;
    exerciseSlug: string;
    categoryColor: string;
  };
};

const Stack = createNativeStackNavigator<WorkoutStackParamList>();

export default function WorkoutNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CategoryList" component={CategoryScreen} />
      <Stack.Screen name="ExerciseList" component={ExerciseListScreen} />
      <Stack.Screen
        name="ExerciseCamera"
        component={ExerciseCameraScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}
