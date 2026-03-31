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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FUNNEL_STAGES, HEALTH_COLORS, STAGE_COLORS } from '../../../src/constants/theme';
import { getAgencyMetrics } from '../../../src/services/api';

export default function AgencyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [filter, setFilter] = useState<'today' | 'week' | 'month'>('month');

  const fetchData = useCallback(async () => {
    try {
      const result = await getAgencyMetrics(id || '', filter);
      setData(result);
    } catch (error) {
      console.error('Error fetching agency metrics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, filter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const FilterButton = ({ type, label }: { type: 'today' | 'week' | 'month'; label: string }) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === type && styles.filterButtonActive]}
      onPress={() => setFilter(type)}
    >
      <Text style={[styles.filterText, filter === type && styles.filterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const getHealthStatus = (rate: number, threshold: number) => {
    if (rate >= threshold) return 'green';
    if (rate >= threshold * 0.7) return 'yellow';
    return 'red';
  };

  const formatCurrency = (value: number) => '$' + value.toLocaleString('es-MX');

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{id}</Text>
        </View>

        <View style={styles.filterContainer}>
          <FilterButton type="today" label="Hoy" />
          <FilterButton type="week" label="Semana" />
          <FilterButton type="month" label="Mes" />
        </View>

        {/* Summary Stats */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryLabel}>Tiempo Promedio</Text>
              <Text style={styles.summaryValue}>{data?.avg_time_to_sale_days || 0} días</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryLabel}>Facturadas</Text>
              <Text style={[styles.summaryValue, { color: COLORS.success }]}>
                {data?.recent_sales?.length || 0}
              </Text>
            </View>
          </View>
        </View>

        {/* DCAs Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DCAs</Text>
          {data?.dca_metrics?.map((dca: any) => (
            <View key={dca.id} style={styles.dcaCard}>
              <View style={styles.dcaHeader}>
                <View style={styles.dcaInfo}>
                  <View style={styles.dcaAvatar}>
                    <Ionicons name="person" size={20} color={COLORS.primary} />
                  </View>
                  <View>
                    <Text style={styles.dcaName}>{dca.name}</Text>
                    <Text style={styles.dcaLeads}>{dca.total_leads} leads</Text>
                  </View>
                </View>
                <View style={styles.healthIndicators}>
                  {['Contactado', 'Citado', 'Cumplida', 'Cierre'].map((stage) => {
                    const thresholds: Record<string, number> = { Contactado: 90, Citado: 60, Cumplida: 65, Cierre: 25 };
                    const status = getHealthStatus(dca.conversion_rates[stage] || 0, thresholds[stage]);
                    return (
                      <View
                        key={stage}
                        style={[styles.healthDot, { backgroundColor: HEALTH_COLORS[status] }]}
                      />
                    );
                  })}
                </View>
              </View>

              {/* DCA Funnel */}
              <View style={styles.dcaFunnel}>
                {FUNNEL_STAGES.map((stage) => (
                  <View key={stage} style={styles.funnelItem}>
                    <Text style={styles.funnelCount}>{dca.stages[stage] || 0}</Text>
                    <Text style={styles.funnelLabel}>{stage.substring(0, 3)}</Text>
                  </View>
                ))}
              </View>

              {/* Conversion Rates */}
              <View style={styles.conversionRow}>
                {['Contactado', 'Citado', 'Cumplida', 'Cierre'].map((stage) => (
                  <View key={stage} style={styles.conversionItem}>
                    <Text style={styles.conversionRate}>{dca.conversion_rates[stage] || 0}%</Text>
                    <Text style={styles.conversionLabel}>{stage.substring(0, 4)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Recent Sales */}
        {data?.recent_sales?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ventas Recientes</Text>
            <View style={styles.salesCard}>
              {data.recent_sales.map((sale: any, index: number) => (
                <View
                  key={sale.id}
                  style={[styles.saleRow, index > 0 && styles.saleRowBorder]}
                >
                  <View style={styles.saleInfo}>
                    <Text style={styles.saleName}>{sale.lead_name}</Text>
                    <Text style={styles.saleDetails}>
                      {sale.marca} {sale.modelo}
                    </Text>
                  </View>
                  <Text style={styles.salePrice}>{formatCurrency(sale.precio)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Health Legend */}
        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>Indicadores de Salud</Text>
          <View style={styles.legendContent}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: HEALTH_COLORS.green }]} />
              <Text style={styles.legendText}>Excelente</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: HEALTH_COLORS.yellow }]} />
              <Text style={styles.legendText}>Atención</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: HEALTH_COLORS.red }]} />
              <Text style={styles.legendText}>Problema</Text>
            </View>
          </View>
          <View style={styles.thresholds}>
            <Text style={styles.thresholdText}>Contactado: 90% | Citado: 60% | Cumplida: 65% | Cierre: 25%</Text>
          </View>
        </View>
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
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
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
  summaryCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryStat: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  dcaCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
  },
  dcaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dcaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dcaAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dcaName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  dcaLeads: {
    fontSize: 12,
    color: COLORS.textLight,
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
  dcaFunnel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  funnelItem: {
    alignItems: 'center',
  },
  funnelCount: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  funnelLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  conversionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  conversionItem: {
    alignItems: 'center',
  },
  conversionRate: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  conversionLabel: {
    fontSize: 10,
    color: COLORS.textLight,
  },
  salesCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
  },
  saleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  saleRowBorder: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  saleInfo: {
    flex: 1,
  },
  saleName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  saleDetails: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  salePrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  legendCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    marginBottom: 40,
    borderRadius: 16,
    padding: 16,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  legendContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  thresholds: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  thresholdText: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});
