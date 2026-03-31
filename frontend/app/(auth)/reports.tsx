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
import { Ionicons } from '@expo/vector-icons';
import { COLORS, AGENCIES } from '../../src/constants/theme';
import { getReportsOverview } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import AdvancedDateFilter from '../../src/components/AdvancedDateFilter';

type FilterType = 'today' | 'week' | 'month' | 'custom';

interface SaleDetail {
  id: string;
  lead_name: string;
  lead_phone?: string;
  facturado_a: string;
  marca: string;
  modelo: string;
  version: string;
  cantidad: number;
  precio: number;
  monto_total: number;
  tipo_venta: string;
  asesor_name: string;
  dca_name: string;
  origen: string;
  campaign?: string;
  fecha_factura: string;
}

interface AgencyData {
  agency: string;
  total_leads: number;
  facturadas: number;
  monto_total: number;
  unidades_total: number;
  sales_count: number;
  sales_detail: SaleDetail[];
}

export default function ReportsScreen() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterType>('month');
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [expandedAgency, setExpandedAgency] = useState<string | null>(null);

  // Roles que pueden ver reportes detallados
  const canViewDetailedReports = user?.role && [
    'Director', 
    'Gerente de Ventas Digitales', 
    'Gerente General', 
    'Gerente de Ventas',
    'Marketing'
  ].includes(user.role);

  const fetchData = useCallback(async () => {
    try {
      const result = await getReportsOverview(filter, startDate, endDate);
      setData(result);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, startDate, endDate]);

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

  const formatCurrency = (value: number) => {
    return '$' + value.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd MMM yyyy", { locale: es });
    } catch {
      return dateStr;
    }
  };

  const toggleAgency = (agency: string) => {
    setExpandedAgency(expandedAgency === agency ? null : agency);
  };

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
          <Text style={styles.title}>Reportes</Text>
        </View>

        <AdvancedDateFilter 
          onFilterChange={handleFilterChange}
          currentFilter={filter}
        />

        {/* Global Totals - Todos los roles con acceso a reportes */}
        {canViewDetailedReports && data?.global_totals && (
          <View style={styles.globalTotals}>
            <View style={styles.globalCard}>
              <Text style={styles.globalLabel}>Total Leads</Text>
              <Text style={styles.globalValue}>{data.global_totals.total_leads}</Text>
            </View>
            <View style={styles.globalCard}>
              <Text style={styles.globalLabel}>Facturadas</Text>
              <Text style={[styles.globalValue, { color: COLORS.success }]}>
                {data.global_totals.total_facturadas}
              </Text>
            </View>
            <View style={styles.globalCard}>
              <Text style={styles.globalLabel}>Unidades</Text>
              <Text style={[styles.globalValue, { color: COLORS.secondary }]}>
                {data.global_totals.unidades_total}
              </Text>
            </View>
            <View style={[styles.globalCard, styles.globalCardWide]}>
              <Text style={styles.globalLabel}>Monto Total</Text>
              <Text style={[styles.globalValueLarge, { color: COLORS.success }]}>
                {formatCurrency(data.global_totals.monto_total)}
              </Text>
            </View>
          </View>
        )}

        {/* By Agency - Detailed for Director */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ventas por Agencia</Text>
          {data?.by_agency?.map((agency: AgencyData) => (
            <View key={agency.agency} style={styles.agencySection}>
              <TouchableOpacity 
                style={styles.agencyHeader}
                onPress={() => toggleAgency(agency.agency)}
              >
                <View style={styles.agencyInfo}>
                  <Text style={styles.agencyName}>{agency.agency}</Text>
                  <View style={styles.agencyStats}>
                    <View style={styles.agencyStat}>
                      <Text style={styles.agencyStatNumber}>{agency.total_leads}</Text>
                      <Text style={styles.agencyStatLabel}>Leads</Text>
                    </View>
                    <View style={styles.agencyStat}>
                      <Text style={[styles.agencyStatNumber, { color: COLORS.success }]}>
                        {agency.facturadas}
                      </Text>
                      <Text style={styles.agencyStatLabel}>Facturadas</Text>
                    </View>
                    <View style={styles.agencyStat}>
                      <Text style={[styles.agencyStatNumber, { color: COLORS.secondary }]}>
                        {agency.unidades_total}
                      </Text>
                      <Text style={styles.agencyStatLabel}>Unidades</Text>
                    </View>
                    <View style={styles.agencyStat}>
                      <Text style={[styles.agencyStatNumber, { color: COLORS.success, fontSize: 14 }]}>
                        {formatCurrency(agency.monto_total)}
                      </Text>
                      <Text style={styles.agencyStatLabel}>Monto</Text>
                    </View>
                  </View>
                </View>
                <Ionicons 
                  name={expandedAgency === agency.agency ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color={COLORS.textLight} 
                />
              </TouchableOpacity>

              {/* Sales Detail - Expanded */}
              {expandedAgency === agency.agency && agency.sales_detail.length > 0 && (
                <View style={styles.salesDetail}>
                  <Text style={styles.salesDetailTitle}>Detalle de Ventas Facturadas</Text>
                  {agency.sales_detail.map((sale, index) => (
                    <View key={sale.id} style={[styles.saleCard, index > 0 && styles.saleCardBorder]}>
                      <View style={styles.saleHeader}>
                        <View>
                          <Text style={styles.saleName}>{sale.lead_name}</Text>
                          <Text style={styles.saleInvoice}>Facturado a: {sale.facturado_a}</Text>
                        </View>
                        <View style={styles.saleAmount}>
                          <Text style={styles.salePrice}>{formatCurrency(sale.monto_total)}</Text>
                          <Text style={styles.saleUnits}>{sale.cantidad} unidad{sale.cantidad > 1 ? 'es' : ''}</Text>
                        </View>
                      </View>
                      
                      <View style={styles.saleVehicle}>
                        <Ionicons name="car" size={16} color={COLORS.secondary} />
                        <Text style={styles.saleVehicleText}>
                          {sale.marca} {sale.modelo} {sale.version}
                        </Text>
                      </View>

                      <View style={styles.saleDetails}>
                        <View style={styles.saleDetailRow}>
                          <Text style={styles.saleDetailLabel}>Tipo:</Text>
                          <Text style={styles.saleDetailValue}>{sale.tipo_venta}</Text>
                        </View>
                        <View style={styles.saleDetailRow}>
                          <Text style={styles.saleDetailLabel}>Asesor:</Text>
                          <Text style={styles.saleDetailValue}>{sale.asesor_name}</Text>
                        </View>
                        <View style={styles.saleDetailRow}>
                          <Text style={styles.saleDetailLabel}>DCA:</Text>
                          <Text style={styles.saleDetailValue}>{sale.dca_name}</Text>
                        </View>
                        <View style={styles.saleDetailRow}>
                          <Text style={styles.saleDetailLabel}>Origen:</Text>
                          <Text style={styles.saleDetailValue}>{sale.origen}</Text>
                        </View>
                        {sale.campaign && (
                          <View style={styles.saleDetailRow}>
                            <Text style={styles.saleDetailLabel}>Campaña:</Text>
                            <Text style={styles.saleDetailValue}>{sale.campaign}</Text>
                          </View>
                        )}
                        <View style={styles.saleDetailRow}>
                          <Text style={styles.saleDetailLabel}>Fecha:</Text>
                          <Text style={styles.saleDetailValue}>{formatDate(sale.fecha_factura)}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {expandedAgency === agency.agency && agency.sales_detail.length === 0 && (
                <View style={styles.noSales}>
                  <Ionicons name="document-outline" size={32} color={COLORS.textMuted} />
                  <Text style={styles.noSalesText}>Sin ventas facturadas en este período</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* By Origin */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Por Origen</Text>
          <View style={styles.card}>
            {data?.by_origin?.slice(0, 6).map((item: any, index: number) => (
              <View key={item.origin} style={[styles.originRow, index > 0 && styles.originRowBorder]}>
                <View style={styles.originInfo}>
                  <Ionicons name="globe-outline" size={18} color={COLORS.secondary} />
                  <Text style={styles.originName}>{item.origin}</Text>
                </View>
                <Text style={styles.originCount}>{item.count}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* By Campaign */}
        {data?.by_campaign?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Por Campaña</Text>
            <View style={styles.card}>
              {data?.by_campaign?.slice(0, 5).map((item: any, index: number) => (
                <View key={item.campaign} style={[styles.originRow, index > 0 && styles.originRowBorder]}>
                  <View style={styles.originInfo}>
                    <Ionicons name="megaphone-outline" size={18} color={COLORS.warning} />
                    <Text style={styles.originName}>{item.campaign}</Text>
                  </View>
                  <Text style={styles.originCount}>{item.count}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Top DCAs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top DCAs</Text>
          <View style={styles.card}>
            {data?.top_dcas?.slice(0, 5).map((item: any, index: number) => (
              <View key={item.dca_id} style={[styles.dcaRow, index > 0 && styles.originRowBorder]}>
                <View style={styles.dcaRank}>
                  <Text style={styles.dcaRankText}>{index + 1}</Text>
                </View>
                <Text style={styles.dcaName}>{item.dca_name}</Text>
                <Text style={styles.dcaCount}>{item.count} leads</Text>
              </View>
            ))}
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
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
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
  globalTotals: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 10,
  },
  globalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    width: '31%',
    alignItems: 'center',
  },
  globalCardWide: {
    width: '100%',
  },
  globalLabel: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  globalValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 4,
  },
  globalValueLarge: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  agencySection: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  agencyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  agencyInfo: {
    flex: 1,
  },
  agencyName: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  agencyStats: {
    flexDirection: 'row',
    gap: 16,
  },
  agencyStat: {
    alignItems: 'center',
  },
  agencyStatNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  agencyStatLabel: {
    fontSize: 10,
    color: COLORS.textLight,
    marginTop: 2,
  },
  salesDetail: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: 12,
  },
  salesDetailTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  saleCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  saleCardBorder: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  saleName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  saleInvoice: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  saleAmount: {
    alignItems: 'flex-end',
  },
  salePrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  saleUnits: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  saleVehicle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    backgroundColor: COLORS.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  saleVehicleText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  saleDetails: {
    gap: 4,
  },
  saleDetailRow: {
    flexDirection: 'row',
  },
  saleDetailLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    width: 70,
  },
  saleDetailValue: {
    fontSize: 12,
    color: COLORS.text,
    flex: 1,
  },
  noSales: {
    alignItems: 'center',
    padding: 30,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  noSalesText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 8,
  },
  card: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
  },
  originRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  originRowBorder: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  originInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  originName: {
    fontSize: 14,
    color: COLORS.text,
  },
  originCount: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  dcaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  dcaRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dcaRankText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  dcaName: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  dcaCount: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
  },
});
