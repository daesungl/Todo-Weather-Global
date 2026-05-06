import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Animated, Platform, Modal, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Keyboard, PanResponder, FlatList, Pressable, Switch, Share, TouchableOpacity, ToastAndroid } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView, TouchableOpacity as GHButton, BorderlessButton } from 'react-native-gesture-handler';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import AdBanner from '../components/AdBanner';
import { BANNER_UNIT_ID } from '../constants/AdUnits';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAuth } from '../contexts/AuthContext';
import { BannerAdSize } from 'react-native-google-mobile-ads';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import RangeCalendarModal from '../components/RangeCalendarModal';
import {
  Plus,
  MapPin,
  Calendar,
  CloudRain,
  Sun,
  Wind,
  ChevronLeft,
  MoreVertical,
  Navigation2,
  Search,
  X,
  Navigation,
  Trash2,
  Clock,
  CloudSun,
  CloudMoon,
  Moon,
  CloudSnow,
  CloudLightning,
  Cloud,
  Check,
  AlertTriangle,
  Edit3,
  ChevronDown,
  FileText,
  Keyboard as KeyboardIcon,
  Flag,
  Share2,
  Lock,
  ArrowUpDown,
  Repeat,
  Bell,
  BellOff,
  Users,
  LogOut,
  MessageCircle,
  ArrowUp,
  ArrowUpCircle,
  UserMinus,
  Info,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../theme';
import { useUnits } from '../contexts/UnitContext';
import MenuModal from '../components/MenuModal';
import MainHeader from '../components/MainHeader';
import WeatherService from '../services/weather/WeatherService';
import { searchLocations, getRepresentativeCoordinates } from '../services/weather/GlobalService';
import { searchPlaces as searchDomesticPlaces } from '../services/weather/VWorldService';
import { getFlows, saveFlows, addFlow, deleteFlow, subscribeToFlows, updateFlowDoc, removeSharedFlowOptimistic, refreshSharedFlowListener, isRemoteFlowUpdate } from '../services/FlowSyncService';
import { 
  generateInviteCode, 
  invalidateInviteCode, 
  joinFlowByCode, 
  leaveFlow, 
  removeMember, 
  getFlowMembers,
  subscribeToFlowMembers,
  updateMemberPermissions,
} from '../services/InviteService';
import { requestPermission, scheduleNotification, cancelNotification, refillStepNotifications } from '../services/NotificationService';
import * as CommentService from '../services/CommentService';


const { width, height } = Dimensions.get('window');

const _advanceByRepeat = (date, repeat) => {
  const d = new Date(date);
  switch (repeat) {
    case 'daily':   d.setDate(d.getDate() + 1);          break;
    case 'weekly':  d.setDate(d.getDate() + 7);          break;
    case 'monthly': d.setMonth(d.getMonth() + 1);        break;
    case 'yearly':  d.setFullYear(d.getFullYear() + 1);  break;
  }
  return d;
};
const _dateStrFlow = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const FLOW_GRADIENT_PRESETS = [
  { key: 'wine',          name: '와인',     colors: ['#881337', '#7f1d1d'] },
  { key: 'midnight',      name: '미드나잇', colors: ['#1e3a8a', '#312e81'] },
  { key: 'cherry',        name: '체리',     colors: ['#be123c', '#9f1239'] },
  { key: 'steel',         name: '스틸',     colors: ['#1d4ed8', '#1e3a8a'] },
  { key: 'grape',         name: '그레이프', colors: ['#7c3aed', '#4c1d95'] },
  { key: 'deep_sea',      name: '딥씨',     colors: ['#0369a1', '#1e3a8a'] },
  { key: 'nebula',        name: '네뷸라',   colors: ['#4f46e5', '#7e22ce'] },
  { key: 'bronze',        name: '브론즈',   colors: ['#b45309', '#78350f'] },
  { key: 'lavender',      name: '라벤더',   colors: ['#c026d3', '#7c3aed'] },
  { key: 'slate',         name: '슬레이트', colors: ['#64748b', '#475569'] },
  { key: 'teal_ocean',    name: '틸오션',   colors: ['#0891b2', '#0369a1'] },
  { key: 'forest',        name: '포레스트', colors: ['#16a34a', '#065f46'] },
  { key: 'gold',          name: '골드',     colors: ['#d97706', '#92400e'] },
  { key: 'violet_purple', name: '바이올렛', colors: ['#6366f1', '#a855f7'] },
  { key: 'olive',         name: '올리브',   colors: ['#65a30d', '#713f12'] },
  { key: 'fire',          name: '파이어',   colors: ['#dc2626', '#f97316'] },
  { key: 'tropical',      name: '트로피칼', colors: ['#059669', '#0891b2'] },
  { key: 'sunset',        name: '선셋',     colors: ['#f97316', '#ef4444'] },
  { key: 'aurora',        name: '오로라',   colors: ['#8b5cf6', '#06b6d4'] },
  { key: 'rose',          name: '로즈',     colors: ['#f43f5e', '#fb923c'] },
  { key: 'candy',         name: '캔디',     colors: ['#f43f5e', '#e879f9'] },
  { key: 'ocean',         name: '오션',     colors: ['#3b82f6', '#06b6d4'] },
  { key: 'warm_gray',     name: '웜그레이', colors: ['#9ca3af', '#6b7280'] },
  { key: 'coral',         name: '코럴',     colors: ['#e05252', '#f59e0b'] },
  { key: 'emerald',       name: '에메랄드', colors: ['#10b981', '#06b6d4'] },
  { key: 'sakura',        name: '사쿠라',   colors: ['#f472b6', '#e879f9'] },
  { key: 'lime',          name: '라임',     colors: ['#84cc16', '#16a34a'] },
  { key: 'sky',           name: '스카이',   colors: ['#38bdf8', '#818cf8'] },
  { key: 'mint',          name: '민트',     colors: ['#34d399', '#06b6d4'] },
  { key: 'peach_rose',    name: '피치로즈', colors: ['#fb7185', '#fbbf24'] },
  { key: 'peach',         name: '피치',     colors: ['#fb923c', '#fbbf24'] },
  { key: 'arctic',        name: '아틱',     colors: ['#bae6fd', '#a5b4fc'] },
];

const FlowScreen = ({ navigation, route }) => {
  const { t, i18n } = useTranslation();
  const { formatTemp } = useUnits();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);
  const [flowMenuVisible, setFlowMenuVisible] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState(null);
  const selectedFlowRef = useRef(null);
  const [stepSortOrder, setStepSortOrder] = useState('asc');
  const [isSharingImage, setIsSharingImage] = useState(false);
  const viewShotRef = useRef();
  
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmOnPress, setConfirmOnPress] = useState(null);
  const [confirmIsDestructive, setConfirmIsDestructive] = useState(false);
  const [confirmShowCancel, setConfirmShowCancel] = useState(true);
  const [confirmOkText, setConfirmOkText] = useState('');

  const showConfirm = (title, message, onPress, isDestructive = true, okText = '', showCancel = true) => {
    setConfirmTitle(title || t('common.info'));
    setConfirmMessage(message);
    setConfirmOnPress(() => onPress);
    setConfirmIsDestructive(isDestructive);
    setConfirmOkText(okText || t('common.confirm'));
    setConfirmShowCancel(showCancel);
    setConfirmModalVisible(true);
  };
  
  const handleConfirm = () => {
    setConfirmModalVisible(false);
    if (confirmOnPress) confirmOnPress();
  };
  
  const [flows, setFlows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isPremium, limits } = useSubscription();

  // Search Modal State
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState('flow'); // 'flow' or 'step'

  // Edit Step State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingStep, setEditingStep] = useState(null);
  const [editTime, setEditTime] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [matchStartDate, setMatchStartDate] = useState(true);
  const [editActivity, setEditActivity] = useState('');
  const [editMemo, setEditMemo] = useState('');
  const [pickerType, setPickerType] = useState(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const currentScrollYRef = useRef(0); // 현재 스크롤 위치 추적 (댓글 포커스 시 사용)
  const pickerBackupRef = useRef({ editDate: '', editTime: '', editEndDate: '', editEndTime: '' });

  // Step Repeat State
  const [stepRepeatType, setStepRepeatType] = useState(null);
  const [stepRepeatEndDate, setStepRepeatEndDate] = useState('');
  const [showStepRepeatPicker, setShowStepRepeatPicker] = useState(false);
  const [showStepRepeatEndPicker, setShowStepRepeatEndPicker] = useState(false);

  // Step Notification State
  const [stepNotify, setStepNotify] = useState(false);

  // Flow Create/Edit State
  const [flowModalVisible, setFlowModalVisible] = useState(false);
  const [editingFlow, setEditingFlow] = useState(null);
  const [flowTitle, setFlowTitle] = useState('');
  const [flowDescription, setFlowDescription] = useState('');
  const [flowLocation, setFlowLocation] = useState('');
  const [flowAddress, setFlowAddress] = useState('');
  const [flowLat, setFlowLat] = useState(null);
  const [flowLon, setFlowLon] = useState(null);
  const [flowGradient, setFlowGradient] = useState(FLOW_GRADIENT_PRESETS[0].colors);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [heroWeather, setHeroWeather] = useState(null);
  const [topAdHidden, setTopAdHidden] = useState(false);
  const [detailAdHidden, setDetailAdHidden] = useState(false);

  // Invite / Join state
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [flowMembers, setFlowMembers] = useState([]);
  const [pendingPermissions, setPendingPermissions] = useState({});  // { [uid]: permissions }
  const [applyingPermissions, setApplyingPermissions] = useState({});  // { [uid]: bool }
  const [isLeaving, setIsLeaving] = useState(false);
  const prevSelectedFlowRoleRef = useRef(null); // tracks { _role, _permissions } to detect perm changes
  const [comments, setComments] = useState([]);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [showRangePicker, setShowRangePicker] = useState(false);
  const panY = useRef(new Animated.Value(0)).current;
  const flowPanY = useRef(new Animated.Value(0)).current;
  const flowKeyboardOffset = useRef(new Animated.Value(0)).current;
  const invitePanY = useRef(new Animated.Value(height)).current;
  const joinPanY = useRef(new Animated.Value(height)).current;
  const joinKeyboardOffset = useRef(new Animated.Value(0)).current;
  const searchPanY = useRef(new Animated.Value(0)).current;
  const [inviteModalHeight, setInviteModalHeight] = useState(0);
  const [joinModalHeight, setJoinModalHeight] = useState(0);
  const [flowModalHeight, setFlowModalHeight] = useState(0);
  const [editModalHeight, setEditModalHeight] = useState(0);
  const [searchModalHeight, setSearchModalHeight] = useState(0);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [flowToastMsg, setFlowToastMsg] = useState('');
  const flowToastAnim = useRef(new Animated.Value(0)).current;
  const flowToastTimeout = useRef(null);
  const flatListRef = useRef(null);
  const stepScrollRef = useRef(null);
  const timelineScrollRef = useRef(null);  // 타임라인 전체 스크롤뷰 ref (댓글 입력 시 키보드 대응)
  const commentInputRefs = useRef({}); // { stepId: ref } 댓글 입력창 위치 파악용
  const memoYRef = useRef(0);
  const activityInputRef = useRef(null);
  const flowTitleRef = useRef(null);
  const flowDescRef = useRef(null);
  const focusedFlowInputRef = useRef(null);

  // Comments State
  const [commentInputs, setCommentInputs] = useState({}); // { stepId: 'text' }
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [expandedCommentSteps, setExpandedCommentSteps] = useState({}); // { stepId: bool }

  const toggleComments = (stepId, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setExpandedCommentSteps(prev => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  // --- Initialization ---
  useFocusEffect(
    useCallback(() => {
      loadInitialData();
    }, [])
  );

  useEffect(() => {
    const unsub = subscribeToFlows((flows) => {
      if (flows !== null) setFlows(flows);
    });
    return unsub;
  }, []);

  // 타임라인 스크롤 위치 추적 (댓글 입력 포커스 시 scrollTo 계산용)
  useEffect(() => {
    const listenerId = scrollY.addListener(({ value }) => {
      currentScrollYRef.current = value;
    });
    return () => scrollY.removeListener(listenerId);
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      selectedFlowRef.current = null;
      setSelectedFlow(null);
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    const flowId = route.params?.flowId;
    if (!flowId || !flows.length) return;
    const targetFlow = flows.find(f => f.id === flowId);
    if (targetFlow) {
      setSelectedFlow(targetFlow);
      navigation.setParams({ flowId: undefined });
    }
  }, [route.params?.flowId, flows]);

  // Sync selectedFlow with flows list when list updates (for collaborative editing)
  useEffect(() => {
    if (selectedFlow) {
      const latest = flows.find(f => f.id === selectedFlow.id);
      if (latest) {
        const prev = prevSelectedFlowRoleRef.current;
        const sameFlow = prev && prev.flowId === latest.id;
        const roleChanged = sameFlow && prev._role !== latest._role;
        const permChanged = sameFlow && JSON.stringify(prev._permissions) !== JSON.stringify(latest._permissions);

        if ((roleChanged || permChanged) && !isFlowOwner(latest) && isRemoteFlowUpdate()) {
          // 권한 변경 알림 — 오너 자신에게는 표시 안 함, 원격 업데이트(Firestore)일 때만 표시
          const becameEditor = latest._role === 'editor';
          const msg = becameEditor
            ? t('flow.alert.perm_changed_editor')
            : t('flow.alert.perm_changed_viewer');
          showConfirm(t('common.info'), msg, null, false, t('common.confirm'), false);
        }

        prevSelectedFlowRoleRef.current = { flowId: latest.id, _role: latest._role, _permissions: latest._permissions };

        // steps, updatedAt, 권한 중 하나라도 바뀌면 selectedFlow 갱신 (댓글/스텝 실시간 반영)
        const stepsChanged = JSON.stringify(latest.steps) !== JSON.stringify(selectedFlow.steps);
        const updatedAtChanged = latest.updatedAt !== selectedFlow.updatedAt;
        if (stepsChanged || updatedAtChanged || roleChanged || permChanged) {
          if (__DEV__) console.log('[FlowScreen] Syncing selectedFlow with latest from subscription');
          setSelectedFlow(latest);
        }
      } else if (!isFlowOwner(selectedFlow) && !isLeaving) {
        // Kick detected: User is not owner AND flow is gone from the list AND user didn't leave voluntarily
        prevSelectedFlowRoleRef.current = null;
        setInviteModalVisible(false);
        setFlowMenuVisible(false);
        showConfirm(
          t('common.info'),
          t('flow.alert.kicked_msg'),
          () => setSelectedFlow(null),
          false,
          t('common.confirm'),
          false
        );
      }
    } else {
      prevSelectedFlowRoleRef.current = null;
    }
  }, [flows, selectedFlow]);

  // Comments Subscription
  useEffect(() => {
    if (!selectedFlow) {
      setComments([]);
      return;
    }

    const ownerUid = selectedFlow._ownerUid || user?.uid;
    const unsub = CommentService.subscribeToComments(ownerUid, selectedFlow.id, (data) => {
      setComments(data);
    });

    return unsub;
  }, [selectedFlow?.id, selectedFlow?._ownerUid, user?.uid]);

  const handlePostComment = async (stepId) => {
    const text = commentInputs[stepId];
    if (!text || !text.trim() || isPostingComment) return;

    setIsPostingComment(true);
    const ownerUid = selectedFlow._ownerUid || user?.uid;
    try {
      await CommentService.addComment(ownerUid, selectedFlow.id, stepId, user, text);
      setCommentInputs(prev => ({ ...prev, [stepId]: '' }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      showConfirm(t('common.error'), t('flow.comment_error', 'Failed to post comment.'), null, false);
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    const ownerUid = selectedFlow._ownerUid || selectedFlow.ownerUid || user?.uid;
    const foundComment = comments.find(c => c.id === commentId);
    if (!foundComment) return;
    
    // 권한 체크: 본인 댓글이거나, 관리 권한이 있거나
    const isAuthor = foundComment.uid === user?.uid;
    const hasPermission = isAuthor || canManageComments(selectedFlow);

    if (!hasPermission) {
      showConfirm(t('common.info'), t('flow.no_permission_comment'), null, false);
      return;
    }

    const targetStepId = foundComment.stepId;
    if (!targetStepId) return;

    showConfirm(
      t('flow.alert.delete_comment'),
      t('flow.alert.delete_comment_msg'),
      async () => {
        try {
          await CommentService.deleteComment(ownerUid, selectedFlow.id, targetStepId, commentId);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
          showConfirm(t('common.error'), t('flow.delete_comment_error', 'Failed to delete comment.'), null, false);
        }
      },
      true // 취소 버튼 포함
    );
  };

  useEffect(() => {
    const showSubscription = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      setIsKeyboardVisible(true);
      const kbHeight = e.endCoordinates.height;
      setKeyboardHeight(kbHeight);
      
      // Calculate offset based on modal height and keyboard height
      const currentModalHeight = flowModalVisible ? flowModalHeight : (editModalVisible ? editModalHeight : (joinModalVisible ? joinModalHeight : 0));
      if (currentModalHeight > 0) {
        const maxShift = height - currentModalHeight - (Platform.OS === 'ios' ? 60 : 40);
        const shift = Math.min(kbHeight, Math.max(0, maxShift));
        
        if (flowModalVisible) {
          Animated.timing(flowKeyboardOffset, {
            toValue: shift, // flowKeyboardOffset is subtracted, so positive moves UP
            duration: e.duration || 250,
            useNativeDriver: true,
          }).start();
        } else if (editModalVisible) {
          Animated.timing(panY, {
            toValue: -shift, // panY is directly used, so negative moves UP
            duration: e.duration || 250,
            useNativeDriver: true,
          }).start();
        } else if (joinModalVisible) {
          Animated.timing(joinKeyboardOffset, {
            toValue: shift,
            duration: e.duration || 250,
            useNativeDriver: true,
          }).start();
        }
      }
    });
    const hideSubscription = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', (e) => {
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
      const targetAnim = flowModalVisible ? flowKeyboardOffset : (joinModalVisible ? joinKeyboardOffset : panY);
      Animated.timing(targetAnim, {
        toValue: 0,
        duration: e.duration || 200,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) panY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Animated.timing(panY, { toValue: height, duration: 220, useNativeDriver: true }).start(() => {
            closeEditModal();
          });
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true, bounciness: 8 }).start();
        }
      },
    })
  ).current;

  const flowPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) flowPanY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Animated.timing(flowPanY, { toValue: height, duration: 220, useNativeDriver: true }).start(() => {
            closeFlowModal();
          });
        } else {
          Animated.spring(flowPanY, { toValue: 0, useNativeDriver: true, bounciness: 8 }).start();
        }
      },
    })
  ).current;

  const searchPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) searchPanY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Animated.timing(searchPanY, { toValue: height, duration: 220, useNativeDriver: true }).start(() => {
            closeSearch();
            searchPanY.setValue(0);
          });
        } else {
          Animated.spring(searchPanY, { toValue: 0, useNativeDriver: true, bounciness: 8 }).start();
        }
      },
    })
  ).current;

  const invitePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) invitePanY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Animated.timing(invitePanY, { toValue: height, duration: 220, useNativeDriver: true }).start(() => {
            closeInviteModal();
          });
        } else {
          Animated.spring(invitePanY, { toValue: 0, useNativeDriver: true, bounciness: 8 }).start();
        }
      },
    })
  ).current;

  const joinPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) joinPanY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Animated.timing(joinPanY, { toValue: height, duration: 220, useNativeDriver: true }).start(() => {
            closeJoinModal();
          });
        } else {
          Animated.spring(joinPanY, { toValue: 0, useNativeDriver: true, bounciness: 8 }).start();
        }
      },
    })
  ).current;

  const openEditModal = (isNew = false) => {
    panY.setValue(height);
    setEditModalVisible(true);
    stepScrollRef.current?.scrollTo({ y: 0, animated: false });
    Animated.spring(panY, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 14 }).start();
    if (isNew) {
      setTimeout(() => {
        activityInputRef.current?.focus();
        // 포커스 후 스크롤이 튀는 것을 방지하기 위해 다시 한번 상단으로 스크롤
        setTimeout(() => stepScrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
      }, 350);
    }
  };

  const closeEditModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditModalVisible(false);
    setEditingStep(null);
    setEditActivity('');
    setEditMemo('');
    setEditDate('');
    setEditTime('');
    setEditEndDate('');
    setEditEndTime('');
    setMatchStartDate(true);
    setPickerType(null);
    setShowRangePicker(false);
    setSelectedRegion(null);
    setStepRepeatType(null);
    setStepRepeatEndDate('');
    setShowStepRepeatPicker(false);
    setShowStepRepeatEndPicker(false);
    setStepNotify(false);
  };

  const closeFlowModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFlowModalVisible(false);
    setEditingFlow(null);
    setFlowTitle('');
    setFlowLocation('');
    setFlowAddress('');
    setFlowLat(null);
    setFlowLon(null);
    setFlowDescription('');
  };

  const isFlowOwner = (flow) => !flow?._ownerUid;
  const canEditFlow = (flow) => !flow || !flow._ownerUid || flow._role === 'owner' || flow._role === 'editor';
  
  const canEdit = (flow) => {
    if (isFlowOwner(flow)) return true;
    if (!flow?._permissions) return flow?._role === 'editor';
    return !!flow._permissions.edit;
  };

  const canManageComments = (flow) => {
    if (isFlowOwner(flow)) return true;
    if (!flow?._permissions) return flow?._role === 'editor';
    return !!flow._permissions.manageComments;
  };

  const handleJoinPress = () => {
    if (!user) {
      showConfirm(
        t('common.login_required'),
        t('common.login_required_msg'),
        () => navigation.navigate('Login'),
        true
      );
      return;
    }
    openJoinModal();
  };

  const canEditSteps = (flow) => canEdit(flow);

  const handleOpenInvite = async () => {
    setFlowMenuVisible(false);
    
    if (!user) {
      showConfirm(
        t('common.login_required'),
        t('common.login_required_msg'),
        () => navigation.navigate('Login'),
        true
      );
      return;
    }

    setInviteCode(selectedFlow.inviteCode || '');
    setInviteRole(selectedFlow.inviteRole || 'viewer');
    setFlowMembers([]);
    setPendingPermissions({});
    setApplyingPermissions({});
    invitePanY.setValue(height);
    setInviteModalVisible(true);
    Animated.spring(invitePanY, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 14 }).start();
  };

  const closeInviteModal = () => {
    Animated.timing(invitePanY, {
      toValue: height,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setInviteModalVisible(false);
      setPendingPermissions({});
    });
  };

  const openJoinModal = () => {
    setJoinCode('');
    joinPanY.setValue(height);
    setJoinModalVisible(true);
    Animated.spring(joinPanY, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 14 }).start();
  };

  const closeJoinModal = () => {
    Animated.timing(joinPanY, {
      toValue: height,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setJoinModalVisible(false);
      setJoinCode('');
    });
  };

  // Membership Real-time Subscription
  useEffect(() => {
    if (!inviteModalVisible || !selectedFlow) return;

    const ownerUid = selectedFlow._ownerUid || user?.uid;
    setIsMembersLoading(true);
    const unsub = subscribeToFlowMembers(ownerUid, selectedFlow.id, (members) => {
      setFlowMembers(members);
      setIsMembersLoading(false);
    });

    // selectedFlow 전체가 아닌 식별자만 의존성으로 추가하여 초대 코드 갱신 시 재구독 방지
    return unsub;
  }, [inviteModalVisible, selectedFlow?.id, selectedFlow?._ownerUid, user?.uid]);

  const handleGenerateCode = async (forcedRole = null) => {
    if (!user?.uid) return;
    setIsGeneratingCode(true);
    const targetRole = forcedRole || inviteRole;
    try {
      // 구 코드의 inviteCodes 도큐먼트만 비동기로 삭제 (fire-and-forget)
      // flow 문서는 generateInviteCode의 set+merge가 원자적으로 덮어쓰기 때문에
      // await할 필요 없음 → FlowSyncService 루프 방지
      if (inviteCode) {
        invalidateInviteCode(user?.uid, selectedFlow.id, inviteCode).catch(e =>
          console.warn('[Flow] invalidate code cleanup error:', e)
        );
      }
      const code = await generateInviteCode(user?.uid, selectedFlow.id, targetRole, selectedFlow);
      setInviteCode(code);
      const updatedFlow = { ...selectedFlow, inviteCode: code, inviteRole: targetRole };
      setSelectedFlow(updatedFlow);
      setFlows(prev => prev.map(f => f.id === selectedFlow.id ? updatedFlow : f));
    } catch (e) {
      showConfirm(t('common.error'), e.message, null, false);
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleInvalidateCode = async () => {
    if (!inviteCode || !user?.uid) return;
    try {
      await invalidateInviteCode(user?.uid, selectedFlow.id, inviteCode);
      setInviteCode('');
      const updatedFlow = { ...selectedFlow, inviteCode: null, inviteRole: null };
      setSelectedFlow(updatedFlow);
      setFlows(prev => prev.map(f => f.id === selectedFlow.id ? updatedFlow : f));
    } catch (e) {
      showConfirm(t('common.error'), e.message, null, false);
    }
  };

  const handleRemoveMember = async (memberUid) => {
    if (!isFlowOwner(selectedFlow)) {
      showConfirm(t('common.error'), t('flow.alert.only_owner_can_kick', 'Only the owner can remove members.'), null, false);
      return;
    }
    showConfirm(
      t('flow.alert.kick_member'),
      t('flow.alert.kick_member_msg'),
      async () => {
        try {
          await removeMember(selectedFlow._ownerUid || user?.uid, selectedFlow.id, memberUid);
          setFlowMembers(prev => prev.filter(m => m.uid !== memberUid));
        } catch (e) {
          showConfirm(t('common.error'), e.message, null, false);
        }
      },
      true,
      t('common.confirm', 'Confirm')
    );
  };

  const handleTogglePermission = (memberUid, key) => {
    const member = flowMembers.find(m => m.uid === memberUid);
    if (!member) return;
    const base = pendingPermissions[memberUid] ?? member.permissions;
    setPendingPermissions(prev => ({
      ...prev,
      [memberUid]: { ...base, [key]: !base[key] },
    }));
  };

  const handleApplyPermissions = async (memberUid) => {
    // 이제 개별 저장은 사용하지 않지만, 내부 로직 유지를 위해 남겨두거나 handleSaveAllPermissions에서 활용
    const pending = pendingPermissions[memberUid];
    if (!pending) return;
    setApplyingPermissions(prev => ({ ...prev, [memberUid]: true }));
    try {
      await updateMemberPermissions(selectedFlow._ownerUid || user?.uid, selectedFlow.id, memberUid, pending);
      setFlowMembers(prev => prev.map(m => m.uid === memberUid ? { ...m, permissions: pending } : m));
      setPendingPermissions(prev => { const n = { ...prev }; delete n[memberUid]; return n; });
    } catch (e) {
      showConfirm(t('common.error'), e.message, null, false);
    } finally {
      setApplyingPermissions(prev => ({ ...prev, [memberUid]: false }));
    }
  };

  const handleSaveAllPermissions = async () => {
    const uids = Object.keys(pendingPermissions);
    
    if (uids.length === 0) {
      closeInviteModal();
      return;
    }

    setIsSavingPermissions(true);
    try {
      const ownerUid = selectedFlow._ownerUid || user?.uid;
      // 순차적으로 처리하여 안정성 확보
      for (const uid of uids) {
        const pending = pendingPermissions[uid];
        await updateMemberPermissions(ownerUid, selectedFlow.id, uid, pending);
        setFlowMembers(prev => prev.map(m => m.uid === uid ? { ...m, permissions: pending } : m));
      }
      
      setPendingPermissions({});
      closeInviteModal();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      showConfirm(t('common.error'), e.message, null, false);
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const handleShowPermissionInfo = () => {
    showConfirm(
      t('flow.permission_info_title', '권한 안내'),
      '• ' + t('flow.permission_edit_desc', '편집: 플로우의 스텝을 추가, 수정, 삭제할 수 있습니다.') + '\n' +
      '• ' + t('flow.permission_comment_desc', '댓글 관리: 본인뿐만 아니라 모든 멤버의 댓글을 삭제할 수 있습니다.'),
      null, false
    );
  };

  const handleJoinFlow = async () => {
    if (!joinCode.trim() || !user?.uid) return;
    setIsJoining(true);
    
    try {
      const result = await joinFlowByCode(user.uid, joinCode, user.displayName || user.email || '');
      const alreadyExists = flows.some(f => f.id === result.flowId);

      setJoinCode('');
      setJoinModalVisible(false);

      // 현재 플로우 최솟값 -1을 order로 지정해 리스트 최상단에 배치
      const minOrder = flows.length > 0 ? Math.min(...flows.map(f => f.order ?? 0)) : 0;
      refreshSharedFlowListener(result.ownerUid, result.flowId, result.role, minOrder - 1);

      if (alreadyExists) {
        showConfirm(
          t('flow.alert.already_member'),
          `"${result.flowTitle || ''}" ${t('flow.alert.already_member_msg')}`,
          null, false
        );
      } else {
        const titleLabel = result.flowTitle ? `"${result.flowTitle}"` : t('flow.alert.join_success');
        showConfirm(
          t('flow.alert.join_success'),
          `${titleLabel}${t('flow.alert.join_success_msg')}`,
          null, false
        );
      }
    } catch (e) {
      // 에러 모달이 join 모달 위에 겹치면 iOS에서 표시 안 됨 — 먼저 닫기
      setJoinModalVisible(false);
      setJoinCode('');
      const msgMap = {
        'INVALID_CODE': t('flow.alert.invalid_code'),
        'EXPIRED_CODE': t('flow.alert.expired_code'),
        'OWN_FLOW': t('flow.alert.own_flow_error'),
      };
      const errorMsg = msgMap[e.message] || e.message;
      showConfirm(t('common.error'), errorMsg, null, false, t('common.confirm'));
    } finally {
      setIsJoining(false);
    }
  };

  const loadInitialData = async () => {
    setIsLoading(true);
    const savedFlows = await getFlows();
    let currentFlows = [];
    if (savedFlows.length === 0) {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      
      const sample = {
        id: 'sample-1',
        title: 'Welcome to Flow',
        period: 'Multi-day Planning',
        location: 'Dream Destination',
        progress: 0.3,
        gradient: ['#6366f1', '#a855f7'],
        weatherSummary: 'Curated multi-day planning',
        weatherCondKey: 'sunny',
        weatherIsDay: true,
        lat: 37.5665,
        lon: 126.9780,
        steps: [
          { id: 's1', date: today, time: '10:00', activity: 'Arrival & Coffee', status: 'completed' },
          { id: 's2', date: today, time: '14:00', activity: 'Hotel Check-in', status: 'current' },
          { id: 's3', date: tomorrow, time: '09:00', activity: 'City Tour Start', status: 'upcoming' }
        ]
      };
      currentFlows = [sample];
      setFlows(currentFlows);
    } else {
      currentFlows = savedFlows;
      setFlows(currentFlows);
    }

    setIsLoading(false);
  };

  const refreshFlowWeather = async (flow) => {
    if (!flow.lat || !flow.lon) return;
    try {
      const weather = await WeatherService.getWeather(flow.lat, flow.lon, false, flow.location, flow.location);
      if (!weather) return;
      const weatherTemp = weather.temp ? (String(weather.temp).includes('°') ? weather.temp : `${weather.temp}°`) : '--°';
      setFlows(prev => {
        const updated = prev.map(f => f.id === flow.id
          ? { ...f, weatherTemp, weatherCondKey: weather.condKey, weatherIsDay: weather.isDay !== false }
          : f
        );
        // setTimeout을 사용하여 렌더링 사이클 이후에 updateFlowDoc이 실행되도록 지연
        setTimeout(() => {
          if (!selectedFlowRef.current) return;
          const updatedFlow = updated.find(f => f.id === selectedFlowRef.current.id);
          // Firestore 원격 변경(예: 초대 코드 발급))에 의한 re-notify일 경우 write-back 안 함
          if (updatedFlow && canEditFlow(updatedFlow) && !isRemoteFlowUpdate()) {
            updateFlowDoc(updatedFlow);
          }
        }, 0);
        return updated;
      });
    } catch (e) { console.warn('[Flow] Refresh failed for', flow.location); }
  };

  // --- Search Logic ---
  const isKoreanQuery = (query) => /[가-힣]/.test(query);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) handleSearch(searchQuery);
      else setSearchResults([]);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearch = async (query) => {
    setIsSearching(true);
    try {
      const [dom, glo] = await Promise.all([searchDomesticPlaces(query), searchLocations(query, i18n.language)]);
      setSearchResults(isKoreanQuery(query) ? [...dom, ...glo] : [...glo, ...dom]);
    } catch (e) { console.error(e); }
    finally { setIsSearching(false); }
  };

  const handleSelection = async (item) => {
    let finalItem = { ...item };
    
    // 주(State)나 국가(Country) 단위 결과인 경우 대표 도시 좌표로 보정
    if (item.isRegion) {
      setIsSearching(true);
      const representative = await getRepresentativeCoordinates(item.name, item.rawType, i18n.language);
      setIsSearching(false);
      
      if (representative) {
        finalItem = {
          ...item,
          lat: representative.lat,
          lon: representative.lon,
          // 주소 명칭은 원본을 유지하되 좌표만 보정함
        };
        console.log(`[FlowScreen] Location corrected: ${item.name} -> ${representative.name} coordinates`);
      }
    }

    if (searchMode === 'flow') {
      setFlowLocation(finalItem.name);
      setFlowAddress(finalItem.address || finalItem.addressName || '');
      setFlowLat(finalItem.lat);
      setFlowLon(finalItem.lon);
      if (!flowTitle) setFlowTitle(`${finalItem.name} Trip`);
    } else {
      setSelectedRegion(finalItem);
    }
    setSearchModalVisible(false);
  };

  const fetchHeroWeather = async (flow) => {
    if (flow && flow.lat && flow.lon) {
      const weather = await WeatherService.getWeather(flow.lat, flow.lon, false, flow.location, flow.address || '');
      setHeroWeather(weather);
    } else {
      setHeroWeather(null);
    }
  };

  useEffect(() => {
    selectedFlowRef.current = selectedFlow;
    if (selectedFlow) {
      fetchHeroWeather(selectedFlow);
      refreshFlowWeather(selectedFlow);
    }
  }, [selectedFlow]);

  // WeatherDetail에서 돌아올 때 선택된 플로우의 스텝 날씨를 갱신
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const flow = selectedFlowRef.current;
      if (!flow?.steps?.length) return;
      const stepsWithLocation = flow.steps.filter(s => s.lat && s.lon);
      if (!stepsWithLocation.length) return;

      (async () => {
        // 중복 위치 제거 (lat, lon 기준)
        const uniqueLocations = [];
        const seen = new Set();
        
        for (const s of stepsWithLocation) {
          const key = `${s.lat}_${s.lon}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueLocations.push({ lat: s.lat, lon: s.lon, name: s.region?.name });
          }
        }

        const weatherResults = {};
        for (const loc of uniqueLocations) {
          try {
            const weather = await WeatherService.getWeather(loc.lat, loc.lon, false, loc.name, loc.name);
            if (weather?.condKey) {
              weatherResults[`${loc.lat}_${loc.lon}`] = { 
                condKey: weather.condKey, 
                isDay: weather.isDay !== false, 
                tzOffsetMs: weather.tzOffsetMs 
              };
            }
          } catch (_) {}
        }

        if (Object.keys(weatherResults).length === 0) return;

        setFlows(prev => {
          const updated = prev.map(f => {
            if (f.id !== flow.id) return f;
            const newSteps = f.steps.map(s => {
              if (!s.lat || !s.lon) return s;
              const newWeather = weatherResults[`${s.lat}_${s.lon}`];
              if (newWeather) return { ...s, weather: newWeather };
              return s;
            });
            return { ...f, steps: newSteps };
          });
          
          // setTimeout을 사용하여 렌더링 사이클 이후에 updateFlowDoc이 실행되도록 지연 (경고 방지)
          setTimeout(() => {
            const flowToUpdate = updated.find(f => f.id === flow.id);
            if (flowToUpdate && canEditFlow(flowToUpdate)) {
              updateFlowDoc(flowToUpdate);
            }
          }, 0);
          
          // 현재 선택된 플로우 동기화 (무한 루프 방지 위해 레퍼런스 활용)
          const updatedFlow = updated.find(f => f.id === flow.id);
          if (updatedFlow) {
            selectedFlowRef.current = updatedFlow;
            // setFlows 외부에서 setSelectedFlow가 간접적으로 업데이트되도록 처리
            // (무한 루프의 원인이 되는 setSelectedFlow 직접 호출 제거)
            setTimeout(() => setSelectedFlow(updatedFlow), 0);
          }
          
          return updated;
        });
      })();
    });
    return unsubscribe;
  }, [navigation]);

  const MAX_FLOWS = limits.flows;
  const MAX_STEPS = limits.stepsPerFlow;
  const WEATHER_LIMIT = limits.stepWeatherLimit;

  // inactive 플래그를 렌더 시점에 계산 — AsyncStorage 타이밍 이슈 없이 isPremium 즉시 반영
  const displayFlows = React.useMemo(() => {
    // 임시: 모든 플로우 활성화
    if (true) return flows.map(f => ({ ...f, inactive: false }));
    const sorted = [...flows].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    const activeIds = new Set(sorted.slice(0, MAX_FLOWS).map(f => f.id));
    return flows.map(f => ({ ...f, inactive: !activeIds.has(f.id) }));
  }, [flows, isPremium, MAX_FLOWS]);

  const showFlowToast = (msg) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(msg, ToastAndroid.SHORT);
      return;
    }
    if (flowToastTimeout.current) clearTimeout(flowToastTimeout.current);
    setFlowToastMsg(msg);
    flowToastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(flowToastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(flowToastAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setFlowToastMsg(''));
  };

  const saveFlow = async () => {
    if (isSaving) return;
    if (!flowTitle.trim()) {
      showFlowToast(t('flow.alert.title_required_toast'));
      return;
    }
    if (!editingFlow && displayFlows.filter(f => !f.inactive).length >= MAX_FLOWS) {
      const msg = isPremium
        ? t('flow.alert.limit_msg', `최대 ${MAX_FLOWS}개 플로우까지 만들 수 있습니다.`)
        : t('flow.alert.premium_limit_msg', `무료 플랜은 최대 ${MAX_FLOWS}개 플로우까지 만들 수 있습니다. 더 만들려면 프리미엄을 이용해 주세요.`);
      showConfirm(t('flow.alert.limit_title', 'Flow Limit'), msg, null, false);
      return;
    }
    
    setIsSaving(true);
    try {
      let weatherTemp = null;
      let weatherCondKey = null;
      let weatherIsDay = true;
      if (flowLat && flowLon) {
        const weather = await WeatherService.getWeather(flowLat, flowLon, false, flowLocation, flowLocation);
        weatherTemp = weather?.temp ? (String(weather.temp).includes('°') ? weather.temp : `${weather.temp}°`) : '--°';
        weatherCondKey = weather?.condKey || 'cloudy';
        weatherIsDay = weather?.isDay !== false;
      }

      const now = new Date().toISOString();
      const updatedFlows = editingFlow
        ? flows.map(f => f.id === editingFlow.id ? {
            ...f,
            title: flowTitle,
            description: flowDescription,
            location: flowLocation,
            address: flowAddress,
            lat: flowLat,
            lon: flowLon,
            gradient: flowGradient,
            weatherTemp,
            weatherCondKey,
            weatherIsDay,
            updatedAt: now
          } : f)
        : await addFlow({
            id: Date.now().toString(),
            title: flowTitle,
            description: flowDescription,
            period: t('flow.multi_day_planning', 'Multi-day Planning'),
            location: flowLocation || '',
            address: flowAddress || '',
            progress: 0,
            gradient: flowGradient,
            weatherTemp,
            weatherCondKey,
            weatherIsDay,
            lat: flowLat,
            lon: flowLon,
            steps: [],
            createdAt: now,
            updatedAt: now
          });

      setFlows(updatedFlows);
      await saveFlows(updatedFlows);
      
      if (editingFlow && selectedFlow && selectedFlow.id === editingFlow.id) {
        const updatedSelected = updatedFlows.find(f => f.id === editingFlow.id);
        if (updatedSelected) setSelectedFlow(updatedSelected);
      }
      
      setFlowModalVisible(false);
    } catch (e) { console.error(e); }
    finally { setIsSaving(false); }
  };

  const saveStep = async () => {
    if (isSaving) return;
    if (!editActivity.trim()) {
      showConfirm(t('flow.alert.activity_required'), t('flow.alert.activity_required_msg'), null, false);
      return;
    }
    if (!editingStep && (selectedFlow?.steps?.length || 0) >= MAX_STEPS) {
      const msg = isPremium
        ? t('flow.alert.step_limit_msg', `플로우당 최대 ${MAX_STEPS}개 일정까지 추가할 수 있습니다.`)
        : t('flow.alert.step_limit_free_msg', `무료 플랜은 플로우당 최대 ${MAX_STEPS}개 일정까지 추가할 수 있습니다.`);
      showConfirm(t('flow.alert.limit_title', 'Flow Limit'), msg, null, false);
      return;
    }

    // 날씨 설정 제한 체크: 반복 일정은 1개로 카운트
    const weatherStepGroups = new Set();
    let weatherCount = 0;
    (selectedFlow?.steps || []).forEach(s => {
      if (s.region) {
        if (s.repeatGroupId) {
          if (!weatherStepGroups.has(s.repeatGroupId)) {
            weatherStepGroups.add(s.repeatGroupId);
            weatherCount++;
          }
        } else {
          weatherCount++;
        }
      }
    });
    
    const isAddingNewWeather = selectedRegion && (!editingStep || !editingStep.region);
    if (isAddingNewWeather && weatherCount >= WEATHER_LIMIT) {
      const msg = isPremium
        ? t('flow.alert.weather_limit_msg', { count: WEATHER_LIMIT })
        : t('flow.alert.weather_limit_free_msg', { count: WEATHER_LIMIT });
      showConfirm(t('flow.alert.limit_title', 'Weather Limit'), msg, null, false);
      return;
    }
    if (editTime && !editTime.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
      showConfirm(t('flow.alert.invalid_time'), t('flow.alert.invalid_time_msg'), null, false);
      return;
    }
    if (stepRepeatType && !stepRepeatEndDate) {
      showConfirm('', t('tasks.repeat_end_required', '반복 종료일을 선택해주세요'), null, false);
      return;
    }

    setIsSaving(true);
    try {
      setIsSearching(true);
      let weatherData = null;
      let hasWarning = false;
      const now = new Date().toISOString();
      const targetLat = selectedRegion ? selectedRegion.lat : null;
      const targetLon = selectedRegion ? selectedRegion.lon : null;
      const targetName = selectedRegion ? selectedRegion.name : null;

      try {
        if (targetLat && targetLon) {
          const weather = await WeatherService.getWeather(targetLat, targetLon, false, targetName, targetName);
          const weatherKey = weather ? weather.condKey : null;
          const weatherIsDay = weather ? (weather.isDay !== false) : true;
          hasWarning = weather && (weather.condKey === 'rainy' || weather.condKey === 'thunderstorm');
          weatherData = { condKey: weatherKey, isDay: weatherIsDay };
        }
      } catch (e) { console.error(e); }
      finally { setIsSearching(false); }

      const finalEndDate = matchStartDate ? editDate : editEndDate;
      const finalEndTime = matchStartDate ? editTime : editEndTime;

      const applyToFlow = async (updatedSteps) => {
        if (__DEV__) console.log('[FlowScreen] applyToFlow starting...', { flowId: selectedFlow.id, ownerUid: selectedFlow._ownerUid });
        
        // UI 즉시 반응: 모달 닫기
        closeEditModal();
        
        const sorted = sortSteps(updatedSteps);
        const updatedF = { ...selectedFlow, steps: sorted, updatedAt: now };
        setSelectedFlow(updatedF);
        const updatedFlows = flows.map(f => f.id === selectedFlow.id ? updatedF : f);
        setFlows(updatedFlows);
        
        try {
          if (selectedFlow._ownerUid) {
            if (canEditFlow(selectedFlow)) {
              if (__DEV__) console.log('[FlowScreen] Shared flow (editor/owner). Updating via updateFlowDoc...');
              await updateFlowDoc(updatedF);
            } else {
              if (__DEV__) console.warn('[FlowScreen] Shared flow (viewer). Permission denied for update.');
              // 뷰어는 서버에 저장할 수 없으므로 로컬 UI 변경을 롤백하거나 경고를 띄워야 함
              // 여기서는 버튼 자체를 숨기므로 이 코드는 방어용
              showConfirm(t('common.info'), t('flow.alert.viewer_cannot_edit', 'You only have view permission.'), null, false);
              return; // 서버 업데이트 실패했으므로 여기서 중단 (UI는 이미 바뀌었지만 Snapshot에 의해 곧 원복됨)
            }
          } else {
            if (__DEV__) console.log('[FlowScreen] Own flow detected. Saving via saveFlows...');
            await saveFlows(updatedFlows);
          }
          if (__DEV__) console.log('[FlowScreen] applyToFlow success.');
        } catch (err) {
          if (__DEV__) console.error('[FlowScreen] applyToFlow error:', err);
          showConfirm(t('common.error', 'Error'), t('flow.update_failed', 'Failed to update flow on server. Please check your connection.'), null, false);
        } finally {
          setIsSaving(false); // 여기서도 확실히 해제
        }
      };

      const currentSteps = flows.find(f => f.id === selectedFlow.id)?.steps || [];

      // 반복 시리즈 신규 생성 여부 (단일 스텝 편집 또는 신규 추가 → 반복 전환)
      const willCreateRepeatSeries = !!(stepRepeatType && stepRepeatEndDate &&
        (!editingStep || !editingStep.repeatGroupId));

      // 알림 처리: time 없으면 알림 불가
      let notificationId = editingStep?.notificationId || null;
      if (stepNotify && !editTime) {
        showConfirm('', t('flow.notify_time_required', '알림을 설정하려면 시작 시간이 필요합니다'), null, false);
        setIsSaving(false);
        return;
      }
      if (stepNotify) {
        const granted = await requestPermission();
        if (!granted) {
          showConfirm('', t('tasks.notify_permission_denied', '알림 권한이 필요합니다'), null, false);
          setIsSaving(false);
          return;
        }
        if (willCreateRepeatSeries) {
          // 반복 시리즈: 기존 알림 취소만 하고 upfront 스케줄 안 함; refill이 처리
          if (notificationId) await cancelNotification(notificationId);
          notificationId = null;
        } else {
          if (notificationId) await cancelNotification(notificationId);
          notificationId = await scheduleNotification(editActivity, editActivity, editDate, editTime);
        }
      } else if (!stepNotify && editingStep?.notificationId) {
        await cancelNotification(editingStep.notificationId);
        notificationId = null;
      }

      const baseUpdates = { time: editTime, date: editDate, endTime: finalEndTime, endDate: finalEndDate, activity: editActivity, memo: editMemo, region: selectedRegion, weather: weatherData, warning: hasWarning, lat: targetLat, lon: targetLon, updatedAt: now, notify: stepNotify, notificationId: stepNotify ? notificationId : null };

      const doEdit = async (scope) => {
        let updatedSteps;
        if (scope === 'this') {
          updatedSteps = currentSteps.map(s => s.id === editingStep.id ? { ...s, ...baseUpdates } : s);
          await applyToFlow(updatedSteps);
        } else {
          const { date: _d, endDate: _ed, ...shared } = baseUpdates;

          // 다중 범위: 영향받는 모든 스텝의 기존 알림 취소 + upfront 알림도 취소
          if (stepNotify) {
            const predCancel = scope === 'future'
              ? s => s.repeatGroupId === editingStep.repeatGroupId && s.date >= editingStep.date
              : s => s.repeatGroupId === editingStep.repeatGroupId;
            const oldIds = currentSteps.filter(predCancel).map(s => s.notificationId).filter(Boolean);
            const allToCancel = [...new Set([...oldIds, ...(notificationId ? [notificationId] : [])])];
            await Promise.all(allToCancel.map(cancelNotification));
          }

          // 다른 스텝들엔 notificationId: null (refill이 처리)
          const sharedForOthers = stepNotify ? { ...shared, notificationId: null } : shared;
          const baseForEditing = stepNotify ? { ...baseUpdates, notificationId: null } : baseUpdates;

          const oldDateMs = new Date(editingStep.date + 'T12:00:00').getTime();
          const editDateMs = new Date(editDate + 'T12:00:00').getTime();
          const dateShiftMs = editDateMs - oldDateMs;

          const editEndDateMs = finalEndDate ? new Date(finalEndDate + 'T12:00:00').getTime() : null;
          const durationMs = editEndDateMs !== null ? editEndDateMs - editDateMs : null;

          const pred = scope === 'future'
            ? (s) => s.repeatGroupId === editingStep.repeatGroupId && s.date >= editingStep.date
            : (s) => s.repeatGroupId === editingStep.repeatGroupId;

          updatedSteps = currentSteps.map(s => {
            if (!pred(s)) return s;
            if (s.id === editingStep.id) {
              return { ...s, ...baseForEditing };
            }
            const stepDateMs = new Date(s.date + 'T12:00:00').getTime();
            const newStepDateMs = stepDateMs + dateShiftMs;
            const newDateStr = _dateStrFlow(new Date(newStepDateMs));

            let newEndDate = null;
            if (durationMs !== null) {
              newEndDate = _dateStrFlow(new Date(newStepDateMs + durationMs));
            } else if (s.endDate) {
              const oldEndMs = new Date(s.endDate + 'T12:00:00').getTime();
              newEndDate = _dateStrFlow(new Date(oldEndMs + dateShiftMs));
            }

            return { ...s, ...sharedForOthers, date: newDateStr, endDate: newEndDate };
          });

          await applyToFlow(updatedSteps);

          if (stepNotify) {
            const flowForRefill = flows.map(f => f.id !== selectedFlow.id ? f : { ...f, steps: sortSteps(updatedSteps) });
            // 백그라운드 처리 (await 제거)
            refillStepNotifications(flowForRefill, async (fId, sId, patch) => {
              const latest = await getFlows();
              const refreshed = latest.map(fl => fl.id !== fId ? fl : { ...fl, steps: fl.steps.map(s => s.id === sId ? { ...s, ...patch } : s) });
              await saveFlows(refreshed);
              setFlows(refreshed);
            }).catch(err => { if (__DEV__) console.error('refill error:', err); });
          }
        }
      };

      if (editingStep) {
        if (editingStep.repeatGroupId) {
          const repEndChanged = stepRepeatEndDate !== (editingStep.repeatEndDate || '');

          if (repEndChanged && stepRepeatEndDate) {
            // Repeat end date changed → extend/shorten series globally, no 3-way choice
            const groupId = editingStep.repeatGroupId;
            const repeat = editingStep.repeat || stepRepeatType;
            const newRepeatEnd = new Date(stepRepeatEndDate + 'T12:00:00');

            const groupSteps = currentSteps
              .filter(s => s.repeatGroupId === groupId)
              .sort((a, b) => a.date.localeCompare(b.date));
            const lastStep = groupSteps[groupSteps.length - 1];
            const lastDate = new Date(lastStep.date + 'T12:00:00');

            const masterStep = groupSteps.find(s => s.isRepeatMaster) || groupSteps[0];
            const masterStart = new Date(masterStep.date + 'T12:00:00');
            const masterEndObj = masterStep.endDate ? new Date(masterStep.endDate + 'T12:00:00') : masterStart;
            const durationMs = masterEndObj - masterStart;

            const { date: _d, endDate: _ed, ...sharedUpdatesRaw } = baseUpdates;

            // 모든 그룹 스텝의 기존 알림 취소 + upfront 알림 취소
            if (stepNotify) {
              const oldIds = currentSteps.filter(s => s.repeatGroupId === groupId).map(s => s.notificationId).filter(Boolean);
              const allToCancel = [...new Set([...oldIds, ...(notificationId ? [notificationId] : [])])];
              await Promise.all(allToCancel.map(cancelNotification));
            }

            // notificationId는 refill이 개별 처리
            const sharedUpdates = stepNotify ? { ...sharedUpdatesRaw, notificationId: null } : sharedUpdatesRaw;

            // Remove instances after new end date (keep master), apply shared edits
            let updatedSteps = currentSteps
              .filter(s => {
                if (s.repeatGroupId !== groupId) return true;
                if (s.isRepeatMaster) return true;
                return s.date <= stepRepeatEndDate;
              })
              .map(s => s.repeatGroupId === groupId
                ? { ...s, ...sharedUpdates, repeatEndDate: stepRepeatEndDate }
                : s
              );

            // Add new instances if end date was extended
            if (newRepeatEnd > lastDate) {
              let current = _advanceByRepeat(lastDate, repeat);
              const MAX_OCC = 200;
              const newSteps = [];
              while (current <= newRepeatEnd && newSteps.length < MAX_OCC) {
                newSteps.push({
                  ...masterStep,
                  ...sharedUpdates,
                  id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_ext_${newSteps.length}`,
                  date: _dateStrFlow(current),
                  endDate: _dateStrFlow(new Date(current.getTime() + durationMs)),
                  repeatEndDate: stepRepeatEndDate,
                  isRepeatMaster: false,
                  isCompleted: false,
                  status: 'upcoming',
                  createdAt: now,
                  updatedAt: now,
                });
                current = _advanceByRepeat(current, repeat);
              }
              updatedSteps = [...updatedSteps, ...newSteps];
            }

            await applyToFlow(updatedSteps);
            if (stepNotify) {
              const flowForRefill = flows.map(f => f.id !== selectedFlow.id ? f : { ...f, steps: sortSteps(updatedSteps) });
              // 백그라운드 처리 (await 제거)
              refillStepNotifications(flowForRefill, async (fId, sId, patch) => {
                const latest = await getFlows();
                const refreshed = latest.map(fl => fl.id !== fId ? fl : { ...fl, steps: fl.steps.map(s => s.id === sId ? { ...s, ...patch } : s) });
                await saveFlows(refreshed);
                setFlows(refreshed);
              }).catch(err => { if (__DEV__) console.error('refill error:', err); });
            }
            return;
          }

          await doEdit('all');
        } else if (stepRepeatType && stepRepeatEndDate) {
          // 단일 스텝 → 반복 시리즈로 변환
          const groupId = `rg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const startDate = new Date(editDate + 'T12:00:00');
          const endDateObj = finalEndDate ? new Date(finalEndDate + 'T12:00:00') : startDate;
          const durationMs = endDateObj - startDate;
          const repeatEnd = new Date(stepRepeatEndDate + 'T12:00:00');
          const MAX_OCCURRENCES = 200;
          const newSteps = [];
          let current = new Date(startDate);

          while (current <= repeatEnd && newSteps.length < MAX_OCCURRENCES) {
            const occStartStr = _dateStrFlow(current);
            const occEndStr = _dateStrFlow(new Date(current.getTime() + durationMs));
            newSteps.push({
              ...baseUpdates,
              id: newSteps.length === 0
                ? editingStep.id
                : `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${newSteps.length}`,
              date: occStartStr,
              endDate: occEndStr,
              repeat: stepRepeatType,
              repeatEndDate: stepRepeatEndDate,
              repeatGroupId: groupId,
              isRepeatMaster: newSteps.length === 0,
              status: editingStep.status || 'upcoming',
              createdAt: editingStep.createdAt || now,
              updatedAt: now,
            });
            current = _advanceByRepeat(current, stepRepeatType);
          }

          const stepsWithoutEditing = currentSteps.filter(s => s.id !== editingStep.id);
          const editRepeatSteps = [...stepsWithoutEditing, ...newSteps];
          await applyToFlow(editRepeatSteps);
          if (stepNotify) {
            const flowForRefill = flows.map(f => f.id !== selectedFlow.id ? f : { ...f, steps: sortSteps(editRepeatSteps) });
            // 백그라운드 처리 (await 제거)
            refillStepNotifications(flowForRefill, async (fId, sId, patch) => {
              const latest = await getFlows();
              const refreshed = latest.map(fl => fl.id !== fId ? fl : { ...fl, steps: fl.steps.map(s => s.id === sId ? { ...s, ...patch } : s) });
              await saveFlows(refreshed);
              setFlows(refreshed);
            }).catch(err => { if (__DEV__) console.error('refill error:', err); });
          }
        } else {
          const updatedSteps = currentSteps.map(s => s.id === editingStep.id ? { ...s, ...baseUpdates } : s);
          await applyToFlow(updatedSteps);
        }
        return;
      }

      // New step
      if (stepRepeatType && stepRepeatEndDate) {
        const groupId = `rg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const startDate = new Date(editDate + 'T12:00:00');
        const endDateObj = finalEndDate ? new Date(finalEndDate + 'T12:00:00') : startDate;
        const durationMs = endDateObj - startDate;
        const repeatEnd = new Date(stepRepeatEndDate + 'T12:00:00');
        const MAX_OCCURRENCES = 200;
        const newSteps = [];
        let current = new Date(startDate);

        while (current <= repeatEnd && newSteps.length < MAX_OCCURRENCES) {
          const occStartStr = _dateStrFlow(current);
          const occEndStr = _dateStrFlow(new Date(current.getTime() + durationMs));
          newSteps.push({
            id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${newSteps.length}`,
            date: occStartStr,
            time: editTime,
            endTime: finalEndTime,
            endDate: occEndStr,
            activity: editActivity,
            memo: editMemo,
            region: selectedRegion,
            status: 'upcoming',
            weather: weatherData,
            warning: hasWarning,
            lat: targetLat,
            lon: targetLon,
            repeat: stepRepeatType,
            repeatEndDate: stepRepeatEndDate,
            repeatGroupId: groupId,
            isRepeatMaster: newSteps.length === 0,
            notify: stepNotify,
            notificationId: null, // refill handles this
            createdAt: now,
            updatedAt: now,
          });
          current = _advanceByRepeat(current, stepRepeatType);
        }
      const newRepeatSteps = [...currentSteps, ...newSteps];
      await applyToFlow(newRepeatSteps);
      if (stepNotify) {
        const flowForRefill = flows.map(f => f.id !== selectedFlow.id ? f : { ...f, steps: sortSteps(newRepeatSteps) });
        // 백그라운드 처리 (await 제거)
        refillStepNotifications(flowForRefill, async (fId, sId, patch) => {
          const latest = await getFlows();
          const refreshed = latest.map(fl => fl.id !== fId ? fl : { ...fl, steps: fl.steps.map(s => s.id === sId ? { ...s, ...patch } : s) });
          await saveFlows(refreshed);
          setFlows(refreshed);
        }).catch(err => { if (__DEV__) console.error('refill error:', err); });
      }
    } else {
      const newStep = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        ...baseUpdates,
        status: 'upcoming',
        createdAt: now,
      };
        await applyToFlow([...currentSteps, newStep]);
        if (stepNotify) {
          const flowForRefill = flows.map(f => f.id !== selectedFlow.id ? f : { ...f, steps: sortSteps([...currentSteps, newStep]) });
          refillStepNotifications(flowForRefill, async (fId, sId, patch) => {
            const latest = await getFlows();
            const refreshed = latest.map(fl => fl.id !== fId ? fl : { ...fl, steps: fl.steps.map(s => s.id === sId ? { ...s, ...patch } : s) });
            await saveFlows(refreshed);
            setFlows(refreshed);
          }).catch(err => { if (__DEV__) console.error('refill error:', err); });
        }
      }
    } catch (e) {
      if (__DEV__) console.error('[FlowScreen] saveStep error:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const doDeleteStep = async (scope) => {
    const now = new Date().toISOString();
    const currentStepsForFlow = flows.find(f => f.id === selectedFlow.id)?.steps || [];

    // 삭제 대상 스텝들의 알림 취소
    let toCancel = [];
    if (scope === 'this') {
      if (editingStep?.notificationId) toCancel = [editingStep.notificationId];
    } else if (scope === 'future') {
      toCancel = currentStepsForFlow.filter(s => s.repeatGroupId === editingStep.repeatGroupId && s.date >= editingStep.date && s.notificationId).map(s => s.notificationId);
    } else {
      toCancel = currentStepsForFlow.filter(s => s.repeatGroupId === editingStep.repeatGroupId && s.notificationId).map(s => s.notificationId);
    }
    await Promise.all(toCancel.map(cancelNotification));

    let updatedF;
    const updatedFlows = flows.map(f => {
      if (f.id !== selectedFlow.id) return f;
      let updatedSteps;
      if (scope === 'this') {
        updatedSteps = f.steps.filter(s => s.id !== editingStep.id);
      } else if (scope === 'future') {
        updatedSteps = f.steps.filter(s => !(s.repeatGroupId === editingStep.repeatGroupId && s.date >= editingStep.date));
      } else {
        updatedSteps = f.steps.filter(s => s.repeatGroupId !== editingStep.repeatGroupId);
      }
      updatedF = { ...f, steps: updatedSteps, updatedAt: now };
      setSelectedFlow(updatedF);
      return updatedF;
    });
    setFlows(updatedFlows);
    if (selectedFlow._ownerUid) {
      if (canEditFlow(selectedFlow)) await updateFlowDoc(updatedF);
    } else {
      await saveFlows(updatedFlows);
    }
    closeEditModal();
  };

  const deleteStep = () => {
    const title = editingStep?.repeatGroupId ? t('tasks.delete_repeat_title') : t('tasks.delete_confirm');
    const msg = editingStep?.repeatGroupId ? t('tasks.delete_repeat_msg') : t('tasks.delete_confirm_msg');

    showConfirm(
      title,
      msg,
      () => {
        if (editingStep?.repeatGroupId) {
          doDeleteStep('all');
        } else {
          doDeleteStep('this');
        }
      },
      true
    );
  };

  const deleteStepById = async (stepId) => {
    const now = new Date().toISOString();
    const step = flows.find(f => f.id === selectedFlow.id)?.steps?.find(s => s.id === stepId);
    if (step?.notificationId) await cancelNotification(step.notificationId);
    let updatedF;
    const updatedFlows = flows.map(f => {
      if (f.id === selectedFlow.id) {
        const updatedSteps = f.steps.filter(s => s.id !== stepId);
        updatedF = { ...f, steps: updatedSteps, updatedAt: now };
        setSelectedFlow(updatedF);
        return updatedF;
      }
      return f;
    });
    setFlows(updatedFlows);
    if (selectedFlow._ownerUid) {
      if (canEditFlow(selectedFlow)) await updateFlowDoc(updatedF);
    } else {
      await saveFlows(updatedFlows);
    }
  };

  const handleShareFlowImage = async () => {
    if (!viewShotRef.current) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSharingImage(true);
    
    try {
      // 캡처 전에 잠시 대기 (UI 업데이트 보장)
      const uri = await viewShotRef.current.capture();
      if (uri) {
        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (isSharingAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: `Share ${selectedFlow?.title || 'My Schedule'}`,
            UTI: 'public.png',
          });
        } else {
          showConfirm(t('flow.alert.sharing_not_available'), t('flow.alert.sharing_not_available_msg'), null, false);
        }
      }
    } catch (e) {
      console.error("Capture failed", e);
      showConfirm(t('flow.alert.share_failed'), t('flow.alert.share_failed_msg'), null, false);
    } finally {
      setIsSharingImage(false);
    }
  };

  const sortSteps = (steps) => {
    if (!steps) return [];
    return [...steps].sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      
      const timeA = a.time || '';
      const timeB = b.time || '';
      return timeA.localeCompare(timeB);
    });
  };

  const groupStepsByDate = (steps) => {
    if (!steps) return {};
    return steps.reduce((acc, step) => {
      const dateKey = step.date || 'Unscheduled';
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(step);
      return acc;
    }, {});
  };

  const getLocalizedPeriod = (period) => {
    if (period === 'Multi-day Planning' || period === '일정 계획' || period === 'Multi-Day Planning') {
      return t('flow.multi_day_planning', 'Multi-day Planning');
    }
    return period;
  };

  const formatDateLabel = (dateStr) => {
    if (!dateStr || dateStr === 'Unscheduled') return t('flow.unscheduled', 'Unscheduled');
    try {
      const d = new Date(dateStr);
      if (i18n.language.startsWith('ko')) {
        const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
        return `${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdays[d.getDay()]})`;
      }
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
    } catch (e) { return dateStr; }
  };

  const openSearch = (mode) => { 
    setSearchQuery(''); 
    setSearchResults([]); 
    searchPanY.setValue(0); 
    setSearchMode(mode); 
    setSearchModalVisible(true); 
  };
  const closeSearch = () => { setSearchModalVisible(false); setSearchQuery(''); setSearchResults([]); };

  const openFlowModal = (flow = null) => {
    flowPanY.setValue(height);
    setEditingFlow(flow);
    setFlowTitle(flow ? flow.title : '');
    setFlowDescription(flow ? (flow.description || '') : '');
    setFlowLocation(flow ? flow.location : '');
    setFlowAddress(flow ? (flow.address || '') : '');
    setFlowLat(flow ? flow.lat : null);
    setFlowLon(flow ? flow.lon : null);
    setFlowGradient(flow ? (flow.gradient || FLOW_GRADIENT_PRESETS[0].colors) : FLOW_GRADIENT_PRESETS[Math.floor(Math.random() * FLOW_GRADIENT_PRESETS.length)].colors);
    setFlowModalVisible(true);
    Animated.spring(flowPanY, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 14 }).start();
  };

  const openEditStep = (step) => {
    setEditingStep(step);
    setEditTime(step.time);
    setEditDate(step.date);
    setEditEndTime(step.endTime || step.time);
    setEditEndDate(step.endDate || step.date);
    setMatchStartDate(!(step.endDate && step.endDate !== step.date) && !(step.endTime && step.endTime !== step.time));
    setEditActivity(step.activity);
    setEditMemo(step.memo || '');
    setSelectedRegion(step.region || null);
    setStepRepeatType(step.repeat || null);
    setStepRepeatEndDate(step.repeatEndDate || '');
    setShowStepRepeatPicker(false);
    setPickerType(null);
    setStepNotify(!!step.notify);
    openEditModal();
  };

  const handleDeleteFlow = (id) => {
    const flow = flows.find(f => f.id === id);
    if (!flow || isFlowOwner(flow)) {
      showConfirm(
        t('flow.alert.delete_flow'),
        t('flow.alert.delete_flow_msg'),
        async () => {
          const updated = flows.filter(f => f.id !== id);
          setFlows(updated);
          if (selectedFlow?.id === id) setSelectedFlow(null);
          await deleteFlow(id);
        },
        true,
        t('common.delete')
      );
    } else {
      showConfirm(
        t('flow.alert.leave_flow'),
        t('flow.alert.leave_flow_msg'),
        async () => {
          setIsLeaving(true);
          try {
            removeSharedFlowOptimistic(flow.id);
            setSelectedFlow(null);
            await leaveFlow(user?.uid, flow._ownerUid, flow.id);
          } catch (e) {
            console.warn('[FlowScreen] leaveFlow error:', e);
            showConfirm(t('common.error'), e.message, null, false);
          } finally {
            setIsLeaving(false);
          }
        },
        true,
        t('common.leave')
      );
    }
  };

  const renderConfirmModal = () => (
    <Modal visible={confirmModalVisible} transparent animationType="fade">
      <View style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center' }]}>
        <View style={styles.confirmModal}>
          <Text style={styles.confirmTitle}>{confirmTitle}</Text>
          <Text style={styles.confirmMessage}>{confirmMessage}</Text>
          <View style={styles.confirmActions}>
            {confirmShowCancel && (
              <Pressable 
                style={({ pressed }) => [styles.confirmBtn, { opacity: pressed ? 0.6 : 1 }]} 
                onPress={() => setConfirmModalVisible(false)}
              >
                <Text style={styles.confirmCancelText}>{t('common.cancel')}</Text>
              </Pressable>
            )}
            <Pressable 
              style={({ pressed }) => [
                styles.confirmBtn, 
                confirmIsDestructive && { backgroundColor: Colors.error },
                { opacity: pressed ? 0.8 : 1 }
              ]} 
              onPress={handleConfirm}
            >
              <Text style={confirmIsDestructive ? styles.confirmDestructiveText : styles.confirmText}>
                {confirmOkText}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  const handleWeatherIconPress = (step) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const lat = step.lat || selectedFlow?.lat;
    const lon = step.lon || selectedFlow?.lon;
    const name = (step.region && step.region.name) || selectedFlow?.location;
    const address = (step.region && step.region.address) || selectedFlow?.address || '';

    if (!lat || !lon) return;

    // 즉시 이동 (상세 데이터는 WeatherDetailScreen에서 needsFullLoad로 처리됨)
    navigation.navigate('WeatherDetail', { 
      weatherData: { lat, lon, locationName: name, addressName: address }, 
      isCurrentLocation: false, 
      locationName: name 
    });
  };

  // 실시간 스와이프 애니메이션을 위한 변수
  const swipeBackX = useRef(new Animated.Value(0)).current;

  const swipeBackPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // 왼쪽 가장자리(x < 50)에서 시작해 오른쪽으로 밀 때 인식
        return gestureState.dx > 5 && Math.abs(gestureState.dy) < 15 && gestureState.x0 < 50;
      },
      onPanResponderMove: (_, gestureState) => {
        // 오른쪽으로 밀 때만 애니메이션 값 업데이트
        if (gestureState.dx > 0) {
          swipeBackX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > width * 0.25) {
          // 일정 거리 이상 밀면 화면 밖으로 날리고 상태 변경
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          Animated.timing(swipeBackX, {
            toValue: width,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setSelectedFlow(null);
            swipeBackX.setValue(0); // 다음 진입을 위해 초기화
          });
        } else {
          // 아니면 다시 제자리로 스프링 효과와 함께 복귀
          Animated.spring(swipeBackX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
            tension: 40
          }).start();
        }
      }
    })
  ).current;

  const getFlowGradient = (existingFlows = []) => {
    // 1. 지능형 랜덤 컬러 생성기 (가독성 보장 + 무한한 다양성)
    const generateSafeGradient = () => {
      // 색상(Hue)을 0-360도 전체에서 선택
      const h = Math.floor(Math.random() * 360);
      
      // 색상 영역에 따른 명도(Lightness) 보정 로직 (WCAG 가독성 기준 기반)
      // 노란색, 연두색 등 밝은 계열(40~100도)은 명도를 더 낮게, 파란색/보라색 등 어두운 계열은 명도를 약간 더 높게.
      let l;
      if (h >= 40 && h <= 100) {
        // Yellow-Green 영역: 더 어둡게 (35~45%)
        l = 35 + Math.floor(Math.random() * 10);
      } else if (h >= 190 && h <= 280) {
        // Blue-Purple 영역: 조금 더 밝게 해도 가독성 좋음 (45~55%)
        l = 45 + Math.floor(Math.random() * 10);
      } else {
        // 기타 영역 (Red, Orange, Cyan, Magenta): 중간 명도 (40~50%)
        l = 40 + Math.floor(Math.random() * 10);
      }

      // 채도(Saturation): 65%~90% 사이에서 풍부하게 표현
      const s = 65 + Math.floor(Math.random() * 25);
      
      const color1 = `hsl(${h}, ${s}%, ${l}%)`;
      // 끝 색상은 색상을 20-40도 정도 회전시키고, 명도를 살짝 변형하여 입체감 있는 그라디언트 생성
      const h2 = (h + 20 + Math.floor(Math.random() * 20)) % 360;
      const l2 = Math.max(25, l - 10); // 너무 어두워지지 않게 하한선(25%) 설정
      const color2 = `hsl(${h2}, ${s}%, ${l2}%)`;

      return [color1, color2];
    };

    // 2. 이미 사용 중인 색상과 너무 겹치지 않게 최대 5번 시도
    let bestGradient = generateSafeGradient();
    const usedHues = existingFlows.map(f => {
      const match = f.gradient?.[0]?.match(/hsl\((\d+)/);
      return match ? parseInt(match[1]) : -1;
    });

    for (let i = 0; i < 5; i++) {
      const candidate = generateSafeGradient();
      const candHue = parseInt(candidate[0].match(/hsl\((\d+)/)[1]);
      
      // 기존 색상들과 Hue 값이 30도 이상 차이 나면 채택
      const isUnique = usedHues.every(uh => Math.abs(uh - candHue) > 30);
      if (isUnique) {
        bestGradient = candidate;
        break;
      }
    }

    return bestGradient;
  };

  const getLiveIsDay = (lon) => {
    if (lon == null) return true;
    const offsetMs = Math.round(lon / 15) * 3600000;
    const localHour = new Date(Date.now() + offsetMs).getUTCHours();
    return localHour >= 6 && localHour < 18;
  };

  const getStepIsDay = (step) => {
    if (step.weather?.tzOffsetMs !== undefined) {
      const localHour = new Date(Date.now() + step.weather.tzOffsetMs).getUTCHours();
      return localHour >= 6 && localHour < 18;
    }
    return getLiveIsDay(step.lon);
  };

  const renderWeatherIcon = (key, size = 20, color = Colors.primary, isDay = true) => {
    const moonColor = color === 'white' ? 'white' : "#A1C9FF";
    const sunColor = color === 'white' ? 'white' : "#f59e0b";
    const rainColor = color === 'white' ? 'white' : "#3b82f6";
    const snowColor = color === 'white' ? 'white' : "#94a3b8";
    const thunderColor = color === 'white' ? 'white' : "#E53935";

    let icon;
    switch (key) {
      case 'sunny': case 'clear': icon = isDay ? <Sun size={size} color={sunColor} /> : <Moon size={size} color={moonColor} />; break;
      case 'clear_night': case 'mostly_clear_night': icon = <Moon size={size} color={moonColor} />; break;
      case 'partly_cloudy': case 'mostly_sunny': icon = isDay ? <CloudSun size={size} color={color} /> : <CloudMoon size={size} color={moonColor} />; break;
      case 'cloudy': case 'overcast': icon = <Cloud size={size} color={color} />; break;
      case 'light_rain': case 'moderate_rain': case 'heavy_rain': case 'rainy': case 'rain': icon = <CloudRain size={size} color={rainColor} />; break;
      case 'light_snow': case 'heavy_snow': case 'snowy': case 'snow': icon = <CloudSnow size={size} color={snowColor} />; break;
      case 'thunderstorm': case 'lightning': icon = <CloudLightning size={size} color={thunderColor} />; break;
      default: icon = isDay ? <Sun size={size} color={sunColor} /> : <Moon size={size} color={moonColor} />;
    }
    return <View pointerEvents="none">{icon}</View>;
  };

  const onDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setPickerType(null);
    if (selectedDate) {
      const y = selectedDate.getFullYear();
      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const d = String(selectedDate.getDate()).padStart(2, '0');
      const formatted = `${y}-${m}-${d}`;
      
      if (pickerType === 'endDate') {
        setEditEndDate(formatted);
        setMatchStartDate(false);
      } else {
        setEditDate(formatted);
        if (matchStartDate) setEditEndDate(formatted);
      }
    }
  };

  const onTimeChange = (event, selectedTime) => {
    if (Platform.OS === 'android') setPickerType(null);
    if (selectedTime) {
      const h = String(selectedTime.getHours()).padStart(2, '0');
      const m = String(selectedTime.getMinutes()).padStart(2, '0');
      const formatted = `${h}:${m}`;
      
      if (pickerType === 'endTime') {
        setEditEndTime(formatted);
        setMatchStartDate(false);
      } else {
        setEditTime(formatted);
        if (matchStartDate) setEditEndTime(formatted);
      }
    }
  };

  const renderSearchLayer = () => (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.background, zIndex: 2000, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg }, { transform: [{ translateY: searchPanY }] }]}>
      <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 16 }} {...searchPanResponder.panHandlers}>
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.outline, opacity: 0.4 }} />
      </View>
      <View style={styles.modalHeader}>
        <View style={styles.searchInputContainer}>
          <Search size={20} color={Colors.outline} />
          <TextInput 
            style={styles.modalInput} 
            placeholder={t('common.search_placeholder', 'Search region...')} 
            placeholderTextColor={Colors.outline} 
            value={searchQuery} 
            onChangeText={setSearchQuery} 
            autoFocus 
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <GHButton onPress={() => setSearchQuery('')}>
              <X size={20} color={Colors.outline} />
            </GHButton>
          )}
        </View>
        <GHButton onPress={closeSearch}>
          <Text style={styles.cancelText}>{t('common.cancel', 'Cancel')}</Text>
        </GHButton>
      </View>
      <ScrollView style={styles.searchResultsList}>
        {isSearching ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
        ) : (
          searchResults.map((item) => (
            <GHButton key={item.id} style={styles.resultItem} onPress={() => handleSelection(item)}>
              <View style={styles.resultIconWrap}><MapPin size={20} color={Colors.primary} /></View>
              <View style={styles.resultInfo}>
                <View style={styles.resultHeader}><Text style={styles.resultName}>{item.name}</Text></View>
                <Text style={styles.resultAddress}>{item.address}</Text>
              </View>
            </GHButton>
          ))
        )}
      </ScrollView>
    </Animated.View>
  );

  const groupedSteps = groupStepsByDate(selectedFlow?.steps);
  const sortedDates = Object.keys(groupedSteps).sort((a, b) => {
    if (a === 'Unscheduled') return 1;
    if (b === 'Unscheduled') return -1;
    return a.localeCompare(b);
  });

  const renderTimelineDetail = () => {
    const allSteps = selectedFlow.steps || [];
    const displaySteps = (() => {
      // Show only master steps for repeat groups (non-masters are hidden in list, visible in calendar)
      const visible = allSteps.filter(s => !s.repeatGroupId || s.isRepeatMaster);
      return visible;
    })();
    const groupedSteps = groupStepsByDate(displaySteps);
    const sortedDates = Object.keys(groupedSteps).sort((a, b) => {
      if (a === 'Unscheduled') return -1;
      if (b === 'Unscheduled') return 1;
      const cmp = a.localeCompare(b);
      return stepSortOrder === 'asc' ? cmp : -cmp;
    });

    return (
      <Animated.View 
        style={[
          styles.detailContainer, 
          { transform: [{ translateX: swipeBackX }] }
        ]} 
        {...swipeBackPanResponder.panHandlers}
      >
        <View style={styles.detailHeader}>
          <View style={styles.headerLeft}>
            <BorderlessButton 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedFlow(null);
              }} 
              style={styles.iconBtn}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 10 }}
            >
              <ChevronLeft size={24} color={Colors.onBackground} />
            </BorderlessButton>
          </View>

          <View style={styles.headerCenter}>
            <Animated.View 
              style={{ 
                opacity: scrollY.interpolate({
                  inputRange: [100, 150],
                  outputRange: [0, 1],
                  extrapolate: 'clamp'
                }),
                alignItems: 'center'
              }}
            >
              <Text style={styles.detailHeaderTitle} numberOfLines={1}>{selectedFlow.title}</Text>
              {!isFlowOwner(selectedFlow) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 }}>
                  <Users size={10} color={Colors.outline} />
                  <Text style={{ fontSize: 10, color: Colors.outline }}>{selectedFlow._role}</Text>
                </View>
              )}
            </Animated.View>
          </View>

          <View style={[styles.headerRight, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
            <BorderlessButton
              style={styles.iconBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setStepSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
              }}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 8 }}
            >
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <ArrowUpDown size={18} color={stepSortOrder === 'desc' ? Colors.primary : Colors.onBackground} />
              </View>
            </BorderlessButton>
            <BorderlessButton
              style={styles.iconBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFlowMenuVisible(true);
              }}
              hitSlop={{ top: 20, bottom: 20, left: 8, right: 20 }}
            >
              <MoreVertical size={20} color={Colors.onBackground} />
            </BorderlessButton>
          </View>
        </View>

        <Animated.ScrollView 
          ref={timelineScrollRef}
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.detailContent}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
          <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }} style={{ backgroundColor: Colors.background, padding: 12, borderRadius: 24 }}>
            {/* 히어로 섹션: 제목과 정보 통합 */}
            <View style={{ marginBottom: 28, paddingHorizontal: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <View style={{ width: 12, height: 2, backgroundColor: Colors.primary, borderRadius: 1 }} />
                <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.primary, letterSpacing: 1 }}>{t('flow.schedule_plan', 'SCHEDULE PLAN')}</Text>
              </View>
              <Text style={{ ...Typography.h1, fontSize: 34, color: Colors.onBackground, marginBottom: 10, fontWeight: '900', letterSpacing: -1.2, lineHeight: 40 }}>{selectedFlow.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surfaceContainerLow, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                  <Calendar size={14} color={Colors.primary} />
                  <Text style={{ fontSize: 13, color: Colors.onBackground, fontWeight: '700' }}>{getLocalizedPeriod(selectedFlow.period)}</Text>
                </View>
                {!isFlowOwner(selectedFlow) && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary + '10', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: Colors.primary + '20' }}>
                    <Users size={12} color={Colors.primary} />
                    <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: '700', textTransform: 'capitalize' }}>{selectedFlow._role}</Text>
                  </View>
                )}
              </View>
            </View>

            {!!selectedFlow.location && selectedFlow.location !== 'No Region' && (
              <Pressable
                style={({ pressed }) => [styles.heroLocationRow, { marginTop: 0, marginBottom: 24 }, pressed && { opacity: 0.7 }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const navData = heroWeather 
                    ? { ...heroWeather, locationName: selectedFlow.location, addressName: selectedFlow.address || heroWeather.addressName }
                    : { lat: selectedFlow.lat, lon: selectedFlow.lon, locationName: selectedFlow.location, addressName: selectedFlow.address };
                  
                  navigation.navigate('WeatherDetail', {
                    weatherData: navData,
                    isCurrentLocation: false,
                    locationName: selectedFlow.location,
                  });
                }}
              >
                <View style={styles.locationMain}>
                  <MapPin size={18} color={Colors.primary} />
                  <Text style={styles.detailLocationText} numberOfLines={1}>{selectedFlow.location}</Text>
                </View>
                {heroWeather && (
                  <View style={styles.heroWeather}>
                    {renderWeatherIcon(heroWeather.condKey, 20, Colors.primary, heroWeather.isDay !== false)}
                    <Text style={styles.heroTemp}>{formatTemp(heroWeather.temp)}</Text>
                  </View>
                )}
              </Pressable>
            )}

            {sortedDates.length > 0 ? (
              sortedDates.map((date, dateIdx) => (
                <View key={date} style={styles.dayGroup}>
                  {date !== 'Unscheduled' ? (
                    <View style={styles.dayHeader}>
                      <Text style={styles.dayDateText}>{formatDateLabel(date)}</Text>
                    </View>
                  ) : (
                    <View style={[styles.dayHeader, { marginTop: 8 }]}>
                      <Text style={styles.dayDateText}>{t('flow.unscheduled', 'Unscheduled')}</Text>
                    </View>
                  )}
                  {(stepSortOrder === 'asc' ? groupedSteps[date] : [...groupedSteps[date]].reverse()).map((step, index) => (
                    <View key={step.id} style={styles.stepRow}>
                      <View style={styles.timelineCol}>
                        <View style={[styles.timelineDot, step.status === 'completed' && styles.dotCompleted, step.inactive && { backgroundColor: Colors.outline }]} />
                        {index < groupedSteps[date].length - 1 && <View style={styles.timelineLine} />}
                      </View>
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                        {step.inactive ? (
                          <View style={[styles.stepInfoCard, { backgroundColor: Colors.surfaceContainerLow, borderWidth: 1, borderColor: Colors.outlineVariant, borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', flex: 1 }]}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 11, color: Colors.outline, fontWeight: '700', marginBottom: 2 }}>{step.time || '--:--'}</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Lock size={13} color={Colors.outline} />
                                <Text style={{ fontSize: 13, color: Colors.outline }} numberOfLines={1}>{step.activity || t('flow.untitled_schedule', 'Untitled Schedule')}</Text>
                              </View>
                              <Text style={{ fontSize: 11, color: Colors.outlineVariant, marginTop: 4 }}>{t('flow.locked_premium', '재구독 시 복원')}</Text>
                            </View>
                            <GHButton 
                              onPress={() => deleteStepById(step.id)} 
                              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }} 
                              style={styles.deleteBtnInner}
                            >
                              <Trash2 size={16} color={Colors.outlineVariant} />
                            </GHButton>
                          </View>
                        ) : (
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Pressable
                              style={({ pressed }) => [styles.stepInfoCard, pressed && canEditSteps(selectedFlow) && { opacity: 0.7 }, { flex: 1 }]}
                              onPress={canEditSteps(selectedFlow) ? () => openEditStep(step) : undefined}
                            >
                              <View style={styles.stepHeader}>
                                <View style={{ flex: 1, marginRight: 10 }}>
                                  <Text style={[styles.stepTime, step.inactive && { color: Colors.outline }]}>{step.time || '--:--'}</Text>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <Text style={styles.stepActivity} numberOfLines={2}>
                                      {step.activity && step.activity.trim() !== '' ? step.activity : t('flow.untitled_schedule', 'Untitled Schedule')}
                                    </Text>
                                    {step.repeatGroupId && (
                                      <View style={styles.repeatStepBadge}>
                                        <Repeat size={10} color={Colors.primary} />
                                        <Text style={styles.repeatStepBadgeText}>{t('tasks.repeat_badge', '반복')}</Text>
                                      </View>
                                    )}
                                  </View>
                                  {step.memo ? <Text style={styles.stepMemo} numberOfLines={2} ellipsizeMode="tail">{step.memo}</Text> : null}
                                </View>

                                {step.weather && (
                                  <Pressable 
                                    onPress={(e) => { e.stopPropagation(); handleWeatherIconPress(step); }}
                                    style={styles.stepWeatherMini}
                                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                                  >
                                    {renderWeatherIcon(typeof step.weather === 'object' ? step.weather.condKey : 'sunny', 24, Colors.primary, getStepIsDay(step))}
                                    {step.weather.temp !== undefined && (
                                      <Text style={styles.stepWeatherTemp}>{formatTemp(step.weather.temp)}</Text>
                                    )}
                                  </Pressable>
                                )}
                              </View>

                              {/* Comments Section — Instagram style */}
                              {(() => {
                                const stepComments = comments.filter(c => c.stepId === step.id);
                                const count = stepComments.length;
                                const isExpanded = !!expandedCommentSteps[step.id];
                                const canComment = !!(selectedFlow._role && selectedFlow._role !== '');
                                return (
                                  <View>
                                    {/* 말풍선 버튼 */}
                                    <Pressable
                                      onPress={(e) => { e.stopPropagation(); toggleComments(step.id, e); }}
                                      style={({ pressed }) => [styles.commentToggleBtn, pressed && { opacity: 0.6 }]}
                                      hitSlop={{ top: 15, bottom: 15, left: 20, right: 100 }}
                                    >
                                      <View pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <MessageCircle size={24} color={count > 0 ? Colors.primary : Colors.outline} strokeWidth={2.4} />
                                        {count > 0 && (
                                          <Text style={[styles.commentCountText, { color: Colors.primary }]}>{count}</Text>
                                        )}
                                      </View>
                                      <View style={{ flex: 1 }} />
                                    </Pressable>

                                    {/* 펼쳐진 댓글 영역 */}
                                    {isExpanded && (
                                      <Pressable onPress={(e) => e.stopPropagation()} style={styles.commentsContainer}>
                                        {stepComments.slice(-10).map(comment => (
                                          <View key={comment.id} style={styles.commentWrapper}>
                                            <Pressable
                                              onLongPress={() => {
                                                const isOwner = isFlowOwner(selectedFlow);
                                                const isEditor = selectedFlow._role === 'editor';
                                                const isAuthor = comment.uid === user?.uid;
                                                if (isOwner || isEditor || isAuthor) {
                                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                                  handleDeleteComment(comment.id);
                                                }
                                              }}
                                              style={({ pressed }) => [styles.commentBubble, pressed && { opacity: 0.7 }]}
                                            >
                                              <Text style={styles.commentText}>
                                                <Text style={styles.commentAuthor}>{comment.displayName}</Text> : {comment.text}
                                              </Text>
                                            </Pressable>
                                          </View>
                                        ))}

                                        {/* 댓글 입력창 */}
                                        {canComment && (
                                          <View style={styles.commentInputRow}>
                                            <TextInput
                                              ref={(el) => { if (el) commentInputRefs.current[step.id] = el; }}
                                              style={styles.commentInput}
                                              placeholder={t('flow.add_comment', 'Add a comment...')}
                                              placeholderTextColor={Colors.outline}
                                              value={commentInputs[step.id] || ''}
                                              onChangeText={(val) => setCommentInputs(prev => ({ ...prev, [step.id]: val }))}
                                              returnKeyType="send"
                                              onSubmitEditing={() => handlePostComment(step.id)}
                                              onFocus={() => {
                                                setTimeout(() => {
                                                  const inputRef = commentInputRefs.current[step.id];
                                                  if (inputRef && timelineScrollRef.current) {
                                                    inputRef.measureInWindow((x, y, w, h) => {
                                                      const kbHeight = 320;
                                                      const buffer = 100;
                                                      const screenH = Dimensions.get('window').height;
                                                      const inputBottom = y + h;
                                                      const visibleBottom = screenH - kbHeight;
                                                      if (inputBottom > visibleBottom - buffer) {
                                                        const scrollAmount = inputBottom - visibleBottom + buffer;
                                                        timelineScrollRef.current.scrollTo &&
                                                          timelineScrollRef.current.scrollTo({
                                                            y: currentScrollYRef.current + scrollAmount,
                                                            animated: true,
                                                          });
                                                      }
                                                    });
                                                  }
                                                }, 300);
                                              }}
                                            />
                                            <GHButton
                                              onPress={() => handlePostComment(step.id)}
                                              disabled={!commentInputs[step.id]?.trim() || isPostingComment}
                                              style={styles.commentSendBtn}
                                            >
                                              <ArrowUpCircle 
                                                size={28} 
                                                color={commentInputs[step.id]?.trim() ? Colors.primary : Colors.outline} 
                                                strokeWidth={2.2}
                                              />
                                            </GHButton>
                                          </View>
                                        )}
                                      </Pressable>
                                    )}
                                  </View>
                                );
                              })()}
                            </Pressable>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              ))
            ) : (
              <View style={styles.emptyFlow}>
                <Navigation size={40} color={Colors.outlineVariant} strokeWidth={1} />
                <Text style={styles.emptyFlowText}>{t('flow.no_schedules', 'No schedules added yet.')}</Text>
              </View>
            )}

            {/* 공유 이미지 전용 푸터 (워터마크) */}
            <View style={{ marginTop: 32, paddingVertical: 16, borderTopWidth: 1, borderTopColor: Colors.outlineVariant + '30', alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: Colors.outline, fontWeight: '700', letterSpacing: 1 }}>TODO WEATHER</Text>
              <Text style={{ fontSize: 10, color: Colors.outline, marginTop: 2, opacity: 0.6 }}>Your smart event-based weather planner</Text>
            </View>
          </ViewShot>

        </Animated.ScrollView>

        {/* Floating Add Step Button — hidden for viewers */}
        {canEditSteps(selectedFlow) && (
          <View style={[StyleSheet.absoluteFill, { zIndex: 999 }]} pointerEvents="box-none">
            <Pressable
              style={({ pressed }) => [
                {
                  position: 'absolute',
                  bottom: Math.max(insets.bottom, 20) + 10 + 64 + 16,
                  right: 30,
                  width: 64, height: 64, borderRadius: 32,
                  backgroundColor: '#111827',
                  justifyContent: 'center', alignItems: 'center',
                  shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.35, shadowRadius: 10, elevation: 12,
                },
                pressed && { opacity: 0.8, transform: [{ scale: 0.92 }] }
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setEditingStep(null);
                setEditActivity('');
                setEditMemo('');
                const todayStr = new Date().toISOString().split('T')[0];
                setEditDate(todayStr);
                setEditEndDate(todayStr);
                setEditTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
                setSelectedRegion(null);
                setStepRepeatType(null);
                setStepRepeatEndDate('');
                setShowStepRepeatPicker(false);
                setStepNotify(false);
                openEditModal(true);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View pointerEvents="none">
                <Plus size={32} color="white" strokeWidth={3} />
              </View>
            </Pressable>
          </View>
        )}
        </Animated.View>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { paddingTop: Constants.statusBarHeight }]}>
        {!selectedFlow && (
          <>
            <MainHeader onMenuPress={() => setMenuVisible(true)} />
            <View style={{ flex: 1 }}>
              {isLoading ? (
                <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />
              ) : (
                <DraggableFlatList
                  ref={flatListRef}
                  data={displayFlows || []}
                  keyExtractor={(item) => item.id}
                  onDragEnd={({ data }) => { setFlows(data); saveFlows(data); }}
                  activationDistance={20}
                  renderItem={({ item: flow, drag, isActive }) => (
                    <ScaleDecorator>
                      <View style={styles.flowCardContainer}>
                        {flow.inactive ? (
                          <View style={styles.flowCardLocked}>
                            <LinearGradient colors={['#9ca3af', '#6b7280']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.flowCard, { opacity: 0.7 }]}>
                              <TouchableOpacity
                                onPress={() => {
                                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                                  handleDeleteFlow(flow.id);
                                }}
                                hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}
                                style={styles.deleteBtnAbsolute}
                              >
                                <View pointerEvents="none">
                                  <Trash2 size={18} color="rgba(255,255,255,0.8)" />
                                </View>
                              </TouchableOpacity>
                              <View style={styles.cardMainArea}>
                                <Text style={styles.cardTitle} numberOfLines={2}>{flow.title}</Text>
                                <View style={styles.dateRow}><Calendar size={14} color="rgba(255,255,255,0.8)" /><Text style={styles.cardDate}>{getLocalizedPeriod(flow.period)}</Text></View>
                              </View>
                              <View style={styles.cardBottom}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Lock size={12} color="rgba(255,255,255,0.9)" />
                                  <Text style={styles.tagText}>{t('flow.locked_premium', '구독 해지로 비활성화됨 — 재구독 시 복원')}</Text>
                                </View>
                              </View>
                            </LinearGradient>
                          </View>
                        ) : (
                        <TouchableOpacity
                          onLongPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            drag();
                          }}
                          onPress={() => setSelectedFlow(flow)}
                          style={isActive ? { opacity: 0.8 } : undefined}
                          activeOpacity={0.9}
                          delayLongPress={250}
                        >
                          <LinearGradient colors={flow.gradient || ['#6366f1', '#a855f7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.flowCard}>
                            <TouchableOpacity
                              onPress={() => {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                                handleDeleteFlow(flow.id);
                              }}
                              hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}
                              style={styles.deleteBtnAbsolute}
                            >
                              <View pointerEvents="none">
                                {isFlowOwner(flow)
                                  ? <Trash2 size={18} color="rgba(255,255,255,0.8)" />
                                  : <LogOut size={18} color="rgba(255,255,255,0.8)" />}
                              </View>
                            </TouchableOpacity>

                            <View style={styles.cardMainArea}>
                              {/* Shared flow badge */}
                              {!isFlowOwner(flow) && (
                                <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8 }}>
                                  <Users size={11} color="white" />
                                  <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>{flow._role}</Text>
                                </View>
                              )}
                              <Text style={styles.cardTitle} numberOfLines={2}>{flow.title}</Text>
                              <View style={styles.dateRow}><Calendar size={14} color="rgba(255,255,255,0.8)" /><Text style={styles.cardDate}>{getLocalizedPeriod(flow.period)}</Text></View>
                            </View>
                            <View style={styles.cardBottom}>
                              <View style={styles.progressContainer}><View style={[styles.progressBar, { width: `${(flow.progress || 0) * 100}%` }]} /></View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                  <MapPin size={12} color="rgba(255,255,255,0.9)" />
                                  <Text style={styles.tagText} numberOfLines={1}>
                                    {(!flow.location || flow.location === 'No Region') ? t('flow.no_region', 'No Region') : flow.location}
                                  </Text>
                                </View>
                              <View style={styles.weatherSummary}>
                                <View style={{ marginRight: 6 }}>
                                  {renderWeatherIcon(
                                    (() => {
                                      if (flow.weatherCondKey) return flow.weatherCondKey;
                                      const s = (flow.weatherSummary || '').toLowerCase();
                                      if (s.includes('rain') || s.includes('drizzle')) return 'rainy';
                                      if (s.includes('snow')) return 'snowy';
                                      if (s.includes('thunder') || s.includes('storm')) return 'thunderstorm';
                                      if (s.includes('sunny') || s.includes('clear')) return 'sunny';
                                      if (s.includes('cloud') || s.includes('overcast') || s.includes('mist') || s.includes('fog')) return 'cloudy';
                                      return 'cloudy';
                                    })(),
                                    16, "white", flow.weatherIsDay !== false
                                  )}
                                </View>
                                <Text style={styles.weatherText} numberOfLines={1}>
                                  {flow.weatherTemp && flow.weatherCondKey
                                    ? `${t('weather.currently', 'Currently')} ${formatTemp(flow.weatherTemp)}, ${t(`weather.${flow.weatherCondKey}`, flow.weatherCondKey)}`
                                    : flow.weatherSummary && flow.weatherSummary !== 'Weather not set'
                                      ? flow.weatherSummary
                                      : t('flow.weather_not_set', 'Weather not set')}
                                </Text>
                              </View>
                            </View>
                          </LinearGradient>
                        </TouchableOpacity>
                        )}
                      </View>
                    </ScaleDecorator>
                  )}
                  ListHeaderComponent={
                    <View>
                      <View style={styles.listHeader}>
                        <View style={[styles.headerTopRow, { alignItems: 'flex-start', justifyContent: 'space-between' }]}>
                          <View>
                            <Text style={styles.screenTitle}>{t('flow.my_flows', 'My Flows')}</Text>
                            <Text style={styles.screenSubtitle}>{t('flow.curated_journeys', 'Curated journeys')}</Text>
                          </View>
                          <Pressable 
                            style={({ pressed }) => [
                              styles.joinFlowChip,
                              { opacity: pressed ? 0.7 : 1 }
                            ]} 
                            onPress={() => {
                              if (!user) {
                                showConfirm(
                                  t('common.login_required'),
                                  t('common.login_required_msg'),
                                  () => navigation.navigate('Login'),
                                  true
                                );
                                return;
                              }
                              openJoinModal();
                            }}
                          >
                            <MaterialCommunityIcons name="account-multiple-plus" size={16} color={Colors.primary} />
                            <Text style={styles.joinFlowChipText}>{t('flow.join_shared_flow_btn')}</Text>
                          </Pressable>
                        </View>
                      </View>

                      {!isPremium && !topAdHidden ? (
                        <View style={{ marginVertical: 10, alignItems: 'center' }}>
                          <AdBanner onFail={() => setTopAdHidden(true)} />
                        </View>
                      ) : (
                        <View style={{ height: 12 }} />
                      )}
                    </View>
                  }
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>
            <View style={[StyleSheet.absoluteFill, { zIndex: 999 }]} pointerEvents="box-none">
            <Pressable
              style={({ pressed }) => [
                {
                  position: 'absolute',
                  bottom: Math.max(insets.bottom, 20) + 10 + 64 + 16,
                  right: 30,
                  width: 64, height: 64, borderRadius: 32,
                  backgroundColor: '#111827',
                  justifyContent: 'center', alignItems: 'center',
                  shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.35, shadowRadius: 10, elevation: 12,
                },
                pressed && { opacity: 0.8, transform: [{ scale: 0.92 }] }
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                openFlowModal();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View pointerEvents="none">
                <Plus size={32} color="white" strokeWidth={3} />
              </View>
            </Pressable>
          </View>
          </>
        )}

        {selectedFlow && renderTimelineDetail()}

        {/* --- Flow Modal --- */}
        <Modal
          visible={flowModalVisible}
          transparent={true}
          animationType="none"
          onRequestClose={closeFlowModal}
        >
          <GestureHandlerRootView style={{ flex: 1 }}>
            <Pressable style={[StyleSheet.absoluteFill, styles.modalBg]} onPress={closeFlowModal} />
            {Platform.OS === 'ios' && flowToastMsg !== '' && (
              <Animated.View style={[styles.flowToast, { opacity: flowToastAnim, transform: [{ translateY: flowToastAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]} pointerEvents="none">
                <Text style={styles.flowToastText}>{flowToastMsg}</Text>
              </Animated.View>
            )}
            <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
              <Animated.View
                onLayout={(e) => setFlowModalHeight(e.nativeEvent.layout.height)}
                style={[styles.editModalContent, { transform: [{ translateY: Animated.subtract(flowPanY, flowKeyboardOffset) }] }]}
              >
                    <View {...flowPanResponder.panHandlers} style={styles.handleArea}>
                      <View style={styles.modalHandle} />
                    </View>
                    <View style={styles.editHeader}>
                      <View style={{ width: 80, alignItems: 'flex-start' }} />
                      
                      <Text style={[styles.editTitle, { flex: 1, textAlign: 'center' }]} numberOfLines={1}>
                        {editingFlow ? t('flow.edit_flow', 'Edit Flow') : t('flow.new_flow', 'New Flow')}
                      </Text>

                      <View style={{ width: 80, alignItems: 'flex-end' }}>
                        <GHButton 
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            isKeyboardVisible ? Keyboard.dismiss() : saveFlow();
                          }} 
                          style={styles.headerActionBtn}
                          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        >
                          {isKeyboardVisible ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} pointerEvents="none">
                              <KeyboardIcon size={18} color={Colors.primary} />
                              <ChevronDown size={14} color={Colors.primary} />
                            </View>
                          ) : (
                            <Text style={styles.headerSaveText} pointerEvents="none">{t('common.save', 'Save')}</Text>
                          )}
                        </GHButton>
                      </View>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
                      <View style={styles.modalContentPadding}>
                        <View style={styles.labelRow}>
                          <Text style={styles.inputLabel}>{t('flow.flow_title', 'Flow Title')} <Text style={styles.requiredAsterisk}>*</Text></Text>
                        </View>
                        <View style={[styles.compactInputRow, !flowTitle && styles.compactInputRowRequired]}>
                          <Flag size={18} color={flowTitle ? Colors.primary : Colors.error} />
                          <TextInput ref={flowTitleRef} style={styles.compactInput} value={flowTitle} onChangeText={setFlowTitle} placeholder={t('flow.flow_title_placeholder', 'e.g. Hawaii Trip, Morning Routine')} placeholderTextColor={Colors.outline} autoCapitalize="none" onFocus={() => { focusedFlowInputRef.current = flowTitleRef.current; }} onBlur={() => { focusedFlowInputRef.current = null; }} />
                        </View>
                      </View>

                      <View style={styles.inputGroup}>
                        <View style={styles.labelRow}>
                          <Text style={styles.inputLabel}>{t('flow.base_region', 'Base Region')}</Text>
                          <GHButton 
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              openSearch('flow');
                            }} 
                            style={styles.searchAccessoryBtn}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Search size={14} color={Colors.primary} pointerEvents="none" />
                            <Text style={styles.searchAccessoryText} pointerEvents="none">{t('common.find', 'Find')}</Text>
                          </GHButton>
                        </View>
                        <View style={styles.regionDisplay}>
                          {(() => { const hasLocation = flowLocation && flowLocation !== 'No Region'; return (<>
                          <MapPin size={18} color={hasLocation ? Colors.primary : Colors.outline} />
                          <Text style={[styles.regionDisplayText, !hasLocation && { color: Colors.outline }]}>
                            {hasLocation ? flowLocation : t('flow.not_set_global', 'Not set (Global)')}
                          </Text>
                          {hasLocation && (
                            <GHButton 
                              onPress={() => { 
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                setFlowLocation(''); setFlowLat(null); setFlowLon(null); 
                              }}
                              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                            >
                              <X size={16} color={Colors.outline} pointerEvents="none" />
                            </GHButton>
                          )}</>); })()}
                        </View>
                      </View>

                      <View style={styles.inputGroup}>
                        <View style={styles.labelRow}>
                          <Text style={styles.inputLabel}>{t('flow.description', 'Description')}</Text>
                        </View>
                        <View style={styles.compactInputRow}><Edit3 size={18} color={Colors.primary} /><TextInput ref={flowDescRef} style={styles.compactInput} value={flowDescription} onChangeText={setFlowDescription} placeholder={t('flow.description_placeholder', 'What is this flow about?')} placeholderTextColor={Colors.outline} autoCapitalize="none" onFocus={() => { focusedFlowInputRef.current = flowDescRef.current; }} onBlur={() => { focusedFlowInputRef.current = null; }} /></View>
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>{t('flow.card_color', '카드 색상')}</Text>
                        <View style={styles.gradientPreview}>
                          <LinearGradient colors={flowGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradientPreviewCircle} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.gradientPreviewName}>
                              {FLOW_GRADIENT_PRESETS.find(p => p.colors[0] === flowGradient[0] && p.colors[1] === flowGradient[1])?.name ?? t('flow.custom_color', '커스텀')}
                            </Text>
                            <LinearGradient colors={flowGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradientPreviewBadge}>
                              <Text style={styles.gradientPreviewBadgeText}>{flowTitle || t('flow.flow_title_placeholder', 'Flow')}</Text>
                            </LinearGradient>
                          </View>
                        </View>
                        <View style={styles.gradientGrid}>
                          {FLOW_GRADIENT_PRESETS.map((preset) => {
                            const isSelected = flowGradient[0] === preset.colors[0] && flowGradient[1] === preset.colors[1];
                            return (
                              <GHButton
                                key={preset.key}
                                style={styles.gradientGridCell}
                                onPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  setFlowGradient(preset.colors);
                                }}
                              >
                                <View style={[styles.gradientSwatchWrap, isSelected && styles.gradientSwatchWrapSelected]}>
                                  <LinearGradient
                                    colors={preset.colors}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.gradientSwatch}
                                  >
                                    {isSelected && <Check size={16} color="white" strokeWidth={3} />}
                                  </LinearGradient>
                                </View>
                                <Text style={styles.gradientLabel} numberOfLines={1}>{preset.name}</Text>
                              </GHButton>
                            );
                          })}
                        </View>
                      </View>

                      <View style={{ height: 100 }} />
                    </ScrollView>

                    {searchModalVisible && searchMode === 'flow' && renderSearchLayer()}
              </Animated.View>
            </View>
          </GestureHandlerRootView>
        </Modal>

        {/* --- Step Modal --- */}
        <Modal
          visible={editModalVisible}
          transparent={true}
          animationType="none"
          onRequestClose={closeEditModal}
        >
          <GestureHandlerRootView style={{ flex: 1 }}>
            <Pressable style={[StyleSheet.absoluteFill, styles.modalBg]} onPress={closeEditModal} />
            <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
              <Animated.View 
                onLayout={(e) => setEditModalHeight(e.nativeEvent.layout.height)}
                style={[styles.editModalContent, { transform: [{ translateY: panY }] }]}
              >
                    <View {...panResponder.panHandlers} style={styles.handleArea}>
                      <View style={styles.modalHandle} />
                    </View>
                    <View style={styles.editHeader}>
                      <View style={{ width: 80, alignItems: 'flex-start' }}>
                        {editingStep && (
                          <GHButton 
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              deleteStep();
                            }} 
                            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} 
                            style={styles.headerDeleteBtn}
                          >
                            <Trash2 size={20} color={Colors.error} />
                          </GHButton>
                        )}
                      </View>
                      
                      <Text style={[styles.editTitle, { flex: 1, textAlign: 'center' }]} numberOfLines={1}>
                        {editingStep ? t('flow.edit_schedule', 'Edit Schedule') : t('flow.new_schedule', 'New Schedule')}
                      </Text>

                      <View style={{ width: 80, alignItems: 'flex-end' }}>
                        <GHButton 
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            isKeyboardVisible ? Keyboard.dismiss() : saveStep();
                          }} 
                          style={[styles.headerActionBtn, isSaving && { opacity: 0.5 }]}
                          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <ActivityIndicator size="small" color={Colors.primary} />
                          ) : isKeyboardVisible ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <KeyboardIcon size={18} color={Colors.primary} />
                              <ChevronDown size={14} color={Colors.primary} />
                            </View>
                          ) : (
                            <Text style={styles.headerSaveText}>{t('common.save', 'Save')}</Text>
                          )}
                        </GHButton>
                      </View>
                    </View>

                    <ScrollView ref={stepScrollRef} showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
                      <View style={styles.modalContentPadding}>
                        <View style={styles.labelRow}>
                          <Text style={styles.inputLabel}>{t('flow.activity', 'Activity')} <Text style={styles.requiredAsterisk}>*</Text></Text>
                        </View>
                        <View style={[styles.compactInputRow, !editActivity && styles.compactInputRowRequired]}>
                          <Edit3 size={18} color={editActivity ? Colors.primary : Colors.error} />
                          <TextInput ref={activityInputRef} style={styles.compactInput} value={editActivity} onChangeText={setEditActivity} placeholder={t('flow.activity_placeholder', 'What are you doing?')} placeholderTextColor={Colors.outline} autoCapitalize="none" />
                        </View>
                      </View>

                      <View style={styles.inputGroup}>
                        <View style={styles.labelRow}>
                          <Text style={styles.inputLabel}>{t('flow.weather_region', 'Weather Region')}</Text>
                          <GHButton 
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              openSearch('step');
                            }} 
                            style={styles.searchAccessoryBtn}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Search size={14} color={Colors.primary} pointerEvents="none" />
                            <Text style={styles.searchAccessoryText} pointerEvents="none">{t('common.find', 'Find')}</Text>
                          </GHButton>
                        </View>
                        <View style={styles.regionDisplay}>
                          <MapPin size={18} color={selectedRegion ? Colors.primary : Colors.outline} pointerEvents="none" />
                          <Text style={[styles.regionDisplayText, !selectedRegion && { color: Colors.outline }]} pointerEvents="none">
                            {selectedRegion ? selectedRegion.name : t('flow.no_region', 'No region selected')}
                          </Text>
                          {selectedRegion && (
                            <GHButton 
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                setSelectedRegion(null);
                              }}
                              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                            >
                              <X size={16} color={Colors.outline} pointerEvents="none" />
                            </GHButton>
                          )}
                        </View>
                      </View>

                      <View style={styles.rowInputs}>
                        <View style={[styles.inputGroup, { flex: 1.3, marginRight: 10 }]}>
                          <View style={styles.labelRow}>
                            <Text style={styles.inputLabel}>{t('flow.start_date', 'Start Date')}</Text>
                             {editDate ? (
                               <GHButton 
                                 onPress={() => {
                                   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                   setEditDate('');
                                 }} 
                                 hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                               >
                                 <Text style={styles.resetText}>{t('common.reset', 'Reset')}</Text>
                               </GHButton>
                             ) : null}
                          </View>
                           <GHButton
                             style={styles.editInputWrap}
                             onPress={() => { 
                               Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                               Keyboard.dismiss(); 
                               setShowRangePicker(true); 
                             }}
                             activeOpacity={0.6}
                           >
                             <Calendar size={18} color={Colors.primary} style={{ marginRight: 8 }} pointerEvents="none" />
                             <Text style={[styles.editInputText, !editDate && { color: Colors.outline }]} numberOfLines={1} pointerEvents="none">
                               {editDate || '--/--'}
                             </Text>
                           </GHButton>
                        </View>

                        <View style={[styles.inputGroup, { flex: 1 }]}>
                          <View style={styles.labelRow}>
                            <Text style={styles.inputLabel}>{t('common.start_time', 'Time')}</Text>
                             {editTime ? (
                               <GHButton 
                                 onPress={() => {
                                   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                   setEditTime('');
                                 }} 
                                 hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                               >
                                 <Text style={styles.resetText}>{t('common.reset', 'Reset')}</Text>
                               </GHButton>
                             ) : null}
                          </View>
                           <GHButton
                             style={styles.editInputWrap}
                             onPress={() => { 
                               Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                               Keyboard.dismiss(); 
                               pickerBackupRef.current = { editDate, editTime, editEndDate, editEndTime }; 
                               setPickerType('startTime'); 
                             }}
                             activeOpacity={0.6}
                           >
                             <Clock size={18} color={Colors.primary} style={{ marginRight: 8 }} pointerEvents="none" />
                             <Text style={[styles.editInputText, !editTime && { color: Colors.outline }]} numberOfLines={1} pointerEvents="none">
                               {editTime || '--:--'}
                             </Text>
                           </GHButton>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <Text style={[styles.inputLabel, { marginBottom: 0 }]}>{t('flow.same_as_start', 'Same as start date/time')}</Text>
                        <Switch
                          value={matchStartDate}
                          onValueChange={(val) => {
                            setMatchStartDate(val);
                            if (val) {
                              setEditEndDate(editDate);
                              setEditEndTime(editTime);
                            }
                          }}
                          trackColor={{ false: Colors.surfaceContainerHigh, true: Colors.primary }}
                          thumbColor={'white'}
                        />
                      </View>

                      <View style={styles.rowInputs}>
                        <View style={[styles.inputGroup, { flex: 1.3, marginRight: 10 }]}>
                          <View style={styles.labelRow}>
                            <Text style={styles.inputLabel}>{t('flow.end_date', 'End Date')}</Text>
                             {editEndDate ? (
                               <GHButton 
                                 onPress={() => {
                                   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                   setEditEndDate(''); 
                                   setMatchStartDate(false);
                                 }} 
                                 hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                               >
                                 <Text style={styles.resetText}>{t('common.reset', 'Reset')}</Text>
                               </GHButton>
                             ) : null}
                          </View>
                           <GHButton
                             style={styles.editInputWrap}
                             onPress={() => { 
                               Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                               Keyboard.dismiss(); 
                               setShowRangePicker(true); 
                             }}
                             activeOpacity={0.6}
                           >
                             <Calendar size={18} color={Colors.primary} style={{ marginRight: 8 }} pointerEvents="none" />
                             <Text style={[styles.editInputText, !editEndDate && { color: Colors.outline }]} numberOfLines={1} pointerEvents="none">
                               {editEndDate || '--/--'}
                             </Text>
                           </GHButton>
                        </View>

                        <View style={[styles.inputGroup, { flex: 1 }]}>
                          <View style={styles.labelRow}>
                            <Text style={styles.inputLabel}>{t('common.end_time', 'Time')}</Text>
                             {editEndTime ? (
                               <GHButton 
                                 onPress={() => {
                                   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                   setEditEndTime(''); 
                                   setMatchStartDate(false);
                                 }} 
                                 hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                               >
                                 <Text style={styles.resetText}>{t('common.reset', 'Reset')}</Text>
                               </GHButton>
                             ) : null}
                          </View>
                           <GHButton
                             style={styles.editInputWrap}
                             onPress={() => { 
                               Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                               Keyboard.dismiss(); 
                               pickerBackupRef.current = { editDate, editTime, editEndDate, editEndTime }; 
                               setPickerType('endTime'); 
                             }}
                             activeOpacity={0.6}
                           >
                             <Clock size={18} color={Colors.primary} style={{ marginRight: 8 }} pointerEvents="none" />
                             <Text style={[styles.editInputText, !editEndTime && { color: Colors.outline }]} numberOfLines={1} pointerEvents="none">
                               {editEndTime || '--:--'}
                             </Text>
                           </GHButton>
                        </View>
                      </View>

                      {/* Repeat Section */}
                      <View style={styles.inputGroup}>
                        <Pressable
                          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}
                          onPress={() => { Keyboard.dismiss(); setShowStepRepeatPicker(prev => !prev); }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Repeat size={16} color={stepRepeatType ? Colors.primary : Colors.outline} />
                            <Text style={[styles.inputLabel, { marginBottom: 0, color: stepRepeatType ? Colors.primary : Colors.onBackground }]}>
                              {t('tasks.repeat', '반복')}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ fontSize: 14, color: stepRepeatType ? Colors.primary : Colors.outline, fontWeight: '500' }}>
                              {stepRepeatType ? t(`tasks.repeat_${stepRepeatType}`) : t('tasks.repeat_none', '없음')}
                            </Text>
                            <ChevronDown size={14} color={Colors.outline} />
                          </View>
                        </Pressable>
                        {showStepRepeatPicker && (
                          <View style={styles.stepRepeatPickerRow}>
                            {[null, 'daily', 'weekly', 'monthly', 'yearly'].map(opt => (
                              <Pressable
                                key={opt || 'none'}
                                style={[styles.repeatChip, stepRepeatType === opt && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
                                onPress={() => { setStepRepeatType(opt); setShowStepRepeatPicker(false); if (!opt) setStepRepeatEndDate(''); }}
                              >
                                <Text style={[styles.repeatChipText, stepRepeatType === opt && { color: 'white' }]}>
                                  {opt ? t(`tasks.repeat_${opt}`) : t('tasks.repeat_none', '없음')}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        )}
                        {stepRepeatType && (
                          <View style={{ marginTop: 12 }}>
                            <View style={styles.labelRow}>
                              <Text style={styles.inputLabel}>{t('tasks.repeat_end_date', '반복 종료일')}</Text>
                            </View>
                            <Pressable
                              style={styles.editInputWrap}
                              onPress={() => { Keyboard.dismiss(); setShowStepRepeatEndPicker(true); }}
                            >
                              <Calendar size={18} color={Colors.primary} style={{ marginRight: 8 }} />
                              <Text style={[styles.editInputText, !stepRepeatEndDate && { color: Colors.error }]}>
                                {stepRepeatEndDate || t('tasks.repeat_end_required', '종료일 선택 필요')}
                              </Text>
                            </Pressable>
                          </View>
                        )}
                      </View>

                      {/* Notification Section */}
                      <View style={styles.inputGroup}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {stepNotify ? <Bell size={16} color={Colors.primary} /> : <BellOff size={16} color={Colors.outline} />}
                            <Text style={[styles.inputLabel, { marginBottom: 0, color: stepNotify ? Colors.primary : Colors.onBackground }]}>
                              {t('tasks.notify', '알림')}
                            </Text>
                            {!editTime && (
                              <Text style={{ fontSize: 11, color: Colors.outline }}>
                                {t('flow.notify_needs_time', '(시작 시간 필요)')}
                              </Text>
                            )}
                          </View>
                          <Switch
                            value={stepNotify}
                            onValueChange={(v) => {
                              if (v && !editTime) {
                                Alert.alert('', t('flow.notify_time_required', '알림을 설정하려면 시작 시간이 필요합니다'));
                                return;
                              }
                              setStepNotify(v);
                            }}
                            disabled={!editTime}
                            trackColor={{ false: '#E2E8F0', true: Colors.primary + '80' }}
                            thumbColor={stepNotify ? Colors.primary : '#F4F7FE'}
                          />
                        </View>
                      </View>

                      <View
                        style={styles.inputGroup}
                        onLayout={(e) => { memoYRef.current = e.nativeEvent.layout.y; }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <Text style={styles.inputLabel}>{t('common.memo', 'Memo')}</Text>
                          <Text style={styles.charCount}>{editMemo.length}/500</Text>
                        </View>
                        <TextInput
                          style={styles.memoInlineInput}
                          value={editMemo}
                          onChangeText={setEditMemo}
                          placeholder={t('flow.memo_placeholder', 'Add detailed notes or addresses...')}
                          placeholderTextColor={Colors.outline}
                          multiline
                          textAlignVertical="top"
                          maxLength={500}
                          autoCapitalize="none"
                          onFocus={() => setTimeout(() => stepScrollRef.current?.scrollTo({ y: memoYRef.current - 12, animated: true }), 150)}
                        />
                      </View>

                      {!isPremium && !detailAdHidden && (
                        <View style={{ marginVertical: 12, alignItems: 'center' }}>
                          <AdBanner 
                            size={BannerAdSize.MEDIUM_RECTANGLE} 
                            onFail={() => setDetailAdHidden(true)}
                          />
                        </View>
                      )}
                      <View style={{ height: 12 }} />
                    </ScrollView>

                    {searchModalVisible && searchMode === 'step' && renderSearchLayer()}
              </Animated.View>
            </View>

            {/* Date / Time Picker Overlay */}
            {!!pickerType && (
              <View style={[StyleSheet.absoluteFillObject, styles.pickerOverlay]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={() => { 
                  setEditDate(pickerBackupRef.current.editDate); 
                  setEditTime(pickerBackupRef.current.editTime); 
                  setEditEndDate(pickerBackupRef.current.editEndDate);
                  setEditEndTime(pickerBackupRef.current.editEndTime);
                  setPickerType(null); 
                }} />
                <View style={[styles.pickerSheet]}>
                  <View style={{ width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 4 }} />
                  <View style={styles.pickerHeader}>
                    <Pressable onPress={() => { 
                      setEditDate(pickerBackupRef.current.editDate); 
                      setEditTime(pickerBackupRef.current.editTime); 
                      setEditEndDate(pickerBackupRef.current.editEndDate);
                      setEditEndTime(pickerBackupRef.current.editEndTime);
                      setPickerType(null); 
                    }} style={{ padding: 4 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.textSecondary }}>{t('common.cancel', 'Cancel')}</Text>
                    </Pressable>
                    <Text style={styles.pickerTitle}>
                      {pickerType === 'startTime' ? t('common.start_time', 'Start Time') : t('common.end_time', 'End Time')}
                    </Text>
                    <Pressable onPress={() => setPickerType(null)} style={styles.pickerDoneBtn}>
                      <Text style={styles.pickerDoneText}>{t('common.done', 'Done')}</Text>
                    </Pressable>
                  </View>
                  <View style={{ height: 216, justifyContent: 'center', backgroundColor: 'white' }}>
                    <DateTimePicker
                      value={(() => {
                        const timeVal = pickerType === 'startTime' ? editTime : editEndTime;
                        const [h, m] = (timeVal || '00:00').split(':');
                        const d = new Date(); d.setHours(parseInt(h), parseInt(m)); return d;
                      })()}
                      mode="time"
                      display="spinner"
                      is24Hour={true}
                      textColor="black"
                      onChange={onTimeChange}
                      style={{ height: 216, width: width - 32, alignSelf: 'center' }}
                      locale={i18n.language}
                      key={`time-${i18n.language}-${pickerType}`}
                    />
                  </View>
                </View>
              </View>
            )}

            <RangeCalendarModal
              visible={showRangePicker}
              onClose={() => setShowRangePicker(false)}
              initialStartDate={editDate}
              initialEndDate={editEndDate}
              onApply={(start, end) => {
                if (start) setEditDate(start);
                if (end) {
                  setEditEndDate(end);
                  if (start && start !== end) {
                    setMatchStartDate(false);
                  }
                }
              }}
            />
            <RangeCalendarModal
              visible={showStepRepeatEndPicker}
              onClose={() => setShowStepRepeatEndPicker(false)}
              initialStartDate={stepRepeatEndDate || editDate}
              singleDate={true}
              onApply={(start) => {
                if (start) setStepRepeatEndDate(typeof start === 'string' ? start : _dateStrFlow(start));
              }}
            />
          </GestureHandlerRootView>
        </Modal>

        <MenuModal visible={menuVisible} onClose={() => setMenuVisible(false)} onReset={() => { loadInitialData(); }} navigation={navigation} />

        {/* 초대 코드 모달 (오너 전용) */}
        {/* 초대 코드 모달 (오너 전용) - 바텀 시트 스타일 */}
        <Modal
          transparent
          visible={inviteModalVisible}
          onRequestClose={closeInviteModal}
        >
          <GestureHandlerRootView style={{ flex: 1 }}>
            <Pressable style={[StyleSheet.absoluteFill, styles.modalBg]} onPress={closeInviteModal} />
            <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
              <Animated.View 
                style={[
                  styles.editModalContent, 
                  { 
                    height: 'auto',
                    maxHeight: height * 0.9,
                    transform: [{ translateY: invitePanY }] 
                  }
                ]}
                onLayout={(e) => setInviteModalHeight(e.nativeEvent.layout.height)}
              >
                <View {...invitePanResponder.panHandlers} style={styles.handleArea}>
                  <View style={styles.modalHandle} />
                </View>
                <View style={styles.editHeader}>
                  <View style={{ width: 80, alignItems: 'flex-start' }} />
                  <Text style={[styles.editTitle, { flex: 1, textAlign: 'center' }]} numberOfLines={1}>
                    {t('flow.manage_members')}
                  </Text>
                  <View style={{ width: 80, alignItems: 'flex-end' }}>
                    <GHButton 
                      onPress={handleSaveAllPermissions} 
                      style={styles.headerActionBtn}
                      disabled={isSavingPermissions}
                    >
                      {isSavingPermissions ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                      ) : (
                        <Text style={styles.headerSaveText}>
                          {t('common.save', 'Save')}
                        </Text>
                      )}
                    </GHButton>
                  </View>
                </View>

                <ScrollView 
                  bounces={false} 
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 40 }}
                >
                  {/* 역할 선택 */}
                  <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.outline, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('flow.invite_role_label', 'Role for new members')}</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                      {['viewer', 'editor'].map(role => (
                        <Pressable
                          key={role}
                          style={({ pressed }) => [
                            { 
                              flex: 1, 
                              paddingVertical: 14, 
                              borderRadius: 14, 
                              borderWidth: 2, 
                              alignItems: 'center',
                              justifyContent: 'center',
                              opacity: pressed ? 0.8 : 1
                            },
                            inviteRole === role
                              ? { backgroundColor: Colors.primary + '10', borderColor: Colors.primary }
                              : { backgroundColor: 'transparent', borderColor: Colors.outlineVariant + '40' }
                          ]}
                          onPress={() => {
                            if (isGeneratingCode) return;
                            setInviteRole(role);
                            if (inviteCode) handleGenerateCode(role);
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ 
                              width: 18, height: 18, borderRadius: 9, borderWidth: 2, 
                              borderColor: inviteRole === role ? Colors.primary : Colors.outlineVariant,
                              alignItems: 'center', justifyContent: 'center'
                            }}>
                              {inviteRole === role && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary }} />}
                            </View>
                            <Text style={{ color: inviteRole === role ? Colors.primary : Colors.onBackground, fontWeight: '700', fontSize: 15 }}>
                              {role === 'viewer' ? t('flow.viewer') : t('flow.editor')}
                            </Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* 초대 코드 표시 */}
                  <View style={{ alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 }}>
                    {inviteCode ? (
                      <View style={{ width: '100%', alignItems: 'center' }}>
                        <View style={{ backgroundColor: Colors.surfaceContainer, paddingVertical: 16, paddingHorizontal: 30, borderRadius: 20, marginBottom: 12 }}>
                          <Text style={{ fontSize: 42, fontWeight: '800', letterSpacing: 8, color: Colors.text, fontVariant: ['tabular-nums'] }}>{inviteCode}</Text>
                        </View>
                        <Text style={{ color: Colors.outline, fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
                          {t('flow.valid_7_days')} · <Text style={{ fontWeight: '600', color: Colors.textSecondary }}>{inviteRole === 'viewer' ? t('flow.viewer_only') : t('flow.editable')}</Text>
                        </Text>
                        
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, width: '100%' }}>
                          <TouchableOpacity 
                            onPress={() => Share.share({ message: t('flow.share_code_msg', { code: inviteCode }) })}
                            style={{ 
                              flex: 1, 
                              flexDirection: 'row', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              backgroundColor: Colors.primary, 
                              height: 60,
                              borderRadius: 18, 
                              gap: 10,
                              shadowColor: Colors.primary,
                              shadowOffset: { width: 0, height: 6 },
                              shadowOpacity: 0.25,
                              shadowRadius: 10,
                              elevation: 5
                            }}
                            activeOpacity={0.8}
                          >
                            <Share2 size={22} color="white" />
                            <Text style={{ color: 'white', fontWeight: '800', fontSize: 17 }}>{t('flow.share_btn')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            onPress={handleInvalidateCode}
                            style={{ 
                              width: 60, 
                              height: 60,
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              backgroundColor: Colors.error + '12', 
                              borderRadius: 18, 
                              borderWidth: 1.5, 
                              borderColor: Colors.error + '30' 
                            }}
                            activeOpacity={0.7}
                          >
                            <Trash2 size={22} color={Colors.error} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                        <Users size={48} color={Colors.outlineVariant} strokeWidth={1.5} style={{ marginBottom: 12 }} />
                        <Text style={{ color: Colors.outline, fontSize: 15, fontWeight: '500' }}>{t('flow.no_active_code')}</Text>
                      </View>
                    )}
                  </View>

                  {/* 코드 생성 버튼 */}
                  <TouchableOpacity
                    style={{ 
                      marginHorizontal: 20, 
                      backgroundColor: inviteCode ? Colors.surfaceContainerHigh : Colors.primary, 
                      borderRadius: 16, 
                      paddingVertical: 16, 
                      alignItems: 'center',
                      borderWidth: inviteCode ? 1.5 : 0,
                      borderColor: Colors.outlineVariant + '50'
                    }}
                    onPress={() => handleGenerateCode()}
                    disabled={isGeneratingCode}
                    activeOpacity={0.8}
                  >
                    {isGeneratingCode ? (
                      <ActivityIndicator color={inviteCode ? Colors.primary : "white"} />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Repeat size={18} color={inviteCode ? Colors.textSecondary : "white"} />
                        <Text style={{ color: inviteCode ? Colors.textSecondary : "white", fontWeight: '700', fontSize: 16 }}>
                          {inviteCode ? t('flow.regenerate_code') : t('flow.generate_code')}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* 현재 멤버 목록 영역 */}
                  <View style={{ marginTop: 32, paddingHorizontal: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <Text style={{ fontWeight: '800', color: Colors.text, fontSize: 18 }}>{t('flow.current_members')}</Text>
                      <TouchableOpacity
                        onPress={handleShowPermissionInfo}
                        activeOpacity={0.6}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <View pointerEvents="none">
                          <Info size={20} color={Colors.outline} />
                        </View>
                      </TouchableOpacity>
                    </View>

                    {isMembersLoading ? (
                      <ActivityIndicator style={{ padding: 32 }} color={Colors.primary} />
                    ) : flowMembers.length === 0 ? (
                      <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                        <Text style={{ color: Colors.outline, fontSize: 14 }}>{t('flow.no_members')}</Text>
                      </View>
                    ) : (
                      <View style={{ gap: 4 }}>
                        {flowMembers.map(member => (
                          <View key={member.uid} style={{ 
                            padding: 16, 
                            borderRadius: 16, 
                            backgroundColor: Colors.surfaceContainerLowest,
                            borderWidth: 1,
                            borderColor: Colors.outlineVariant + '30',
                            marginBottom: 8
                          }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.text }}>
                                    {member.displayName || 'Unknown'} 
                                  </Text>
                                  {member.uid === (selectedFlow?._ownerUid || selectedFlow?.ownerUid || selectedFlow?.ownerId) && (
                                    <View style={{ backgroundColor: Colors.primary + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                      <Text style={{ color: Colors.primary, fontSize: 10, fontWeight: '800' }}>{t('flow.owner_label').toUpperCase()}</Text>
                                    </View>
                                  )}
                                  {member.uid === user?.uid && (
                                    <Text style={{ color: Colors.outline, fontSize: 12 }}>({t('flow.you_label')})</Text>
                                  )}
                                </View>
                                <Text style={{ fontSize: 13, color: Colors.outline, marginTop: 4 }}>
                                  {member.email || ''}
                                </Text>
                              </View>
                              {isFlowOwner(selectedFlow) && member.uid !== user?.uid && (
                                <TouchableOpacity
                                  onPress={() => handleRemoveMember(member.uid)}
                                  activeOpacity={0.6}
                                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                  style={{ padding: 4 }}
                                >
                                  <View pointerEvents="none">
                                    <UserMinus size={20} color={Colors.error} />
                                  </View>
                                </TouchableOpacity>
                              )}
                            </View>

                            {/* 권한 체크박스 섹션 (오너만 조절 가능) */}
                            {isFlowOwner(selectedFlow) && member.uid !== user?.uid && (() => {
                              const perms = pendingPermissions[member.uid] ?? member.permissions ?? { edit: member.role === 'editor', manageComments: true };
                              return (
                                <View style={{ marginTop: 16, pt: 16, borderTopWidth: 1, borderTopColor: Colors.outlineVariant + '20', flexDirection: 'row', gap: 16 }}>
                                  {[
                                    { key: 'edit', label: t('flow.perm_edit') },
                                    { key: 'manageComments', label: t('flow.perm_comments') }
                                  ].map(perm => (
                                    <Pressable
                                      key={perm.key}
                                      onPress={() => handleTogglePermission(member.uid, perm.key)}
                                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}
                                      hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
                                    >
                                      <View style={{
                                        width: 24, height: 24, borderRadius: 8, borderWidth: 2,
                                        borderColor: perms[perm.key] ? Colors.primary : Colors.outlineVariant,
                                        backgroundColor: perms[perm.key] ? Colors.primary : 'transparent',
                                        alignItems: 'center', justifyContent: 'center'
                                      }}>
                                        {perms[perm.key] && <View pointerEvents="none"><Check size={18} color="white" strokeWidth={3} /></View>}
                                      </View>
                                      <Text style={{ fontSize: 15, fontWeight: '700', color: perms[perm.key] ? Colors.text : Colors.outline }}>{perm.label}</Text>
                                    </Pressable>
                                  ))}
                                </View>
                              );
                            })()}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                </ScrollView>
                {/* iOS 더블 모달 이슈 해결을 위해 모달 내부에도 컨펌 모달 배치 */}
                {renderConfirmModal()}
              </Animated.View>
            </View>
          </GestureHandlerRootView>
        </Modal>

        {/* 공유 플로우 참여 모달 - 바텀 시트 스타일 */}
        <Modal
          transparent
          visible={joinModalVisible}
          onRequestClose={closeJoinModal}
        >
          <GestureHandlerRootView style={{ flex: 1 }}>
            <Pressable style={[StyleSheet.absoluteFill, styles.modalBg]} onPress={closeJoinModal} />
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1, justifyContent: 'flex-end' }}
              pointerEvents="box-none"
            >
              <Animated.View
                style={[
                  styles.editModalContent,
                  {
                    height: 'auto',
                    maxHeight: height * 0.9,
                    transform: [{ translateY: joinPanY }]
                  }
                ]}
                onLayout={(e) => setJoinModalHeight(e.nativeEvent.layout.height)}
              >
                <View {...joinPanResponder.panHandlers} style={styles.handleArea}>
                  <View style={styles.modalHandle} />
                </View>
                <View style={styles.editHeader}>
                  <View style={{ width: 80, alignItems: 'flex-start' }}>
                    <GHButton onPress={closeJoinModal} style={styles.headerActionBtn}>
                      <Text style={styles.headerSaveText}>{t('common.close', 'Close')}</Text>
                    </GHButton>
                  </View>
                  <Text style={[styles.editTitle, { flex: 1, textAlign: 'center' }]} numberOfLines={1}>
                    {t('flow.join_shared_flow')}
                  </Text>
                  <View style={{ width: 80, alignItems: 'flex-end' }}>
                    <GHButton 
                      onPress={handleJoinFlow} 
                      style={styles.headerActionBtn}
                      disabled={isJoining || joinCode.length !== 6}
                    >
                      {isJoining ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                      ) : (
                        <Text style={[
                          styles.headerSaveText, 
                          joinCode.length !== 6 && { color: Colors.outline }
                        ]}>
                          {t('flow.join')}
                        </Text>
                      )}
                    </GHButton>
                  </View>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
                  <View style={styles.modalContentPadding}>
                    <Text style={{ color: Colors.outline, fontSize: 13, marginBottom: 12 }}>{t('flow.enter_invite_code')}</Text>
                    <TextInput
                      style={{
                        borderWidth: 1.5, 
                        borderColor: joinCode.length === 6 ? Colors.primary : Colors.outlineVariant,
                        borderRadius: 16, 
                        padding: 18, 
                        fontSize: 32, 
                        fontWeight: '800',
                        textAlign: 'center', 
                        letterSpacing: 10, 
                        color: Colors.onBackground,
                        backgroundColor: Colors.surfaceContainerLowest,
                      }}
                      value={joinCode}
                      onChangeText={text => setJoinCode(text.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      placeholder="XXXXXX"
                      placeholderTextColor={Colors.outlineVariant}
                      maxLength={6}
                      autoCapitalize="characters"
                      autoCorrect={false}
                    />
                  </View>
                </ScrollView>
              </Animated.View>
            </KeyboardAvoidingView>
          </GestureHandlerRootView>
        </Modal>

        {/* Flow 옵션 팝업 메뉴 */}
        <Modal
          transparent
          visible={flowMenuVisible}
          animationType="fade"
          onRequestClose={() => setFlowMenuVisible(false)}
        >
          <Pressable style={styles.flowMenuOverlay} onPress={() => setFlowMenuVisible(false)}>
            <View style={styles.flowMenuCard}>
              <Text style={styles.flowMenuTitle} numberOfLines={1}>{selectedFlow?.title}</Text>
              <View style={styles.flowMenuDivider} />

              {/* 이미지 공유 — 항상 */}
              <Pressable
                style={({ pressed }) => [styles.flowMenuItem, pressed && { backgroundColor: '#F4F7FE' }]}
                onPress={() => { setFlowMenuVisible(false); handleShareFlowImage(); }}
              >
                <View pointerEvents="none"><Share2 size={18} color={Colors.primary} /></View>
                <Text style={styles.flowMenuItemText}>{t('flow.share_as_image', 'Share as Image')}</Text>
              </Pressable>

              {/* 멤버 초대 — 오너만 */}
              {isFlowOwner(selectedFlow) && (
                <>
                  <View style={styles.flowMenuDivider} />
                  <Pressable
                    style={({ pressed }) => [styles.flowMenuItem, pressed && { backgroundColor: '#F4F7FE' }]}
                    onPress={handleOpenInvite}
                  >
                    <View pointerEvents="none"><Users size={18} color={Colors.primary} /></View>
                    <Text style={styles.flowMenuItemText}>{t('flow.manage_members')}</Text>
                  </Pressable>
                </>
              )}

              {/* 편집 — 오너만 */}
              {isFlowOwner(selectedFlow) && (
                <>
                  <View style={styles.flowMenuDivider} />
                  <Pressable
                    style={({ pressed }) => [styles.flowMenuItem, pressed && { backgroundColor: '#F4F7FE' }]}
                    onPress={() => { setFlowMenuVisible(false); openFlowModal(selectedFlow); }}
                  >
                    <View pointerEvents="none"><Edit3 size={18} color={Colors.onBackground} /></View>
                    <Text style={styles.flowMenuItemText}>{t('common.edit', 'Edit')}</Text>
                  </Pressable>
                </>
              )}

              <View style={styles.flowMenuDivider} />

              {/* 오너: 삭제 / 멤버: 나가기 */}
              {isFlowOwner(selectedFlow) ? (
                <Pressable
                  style={({ pressed }) => [styles.flowMenuItem, pressed && { backgroundColor: '#FFF0F0' }]}
                  onPress={() => { setFlowMenuVisible(false); handleDeleteFlow(selectedFlow?.id); }}
                >
                  <View pointerEvents="none">
                    <Trash2 size={18} color={Colors.error} />
                  </View>
                  <Text style={[styles.flowMenuItemText, { color: Colors.error }]}>{t('common.delete', 'Delete')}</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.flowMenuItem, pressed && { backgroundColor: '#FFF0F0' }]}
                  onPress={() => { setFlowMenuVisible(false); handleDeleteFlow(selectedFlow?.id); }}
                >
                  <View pointerEvents="none">
                    <LogOut size={18} color={Colors.error} />
                  </View>
                  <Text style={[styles.flowMenuItemText, { color: Colors.error }]}>{t('flow.alert.leave_flow', 'Leave Flow')}</Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        </Modal>

        {renderConfirmModal()}
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 220, paddingTop: Spacing.md },
  listHeader: { marginBottom: 0, marginTop: Spacing.md },
  screenTitle: { ...Typography.h1, fontSize: 34, color: Colors.onBackground, letterSpacing: -0.5 },
  screenSubtitle: { ...Typography.body, color: Colors.onSurfaceVariant, marginTop: 4 },
  flowCardContainer: {
    marginBottom: Spacing.lg,
    borderRadius: 32,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 20 },
      android: { elevation: 8 }
    }),
  },
  flowCardLocked: { borderRadius: 32, overflow: 'hidden' },
  flowCard: { padding: Spacing.xl, borderRadius: 32, height: 220, justifyContent: 'space-between' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deleteBtnAbsolute: { position: 'absolute', top: Spacing.lg, right: Spacing.lg, padding: 8, zIndex: 10 },
  cardMainArea: { marginTop: Spacing.xs },
  tagContainer: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  tagText: { color: 'white', fontSize: 12, fontWeight: '700' },
  deleteBtn: { padding: 10 },
  cardMiddle: { marginTop: Spacing.md },
  cardTitle: { ...Typography.h2, color: 'white', fontSize: 26, lineHeight: 32, paddingRight: 50 },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
  cardDate: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500' },
  cardBottom: { marginTop: Spacing.lg },
  progressContainer: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginBottom: 12, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: 'white', borderRadius: 2 },
  weatherSummary: { flexDirection: 'row', alignItems: 'center' },
  weatherText: { color: 'white', fontSize: 13, fontWeight: '600', flex: 1 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerAddBtn: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({ ios: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } })
  },
  detailContainer: { flex: 1, backgroundColor: Colors.background, paddingTop: Platform.OS === 'ios' ? 44 : 0 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 60, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant + '20' },
  headerLeft: { width: 50, alignItems: 'flex-start', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRight: { width: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  detailHeaderTitle: { ...Typography.h3, fontSize: 17, color: Colors.onBackground, textAlign: 'center' },
  iconBtn: { padding: 8 },
  detailContent: { paddingHorizontal: 4, paddingBottom: 200, paddingTop: Spacing.sm },
  heroSection: { marginBottom: Spacing.xl },
  heroDate: { ...Typography.bodySmall, color: Colors.primary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5 },
  heroLocationRow: { 
    flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xs, justifyContent: 'space-between',
    backgroundColor: 'white', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 20,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 }, android: { elevation: 2 } })
  },
  locationMain: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 12 },
  heroWeather: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: 'rgba(0,0,0,0.05)' },
  heroTemp: { ...Typography.bodyMedium, fontWeight: '800', color: Colors.onBackground },
  dayGroup: { marginBottom: 16 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 16 },
  dayBadge: { backgroundColor: Colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginRight: 8 },
  dayBadgeText: { ...Typography.labelSmall, color: 'white', fontWeight: '800' },
  dayDateText: { ...Typography.bodyLarge, fontWeight: '800', color: Colors.onBackground },
  stepRow: { flexDirection: 'row', paddingHorizontal: 2, marginBottom: 14 },
  timelineCol: { width: 10, alignItems: 'center' },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.outlineVariant, marginTop: 18, borderWidth: 1.5, borderColor: 'white' },
  dotCurrent: { backgroundColor: Colors.primary, width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: 'rgba(0, 102, 138, 0.2)' },
  dotCompleted: { backgroundColor: Colors.secondary },
  timelineLine: { width: 2, flex: 1, backgroundColor: Colors.outlineVariant, opacity: 0.3, marginVertical: 4 },
  stepInfoCard: {
    backgroundColor: 'white', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 14, marginLeft: 8, marginBottom: Spacing.xs, minHeight: 74, justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.05, shadowRadius: 12 }, android: { elevation: 2 } })
  },
  deleteBtnInner: {
    padding: 6,
    marginLeft: 2,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.4,
  },
  activeStepCard: { borderColor: 'rgba(0, 102, 138, 0.15)', ...Platform.select({ ios: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 }, android: { elevation: 6 } }) },
  warningStepCard: { borderWidth: 1.5, borderColor: 'rgba(239, 68, 68, 0.2)' },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepActivity: { ...Typography.h3, fontSize: 18, color: Colors.onBackground, fontWeight: '800', letterSpacing: -0.5, marginTop: 1 },
  stepTime: { fontSize: 11.5, color: Colors.primary, fontWeight: '800', letterSpacing: 0.6, marginBottom: 2 },
  stepMemo: { ...Typography.caption, color: Colors.outline, marginTop: 10, lineHeight: 22, fontSize: 17.5 },
  stepWeatherMini: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, minWidth: 52 },
  stepWeatherTemp: { fontSize: 13.5, fontWeight: '800', color: Colors.onBackground, marginTop: 1 },
  repeatStepBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.primary + '18', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
  repeatStepBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  stepRepeatPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, marginBottom: 8 },
  repeatChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.outline, backgroundColor: 'white' },
  repeatChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  stepRegionRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  stepRegionLabel: { fontSize: 11, color: Colors.outline, fontWeight: '600', maxWidth: 120 },
  warningBadge: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 10, borderRadius: 12, marginTop: 12 },
  warningText: { fontSize: 12, color: '#dc2626', fontWeight: '600' },
  centerButtonWrap: { alignItems: 'center', marginTop: Spacing.xl },
  addStepDetail: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 18, paddingHorizontal: 32, borderRadius: 20,
    borderWidth: 1.5, borderColor: 'rgba(0, 102, 138, 0.15)', borderStyle: 'dashed',
    backgroundColor: 'rgba(0, 102, 138, 0.03)', gap: 10,
  },
  addStepText: { ...Typography.body, fontWeight: '800', color: Colors.primary, letterSpacing: -0.5 },
  emptyFlow: { alignItems: 'center', padding: 60, gap: 16 },
  emptyFlowText: { ...Typography.bodySmall, color: Colors.outline },
  rowInputs: { flexDirection: 'row', width: '100%', alignItems: 'flex-start', justifyContent: 'space-between' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.lg },
  searchInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceContainerLow, borderRadius: 20, paddingHorizontal: 16, height: 56, gap: 10 },
  modalInput: { flex: 1, ...Typography.body, fontSize: 16, color: Colors.onBackground, paddingVertical: 0, textAlignVertical: 'center', lineHeight: undefined },
  cancelText: { ...Typography.body, color: Colors.primary, fontWeight: '600' },
  searchResultsList: { flex: 1 },
  resultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant, gap: 16 },
  resultIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  resultInfo: { flex: 1 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultName: { ...Typography.h3, fontSize: 16 },
  resultAddress: { ...Typography.bodySmall, color: Colors.onSurfaceVariant, marginTop: 2 },
  modalBg: { backgroundColor: 'rgba(0,0,0,0.5)' },
  editModalContent: { backgroundColor: Colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 0, paddingHorizontal: Spacing.xl, paddingBottom: Platform.OS === 'ios' ? 40 : 20, maxHeight: height * 0.9 },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
  editTitle: { ...Typography.h2, fontSize: 24, letterSpacing: -0.5, color: Colors.onBackground },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.outlineVariant, borderRadius: 2, alignSelf: 'center', marginBottom: 16, opacity: 0.5 },
  headerActionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(0, 191, 255, 0.05)' },
  headerSaveText: { ...Typography.body, fontWeight: '800', color: Colors.primary },
  searchAccessoryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0, 191, 255, 0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  searchAccessoryText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  modalContentPadding: { marginBottom: Spacing.xl },
  handleArea: { alignItems: 'center', paddingTop: 12, paddingBottom: 12 },
  charCount: { fontSize: 12, color: Colors.outline, fontWeight: '500' },
  headerDeleteBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,59,48,0.08)', alignItems: 'center', justifyContent: 'center' },
  requiredAsterisk: { color: Colors.error, fontWeight: '700' },
  compactInputRowRequired: { borderColor: 'rgba(255,59,48,0.35)', borderWidth: 1.5 },
  inputGroup: { marginBottom: Spacing.xl },
  inputLabel: { ...Typography.bodySmall, color: Colors.onBackground, fontWeight: '800', opacity: 0.8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, height: 20 },
  resetText: { fontSize: 12, color: Colors.primary, fontWeight: '700' },
  editInputWrap: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 16, paddingHorizontal: 16, height: 60, borderWidth: 1.5, borderColor: Colors.surfaceContainerLow,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 }, android: { elevation: 2 } })
  },
  editInput: { flex: 1, ...Typography.body, fontSize: 16, color: Colors.onBackground, fontWeight: '600' },
  regionSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceContainerLow, borderRadius: 24, padding: 16, gap: 16 },
  regionSelectorActive: { backgroundColor: 'white', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10 }, android: { elevation: 6 } }) },
  regionIconWrap: { width: 48, height: 48, borderRadius: 16, backgroundColor: Colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  regionIconWrapActive: { backgroundColor: Colors.primary },
  regionInfo: { flex: 1 },
  regionMainText: { ...Typography.h3, fontSize: 16, color: Colors.onBackground },
  regionPlaceholder: { color: Colors.outline, fontWeight: '500' },
  regionSubText: { ...Typography.bodySmall, color: Colors.onSurfaceVariant, marginTop: 2, fontSize: 12 },
  premiumSubmitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 64, borderRadius: 24, gap: 12, marginTop: 8,
    ...Platform.select({ ios: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15 }, android: { elevation: 6 } })
  },
  premiumSubmitText: { color: 'white', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  editInputText: { ...Typography.body, fontSize: 14.5, color: Colors.onBackground, fontWeight: '600' },
  gradientPreview: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12, marginTop: 10, marginBottom: 12 },
  gradientPreviewCircle: { width: 36, height: 36, borderRadius: 18 },
  gradientPreviewName: { fontSize: 11, fontWeight: '600', color: Colors.onSurfaceVariant, marginBottom: 4 },
  gradientPreviewBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  gradientPreviewBadgeText: { fontSize: 13, fontWeight: '700', color: 'white' },
  gradientGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, gap: 4 },
  gradientGridCell: { width: (width - Spacing.xl * 2 - 4 * 3) / 4, alignItems: 'center', paddingVertical: 8 },
  gradientSwatchWrap: { width: 48, height: 48, borderRadius: 24, padding: 3, borderWidth: 2.5, borderColor: 'transparent', marginBottom: 6 },
  gradientSwatchWrapSelected: { borderColor: Colors.primary },
  gradientSwatch: { flex: 1, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  gradientLabel: { fontSize: 11, color: Colors.onSurfaceVariant, fontWeight: '600', textAlign: 'center' },
  inputClearBtn: { padding: 8, marginLeft: 4, backgroundColor: Colors.surfaceContainer, borderRadius: 10 },
  pickerContainer: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: 24, marginTop: 8, marginBottom: 20, overflow: 'hidden', paddingBottom: 8 },
  modalFooter: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20, alignItems: 'center' },
  // Picker Sheet Styles
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 40, overflow: 'hidden' },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainerLow },
  pickerTitle: { ...Typography.h3, fontSize: 18, color: Colors.onBackground },
  pickerDoneBtn: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: Colors.primaryContainer, borderRadius: 12 },
  pickerDoneText: { color: Colors.primary, fontWeight: '700', fontSize: 15 },
  pickerContent: { paddingVertical: 10, alignItems: 'center' },
  deleteAction: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#FFE5E5', justifyContent: 'center', alignItems: 'center' },
  saveAction: { flex: 1, height: 56, borderRadius: 16, overflow: 'hidden', backgroundColor: Colors.primary },
  saveGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveActionText: { color: 'white', fontWeight: '700', fontSize: 16 },
  compactInputRow: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 20, paddingHorizontal: 16, height: 56, gap: 12, borderWidth: 1.5, borderColor: Colors.surfaceContainerLow,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 }, android: { elevation: 2 } })
  },
  compactInputText: { flex: 1, ...Typography.body, fontSize: 16, color: Colors.onBackground, fontWeight: '600' },
  compactInput: { flex: 1, fontSize: 16, color: Colors.onBackground, fontWeight: '600', paddingVertical: 0, textAlignVertical: 'center', letterSpacing: 0 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingRight: 4 },
  regionDisplay: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceContainerLow, padding: 12, borderRadius: 16, gap: 10, borderWidth: 1, borderColor: Colors.outlineVariant, opacity: 0.9 },
  memoInlineInput: {
    backgroundColor: 'white', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14,
    minHeight: 90, maxHeight: 180, borderWidth: 1.5, borderColor: Colors.surfaceContainerLow,
    ...Typography.body, fontSize: 15, color: Colors.onBackground, lineHeight: 22,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 }, android: { elevation: 2 } })
  },
  pickerConfirmBtn: { backgroundColor: 'rgba(0, 191, 255, 0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  pickerConfirmText: { color: Colors.primary, fontWeight: '800', fontSize: 14 },
  flowAdWrapper: {
    backgroundColor: 'white',
    marginBottom: Spacing.lg,
    borderRadius: 32,
    padding: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 270,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 15 },
      android: { elevation: 6 }
    }),
  },
  adBadge: {
    position: 'absolute',
    top: 10,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    zIndex: 10,
  },
  adBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.5,
  },
  bannerAdWrapper: {
    marginTop: 8,
    marginBottom: 12,
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },

  // Flow 옵션 팝업 메뉴 스타일
  flowMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  flowMenuCard: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20 },
      android: { elevation: 12 }
    }),
  },
  flowMenuTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
    paddingHorizontal: 20,
    paddingVertical: 16,
    textAlign: 'center',
  },
  flowMenuDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  flowMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
  },
  flowMenuItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.onBackground,
  },
  commentsContainer: { marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingBottom: 2 },
  commentBubble: { flex: 1, alignSelf: 'flex-start', backgroundColor: 'transparent', paddingHorizontal: 0, paddingVertical: 1, marginBottom: 0 },
  commentText: { fontSize: 15, color: Colors.onSurfaceVariant, lineHeight: 20 },
  commentAuthor: { fontWeight: '800', color: Colors.primary },
  flowToast: { position: 'absolute', bottom: 100, alignSelf: 'center', backgroundColor: 'rgba(30,30,30,0.88)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 22, zIndex: 9999 },
  flowToastText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 16, gap: 8 },
  commentInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    color: Colors.onBackground,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    textAlignVertical: 'center',
    paddingVertical: Platform.OS === 'ios' ? 12 : 0,
    letterSpacing: 0,
  },
  commentSendBtn: { 
    justifyContent: 'center', 
    alignItems: 'center',
    marginLeft: 4
  },
  commentWrapper: { flexDirection: 'row', alignItems: 'center', marginBottom: 0, gap: 6 },
  commentDeleteBtn: { padding: 4, opacity: 0.6 },
  commentToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 4, width: '100%' },
  commentCountText: { fontSize: 14, fontWeight: '700' },
  joinFlowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '15', 
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  joinFlowChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  
  // Confirm Modal Styles
  confirmModal: {
    width: width * 0.8,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20 },
      android: { elevation: 12 }
    }),
  },
  confirmTitle: {
    ...Typography.h2,
    fontSize: 20,
    color: Colors.onBackground,
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmMessage: {
    ...Typography.body,
    fontSize: 15,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerLow,
  },
  confirmCancelText: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
  },
  confirmText: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.primary,
  },
  confirmDestructiveText: {
    ...Typography.body,
    fontWeight: '700',
    color: 'white',
  },

  // Bottom Sheet Styles
  bottomSheetContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 10 },
      android: { elevation: 20 }
    }),
  },
  bottomSheetKnob: {
    width: 36,
    height: 4,
    backgroundColor: Colors.outlineVariant,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
    opacity: 0.5,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant + '20',
  },
  bottomSheetCloseBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  bottomSheetCloseText: {
    fontSize: 15,
    color: Colors.outline,
    fontWeight: '600',
  },
  bottomSheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.onBackground,
  },
  bottomSheetSaveBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    minWidth: 50,
    alignItems: 'center',
  },
  bottomSheetSaveText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '800',
  },
});

export default FlowScreen;
