import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Modal, TextInput, FlatList } from 'react-native';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, GripVertical, Trash2, Plus, Sun, Search, X, MapPin } from 'lucide-react-native';
import { Colors, Spacing, Typography } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const RegionManagementScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Enhanced Mock Data
  const [regions, setRegions] = useState([
    { id: '1', name: '서울', sub: '현재 위치', temp: '24°', icon: <Sun size={20} color={Colors.primary} />, widget: true },
    { id: '2', name: '강남역', sub: '서울특별시 강남구 역삼동', temp: '22°', icon: <Sun size={20} color={Colors.primary} />, widget: false },
  ]);

  const goBack = () => navigation.goBack();

  const toggleSearch = () => setSearchModalVisible(!searchModalVisible);

  const deleteRegion = (id) => {
    setRegions(regions.filter(r => r.id !== id));
  };

  const SearchModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={searchModalVisible}
      onRequestClose={toggleSearch}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.searchHeader}>
            <View style={styles.searchInputWrap}>
              <Search size={20} color={Colors.outline} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="장소 검색 (예: 강남구, 역삼동)"
                placeholderTextColor={Colors.outline}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={20} color={Colors.outline} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={toggleSearch} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>취소</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchResultWrap}>
             {/* Mock Search Results */}
             {searchQuery.length > 0 ? (
               <ScrollView>
                 <TouchableOpacity style={styles.resultItem}>
                   <MapPin size={18} color={Colors.outline} />
                   <View style={styles.resultTextCol}>
                     <Text style={styles.resultName}>경기도 성남시 분당구</Text>
                     <Text style={styles.resultSub}>대한민국</Text>
                   </View>
                 </TouchableOpacity>
                 <TouchableOpacity style={styles.resultItem}>
                   <MapPin size={18} color={Colors.outline} />
                   <View style={styles.resultTextCol}>
                     <Text style={styles.resultName}>성남 중원구</Text>
                     <Text style={styles.resultSub}>경기도 성남시</Text>
                   </View>
                 </TouchableOpacity>
               </ScrollView>
             ) : (
               <View style={styles.emptySearch}>
                 <Search size={48} color={Colors.surfaceContainerHigh} strokeWidth={1} />
                 <Text style={styles.emptyText}>날씨를 확인할 새로운 지역을{"\n"}검색해 보세요.</Text>
               </View>
             )}
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* Premium Header - Atmospheric Blending */}
      <View style={[styles.stickyHeader, { paddingTop: Constants.statusBarHeight }]}>
        <TouchableOpacity onPress={goBack} style={styles.iconBtn}>
          <ChevronLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>관심 지역 관리</Text>
        <View style={styles.iconBtnPlaceholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <LinearGradient
          colors={['#E6F7FF', '#f7f9ff']}
          style={styles.introSection}
        >
          <Text style={styles.guideText}>
            현재 최대 5개의 지역을 추가하여{"\n"}날씨 정보를 비교하고 관리할 수 있습니다.
          </Text>
        </LinearGradient>

        <View style={styles.listSection}>
          {regions.map((item, index) => (
            <View key={item.id} style={styles.regionCard}>
              <View style={styles.dragHandle}>
                <GripVertical size={20} color={Colors.outlineVariant} />
              </View>
              
              <View style={styles.cardInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.regionName}>{item.name}</Text>
                  {item.widget && (
                    <LinearGradient
                      colors={['#E3F2FD', '#BBDEFB']}
                      style={styles.widgetBadge}
                    >
                      <Text style={styles.widgetText}>WIDGET</Text>
                    </LinearGradient>
                  )}
                </View>
                <Text style={styles.regionSub} numberOfLines={1}>{item.sub}</Text>
              </View>

              <View style={styles.cardRight}>
                <Text style={styles.tempText}>{item.temp}</Text>
                {item.icon}
              </View>

              <TouchableOpacity 
                style={styles.deleteBtn}
                onPress={() => deleteRegion(item.id)}
              >
                <Trash2 size={20} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))}

          {regions.length < 5 && (
            <TouchableOpacity style={styles.addSlot} onPress={toggleSearch}>
              <View style={styles.plusCircle}>
                <Plus size={24} color={Colors.primary} strokeWidth={2.5} />
              </View>
              <Text style={styles.addText}>새로운 지역 추가하기</Text>
            </TouchableOpacity>
          )}

          {/* Empty placeholders to show slots remaining */}
          {Array.from({ length: Math.max(0, 3 - regions.length) }).map((_, i) => (
            <View key={`empty-${i}`} style={styles.emptySlot}>
               <View style={styles.emptyDot} />
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Search Interaction - In-place Modal */}
      <SearchModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  stickyHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: Spacing.md, 
    paddingBottom: Spacing.md, 
    backgroundColor: '#E6F7FF', 
    zIndex: 100 
  },
  iconBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  iconBtnPlaceholder: { width: 44 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: Colors.text },
  
  scrollContent: { paddingBottom: Spacing.xxl },
  introSection: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.xl },
  guideText: { fontSize: 15, fontWeight: '500', color: Colors.textSecondary, lineHeight: 22 },
  
  listSection: { paddingHorizontal: Spacing.md, marginTop: -Spacing.sm },
  regionCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 18, 
    backgroundColor: Colors.surfaceContainerLowest, 
    borderRadius: 28, 
    marginBottom: Spacing.md,
    shadowColor: Colors.shadow, 
    shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 1, 
    shadowRadius: 16, 
    elevation: 4 
  },
  dragHandle: { marginRight: 14 },
  cardInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  regionName: { fontSize: 20, fontWeight: '800', color: Colors.text },
  widgetBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  widgetText: { fontSize: 9, fontWeight: '900', color: '#1976D2' },
  regionSub: { fontSize: 13, color: Colors.outline, marginTop: 4, fontWeight: '500' },
  cardRight: { alignItems: 'center', marginRight: 14, gap: 4 },
  tempText: { fontSize: 22, fontWeight: '800', color: Colors.text },
  deleteBtn: { padding: 8, backgroundColor: Colors.surfaceContainerLow, borderRadius: 14 },
  
  addSlot: { 
    height: 110, 
    borderRadius: 28, 
    borderWidth: 2, 
    borderStyle: 'dashed', 
    borderColor: Colors.outlineVariant, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255, 255, 255, 0.4)', 
    marginTop: Spacing.xs, 
    gap: 12 
  },
  plusCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surfaceContainerLowest, justifyContent: 'center', alignItems: 'center' },
  addText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  
  emptySlot: { height: 80, borderRadius: 28, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.surfaceContainer, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.md, opacity: 0.5 },
  emptyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.outlineVariant },

  // Modal Styles
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { height: height * 0.85, backgroundColor: Colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: Spacing.lg },
  searchHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.xl },
  searchInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceContainerLow, borderRadius: 20, paddingHorizontal: 12, height: 48 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  closeBtn: { paddingVertical: 8 },
  closeBtnText: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  searchResultWrap: { flex: 1 },
  resultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant, gap: 14 },
  resultTextCol: { flex: 1 },
  resultName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  resultSub: { fontSize: 13, color: Colors.outline, marginTop: 2 },
  emptySearch: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  emptyText: { textAlign: 'center', fontSize: 15, color: Colors.outline, fontWeight: '500', lineHeight: 22 }
});

export default RegionManagementScreen;
