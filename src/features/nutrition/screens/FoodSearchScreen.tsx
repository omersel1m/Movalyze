import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, Search, Plus } from 'lucide-react-native';

import { NutritionStackParamList } from '../../../navigation/NutritionNavigator';
import { useFoodSearch } from '../hooks/useFoodSearch';
import { nutritionService } from '../../../services/nutrition.service';
import { Food } from '../types/nutrition.types';
import FoodCard from '../components/FoodCard';

type Nav = NativeStackNavigationProp<NutritionStackParamList, 'FoodSearch'>;
type Route = RouteProp<NutritionStackParamList, 'FoodSearch'>;

type SearchTab = 'all' | 'recent' | 'favorites' | 'mine';
const TABS: { key: SearchTab; label: string }[] = [
  { key: 'all',       label: 'Tümü' },
  { key: 'recent',    label: 'Son Eklenenler' },
  { key: 'favorites', label: 'Favoriler' },
  { key: 'mine',      label: 'Benim Besinlerim' },
];

export default function FoodSearchScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { mealType, date } = route.params;

  const { query, setQuery, activeTab, setActiveTab, results, loading, syncing, refresh } = useFoodSearch();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const isMountedRef = useRef(false);

  // Re-run search when screen comes back into focus (e.g. after AddCustomFood)
  useFocusEffect(
    React.useCallback(() => {
      if (isMountedRef.current) {
        refresh();
      }
      isMountedRef.current = true;
    }, [refresh]),
  );

  const handleFoodPress = (food: Food) => {
    navigation.navigate('FoodDetail', { foodId: food.id, mealType, date });
  };

  const handleToggleFavorite = async (food: Food) => {
    await nutritionService.toggleFavorite(food.id);
    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (next.has(food.id)) next.delete(food.id);
      else next.add(food.id);
      return next;
    });
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={22} color="#1A1A2E" strokeWidth={1.75} />
        </TouchableOpacity>
        <Text style={styles.title}>Besin Ara</Text>
        <TouchableOpacity
          style={styles.addNewBtn}
          onPress={() => navigation.navigate('AddCustomFood')}
        >
          <Plus size={18} color="#263C84" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Search size={16} color="#8A8A8A" strokeWidth={1.75} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Besin ara…"
          placeholderTextColor="#ADADAD"
          returnKeyType="search"
          autoFocus
        />
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab.key as SearchTab)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Background sync indicator */}
      {syncing && (
        <ActivityIndicator style={styles.syncIndicator} size="small" color="#263C84" />
      )}

      {/* Results */}
      {loading ? (
        <ActivityIndicator style={styles.loader} color="#263C84" />
      ) : results.length === 0 ? (
        <View style={styles.emptyState}>
          <Search size={40} color="#E0E0E0" strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>
            {query
              ? `"${query}" için sonuç yok`
              : syncing
              ? 'Besin kataloğu yükleniyor…'
              : 'Aramaya başlayın'}
          </Text>
          <Text style={styles.emptySubtitle}>
            Bulamadıysanız kendi besininizi ekleyebilirsiniz.
          </Text>
          <TouchableOpacity
            style={styles.addCustomBtn}
            onPress={() => navigation.navigate('AddCustomFood')}
          >
            <Plus size={14} color="#263C84" strokeWidth={2} />
            <Text style={styles.addCustomText}>Yeni Besin Ekle</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <FoodCard
              food={item}
              isFavorite={favoriteIds.has(item.id)}
              onPress={handleFoodPress}
              onToggleFavorite={handleToggleFavorite}
            />
          )}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 28,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  addNewBtn: { padding: 4 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A2E',
    padding: 0,
  },

  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  tabBtnActive: {
    backgroundColor: '#263C84',
    borderColor: '#263C84',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A8A8A',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },

  syncIndicator: { alignSelf: 'flex-end', marginRight: 16, marginBottom: 4 },
  loader: { marginTop: 40 },

  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#8A8A8A',
    textAlign: 'center',
  },
  addCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#263C84',
    marginTop: 8,
  },
  addCustomText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#263C84',
  },
});
