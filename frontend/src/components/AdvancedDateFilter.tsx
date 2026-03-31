import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

export type FilterMode = 'preset' | 'day' | 'week' | 'month' | 'year';
export type PresetFilter = 'today' | 'week' | 'month';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface AdvancedDateFilterProps {
  onFilterChange: (filterType: string, startDate?: string, endDate?: string) => void;
  currentFilter: string;
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function AdvancedDateFilter({ onFilterChange, currentFilter }: AdvancedDateFilterProps) {
  const [mode, setMode] = useState<FilterMode>('preset');
  const [showModal, setShowModal] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<PresetFilter>('month');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [customLabel, setCustomLabel] = useState('');

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const handlePresetSelect = (preset: PresetFilter) => {
    setSelectedPreset(preset);
    setMode('preset');
    setCustomLabel('');
    onFilterChange(preset);
    setShowModal(false);
  };

  const handleDaySelect = (date: Date) => {
    setSelectedDate(date);
    setMode('day');
    const start = startOfDay(date);
    const end = endOfDay(date);
    setCustomLabel(format(date, "dd MMM yyyy", { locale: es }));
    onFilterChange('custom', start.toISOString(), end.toISOString());
    setShowModal(false);
  };

  const handleWeekSelect = (date: Date) => {
    setSelectedWeek(date);
    setMode('week');
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const end = endOfWeek(date, { weekStartsOn: 1 });
    setCustomLabel(`Sem. ${format(start, "dd", { locale: es })}-${format(end, "dd MMM", { locale: es })}`);
    onFilterChange('custom', start.toISOString(), end.toISOString());
    setShowModal(false);
  };

  const handleMonthSelect = (month: number, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
    setMode('month');
    const date = new Date(year, month, 1);
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    setCustomLabel(`${MONTHS[month]} ${year}`);
    onFilterChange('custom', start.toISOString(), end.toISOString());
    setShowModal(false);
  };

  const handleYearSelect = (year: number) => {
    setSelectedYear(year);
    setMode('year');
    const date = new Date(year, 0, 1);
    const start = startOfYear(date);
    const end = endOfYear(date);
    setCustomLabel(`Año ${year}`);
    onFilterChange('custom', start.toISOString(), end.toISOString());
    setShowModal(false);
  };

  const getFilterLabel = () => {
    if (customLabel) return customLabel;
    switch (selectedPreset) {
      case 'today': return 'Hoy';
      case 'week': return 'Semana';
      case 'month': return 'Mes';
      default: return 'Mes';
    }
  };

  // Simple calendar for day selection
  const renderDayPicker = () => {
    const now = new Date();
    const currentMonth = selectedDate.getMonth();
    const currentYear = selectedDate.getFullYear();
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      const isSelected = selectedDate.toDateString() === date.toDateString();
      const isToday = now.toDateString() === date.toDateString();
      days.push(
        <TouchableOpacity
          key={day}
          style={[styles.calendarDay, isSelected && styles.calendarDaySelected, isToday && styles.calendarDayToday]}
          onPress={() => handleDaySelect(date)}
        >
          <Text style={[styles.calendarDayText, isSelected && styles.calendarDayTextSelected]}>
            {day}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <View>
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={() => setSelectedDate(new Date(currentYear, currentMonth - 1, 1))}>
            <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.calendarTitle}>
            {MONTHS[currentMonth]} {currentYear}
          </Text>
          <TouchableOpacity onPress={() => setSelectedDate(new Date(currentYear, currentMonth + 1, 1))}>
            <Ionicons name="chevron-forward" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.weekdaysRow}>
          {WEEKDAYS.map(day => (
            <Text key={day} style={styles.weekdayText}>{day}</Text>
          ))}
        </View>
        <View style={styles.calendarGrid}>{days}</View>
      </View>
    );
  };

  // Week picker
  const renderWeekPicker = () => {
    const currentMonth = selectedWeek.getMonth();
    const currentYear = selectedWeek.getFullYear();
    const weeks = [];
    
    // Get all weeks of the month
    let date = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    
    while (date <= lastDay) {
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
      const isSelected = weekStart.toDateString() === startOfWeek(selectedWeek, { weekStartsOn: 1 }).toDateString();
      
      weeks.push(
        <TouchableOpacity
          key={weekStart.toISOString()}
          style={[styles.weekRow, isSelected && styles.weekRowSelected]}
          onPress={() => handleWeekSelect(weekStart)}
        >
          <Text style={[styles.weekText, isSelected && styles.weekTextSelected]}>
            {format(weekStart, "dd", { locale: es })} - {format(weekEnd, "dd MMM", { locale: es })}
          </Text>
        </TouchableOpacity>
      );
      
      date = new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    return (
      <View>
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={() => setSelectedWeek(new Date(currentYear, currentMonth - 1, 1))}>
            <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.calendarTitle}>
            {MONTHS[currentMonth]} {currentYear}
          </Text>
          <TouchableOpacity onPress={() => setSelectedWeek(new Date(currentYear, currentMonth + 1, 1))}>
            <Ionicons name="chevron-forward" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.weeksList}>{weeks}</View>
      </View>
    );
  };

  // Month picker
  const renderMonthPicker = () => {
    return (
      <View>
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={() => setSelectedYear(selectedYear - 1)}>
            <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.calendarTitle}>{selectedYear}</Text>
          <TouchableOpacity onPress={() => setSelectedYear(selectedYear + 1)}>
            <Ionicons name="chevron-forward" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.monthsGrid}>
          {MONTHS.map((month, index) => {
            const isSelected = selectedMonth === index && mode === 'month';
            return (
              <TouchableOpacity
                key={month}
                style={[styles.monthItem, isSelected && styles.monthItemSelected]}
                onPress={() => handleMonthSelect(index, selectedYear)}
              >
                <Text style={[styles.monthText, isSelected && styles.monthTextSelected]}>
                  {month.substring(0, 3)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // Year picker
  const renderYearPicker = () => {
    return (
      <View style={styles.yearsGrid}>
        {years.map(year => {
          const isSelected = selectedYear === year && mode === 'year';
          return (
            <TouchableOpacity
              key={year}
              style={[styles.yearItem, isSelected && styles.yearItemSelected]}
              onPress={() => handleYearSelect(year)}
            >
              <Text style={[styles.yearText, isSelected && styles.yearTextSelected]}>
                {year}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const [activeTab, setActiveTab] = useState<'preset' | 'day' | 'week' | 'month' | 'year'>('preset');

  return (
    <View style={styles.container}>
      {/* Quick filters */}
      <View style={styles.quickFilters}>
        <TouchableOpacity
          style={[styles.quickFilter, selectedPreset === 'today' && mode === 'preset' && styles.quickFilterActive]}
          onPress={() => handlePresetSelect('today')}
        >
          <Text style={[styles.quickFilterText, selectedPreset === 'today' && mode === 'preset' && styles.quickFilterTextActive]}>
            Hoy
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickFilter, selectedPreset === 'week' && mode === 'preset' && styles.quickFilterActive]}
          onPress={() => handlePresetSelect('week')}
        >
          <Text style={[styles.quickFilterText, selectedPreset === 'week' && mode === 'preset' && styles.quickFilterTextActive]}>
            Semana
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickFilter, selectedPreset === 'month' && mode === 'preset' && styles.quickFilterActive]}
          onPress={() => handlePresetSelect('month')}
        >
          <Text style={[styles.quickFilterText, selectedPreset === 'month' && mode === 'preset' && styles.quickFilterTextActive]}>
            Mes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.advancedButton, mode !== 'preset' && styles.advancedButtonActive]}
          onPress={() => setShowModal(true)}
        >
          <Ionicons name="calendar-outline" size={16} color={mode !== 'preset' ? '#fff' : COLORS.primary} />
          <Text style={[styles.advancedButtonText, mode !== 'preset' && styles.advancedButtonTextActive]}>
            {mode !== 'preset' ? customLabel : 'Avanzado'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Advanced date picker modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtrar por Fecha</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'day' && styles.tabActive]}
                onPress={() => setActiveTab('day')}
              >
                <Text style={[styles.tabText, activeTab === 'day' && styles.tabTextActive]}>Día</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'week' && styles.tabActive]}
                onPress={() => setActiveTab('week')}
              >
                <Text style={[styles.tabText, activeTab === 'week' && styles.tabTextActive]}>Semana</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'month' && styles.tabActive]}
                onPress={() => setActiveTab('month')}
              >
                <Text style={[styles.tabText, activeTab === 'month' && styles.tabTextActive]}>Mes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'year' && styles.tabActive]}
                onPress={() => setActiveTab('year')}
              >
                <Text style={[styles.tabText, activeTab === 'year' && styles.tabTextActive]}>Año</Text>
              </TouchableOpacity>
            </ScrollView>

            <ScrollView style={styles.pickerContent}>
              {activeTab === 'day' && renderDayPicker()}
              {activeTab === 'week' && renderWeekPicker()}
              {activeTab === 'month' && renderMonthPicker()}
              {activeTab === 'year' && renderYearPicker()}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  quickFilters: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    flexWrap: 'wrap',
  },
  quickFilter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickFilterActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  quickFilterText: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  quickFilterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  advancedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: 4,
  },
  advancedButtonActive: {
    backgroundColor: COLORS.primary,
  },
  advancedButtonText: {
    fontSize: 13,
    color: COLORS.primary,
  },
  advancedButtonTextActive: {
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: COLORS.background,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  pickerContent: {
    padding: 20,
    maxHeight: 400,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekdayText: {
    width: 40,
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  calendarDaySelected: {
    backgroundColor: COLORS.primary,
  },
  calendarDayToday: {
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  calendarDayText: {
    fontSize: 14,
    color: COLORS.text,
  },
  calendarDayTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  weeksList: {
    gap: 8,
  },
  weekRow: {
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: 12,
  },
  weekRowSelected: {
    backgroundColor: COLORS.primary,
  },
  weekText: {
    fontSize: 14,
    color: COLORS.text,
  },
  weekTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthItem: {
    width: '30%',
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    alignItems: 'center',
  },
  monthItemSelected: {
    backgroundColor: COLORS.primary,
  },
  monthText: {
    fontSize: 14,
    color: COLORS.text,
  },
  monthTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  yearsGrid: {
    gap: 8,
  },
  yearItem: {
    padding: 20,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    alignItems: 'center',
  },
  yearItemSelected: {
    backgroundColor: COLORS.primary,
  },
  yearText: {
    fontSize: 18,
    color: COLORS.text,
  },
  yearTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
});
