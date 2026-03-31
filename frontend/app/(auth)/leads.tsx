import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, STAGE_COLORS, AGENCIES, FUNNEL_STAGES } from '../../src/constants/theme';
import { getLeads, Lead } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

export default function LeadsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Filters
  const [search, setSearch] = useState('');
  const [selectedAgency, setSelectedAgency] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 50;

  const fetchLeads = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      
      const params: any = { page: pageNum, limit: LIMIT };
      if (selectedAgency) params.agency = selectedAgency;
      if (selectedStage) params.stage = selectedStage;
      if (search.trim()) params.search = search.trim();
      if (user?.role === 'DCA') params.dca_id = user.id;
      
      const data = await getLeads(params);
      
      if (append) {
        setLeads(prev => [...prev, ...data.leads]);
      } else {
        setLeads(data.leads);
      }
      
      setTotal(data.total);
      setTotalPages(data.total_pages);
      setPage(pageNum);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [selectedAgency, selectedStage, search, user]);

  useEffect(() => {
    fetchLeads(1, false);
  }, [selectedAgency, selectedStage]);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchLeads(1, false);
  };

  const handleSearch = () => {
    setPage(1);
    fetchLeads(1, false);
  };

  const handleLoadMore = () => {
    if (!loadingMore && page < totalPages) {
      fetchLeads(page + 1, true);
    }
  };

  const clearFilters = () => {
    setSelectedAgency(null);
    setSelectedStage(null);
    setSearch('');
    setShowFilters(false);
  };

  const renderLead = ({ item }: { item: Lead }) => (
    <TouchableOpacity
      style={styles.leadCard}
      onPress={() => router.push(`/(auth)/lead/${item.id}`)}
    >
      <View style={styles.leadHeader}>
        <View style={styles.leadMainInfo}>
          <Text style={styles.leadName}>{item.name}</Text>
          <Text style={styles.leadPhone}>{item.phone}</Text>
        </View>
        <View style={[styles.stageBadge, { backgroundColor: STAGE_COLORS[item.stage] }]}>
          <Text style={styles.stageText}>{item.stage}</Text>
        </View>
      </View>
      <View style={styles.leadInfo}>
        <View style={styles.leadInfoItem}>
          <Ionicons name="business-outline" size={14} color={COLORS.textLight} />
          <Text style={styles.leadInfoText}>{item.agency}</Text>
        </View>
        <View style={styles.leadInfoItem}>
          <Ionicons name="globe-outline" size={14} color={COLORS.textLight} />
          <Text style={styles.leadInfoText}>{item.origin}</Text>
        </View>
        <View style={styles.leadInfoItem}>
          <Ionicons name="person-outline" size={14} color={COLORS.textLight} />
          <Text style={styles.leadInfoText}>{item.dca_name || 'Sin DCA'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  };

  const activeFiltersCount = [selectedAgency, selectedStage].filter(Boolean).length;

  if (loading && page === 1) {
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
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Leads</Text>
          <Text style={styles.subtitle}>{total} leads en total</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/(auth)/lead/new')}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={COLORS.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre o teléfono..."
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); handleSearch(); }}>
              <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity 
          style={[styles.filterButton, activeFiltersCount > 0 && styles.filterButtonActive]}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="filter" size={20} color={activeFiltersCount > 0 ? '#fff' : COLORS.primary} />
          {activeFiltersCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Active Filters Display */}
      {(selectedAgency || selectedStage) && (
        <View style={styles.activeFilters}>
          {selectedAgency && (
            <TouchableOpacity 
              style={styles.activeFilterChip}
              onPress={() => setSelectedAgency(null)}
            >
              <Text style={styles.activeFilterText}>{selectedAgency}</Text>
              <Ionicons name="close" size={14} color={COLORS.primary} />
            </TouchableOpacity>
          )}
          {selectedStage && (
            <TouchableOpacity 
              style={styles.activeFilterChip}
              onPress={() => setSelectedStage(null)}
            >
              <Text style={styles.activeFilterText}>{selectedStage}</Text>
              <Ionicons name="close" size={14} color={COLORS.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={clearFilters}>
            <Text style={styles.clearFiltersText}>Limpiar</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={leads}
        renderItem={renderLead}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No hay leads</Text>
            <Text style={styles.emptySubtext}>
              {search || selectedAgency || selectedStage 
                ? 'Intenta con otros filtros' 
                : 'Agrega tu primer lead'}
            </Text>
          </View>
        }
      />

      {/* Pagination Info */}
      {leads.length > 0 && (
        <View style={styles.paginationInfo}>
          <Text style={styles.paginationText}>
            Página {page} de {totalPages} • {leads.length} de {total} leads
          </Text>
        </View>
      )}

      {/* Filters Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtros</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterLabel}>Agencia</Text>
            <View style={styles.filterOptions}>
              <TouchableOpacity
                style={[styles.filterOption, !selectedAgency && styles.filterOptionSelected]}
                onPress={() => setSelectedAgency(null)}
              >
                <Text style={[styles.filterOptionText, !selectedAgency && styles.filterOptionTextSelected]}>
                  Todas
                </Text>
              </TouchableOpacity>
              {AGENCIES.map(agency => (
                <TouchableOpacity
                  key={agency}
                  style={[styles.filterOption, selectedAgency === agency && styles.filterOptionSelected]}
                  onPress={() => setSelectedAgency(agency)}
                >
                  <Text style={[styles.filterOptionText, selectedAgency === agency && styles.filterOptionTextSelected]}>
                    {agency}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterLabel}>Etapa del Embudo</Text>
            <View style={styles.filterOptions}>
              <TouchableOpacity
                style={[styles.filterOption, !selectedStage && styles.filterOptionSelected]}
                onPress={() => setSelectedStage(null)}
              >
                <Text style={[styles.filterOptionText, !selectedStage && styles.filterOptionTextSelected]}>
                  Todas
                </Text>
              </TouchableOpacity>
              {FUNNEL_STAGES.map(stage => (
                <TouchableOpacity
                  key={stage}
                  style={[styles.filterOption, selectedStage === stage && styles.filterOptionSelected]}
                  onPress={() => setSelectedStage(stage)}
                >
                  <View style={[styles.stageDot, { backgroundColor: STAGE_COLORS[stage] }]} />
                  <Text style={[styles.filterOptionText, selectedStage === stage && styles.filterOptionTextSelected]}>
                    {stage}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
                <Text style={styles.clearButtonText}>Limpiar filtros</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.applyButton} 
                onPress={() => { setShowFilters(false); fetchLeads(1, false); }}
              >
                <Text style={styles.applyButtonText}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  filterButton: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: COLORS.danger,
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  activeFilters: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  activeFilterText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },
  clearFiltersText: {
    fontSize: 13,
    color: COLORS.danger,
    fontWeight: '500',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  leadCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  leadMainInfo: {
    flex: 1,
    marginRight: 12,
  },
  leadName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  leadPhone: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 2,
  },
  stageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stageText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  leadInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  leadInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  leadInfoText: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  paginationInfo: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  paginationText: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
    marginTop: 16,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.borderLight,
    gap: 6,
  },
  filterOptionSelected: {
    backgroundColor: COLORS.primary,
  },
  filterOptionText: {
    fontSize: 14,
    color: COLORS.text,
  },
  filterOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 30,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 16,
    color: COLORS.textLight,
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
