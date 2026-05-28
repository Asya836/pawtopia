import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Location from 'expo-location'
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import MapView, { Callout, Marker } from 'react-native-maps'
import { getPets } from '../firebase/helpers'

const DEFAULT_REGION = {
    latitude: 41.0082,
    longitude: 28.9784,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
}

const isValidCoordinate = (value) => {
    const numericValue = Number(value)
    return Number.isFinite(numericValue)
}

const toMarkerCoordinate = (pet) => {
    const latitude = Number(pet?.latitude)
    const longitude = Number(pet?.longitude)

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null
    }

    return { latitude, longitude }
}

const buildRegionFromCoordinates = (coordinates = [], fallbackRegion = DEFAULT_REGION) => {
    if (!coordinates.length) {
        return fallbackRegion
    }

    if (coordinates.length === 1) {
        return {
            latitude: coordinates[0].latitude,
            longitude: coordinates[0].longitude,
            latitudeDelta: 0.025,
            longitudeDelta: 0.025,
        }
    }

    const latitudes = coordinates.map((item) => item.latitude)
    const longitudes = coordinates.map((item) => item.longitude)
    const minLatitude = Math.min(...latitudes)
    const maxLatitude = Math.max(...latitudes)
    const minLongitude = Math.min(...longitudes)
    const maxLongitude = Math.max(...longitudes)

    const latitudeDelta = Math.max((maxLatitude - minLatitude) * 1.6, 0.03)
    const longitudeDelta = Math.max((maxLongitude - minLongitude) * 1.6, 0.03)

    return {
        latitude: (minLatitude + maxLatitude) / 2,
        longitude: (minLongitude + maxLongitude) / 2,
        latitudeDelta,
        longitudeDelta,
    }
}

const formatLastSeenLabel = (value) => {
    if (!value) return 'Son görülme bilgisi yok'

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return `Son görülme: ${value}`
    }

    return `Son görülme: ${date.toLocaleString('tr-TR')}`
}

export default function MapPage() {
    const navigation = useNavigation();
    const route = useRoute();
    const locationSubscriptionRef = useRef(null);
    const mapRef = useRef(null);
    const hasCenteredMapRef = useRef(false);

    const [currentLocation, setCurrentLocation] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [locationError, setLocationError] = useState('');
    const [pets, setPets] = useState([]);
    const [isPetsLoading, setIsPetsLoading] = useState(true);
    const [isMapReady, setIsMapReady] = useState(false);

    const ensureLocationPermission = async () => {
        const isServiceEnabled = await Location.hasServicesEnabledAsync();
        if (!isServiceEnabled) {
            setLocationError('Konum servisi kapalı. Lütfen GPS aç.');
            return false;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            setLocationError('Konum izni verilmedi. Ayarlardan izin vermelisin.');
            return false;
        }

        return true;
    };

    const loadPets = useCallback(async () => {
        try {
            setIsPetsLoading(true)
            const allPets = await getPets()
            setPets(allPets.filter((pet) => toMarkerCoordinate(pet)))
        } catch (error) {
            console.error('loadPets error', error)
            setPets([])
        } finally {
            setIsPetsLoading(false)
        }
    }, [])

    const loadCurrentLocation = async () => {
        try {
            setIsLoading(true);
            setLocationError('');

            const canAccessLocation = await ensureLocationPermission();
            if (!canAccessLocation) {
                return;
            }

            const lastKnown = await Location.getLastKnownPositionAsync();
            if (lastKnown?.coords) {
                setCurrentLocation({
                    latitude: lastKnown.coords.latitude,
                    longitude: lastKnown.coords.longitude,
                });
            }

            const initialPosition = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            const initialCoords = {
                latitude: initialPosition.coords.latitude,
                longitude: initialPosition.coords.longitude,
            };

            setCurrentLocation(initialCoords);
            return initialCoords;
        } catch (error) {
            setLocationError('Konum alınırken bir hata oluştu.');
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        let isMounted = true;

        const startLocationStream = async () => {
            try {
                setIsLoading(true);
                setLocationError('');

                const canAccessLocation = await ensureLocationPermission();
                if (!canAccessLocation) {
                    return;
                }

                const lastKnown = await Location.getLastKnownPositionAsync();
                if (isMounted && lastKnown?.coords) {
                    setCurrentLocation({
                        latitude: lastKnown.coords.latitude,
                        longitude: lastKnown.coords.longitude,
                    });
                }

                const initialPosition = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.High,
                });

                if (isMounted) {
                    setCurrentLocation({
                        latitude: initialPosition.coords.latitude,
                        longitude: initialPosition.coords.longitude,
                    });
                }

                locationSubscriptionRef.current = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.High,
                        distanceInterval: 5,
                        timeInterval: 3500,
                    },
                    (position) => {
                        if (!isMounted) return;
                        setCurrentLocation({
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                        });
                    }
                );
            } catch (error) {
                if (isMounted) {
                    setLocationError('Konum alınırken bir hata oluştu.');
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        startLocationStream();

        return () => {
            isMounted = false;
            if (locationSubscriptionRef.current) {
                locationSubscriptionRef.current.remove();
                locationSubscriptionRef.current = null;
            }
        };
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadPets()
        }, [loadPets])
    )

    useEffect(() => {
        if (!isMapReady || hasCenteredMapRef.current) {
            return
        }

        const markerCoordinates = pets
            .map(toMarkerCoordinate)
            .filter(Boolean)

        const nextRegion = buildRegionFromCoordinates(
            markerCoordinates.length > 0 ? markerCoordinates : currentLocation ? [currentLocation] : [],
            DEFAULT_REGION
        )

        mapRef.current?.animateToRegion(nextRegion, 500)
        hasCenteredMapRef.current = true
    }, [currentLocation, isMapReady, pets])

    useEffect(() => {
        // if navigation requested focus on a pet
        const focusCoords = route?.params?.focusCoords
        if (focusCoords && mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: focusCoords.latitude,
                longitude: focusCoords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            }, 600)
        }
    }, [route?.params, isMapReady])

    const petMarkers = useMemo(() => {
        return pets
            .map((pet) => {
                const coordinate = toMarkerCoordinate(pet)
                if (!coordinate) return null

                return {
                    ...pet,
                    coordinate,
                }
            })
            .filter(Boolean)
    }, [pets])

    const initialRegion = useMemo(() => {
        const markerCoordinates = petMarkers.map((pet) => pet.coordinate)

        if (markerCoordinates.length > 0) {
            return buildRegionFromCoordinates(markerCoordinates, DEFAULT_REGION)
        }

        if (currentLocation) {
            return {
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                latitudeDelta: 0.03,
                longitudeDelta: 0.03,
            }
        }

        return DEFAULT_REGION
    }, [currentLocation, petMarkers])

    const handleRecenterMap = async () => {
        const coords = await loadCurrentLocation()
        if (coords) {
            mapRef.current?.animateToRegion(
                {
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    latitudeDelta: 0.03,
                    longitudeDelta: 0.03,
                },
                500
            )
        }
    }

    const handleMapReady = async () => {
        setIsMapReady(true)
        if (hasCenteredMapRef.current) return

        const coords = await loadCurrentLocation()
        if (coords) {
            mapRef.current?.animateToRegion(
                {
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    latitudeDelta: 0.03,
                    longitudeDelta: 0.03,
                },
                500
            )
            hasCenteredMapRef.current = true
        }
    }

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={initialRegion}
                onMapReady={handleMapReady}
                showsUserLocation={false}
                showsMyLocationButton={false}
                showsCompass={false}
            >
                {petMarkers.map((pet) => {
                    const locationLabel = pet.locationLabel || [pet.city, pet.district, pet.neighborhood].filter(Boolean).join(' / ')

                    return (
                        <Marker
                            key={pet.id}
                            coordinate={pet.coordinate}
                            anchor={{ x: 0.5, y: 1 }}
                            onPress={() => navigation.navigate('AnimalDetail', { pet })}
                        >
                            <View style={styles.petMarkerContainer}>
                                <View style={styles.petMarkerCircle}>
                                    {pet.imageUrl ? (
                                        <Image source={{ uri: pet.imageUrl }} style={styles.petMarkerImage} resizeMode='cover' />
                                    ) : (
                                        <Ionicons name='paw' size={18} color='#fff' />
                                    )}
                                </View>
                                <View style={styles.petMarkerTail} />
                            </View>

                            <Callout tooltip onPress={() => navigation.navigate('AnimalDetail', { pet })}>
                                <View style={styles.calloutCard}>
                                    <Text style={styles.calloutTitle}>{pet.name || 'Hayvan'}</Text>
                                    <Text style={styles.calloutSubtitle}>{locationLabel || 'Konum bilgisi yok'}</Text>
                                    <Text style={styles.calloutMeta}>{formatLastSeenLabel(pet.lastSeenAt || pet.createdAt)}</Text>
                                    <Text style={styles.calloutLink}>Detaya git</Text>
                                </View>
                            </Callout>
                        </Marker>
                    )
                })}

                {currentLocation && (
                    <Marker coordinate={currentLocation} anchor={{ x: 0.5, y: 0.5 }}>
                        <View style={styles.currentLocationMarkerOuter}>
                            <View style={styles.currentLocationMarkerInner} />
                        </View>
                    </Marker>
                )}
            </MapView>

            <Pressable style={styles.backButton} onPress={() => navigation.navigate('AnimalList')}>
                <Ionicons name="chevron-back" size={22} color="#1f2937" />
            </Pressable>

            <View style={styles.topInfoCard}>
                <Text style={styles.topInfoTitle}>Hayvan Konumları</Text>
                <Text style={styles.topInfoSubtitle}>
                    {isPetsLoading ? 'Hayvan konumları yükleniyor...' : `${petMarkers.length} hayvanın güncel konumu gösteriliyor`}
                </Text>
            </View>

            {(isLoading || isPetsLoading) && (
                <View style={styles.overlayBox}>
                    <ActivityIndicator size="small" color="#2563EB" />
                    <Text style={styles.overlayText}>Harita hazırlanıyor...</Text>
                </View>
            )}

            {!isLoading && !isPetsLoading && petMarkers.length === 0 && !locationError && (
                <View style={styles.overlayBox}>
                    <Text style={styles.overlayText}>Konum eklenmiş hayvan bulunamadı</Text>
                </View>
            )}

            <Pressable style={styles.recenterButton} onPress={handleRecenterMap}>
                <Ionicons name="locate" size={20} color="#fff" />
            </Pressable>

            {!!locationError && (
                <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{locationError}</Text>
                    <Pressable style={styles.retryButton} onPress={loadCurrentLocation}>
                        <Text style={styles.retryButtonText}>Tekrar Dene</Text>
                    </Pressable>
                </View>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f3f0',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    petMarkerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    petMarkerCircle: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: '#ffffff',
        borderWidth: 3,
        borderColor: '#f97316',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
        elevation: 6,
    },
    petMarkerImage: {
        width: '100%',
        height: '100%',
        borderRadius: 9999,
    },
    petMarkerTail: {
        width: 0,
        height: 0,
        marginTop: -2,
        borderLeftWidth: 9,
        borderRightWidth: 9,
        borderTopWidth: 14,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#f97316',
    },
    currentLocationMarkerOuter: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(37, 99, 235, 0.24)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    currentLocationMarkerInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#2563EB',
    },
    calloutCard: {
        width: 180,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.16,
        shadowRadius: 10,
        elevation: 6,
    },
    calloutTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#111827',
    },
    calloutSubtitle: {
        marginTop: 4,
        fontSize: 12,
        color: '#4b5563',
    },
    calloutMeta: {
        marginTop: 4,
        fontSize: 11,
        color: '#6b7280',
    },
    calloutLink: {
        marginTop: 8,
        fontSize: 12,
        fontWeight: '700',
        color: '#2563EB',
    },
    backButton: {
        position: 'absolute',
        top: 54,
        left: 16,
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
        elevation: 6,
    },
    topInfoCard: {
        position: 'absolute',
        top: 54,
        left: 68,
        right: 16,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.94)',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
        elevation: 5,
    },
    topInfoTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    topInfoSubtitle: {
        marginTop: 2,
        fontSize: 12,
        color: '#4b5563',
    },
    overlayBox: {
        position: 'absolute',
        top: 116,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.95)',
        elevation: 4,
    },
    overlayText: {
        fontSize: 13,
        color: '#111827',
        fontWeight: '600',
    },
    recenterButton: {
        position: 'absolute',
        right: 16,
        bottom: 90,
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f766e',
        elevation: 6,
    },
    errorBox: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 24,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(185, 28, 28, 0.95)',
    },
    errorText: {
        color: 'white',
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 10,
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    retryButtonText: {
        color: 'white',
        fontSize: 13,
        fontWeight: '700',
    },
})
