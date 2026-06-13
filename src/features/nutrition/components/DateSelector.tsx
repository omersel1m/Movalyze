import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react-native';

interface Props {
  date: string;
  isToday: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const months = [
    'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
    'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara',
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function DateSelector({ date, isToday, onPrev, onNext, onToday }: Props) {
  return (
    <View style={styles.root}>
      <TouchableOpacity onPress={onPrev} style={styles.arrowBtn} hitSlop={8}>
        <ChevronLeft size={22} color="#263C84" strokeWidth={1.75} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.center} onPress={onToday}>
        <CalendarDays size={14} color="#8A8A8A" strokeWidth={1.75} />
        <Text style={styles.dateText}>{isToday ? 'Bugün' : formatDate(date)}</Text>
        {!isToday && (
          <Text style={styles.fullDate}>{formatDate(date)}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={onNext} style={styles.arrowBtn} hitSlop={8}>
        <ChevronRight size={22} color="#263C84" strokeWidth={1.75} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  arrowBtn: {
    padding: 4,
  },
  center: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  fullDate: {
    fontSize: 12,
    color: '#8A8A8A',
  },
});
