import { useState, useCallback, useEffect, useRef } from 'react';
import { nutritionService } from '../../../services/nutrition.service';
import { Food } from '../types/nutrition.types';

export type SearchTab = 'all' | 'recent' | 'favorites' | 'mine';

export function useFoodSearch() {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const [results, setResults] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncedRef = useRef(false);

  // Keep a stable ref to the latest query/tab so async callbacks read current values
  const stateRef = useRef({ query, activeTab });
  useEffect(() => {
    stateRef.current = { query, activeTab };
  });

  const search = useCallback(async (q: string, tab: SearchTab) => {
    setLoading(true);
    try {
      let foods: Food[];
      if (tab === 'recent') {
        foods = await nutritionService.getRecentFoods(30);
        if (q) {
          const lower = q.toLowerCase();
          foods = foods.filter(f => f.name.toLowerCase().includes(lower));
        }
      } else if (tab === 'favorites') {
        foods = await nutritionService.searchFoods(q, { onlyFavorites: true });
      } else if (tab === 'mine') {
        foods = await nutritionService.searchFoods(q, { onlyMine: true });
      } else {
        foods = await nutritionService.searchFoods(q);
      }
      setResults(foods);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Stable ref to search so async callbacks always call the latest version
  const searchRef = useRef(search);
  useEffect(() => { searchRef.current = search; });

  // Sync system foods from Supabase to SQLite on first mount
  useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;

    setSyncing(true);
    nutritionService.syncFoodsFromSupabase()
      .catch(() => { /* offline — user can still add custom foods */ })
      .finally(() => {
        setSyncing(false);
        // Use ref to get current query/tab at the time sync finishes
        const { query: q, activeTab: tab } = stateRef.current;
        searchRef.current(q, tab);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search on query / tab changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(query, activeTab);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, activeTab, search]);

  const refresh = useCallback(() => {
    search(stateRef.current.query, stateRef.current.activeTab);
  }, [search]);

  return {
    query,
    setQuery,
    activeTab,
    setActiveTab,
    results,
    loading,   // search in progress — controls spinner in content area
    syncing,   // background catalog sync — show as subtle top indicator
    refresh,
  };
}
