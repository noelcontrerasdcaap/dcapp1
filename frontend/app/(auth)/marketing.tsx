import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, STAGE_COLORS, CHART_COLORS, AGENCIES, FUNNEL_STAGES } from '../../src/constants/theme';
import { getMarketingDashboard, getCampaigns, MarketingDashboardData, Campaign } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import AdvancedDateFilter from '../../src/components/AdvancedDateFilter';

const { width } = Dimensions.get('window');
const ROLES_VIEW_MARKETING = ['Director', 'Gerente de Ventas Digitales', 'Gerente General', 'Marketing', 'Gerente de Ventas'];

type FilterType = 'day' | 'week' | 'month' | 'year' | 'custom';

export default function MarketingDashboardScreen() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterType>('month');
  const [agencyFilter, setAgencyFilter] = useState<string>('');
  const [campaignFilter, setCampaignFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<MarketingDashboardData | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();

  const canView = user?.role && ROLES_VIEW_MARKETING.includes(user.role);

  const fetchData = useCallback(async () => {
    try {
      const params: any = { filter_type: filter };
      if (agencyFilter) params.agency = agencyFilter;
      if (campaignFilter) params.campaign_id = campaignFilter;
      if (startDate) params.start_date_param = startDate;
      if (endDate) params.end_date_param = endDate;
      
      const [dashboardData, campaignsData] = await Promise.all([
        getMarketingDashboard(params),
        getCampaigns()
      ]);
      setData(dashboardData);
      setCampaigns(campaignsData);
    } catch (error) {
      console.error('Error fetching marketing data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, agencyFilter, campaignFilter, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleFilterChange = (filterType: string, start?: string, end?: string) => {
    setFilter(filterType as FilterType);
    setStartDate(start);
    setEndDate(end);
  };

  if (!canView) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed" size={64} color={COLORS.textMuted} />
          <Text style={styles.accessDeniedTitle}>Acceso Restringido</Text>
          <Text style={styles.accessDeniedText}>No tienes permisos para ver el dashboard de marketing.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Pie Chart Component (simple)
  const PieChart = ({ data, colors }: { data: { label: string; value: number }[], colors: string[] }) => {
    const total = data.reduce((acc, item) => acc + item.value, 0);
    if (total === 0) return <Text style={styles.noData}>Sin datos</Text>;
    
    return (
      <View style={styles.pieContainer}>
        <View style={styles.pieLegend}>
          {data.slice(0, 6).map((item, index) => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: colors[index % colors.length] }]} />
              <Text style={styles.legendText} numberOfLines={1}>{item.label}</Text>
              <Text style={styles.legendValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Bar Chart Component
  const BarChart = ({ data, color, maxValue }: { data: { label: string; value: number }[], color: string, maxValue?: number }) => {
    const max = maxValue || Math.max(...data.map(d => d.value), 1);
    return (
      <View style={styles.barContainer}>
        {data.slice(0, 7).map((item) => (
          <View key={item.label} style={styles.barRow}>
            <Text style={styles.barLabel} numberOfLines={1}>{item.label}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${(item.value / max) * 100}%`, backgroundColor: color }]} />
            </View>
            <Text style={styles.barValue}>{item.value}</Text>
          </View>
        ))}
      </View>
    );
  };

  // Funnel Chart Component
  const FunnelChart = ({ data }: { data: { stage: string; count: number }[] }) => {
    const maxCount = Math.max(...data.map(d => d.count), 1);
    return (
      <View style={styles.funnelContainer}>
        {data.map((item, index) => {
          const widthPercent = 50 + ((maxCount - item.count) / maxCount) * 50;
          return (
            <View key={item.stage} style={styles.funnelRow}>
              <View style={[
                styles.funnelBar,
                { 
                  width: `${100 - (index * 5)}%`, 
                  backgroundColor: STAGE_COLORS[item.stage] || COLORS.primary,
                }
              ]}>
                <Text style={styles.funnelLabel}>{item.stage}</Text>
                <Text style={styles.funnelValue}>{item.count}</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
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
          <Text style={styles.title}>Dashboard Marketing</Text>
        </View>

        {/* Advanced Date Filter */}
        <AdvancedDateFilter 
          onFilterChange={handleFilterChange}
          currentFilter={filter}
        />

        {/* Agency Filter */}
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.filterChip, !agencyFilter && styles.filterChipActive]}
              onPress={() => setAgencyFilter('')}
            >
              <Text style={[styles.filterChipText, !agencyFilter && styles.filterChipTextActive]}>Todas</Text>
            </TouchableOpacity>
            {AGENCIES.map((ag) => (
              <TouchableOpacity
                key={ag}
                style={[styles.filterChip, agencyFilter === ag && styles.filterChipActive]}
                onPress={() => setAgencyFilter(ag)}
              >
                <Text style={[styles.filterChipText, agencyFilter === ag && styles.filterChipTextActive]}>{ag}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{data?.total_leads || 0}</Text>
            <Text style={styles.summaryLabel}>Total Leads</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: COLORS.success }]}>{data?.total_facturadas || 0}</Text>
            <Text style={styles.summaryLabel}>Facturadas</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: COLORS.secondary }]}>{data?.conversion_rate || 0}%</Text>
            <Text style={styles.summaryLabel}>Conversión</Text>
          </View>
        </View>

        {/* Leads by Origin - Pie */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>A) Leads por Origen</Text>
          <PieChart
            data={(data?.leads_by_origin || []).map(item => ({ label: item.origin, value: item.count }))}
            colors={CHART_COLORS}
          />
        </View>

        {/* Funnel Chart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Embudo de Ventas</Text>
          <FunnelChart data={data?.funnel_data || []} />
        </View>

        {/* Leads by Day of Week */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>E) Leads por Día de la Semana</Text>
          <BarChart
            data={(data?.leads_by_day_of_week || []).map(item => ({ label: item.day, value: item.count }))}
            color={COLORS.secondary}
          />
        </View>

        {/* Lead Trend */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>F) Tendencia de Leads (por día del mes)</Text>
          <BarChart
            data={(data?.lead_trend || []).map(item => ({ label: `${item.day}`, value: item.count }))}
            color={COLORS.success}
          />
        </View>

        {/* Campaign Metrics */}
        {data?.campaign_metrics && data.campaign_metrics.length > 0 && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>B) Días Activos por Campaña</Text>
              <BarChart
                data={data.campaign_metrics.map(c => ({ label: c.nombre, value: c.dias_activos }))}
                color={COLORS.warning}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>C) Leads por Campaña</Text>
              <BarChart
                data={data.campaign_metrics.map(c => ({ label: c.nombre, value: c.leads_generados }))}
                color={COLORS.primary}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>D) Leads por Día Activo de Campaña</Text>
              <BarChart
                data={data.campaign_metrics.map(c => ({ label: c.nombre, value: parseFloat(c.leads_por_dia.toFixed(1)) }))}
                color={COLORS.purple}
              />
            </View>
          </>
        )}

        {/* DCA Performance */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rendimiento DCA</Text>
          {(data?.dca_performance || []).slice(0, 5).map((dca) => (
            <View key={dca.dca_id} style={styles.performanceRow}>
              <Text style={styles.performanceName} numberOfLines={1}>{dca.dca_name}</Text>
              <View style={styles.performanceMetrics}>
                <View style={styles.perfMetric}>
                  <Text style={styles.perfValue}>{dca.total_leads}</Text>
                  <Text style={styles.perfLabel}>Leads</Text>
                </View>
                <View style={styles.perfMetric}>
                  <Text style={styles.perfValue}>{dca.contactados}</Text>
                  <Text style={styles.perfLabel}>Contact.</Text>
                </View>
                <View style={styles.perfMetric}>
                  <Text style={styles.perfValue}>{dca.citados}</Text>
                  <Text style={styles.perfLabel}>Citados</Text>
                </View>
                <View style={styles.perfMetric}>
                  <Text style={styles.perfValue}>{dca.cumplidas}</Text>
                  <Text style={styles.perfLabel}>Cumpl.</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Asesor Performance */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rendimiento Asesor Digital</Text>
          {(data?.asesor_performance || []).slice(0, 5).map((asesor) => (
            <View key={asesor.asesor_id} style={styles.performanceRow}>
              <Text style={styles.performanceName} numberOfLines={1}>{asesor.asesor_name}</Text>
              <View style={styles.performanceMetrics}>
                <View style={styles.perfMetric}>
                  <Text style={styles.perfValue}>{asesor.demos}</Text>
                  <Text style={styles.perfLabel}>Demos</Text>
                </View>
                <View style={styles.perfMetric}>
                  <Text style={styles.perfValue}>{asesor.cierres}</Text>
                  <Text style={styles.perfLabel}>Cierres</Text>
                </View>
                <View style={styles.perfMetric}>
                  <Text style={[styles.perfValue, { color: COLORS.success }]}>{asesor.facturadas}</Text>
                  <Text style={styles.perfLabel}>Facturad.</Text>
                </View>
                <View style={styles.perfMetric}>
                  <Text style={[styles.perfValue, { color: COLORS.secondary }]}>{asesor.conversion_rate}%</Text>
                  <Text style={styles.perfLabel}>Conv.</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollView: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.text },
  loader: { marginTop: 40 },
  filtersContainer: { paddingHorizontal: 20, marginBottom: 12 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surface, marginRight: 8, borderWidth: 1, borderColor: COLORS.border },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 14, color: COLORS.textLight },
  filterChipTextActive: { color: '#fff' },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 16, gap: 12 },
  summaryCard: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, alignItems: 'center' },
  summaryValue: { fontSize: 28, fontWeight: '700', color: COLORS.primary },
  summaryLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  card: { backgroundColor: COLORS.surface, marginHorizontal: 20, marginBottom: 16, borderRadius: 16, padding: 16 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 16 },
  noData: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 20 },
  pieContainer: { paddingVertical: 8 },
  pieLegend: {},
  legendItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  legendColor: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  legendText: { flex: 1, fontSize: 13, color: COLORS.text },
  legendValue: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  barContainer: {},
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  barLabel: { width: 60, fontSize: 12, color: COLORS.textLight },
  barTrack: { flex: 1, height: 20, backgroundColor: COLORS.background, borderRadius: 10, overflow: 'hidden', marginHorizontal: 8 },
  barFill: { height: '100%', borderRadius: 10 },
  barValue: { width: 40, fontSize: 12, fontWeight: '600', color: COLORS.text, textAlign: 'right' },
  funnelContainer: { alignItems: 'center' },
  funnelRow: { width: '100%', alignItems: 'center', marginBottom: 4 },
  funnelBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  funnelLabel: { color: '#fff', fontSize: 12, fontWeight: '600' },
  funnelValue: { color: '#fff', fontSize: 14, fontWeight: '700' },
  performanceRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  performanceName: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  performanceMetrics: { flexDirection: 'row', justifyContent: 'space-around' },
  perfMetric: { alignItems: 'center' },
  perfValue: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  perfLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  accessDenied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  accessDeniedTitle: { fontSize: 20, fontWeight: '600', color: COLORS.text, marginTop: 16 },
  accessDeniedText: { fontSize: 14, color: COLORS.textMuted, marginTop: 8, textAlign: 'center' },
});
