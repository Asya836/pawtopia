import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Image, ImageBackground, Pressable } from 'react-native'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native'
import { Asset } from 'expo-asset'
import * as Location from 'expo-location'
import * as FileSystem from 'expo-file-system/legacy'
import NearbyAnimals from '../components/nearbyAnimalsCard'
import { getColor } from '../css/theme'
import { getPets } from '../firebase/helpers'

const DEFAULT_DAILY_INFO = 'Uygulamamızda her gün yeni bir hayvan bilgisi paylaşarak, sokak hayvanları hakkında daha fazla bilgi edinmeni sağlıyoruz.'

const parseInformationText = (rawText) => rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\*\s*/, '').trim())
    .filter(Boolean)

const getDayOfYear = (date) => {
    const startOfYear = new Date(date.getFullYear(), 0, 0)
    const diff = date - startOfYear
    const oneDayMs = 1000 * 60 * 60 * 24
    return Math.floor(diff / oneDayMs)
}

const normalizeText = (value) => String(value || '').trim().toLocaleLowerCase('tr-TR')

const toRadians = (value) => (value * Math.PI) / 180

const getDistanceKm = (from, to) => {
    if (!from || !to) return null

    const earthRadiusKm = 6371
    const deltaLat = toRadians(to.latitude - from.latitude)
    const deltaLon = toRadians(to.longitude - from.longitude)
    const lat1 = toRadians(from.latitude)
    const lat2 = toRadians(to.latitude)

    const a =
        Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2) * Math.cos(lat1) * Math.cos(lat2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return earthRadiusKm * c
}

const getPetLocationLabel = (pet) => [pet?.city, pet?.district, pet?.neighborhood].filter(Boolean).join(' / ')

const getBestLocationLabel = (place) => {
    if (!place) return null

    const parts = [place.neighborhood, place.district, place.city].filter(Boolean)
    return parts.length ? parts.join(' / ') : null
}

export default function HomePage() {
    const navigation = useNavigation()
    const route = useRoute()
    const [flashVisible, setFlashVisible] = useState(false)
    const [flashText, setFlashText] = useState('')
    const [dailyInfo, setDailyInfo] = useState(DEFAULT_DAILY_INFO)
    const [pets, setPets] = useState([])
    const [currentLocation, setCurrentLocation] = useState(null)
    const [currentLocationLabel, setCurrentLocationLabel] = useState('Konum alınıyor...')
    const [isNearbyLoading, setIsNearbyLoading] = useState(true)

    const loadPets = useCallback(async () => {
        try {
            const items = await getPets()
            setPets(items)
        } catch (error) {
            console.warn('Yakın hayvanlar yüklenemedi:', error)
            setPets([])
        }
    }, [])

    const loadCurrentLocation = useCallback(async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync()
            if (status !== 'granted') {
                setCurrentLocation(null)
                setCurrentLocationLabel('Konum izni verilmedi')
                return
            }

            const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
            const coords = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
            }

            setCurrentLocation(coords)

            try {
                const geocodes = await Location.reverseGeocodeAsync(coords)
                const place = geocodes?.[0]
                const label = getBestLocationLabel({
                    city: place?.city,
                    district: place?.district || place?.subregion,
                    neighborhood: place?.subregion || place?.name,
                })
                setCurrentLocationLabel(label || 'Konum bilgisi alınamadı')
            } catch (error) {
                setCurrentLocationLabel('Konum bilgisi alınamadı')
            }
        } catch (error) {
            setCurrentLocation(null)
            setCurrentLocationLabel('Konum alınamadı')
        }
    }, [])

    useFocusEffect(
        useCallback(() => {
            let active = true

            const run = async () => {
                setIsNearbyLoading(true)
                await Promise.all([loadPets(), loadCurrentLocation()])
                if (active) {
                    setIsNearbyLoading(false)
                }
            }

            run()

            return () => {
                active = false
            }
        }, [loadPets, loadCurrentLocation])
    )

    const nearbyPets = useMemo(() => {
        const userLocation = currentLocation

        if (!userLocation) {
            return pets.slice(0, 6).map((pet) => ({
                ...pet,
                distanceKm: null,
                proximityScore: 0,
                locationLabel: getPetLocationLabel(pet),
            }))
        }

        return pets
            .map((pet) => {
                const petCoords = Number.isFinite(Number(pet?.latitude)) && Number.isFinite(Number(pet?.longitude))
                    ? { latitude: Number(pet.latitude), longitude: Number(pet.longitude) }
                    : null
                const distanceKm = userLocation && petCoords ? getDistanceKm(userLocation, petCoords) : null
                const sameNeighborhood = normalizeText(pet?.neighborhood) && normalizeText(pet?.neighborhood) === normalizeText(currentLocation?.neighborhood)
                const sameDistrict = normalizeText(pet?.district) && normalizeText(pet?.district) === normalizeText(currentLocation?.district)
                const sameCity = normalizeText(pet?.city) && normalizeText(pet?.city) === normalizeText(currentLocation?.city)

                let proximityScore = 0
                if (sameNeighborhood) proximityScore = 3
                else if (sameDistrict) proximityScore = 2
                else if (sameCity) proximityScore = 1

                if (distanceKm !== null) {
                    if (distanceKm <= 1) proximityScore = Math.max(proximityScore, 3)
                    else if (distanceKm <= 5) proximityScore = Math.max(proximityScore, 2)
                    else if (distanceKm <= 15) proximityScore = Math.max(proximityScore, 1)
                }

                return {
                    ...pet,
                    distanceKm,
                    proximityScore,
                    locationLabel: getPetLocationLabel(pet),
                }
            })
            .filter((pet) => pet.proximityScore > 0 || pet.distanceKm !== null)
            .sort((left, right) => {
                if (right.proximityScore !== left.proximityScore) {
                    return right.proximityScore - left.proximityScore
                }

                if (left.distanceKm !== null && right.distanceKm !== null) {
                    return left.distanceKm - right.distanceKm
                }

                return 0
            })
            .slice(0, 6)
    }, [pets, currentLocation])

    useEffect(() => {
        const flash = route.params && route.params.authFlash
        if (flash) {
            setFlashText(flash)
            setFlashVisible(true)
            // clear param so it doesn't show again
            navigation.setParams({ authFlash: undefined })
            setTimeout(() => setFlashVisible(false), 1200)
        }
    }, [route.params])

    useEffect(() => {
        let isMounted = true

        const loadDailyInfo = async () => {
            try {
                const assets = await Asset.loadAsync(require('../information.txt'))
                const infoAsset = assets[0]
                const assetUri = infoAsset.localUri || infoAsset.uri

                let fileText = ''

                if (assetUri?.startsWith('file://')) {
                    fileText = await FileSystem.readAsStringAsync(assetUri)
                } else {
                    const fileResponse = await fetch(assetUri)
                    fileText = await fileResponse.text()
                }

                const facts = parseInformationText(fileText)

                if (!facts.length) {
                    return
                }

                const dayIndex = (getDayOfYear(new Date()) - 1) % facts.length
                if (isMounted) {
                    setDailyInfo(facts[dayIndex])
                }
            } catch (error) {
                console.warn('Günlük bilgi yüklenemedi:', error)
                if (isMounted) {
                    setDailyInfo(DEFAULT_DAILY_INFO)
                }
            }
        }

        loadDailyInfo()

        return () => {
            isMounted = false
        }
    }, [])

    return (
        <ScrollView showsHorizontalScrollIndicator={false}>
            <View style={styles.topContainer}>
                <Image source={require('../../assets/logo2.png')} style={styles.logoImage} resizeMode='contain' />
            </View>
            {flashVisible ? (
                <View style={styles.flashBox} pointerEvents='none'>
                    <Text style={styles.flashText}>{flashText}</Text>
                </View>
            ) : null}
            <View style={styles.homeImageContainer}>
                <ImageBackground
                    source={require('../images/homeimage.png')}
                    style={styles.homeImage}
                    imageStyle={styles.homeImageStyle}
                    resizeMode='cover'
                >
                    <View style={styles.overlayContent}>
                        <Text style={styles.welcomeText}>HOŞ GELDİN</Text>
                        <Text style={styles.descriptionText}>Bu uygulama, sokak hayvanlarını daha yakından takip edebilmek ve onlara birlikte destek olabilmek için geliştirildi. Etrafındaki hayvanları keşfedebilir, besleme ve tedavi bilgilerini paylaşarak onların yaşamına küçük ama değerli katkılar sağlayabilirsin.</Text>
                    </View>
                </ImageBackground>

            </View>

            <View style={{ flexDirection: 'row', marginTop: 10, justifyContent: 'center', marginLeft: 10, marginRight: 5 }}>
                <View style={{ flexDirection: 'column', justifyContent: 'center', alignItems: 'center', marginRight: 7, backgroundColor: '#e6624b', padding: 10, borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 3.84, elevation: 5 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                        <Image source={require('../images/paw.png')} style={styles.statIcon} resizeMode='contain' />
                        <Text style={styles.countText}>150</Text>
                    </View>
                    <View>
                        <Text style={styles.labelText}>Hayvan</Text>
                    </View>

                </View>
                <View style={{ flexDirection: 'column', justifyContent: 'center', alignItems: 'center', marginRight: 7, backgroundColor: '#e4d825', padding: 10, borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 3.84, elevation: 5 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                        <Image source={require('../images/dataImages/food.png')} style={styles.statIcon} resizeMode='contain' />
                        <Text style={styles.countText}>200</Text>
                    </View>
                    <View>
                        <Text style={styles.labelText}>Besleme</Text>
                    </View>

                </View>
                <View style={{ flexDirection: 'column', justifyContent: 'center', alignItems: 'center', marginRight: 7, backgroundColor: '#69c53e', padding: 10, borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 3.84, elevation: 5 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                        <Image source={require('../images/dataImages/health.png')} style={styles.statIcon} resizeMode='contain' />
                        <Text style={styles.countText}>170</Text>
                    </View>
                    <View>
                        <Text style={styles.labelText}>Tedavi</Text>
                    </View>

                </View>
                <View style={{ flexDirection: 'column', justifyContent: 'center', alignItems: 'center', marginRight: 7, backgroundColor: '#5dabf9', padding: 10, borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 3.84, elevation: 5 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                        <Image source={require('../images/dataImages/map.png')} style={styles.statIcon} resizeMode='contain' />
                        <Text style={styles.countText}>220</Text>
                    </View>
                    <View>
                        <Text style={styles.labelText}>Konum</Text>
                    </View>

                </View>
            </View>
            <View style={{ justifyContent: 'center', alignItems: 'center', marginTop: 30 }}>
                <Pressable
                    style={({ pressed }) => [
                        styles.allAnimalsButton,
                        pressed && styles.allAnimalsButtonPressed,
                    ]}
                    onPress={() => navigation.navigate('AnimalList')}
                >
                    <Text style={styles.allAnimalsButtonText}>Tüm Hayvanları Görüntüle</Text>
                    <Text style={styles.allAnimalsButtonArrow}>➜</Text>
                </Pressable>
            </View>
            <View style={{ justifyContent: 'center', alignItems: 'center', marginTop: 30, padding: 10, borderRadius: 10, marginHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5, backgroundColor: 'white' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                    <Image source={require('../images/paw.png')} style={{ width: 30, height: 30, marginRight: 5 }} resizeMode='contain' />
                    <Text style={{ fontWeight: 'bold', fontSize: 18, marginHorizontal: 10 }}>Her Gün Yeni Bilgi!</Text>
                    <Image source={require('../images/paw.png')} style={{ width: 30, height: 30, marginLeft: 5 }} resizeMode='contain' />
                </View>

                <View style={{ width: '100%', height: 1, backgroundColor: getColor('--light-five'), marginVertical: 5 }} />
                <Text style={{ fontSize: 14, marginTop: 5, textAlign: 'center' }}>{dailyInfo}</Text>
            </View>
            <View style={{ marginTop: 30, flexDirection: 'column', marginBottom: 120, marginHorizontal: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Yakındaki Hayvanlar</Text>
                    <Pressable onPress={() => navigation.navigate('AnimalMap')} style={{ paddingHorizontal: 4, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: getColor('--light-six') }}>Haritada gör</Text>
                    </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                    {isNearbyLoading ? (
                        <View style={{ width: 210, minHeight: 240, justifyContent: 'center', alignItems: 'center' }}>
                            <ActivityIndicator size="small" color={getColor('--light-six')} />
                        </View>
                    ) : nearbyPets.length > 0 ? (
                        nearbyPets.map((pet) => (
                            <NearbyAnimals key={pet.id} pet={pet} />
                        ))
                    ) : (
                        <View style={{ width: 260, padding: 16 }}>
                            <Text style={{ color: getColor('--light-six'), fontSize: 14 }}>
                                Yakında eşleşen hayvan bulunamadı.
                            </Text>
                        </View>
                    )}
                </ScrollView>

            </View>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    topContainer: {
        marginTop: 0,
        backgroundColor: getColor('--light-three'),
        width: '100%',
        height: 110,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoImage: {
        marginTop: 25,
        width: '77%',
        height: '77%',
    },
    homeImageContainer: {
        width: '90%',
        alignItems: 'center',
        margin: 20
    },
    homeImage: {
        width: '100%',
        height: 250,
        borderRadius: 20,
        overflow: 'hidden'
    },
    homeImageStyle: {
        borderRadius: 20
    },
    overlayContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
        backgroundColor: 'rgba(0,0,0,0.25)'
    },
    welcomeText: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 20,
        marginBottom: 10,
        alignItems: 'center',
        color: 'white'
    },
    descriptionText: {
        fontSize: 16,
        textAlign: 'center',
        marginTop: 5,
        color: 'white'
    },
    flashBox: {
        position: 'absolute',
        top: 60,
        alignSelf: 'center',
        backgroundColor: 'rgba(34,197,94,0.95)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        zIndex: 50,
        elevation: 10,
    },
    flashText: {
        color: 'white',
        fontWeight: '700',
    },
    countText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: getColor('--light-one'),
    },
    labelText: {
        fontSize: 15,
        fontWeight: '600',
        color: getColor('--light-one'),
    },
    statIcon: {
        width: 30,
        height: 30,
        marginRight: 5,
    },
    allAnimalsButton: {
        width: '90%',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 14,
        backgroundColor: getColor('--light-four'),
        borderWidth: 1,
        borderColor: '#edb381',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
        elevation: 6,
    },
    allAnimalsButtonPressed: {
        transform: [{ scale: 0.98 }],
        elevation: 3,
        shadowOpacity: 0.2,
    },
    allAnimalsButtonText: {
        fontSize: 20,
        fontWeight: '700',
        color: getColor('--light-one'),
        letterSpacing: 0.2,
    },
    allAnimalsButtonArrow: {
        fontSize: 22,
        fontWeight: '700',
        color: getColor('--light-one'),
        marginLeft: 12,
    },
}
)