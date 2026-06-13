import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MealType } from '../features/nutrition/types/nutrition.types';

import NutritionScreen from '../features/nutrition/screens/NutritionScreen';
import FoodSearchScreen from '../features/nutrition/screens/FoodSearchScreen';
import FoodDetailScreen from '../features/nutrition/screens/FoodDetailScreen';
import AddCustomFoodScreen from '../features/nutrition/screens/AddCustomFoodScreen';
import NutritionGoalsScreen from '../features/nutrition/screens/NutritionGoalsScreen';

export type NutritionStackParamList = {
  NutritionHome: undefined;
  FoodSearch: { mealType: MealType; date: string };
  FoodDetail: { foodId: string; mealType: MealType; date: string };
  AddCustomFood: undefined;
  NutritionGoals: undefined;
};

const Stack = createNativeStackNavigator<NutritionStackParamList>();

export default function NutritionNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="NutritionHome" component={NutritionScreen} />
      <Stack.Screen name="FoodSearch" component={FoodSearchScreen} />
      <Stack.Screen name="FoodDetail" component={FoodDetailScreen} />
      <Stack.Screen name="AddCustomFood" component={AddCustomFoodScreen} />
      <Stack.Screen name="NutritionGoals" component={NutritionGoalsScreen} />
    </Stack.Navigator>
  );
}
