import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FUNNEL_STAGES, HEALTH_COLORS, STAGE_COLORS } from '../../src/constants/theme';
import { getDashboardMetrics, getDCAMetrics, AgencyMetrics } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

type FilterType = 'today' | 'week' | 'month';

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterType>('month');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [agencies, setAgencies] = useState<AgencyMetrics[]>([]);
  const [dcaMetrics, setDcaMetrics] = useState<any>(null);

  const isDCA = user?.role === 'DCA';

  const fetchData = useCallback(async () => {
    try {
      if (isDCA && user?.id) {
        const data = await getDCAMetrics(user.id, filter);
        setDcaMetrics(data);
      } else {
        const data = await getDashboardMetrics(filter);
        setAgencies(data.agencies);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, isDCA, user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const FilterButton = ({ type, label }: { type: FilterType; label: string }) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === type && styles.filterButtonActive]}
      onPress={() => setFilter(type)}
    >
      <Text style={[styles.filterText, filter === type && styles.filterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const HealthIndicator = ({ status }: { status: string }) => (
    <View style={[styles.healthDot, { backgroundColor: HEALTH_COLORS[status] || COLORS.textMuted }]} />
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // DCA Dashboard
  if (isDCA && dcaMetrics) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Hola, {user?.name}</Text>
              <Text style={styles.subtitle}>{dcaMetrics.agency}</Text>
            </View>
            <TouchableOpacity style={styles.addButton} onPress={() => router.push('/(auth)/lead/new')}>
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.filterContainer}>
            <FilterButton type="today" label="Hoy" />
            <FilterButton type="week" label="Semana" />
            <FilterButton type="month" label="Mes" />
          </View>

          {/* Quick Stats */}
          <View style={styles.quickStats}>
            <View style={styles.quickStatCard}>
              <Ionicons name="flash" size={24} color={COLORS.warning} />
              <Text style={styles.quickStatNumber}>{dcaMetrics.new_leads_today}</Text>
              <Text style={styles.quickStatLabel}>Nuevos Hoy</Text>
            </View>
            <View style={styles.quickStatCard}>
              <Ionicons name="time" size={24} color={COLORS.danger} />
              <Text style={styles.quickStatNumber}>{dcaMetrics.pending_leads}</Text>
              <Text style={styles.quickStatLabel}>Pendientes</Text>
            </View>
            <View style={styles.quickStatCard}>
              <Ionicons name="calendar" size={24} color={COLORS.secondary} />
              <Text style={styles.quickStatNumber}>{dcaMetrics.todays_appointments}</Text>
              <Text style={styles.quickStatLabel}>Citas Hoy</Text>
            </View>
          </View>

          {/* Personal Funnel */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mi Embudo</Text>
            <View style={styles.funnelContainer}>
              {FUNNEL_STAGES.map((stage) => (
                <View key={stage} style={styles.funnelRow}>
                  <View style={[styles.funnelDot, { backgroundColor: STAGE_COLORS[stage] }]} />
                  <Text style={styles.funnelStage}>{stage}</Text>
                  <Text style={styles.funnelCount}>{dcaMetrics.stages[stage] || 0}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Conversion Rates */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mis Conversiones</Text>
            <View style={styles.conversionGrid}>
              {['Contactado', 'Citado', 'Cumplida', 'Cierre'].map((stage) => (
                <View key={stage} style={styles.conversionItem}>
                  <Text style={styles.conversionValue}>{dcaMetrics.conversion_rates[stage] || 0}%</Text>
                  <Text style={styles.conversionLabel}>{stage}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Main Dashboard (for managers, directors, etc.)
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hola, {user?.name}</Text>
            <Text style={styles.subtitle}>{user?.role}</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={() => router.push('/(auth)/lead/new')}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.filterContainer}>
          <FilterButton type="today" label="Hoy" />
          <FilterButton type="week" label="Semana" />
          <FilterButton type="month" label="Mes" />
        </View>

        {/* Agency Cards */}
        {agencies.map((agency) => (
          <TouchableOpacity
            key={agency.agency}
            style={styles.agencyCard}
            onPress={() => router.push(`/(auth)/agency/${agency.agency}`)}
          >
            <View style={styles.agencyHeader}>
              <Text style={styles.agencyName}>{agency.agency}</Text>
              <View style={styles.healthIndicators}>
                {['Contactado', 'Citado', 'Cumplida', 'Cierre'].map((stage) => (
                  <HealthIndicator key={stage} status={agency.health[stage]} />
                ))}
              </View>
            </View>

            <View style={styles.agencyStats}>
              <View style={styles.agencyStat}>
                <Text style={styles.agencyStatNumber}>{agency.total_leads}</Text>
                <Text style={styles.agencyStatLabel}>Leads</Text>
              </View>
              {FUNNEL_STAGES.slice(1, 4).map((stage) => (
                <View key={stage} style={styles.agencyStat}>
                  <Text style={styles.agencyStatNumber}>{agency.stages[stage] || 0}</Text>
                  <Text style={styles.agencyStatLabel}>{stage}</Text>
                </View>
              ))}
            </View>

            <View style={styles.agencyBottom}>
              <View style={styles.agencyFunnel}>
                {FUNNEL_STAGES.slice(4).map((stage) => (
                  <View key={stage} style={styles.smallStat}>
                    <Text style={styles.smallStatLabel}>{stage}</Text>
                    <Text style={styles.smallStatNumber}>{agency.stages[stage] || 0}</Text>
                  </View>
                ))}
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 2,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  agencyCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  agencyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  agencyName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  healthIndicators: {
    flexDirection: 'row',
    gap: 4,
  },
  healthDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  agencyStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  agencyStat: {
    alignItems: 'center',
  },
  agencyStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  agencyStatLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  agencyBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  agencyFunnel: {
    flexDirection: 'row',
    gap: 16,
  },
  smallStat: {
    alignItems: 'center',
  },
  smallStatLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  smallStatNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  // DCA Dashboard Styles
  quickStats: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  quickStatNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 8,
  },
  quickStatLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
  },
  funnelContainer: {
    gap: 12,
  },
  funnelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  funnelDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  funnelStage: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  funnelCount: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  conversionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  conversionItem: {
    width: '47%',
    backgroundColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  conversionValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  conversionLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 4,
  },
});
