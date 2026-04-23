import React, { useRef, useState, useEffect, useCallback, memo, Component } from 'react';
import { SafeAreaView, Platform, Animated, Image, ToastAndroid, Dimensions, TextInput, Modal, FlatList, StyleSheet, ScrollView, TouchableOpacity, View, Text, AsyncStorageStatic, Alert } from 'react-native';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { updateWidgetManual } from '../widgets/widget-task-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import AsyncStorage from '@react-native-async-storage/async-storage';
import KorWeather from './KorWeather'
import { UiIcon, AnimatedUiIcon } from '../component/UiIcon'
import { myMsg } from '../component/MyMsg'

import Analytics from '../component/AnalyticsStub';

import SQLite from '../component/SQLiteLegacy'
import {
  setTestDeviceIDAsync,
  AdMobBanner,
  AdMobInterstitial,
  PublisherBanner,
  AdMobRewarded
} from '../component/AdMobStub';

import Constants from 'expo-constants';
import * as Device from 'expo-device';

import SelectPlace from '../component/SelectPlace'
import { showInterstitialAd, showRewardedAd, AdLoadingModal, getBannerId } from '../component/AdManager'

export default function WeatherBookmark({ navigation, route }) {




  const adUnitIDBanner = getBannerId();

  const maxFontSizeM = 1.2

  const [refresh, setRefresh] = useState(false);
  const [adLoading, setAdLoading] = useState(false);

  if (route.params != null) {
    let reload = route.params.refresh
    if (reload != null && reload) {
      route.params.refresh = false;
      setRefresh(!refresh)
    }
  }

  //let windowHeight = Dimensions.get("window").height;
  //let windowWidth = Dimensions.get("window").width;

  const STORAGE_KEY = '@save_wBookmark'
  const STORAGE_SLOT_KEY = '@save_wBookSlot'

  const DEFAULT_NUM = 5;
  const MAX_NUM = 5;

  const [bookmark, setBookmark] = useState([[], [], []])

  useEffect(() => {
    const totalBookmarks = bookmark[0].length + bookmark[1].length + bookmark[2].length;
    Analytics.logEvent('Page_View_WeatherBookmark', {
      screen: 'WeatherBookmarkScreen',
      bookmark_count: totalBookmarks
    });
  }, [bookmark[0].length, bookmark[1].length, bookmark[2].length]);
  const [currentPage, setCurrentPage] = useState(0); // 현재 페이지 (0, 1, 2)
  const [isInitialScrollDone, setIsInitialScrollDone] = useState(false); // 초기 스크롤 여부
  const flatListRef = useRef(null)
  const [bSlot, setBSlot] = useState([0, 0, 0])
  const [isLoaded, setIsLoaded] = useState(false); // 데이터 로딩 완료 여부 플래그


  const saveData = async () => {
    try {
      // 현재 페이지의 데이터를 각각 저장
      for (let i = 0; i < 3; i++) {
        await AsyncStorage.setItem(`${STORAGE_KEY}_${i}`, JSON.stringify(bookmark[i]))
        await AsyncStorage.setItem(`${STORAGE_SLOT_KEY}_${i}`, JSON.stringify(bSlot[i]))
      }
    }
    catch (error) {
      myMsg(`날씨 관심 지역 저장 실패 ${error}`)
      if (__DEV__) console.log(`failed to save weather bookmarks ${error}`)
    }
  }

  const readData = async () => {
    try {
      let allBookmarks = [[], [], []]
      let allSlots = [0, 0, 0]

      // 기존 데이터(@save_wBookmark)가 있는지 확인 (마이그레이션용)
      let legacyData = await AsyncStorage.getItem(STORAGE_KEY);
      let legacySlot = await AsyncStorage.getItem(STORAGE_SLOT_KEY);

      for (let i = 0; i < 3; i++) {
        let tmpData = await AsyncStorage.getItem(`${STORAGE_KEY}_${i}`);
        let tmpData2 = await AsyncStorage.getItem(`${STORAGE_SLOT_KEY}_${i}`)

        if (i === 0 && legacyData != null && tmpData == null) {
          allBookmarks[i] = JSON.parse(legacyData);
          allSlots[i] = legacySlot != null ? JSON.parse(legacySlot) : 0;
          // 마이그레이션 후 즉시 저장 (최초 1회)
          await AsyncStorage.setItem(`${STORAGE_KEY}_0`, legacyData);
          await AsyncStorage.setItem(`${STORAGE_SLOT_KEY}_0`, legacySlot || "0");
        } else {
          if (tmpData != null) allBookmarks[i] = JSON.parse(tmpData);
          if (tmpData2 != null) allSlots[i] = JSON.parse(tmpData2);
        }
      }

      setBookmark(allBookmarks);
      setBSlot(allSlots);
      setIsLoaded(true); // 데이터를 다 읽어온 후에만 저장 가능하도록 설정

    } catch (error) {
      myMsg(`날씨 관심 지역 불러오기 실패 ${error}`)
      if (__DEV__) console.log(`failed to load weather bookmarks ${error}`)
      setIsLoaded(true); // 에러가 나더라도 무한 대기를 막기 위해 true 설정
    }
  }

  async function removeWBookmark(id) {
    let newBookmarks = [...bookmark]
    newBookmarks[currentPage] = newBookmarks[currentPage].filter((d) => d.id != id)
    setBookmark(newBookmarks)
  }

  async function addBookmark(wTitle, wAddr) {
    // 현재 페이지의 제한 확인
    let currentLimit = (currentPage === 0) ? (MAX_NUM + bSlot[0]) : (bSlot[currentPage]);

    if (bookmark[currentPage].length >= currentLimit) {
      myMsg(`이 페이지에 추가 가능한 슬롯이 없습니다. 광고를 보고 슬롯을 추가하세요.`)
      return;
    }

    let newBookmarks = [...bookmark]
    let id = Date.now()

    newBookmarks[currentPage].push({ 'id': id, 'weatherTitle': wTitle, 'weatherAddr': wAddr })
    setBookmark(newBookmarks)

    Analytics.logEvent('Action_Add_Bookmark', {
      title: wTitle,
      addr: wAddr
    });
  }


  const [isTab, setIsTab] = useState(false)

  const checkTablet = async () => {
    let dType

    try {
      dType = await Device.getDeviceTypeAsync();

      if (dType == Device.DeviceType.TABLET) {
        //   console.log(`tab`)
        setIsTab(true)
      } else {
        setIsTab(false)
      }
    } catch (e) {

    }
  }

  useEffect(() => {
    checkTablet();
    checkBanner();


    readData();
    //setTimeout(()=>{
    //헤더의 타이틀 변경
    navigation.setOptions({
      headerTitle: (
        <View>
          <Text maxFontSizeMultiplier={maxFontSizeM} style={{ color: 'black', fontSize: 18 }}>날씨 관심 지역</Text>
        </View>

      ),
      headerStyle: { backgroundColor: "#54bfe6" },
      headerShown: true,
    })
    //   },0)
  }, [refresh])

  useEffect(() => {
    if (isLoaded) {
      saveData();
    }
  }, [bookmark, bSlot]) // bSlot이 변할 때도 저장되어야 함 (슬롯 확장 영구 유지)

  useEffect(() => {
    if (isLoaded && !isInitialScrollDone && flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: Dimensions.get('window').width, animated: false });
      setIsInitialScrollDone(true);
    }
  }, [isLoaded]);


  const db = SQLite.openDatabase('db.db')

  const getRandomIntInclusive = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min; //최댓값도 포함, 최솟값도 포함
  }

  const AskAd = () => {
    Alert.alert(
      "날씨 코인이 부족합니다.",
      "동영상 광고 한번 보고 날씨 코인 20개를 충전할까요?",
      [
        {
          text: "아니오",
          //  style: "cancel"
        },
        {
          text: "네!",
          onPress: () => {
            setAdLoading(true);
            showRewardedAd(0, 0, 0, () => {
              setAdLoading(false);
              setRefresh(!refresh);
            }, () => {
              setAdLoading(false);
            });
          }
        },
      ],
      { cancelable: false }
    )
  }


  async function checkWeatherToken(content) {
    let userName = 'self'
    let curWToken = 0;

    //  console.log('weatehr')
    await Analytics.logEvent('Button_Weather_FavoriteList', {
      name: 'weather check in favorite list',
      purpose: 'check weather in favorite list'
    })

    db.transaction(tx => {
      tx.executeSql("SELECT * from USER_INFO where user=(?)", [userName],
        (_, rows) => {
          if (rows.rows.length < 1) {
            curWToken = 0;
            //  AskAd();
          }
          else {
            let res = rows.rows.item(0)
            curWToken = JSON.parse(res.weatherToken);
          }


          if (curWToken > 0) {
            let newToken = curWToken - 1;
            //let newToken = curWToken ; //보상형 광고 거부감이 있으니 전면 광고로 바꾸자.
            if (__DEV__) console.log(`curToken : ${curWToken} newToken : ${newToken}`)
            tx.executeSql("UPDATE USER_INFO SET weatherToken=(?) where user=(?)", [newToken, userName],
              (_, rows) => {
                //    if (__DEV__) myMsg(`__DEV__ 날씨 코인 1개가 차감되었습니다.\n남은 날씨 코인 : ${newToken}`);
                navigation.navigate('Weather', {
                  "date": null,
                  "loc": { "weatherAddr": content.weatherAddr },
                  "nickName": content.weatherTitle
                })
              },
              (_, error) => {
                console.log(`in korWeather.js, update token error`)
              })
          } else {
            // 날씨 코인이 없을 경우에도 정책 위반 방지를 위해 전면 광고 없이 즉시 이동
            navigation.navigate('Weather', {
              "date": null,
              "loc": { "weatherAddr": content.weatherAddr },
              "nickName": content.weatherTitle
            })
          }

        },
        (_, error) => {
          console.log(`in KorWeather.js, select weatherToken error`)
        }
      )
    })
  }

  const [weatherLocation, setWeatherLocation] = useState('')
  const [weatherAddr, setWeatherAddr] = useState('');

  const [showSelectPlace, setShowSelectPlace] = useState(false)

  const [banner, setBanner] = useState(false);

  const checkBanner = () => {
    // 기존 배너 체크 로직은 도트 메뉴로 대체되므로 내부 상태만 유지하거나 필요 시 제거 가능
    setBanner(true);
  }

  // 페이지 전환 및 경계면 내비게이션 핸들러
  const isNavigating = useRef(false);
  const isManualScrolling = useRef(false);

  // 스크롤이 끝나는 시점에 위치를 교정 (무한 루프 트릭)
  const onScroll = (e) => {
    if (isManualScrolling.current) return;
    const x = e.nativeEvent.contentOffset.x;
    const width = Dimensions.get('window').width;
    let index = Math.round(x / width);

    // 논리적인 페이지(0, 1, 2) 계산
    let logicalIndex = (index - 1 + 3) % 3;
    if (logicalIndex !== currentPage) {
      setCurrentPage(logicalIndex);
    }
  }

  const onMomentumScrollEnd = (e) => {
    isManualScrolling.current = false;
    const x = e.nativeEvent.contentOffset.x;
    const width = Dimensions.get('window').width;
    const index = Math.round(x / width);

    // 무한 루프 처리를 위한 사일런트 점프
    if (index === 0) {
      // 0번(복제된 3페이지) -> 3번(진짜 3페이지)으로 이동
      flatListRef.current?.scrollToOffset({ offset: 3 * width, animated: false });
    } else if (index === 4) {
      // 4번(복제된 1페이지) -> 1번(진짜 1페이지)으로 이동
      flatListRef.current?.scrollToOffset({ offset: 1 * width, animated: false });
    }
  }

  const scrollToPage = (logicalPageIndex) => {
    if (logicalPageIndex === currentPage) return;
    // 논리 페이지를 실제 인덱스(1, 2, 3)로 변환하여 이동
    isManualScrolling.current = true;
    setCurrentPage(logicalPageIndex);
    flatListRef.current?.scrollToIndex({ index: logicalPageIndex + 1, animated: true });
  }

  // 개별 아이템 메모이제이션
  const WeatherBookmarkItem = memo(({ content, drag, isActive, isTab, maxFontSizeM, navigation, checkWeatherToken, removeWBookmark, setWeatherAddr, setWeatherLocation, isWidget }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const [visualActive, setVisualActive] = useState(false);

    // isActive 상태 변화에 따른 애니메이션 및 시각적 상태 동기화
    useEffect(() => {
      setVisualActive(isActive);
      Animated.spring(scaleAnim, {
        toValue: isActive ? 1.05 : 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }, [isActive]);

    // 사용자가 터치를 시작할 때, 만약 isActive가 이미 true라면(stuck 상태) 시각적 효과를 강제 활성화
    const handlePressIn = useCallback(() => {
      if (isActive) {
        setVisualActive(true);
        Animated.spring(scaleAnim, {
          toValue: 1.05,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }).start();
      }
    }, [isActive]);

    // 손가락을 뗐을 때 모든 시각적 효과를 강제로 원래 크기로 복구하는 안전장치
    const handlePressOut = useCallback(() => {
      setVisualActive(false); // 배경색, 그림자 즉시 복구
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }, []);

    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }], zIndex: visualActive ? 999 : 1 }}>
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.itemContainer,
            {
              backgroundColor: visualActive ? '#f0f0f0' : 'white',
              elevation: visualActive ? 15 : 0,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: visualActive ? 8 : 0 },
              shadowOpacity: visualActive ? 0.35 : 0,
              shadowRadius: 10,
              borderColor: isWidget ? 'gray' : 'gray',
              borderWidth: isWidget ? 0.5 : 0.5,
            }
          ]}
          onLongPress={drag}
          delayLongPress={250}
          onPressIn={handlePressIn} // 터치 시작 시 상태 체크 및 강제 활성화
          onPressOut={handlePressOut} // 손을 떼는 순간 무조건 시각적 효과 해제
          onPress={async () => {
            if (isActive) return;
            checkWeatherToken(content)
            await Analytics.logEvent('Check_Weather_favorlist', {
              name: 'weather check',
              purpose: 'check weather in weather favorlist'
            })
          }}>
          <View style={{ flex: 1 }}>
            <View style={{ flex: 1, flexDirection: 'row', paddingVertical: 5 }}>
              <View style={{ flex: 20 }}>
                <Text maxFontSizeMultiplier={maxFontSizeM} style={{ paddingLeft: 10, fontSize: isTab ? 18 : 13, fontWeight: 'bold', color: '#333' }} ellipsizeMode='tail' numberOfLines={1}>
                  {isWidget && "📌 "}[{content.weatherTitle}]
                </Text>
                <Text maxFontSizeMultiplier={maxFontSizeM} style={{ paddingLeft: 10, fontSize: isTab ? 18 : 13, color: '#666' }} ellipsizeMode='tail' numberOfLines={1}>{content.weatherAddr}</Text>
              </View>
              <View style={{ flex: 3, alignSelf: 'center' }}>
                <TouchableOpacity hitSlop={{ top: 20, bottom: 20, left: 10, right: 10 }}
                  onPress={() => {
                    removeWBookmark(content.id)
                  }}>
                  <UiIcon name="icon_trash2" w={isTab ? 30 : 20} h={isTab ? 30 : 20} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ flex: 5, marginTop: 10 }} pointerEvents="none">
              <KorWeather navigation={navigation} gps={0} loc={content.weatherAddr} setWeatherAddr={setWeatherAddr} setLocation={setWeatherLocation} fcstType={0} isTab={isTab} />
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  });

  // 각 페이지(판넬)를 별도 컴포넌트로 분리하여 Hook 규칙 준수 및 최적화
  const WeatherBookmarkPage = memo(({
    dataIndex, pageBookmarks, currentLimit, isTab, maxFontSizeM, navigation,
    checkWeatherToken, removeWBookmark, onDragEnd, setShowSelectPlace, setAdLoading, bSlot, refresh, setRefresh, setWeatherAddr, setWeatherLocation
  }) => {

    const renderDragItem = useCallback(({ item, drag, isActive, index, getIndex }) => {
      // index가 undefined일 경우 getIndex()를 호출하여 확실하게 순서를 파악합니다.
      const actualIndex = index !== undefined ? index : getIndex();
      const isWidget = dataIndex === 0 && actualIndex === 0;

      return (
        <WeatherBookmarkItem
          content={item}
          drag={drag}
          isActive={isActive}
          isTab={isTab}
          maxFontSizeM={maxFontSizeM}
          navigation={navigation}
          checkWeatherToken={checkWeatherToken}
          removeWBookmark={removeWBookmark}
          setWeatherAddr={setWeatherAddr}
          setWeatherLocation={setWeatherLocation}
          isWidget={isWidget}
        />
      );
    }, [isTab, navigation, checkWeatherToken, removeWBookmark, setWeatherAddr, setWeatherLocation, dataIndex]);

    const renderFooter = useCallback(() => (
      pageBookmarks.length < currentLimit ? (
        <View style={styles.emptyContainer}>
          <TouchableOpacity onPress={() => setShowSelectPlace(true)}>
            <UiIcon name="icon_plus" w={isTab ? 50 : 40} h={isTab ? 50 : 40} />
            <Text maxFontSizeMultiplier={maxFontSizeM} style={[styles.title, { fontSize: isTab ? 18 : 14 }]}>여기를 눌러서 관심 지역을 추가하세요.{"\n"}길게 눌러 순서를 바꿀 수 있습니다.</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <TouchableOpacity onPress={() => {
            Alert.alert(
              "리워드 광고가 열립니다.",
              "광고를 보고 관심 지역 저장 공간을 1개 추가하시겠습니까?",
              [
                { text: "아니오" },
                {
                  text: "네!",
                  onPress: () => {
                    setAdLoading(true);
                    showRewardedAd(1, bSlot[dataIndex], dataIndex, () => {
                      setAdLoading(false);
                      setRefresh(!refresh);
                    }, () => {
                      setAdLoading(false);
                    });
                  }
                },
              ],
              { cancelable: false }
            )
          }}>
            <UiIcon name="icon_plus" w={isTab ? 50 : 40} h={isTab ? 50 : 40} />
            <Text maxFontSizeMultiplier={maxFontSizeM} style={[styles.title, { fontSize: isTab ? 18 : 14 }]}>광고를 보고 관심 지역 슬롯을 1개 추가하세요.</Text>
          </TouchableOpacity>
        </View>
      )
    ), [pageBookmarks.length, currentLimit, isTab, dataIndex, bSlot, refresh, setShowSelectPlace]);

    return (
      <View style={{ width: Dimensions.get('window').width, flex: 1 }}>
        <DraggableFlatList
          data={pageBookmarks}
          onDragEnd={onDragEnd}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderDragItem}
          ListFooterComponent={renderFooter}
          contentContainerStyle={{ paddingBottom: 100 }}
          activationDistance={20} // 수평 스크롤(페이지 전환) 제스처가 작동할 수 있도록 유격 추가
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  });
  // renderPageItem 또한 useCallback으로 감싸 최적화
  const renderPageItem = useCallback(({ item: pageBookmarks, index: dataIndex }) => {
    const currentLimit = (dataIndex === 0) ? (MAX_NUM + bSlot[0]) : (bSlot[dataIndex]);

    return (
      <WeatherBookmarkPage
        dataIndex={dataIndex}
        pageBookmarks={pageBookmarks}
        currentLimit={currentLimit}
        isTab={isTab}
        maxFontSizeM={maxFontSizeM}
        navigation={navigation}
        checkWeatherToken={checkWeatherToken}
        removeWBookmark={removeWBookmark}
        setWeatherAddr={setWeatherAddr}
        setWeatherLocation={setWeatherLocation}
        bSlot={bSlot}
        refresh={refresh}
        setRefresh={setRefresh}
        setAdLoading={setAdLoading}
        setShowSelectPlace={setShowSelectPlace}
        onDragEnd={({ data }) => {
          let newBookmarks = [...bookmark];
          newBookmarks[dataIndex] = data;
          setBookmark(newBookmarks);
          if (dataIndex === 0) {
            setTimeout(() => {
              updateWidgetManual();
            }, 500);
          }
        }}
      />
    );
  }, [bookmark, bSlot, isTab, navigation, refresh, removeWBookmark, checkWeatherToken, maxFontSizeM]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: 'white' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={[bookmark[2], bookmark[0], bookmark[1], bookmark[2], bookmark[0]]} // 원형 루프를 위한 데이터 구성 [P3, P1, P2, P3, P1]
          keyExtractor={(_, index) => `page-${index}`}
          renderItem={({ item, index }) => {
            const logicalIndex = (index - 1 + 3) % 3; // 실제 데이터 인덱스 매핑
            return renderPageItem({ item, index: logicalIndex });
          }}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          onMomentumScrollEnd={onMomentumScrollEnd}
          getItemLayout={(data, index) => ({
            length: Dimensions.get('window').width,
            offset: Dimensions.get('window').width * index,
            index,
          })}
        />

        {/* 하단 숫자 내비게이션 Footer 영역 */}
        <View style={styles.footerContainer}>
          {[0, 1, 2].map((i) => (
            <TouchableOpacity
              key={i}
              onPress={() => scrollToPage(i)}
              style={styles.paginationItem}
            >
              <Text style={[
                styles.pageNum,
                currentPage === i && styles.activePageNum
              ]}>
                {i + 1}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {
          showSelectPlace &&
          <SelectPlace
            navigation={navigation}
            setShowSelectPlace={setShowSelectPlace}
            onSelectPlace={(title, parcel) => addBookmark(title, parcel)}
          />
        }
        <AdLoadingModal visible={adLoading} />
      </SafeAreaView>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  itemContainer: {
    height: Dimensions.get("window").height * 0.22,
    marginHorizontal: 10,
    marginVertical: 10,
    borderWidth: 0.5,
    borderColor: 'gray',
    borderRadius: 15,
    justifyContent: 'center',
    //  paddingTop:80
  },
  emptyContainer: {
    height: Dimensions.get("window").height * 0.22,
    marginHorizontal: 10,
    marginVertical: 10,
    borderWidth: 0.5,
    borderColor: 'gray',
    borderRadius: 15,
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    // fontSize:14,
    fontWeight: '500',
    color: '#7f7f7f',
    marginTop: 10

  },
  footerContainer: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 10 : 0, // 아이폰 홈 바 대응
  },
  paginationItem: {
    width: 60,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageNum: {
    fontSize: 16,
    color: 'black',
    opacity: 0.3,
    fontWeight: '600',
  },
  activePageNum: {
    fontSize: 26,
    opacity: 1,
    color: 'black',
    fontWeight: 'bold',
  },
})
