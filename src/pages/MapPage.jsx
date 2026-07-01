import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Location from 'expo-location'
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import MapView, { Callout, Marker } from 'react-native-maps'
// real-time subscriptions used instead of one-time getPets
import { db } from '../firebase/config'
import { collection as fsCollection, onSnapshot as fsOnSnapshot, query as fsQuery, orderBy as fsOrderBy, limit as fsLimit } from 'firebase/firestore'


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

const PetMarker = React.memo(function PetMarker({ pet, onPress, styles, Ionicons }) {
    const locationLabel = pet.locationLabel || [pet.city, pet.district, pet.neighborhood].filter(Boolean).join(' / ')
    const [tracksViewChanges, setTracksViewChanges] = useState(Boolean(pet?.imageUrl))

    useEffect(() => {
        // when image URL changes, allow marker to update until image loads
        setTracksViewChanges(Boolean(pet?.imageUrl))
    }, [pet?.imageUrl])

    return (
        <Marker
            key={pet.id}
            coordinate={pet.coordinate}
            anchor={{ x: 0.5, y: 1 }}
            onPress={() => onPress && onPress(pet)}
            tracksViewChanges={tracksViewChanges}
        >
            <View style={styles.petMarkerContainer}>
                <View style={styles.petMarkerShadow}>
                    <View style={styles.petMarkerCircle}>
                        {pet.imageUrl ? (
                            <Image
                                source={{ uri: pet.imageUrl }}
                                style={styles.petMarkerImage}
                                resizeMode='cover'
                                onLoad={() => setTracksViewChanges(false)}
                                onError={() => setTracksViewChanges(false)}
                            />
                        ) : (
                            <Ionicons name='paw' size={18} color='#fff' />
                        )}
                    </View>
                </View>
                <View style={styles.petMarkerTail} />
            </View>

            <Callout tooltip onPress={() => onPress && onPress(pet)}>
                <View style={styles.calloutCard}>
                    <Text style={styles.calloutTitle}>{pet.name || 'Hayvan'}</Text>
                    <Text style={styles.calloutSubtitle}>{locationLabel || 'Konum bilgisi yok'}</Text>
                    <Text style={styles.calloutMeta}>{formatLastSeenLabel(pet.lastSeenAt || pet.createdAt)}</Text>
                    <Text style={styles.calloutLink}>Detaya git</Text>
                </View>
            </Callout>
        </Marker>
    )
}, (prevProps, nextProps) => {
    const a = prevProps.pet || {}
    const b = nextProps.pet || {}
    if (a.id !== b.id) return false
    const ca = a.coordinate || {}
    const cb = b.coordinate || {}
    if (ca.latitude !== cb.latitude || ca.longitude !== cb.longitude) return false
    if ((a.imageUrl || '') !== (b.imageUrl || '')) return false
    if ((a.name || '') !== (b.name || '')) return false
    if ((a.lastSeenAt || '') !== (b.lastSeenAt || '')) return false
    return true
})

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
    const [latestLocations, setLatestLocations] = useState({})
    const locationUnsubsRef = useRef({})

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
            setLocationError('Konum alınırken bir hata oluştu. ' + (error?.message || ''));
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
                    setLocationError('Konum alınırken bir hata oluştu. ' + (error?.message || ''));
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

    // subscribe to pets collection in realtime so map updates when locations change
    useEffect(() => {
        setIsPetsLoading(true)
        const col = fsCollection(db, 'pets')
        const unsub = fsOnSnapshot(col, (snap) => {
            try {
                const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
                setPets(all)
            } catch (err) {
                console.error('pets snapshot processing error', err)
                setPets([])
            } finally {
                setIsPetsLoading(false)
            }
        }, (err) => {
            console.error('pets snapshot error', err)
            setPets([])
            setIsPetsLoading(false)
        })

        return () => {
            try { unsub && unsub() } catch (e) { }
        }
    }, [])

    // subscribe to each pet's latest location document and store it in `latestLocations`
    useEffect(() => {
        const currentUnsubs = locationUnsubsRef.current || {}

        // add subscriptions for new pets
        pets.forEach((pet) => {
            if (!pet || !pet.id) return
            if (currentUnsubs[pet.id]) return // already subscribed

            try {
                const locCol = fsCollection(db, 'pets', pet.id, 'locations')
                const q = fsQuery(locCol, fsOrderBy('createdAt', 'desc'), fsLimit(1))
                const unsubLoc = fsOnSnapshot(q, (snap) => {
                    try {
                        const doc = snap.docs[0]
                        if (doc && doc.exists()) {
                            const data = { id: doc.id, ...doc.data() }
                            setLatestLocations((prev) => ({ ...prev, [pet.id]: data }))
                        } else {
                            setLatestLocations((prev) => {
                                const next = { ...prev }
                                delete next[pet.id]
                                return next
                            })
                        }
                    } catch (err) {
                        console.error('locations snapshot processing error for pet', pet.id, err)
                    }
                }, (err) => {
                    console.error('locations snapshot error for pet', pet.id, err)
                })

                currentUnsubs[pet.id] = unsubLoc
            } catch (err) {
                console.error('failed to subscribe to pet locations for', pet.id, err)
            }
        })

        // remove subscriptions for pets that no longer exist
        Object.keys(currentUnsubs).forEach((petId) => {
            if (!pets.find((p) => p.id === petId)) {
                try {
                    currentUnsubs[petId] && currentUnsubs[petId]()
                } catch (e) { }
                delete currentUnsubs[petId]
                setLatestLocations((prev) => {
                    const next = { ...prev }
                    delete next[petId]
                    return next
                })
            }
        })

        locationUnsubsRef.current = currentUnsubs

        return () => {
            // cleanup all
            try {
                Object.values(locationUnsubsRef.current || {}).forEach((u) => { try { u && u() } catch (e) { } })
            } catch (e) { }
            locationUnsubsRef.current = {}
        }
    }, [pets, latestLocations])

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

        // choose a zoom level based on region span (simple heuristic)
        const zoomForRegion = nextRegion.latitudeDelta <= 0.02 ? 16 : nextRegion.latitudeDelta <= 0.05 ? 14 : 12
        animateToCoordinates({ latitude: nextRegion.latitude, longitude: nextRegion.longitude }, zoomForRegion)
        hasCenteredMapRef.current = true
    }, [currentLocation, isMapReady, pets])

    useEffect(() => {
        // if navigation requested focus on a pet or explicit coords
        const focusCoords = route?.params?.focusCoords
        const focusPetId = route?.params?.focusPetId

        // helper to perform a faster / tighter zoom when user explicitly focuses
        const focusTo = (coords) => {
            // prefer a tighter zoom when jumping to a specific pet/location
            setTimeout(() => animateToCoordinates({ latitude: coords.latitude, longitude: coords.longitude }, 18, 0), 120)
        }

        if (focusCoords && mapRef.current) {
            focusTo(focusCoords)
            return
        }

        if (focusPetId && mapRef.current) {
            // prefer the latest location document (if subscribed)
            const latest = latestLocations[focusPetId]
            if (latest && Number.isFinite(Number(latest.latitude)) && Number.isFinite(Number(latest.longitude))) {
                focusTo({ latitude: Number(latest.latitude), longitude: Number(latest.longitude) })
                return
            }

            // fallback to pet document coordinates
            const pet = pets.find((p) => p.id === focusPetId)
            const petCoord = pet ? toMarkerCoordinate(pet) : null
            if (petCoord) {
                focusTo(petCoord)
                return
            }
        }
    }, [route?.params, isMapReady, latestLocations, pets])

    const petMarkers = useMemo(() => {
        return pets
            .map((pet) => {
                // prefer latest location document if available
                const latest = latestLocations[pet.id]
                if (latest && Number.isFinite(Number(latest.latitude)) && Number.isFinite(Number(latest.longitude))) {
                    return {
                        ...pet,
                        coordinate: { latitude: Number(latest.latitude), longitude: Number(latest.longitude) },
                        locationLabel: [latest.city, latest.district, latest.neighborhood].filter(Boolean).join(' / ') || pet.locationLabel,
                        lastSeenAt: latest.date || latest.createdAt || pet.lastSeenAt,
                    }
                }

                const coordinate = toMarkerCoordinate(pet)
                if (!coordinate) return null

                return {
                    ...pet,
                    coordinate,
                }
            })
            .filter(Boolean)
    }, [pets, latestLocations])

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
        // prefer already-known currentLocation to avoid extra permission prompts
        let coords = currentLocation
        if (!coords) {
            coords = await loadCurrentLocation()
        }

        if (!coords) {
            try {
                setLocationError('Konum alınamadı. Lütfen izinleri kontrol edin.')
            } catch (e) { }
            return
        }

        try {
            animateToCoordinates({ latitude: coords.latitude, longitude: coords.longitude }, 14)
        } catch (err) {
            console.warn('recenter animate error', err)
        }
    }

    const handleMapReady = async () => {
        setIsMapReady(true)
        if (hasCenteredMapRef.current) return

        const coords = await loadCurrentLocation()
        if (coords) {
            animateToCoordinates({ latitude: coords.latitude, longitude: coords.longitude }, 14)
            hasCenteredMapRef.current = true
        }
    }

    const animateToCoordinates = (coords, zoom, durationMs = 0) => {
        if (!mapRef.current || !coords) return
        try {
            // compute a latitudeDelta from a zoom-like parameter for cross-platform behavior
            const zoomLevel = typeof zoom === 'number' ? zoom : 14
            const delta = zoomLevel >= 17 ? 0.005 : zoomLevel >= 16 ? 0.01 : zoomLevel >= 14 ? 0.03 : 0.08

            // prefer animateToRegion which reliably changes visible span across providers
            if (typeof mapRef.current.animateToRegion === 'function') {
                mapRef.current.animateToRegion({ latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: delta, longitudeDelta: delta }, durationMs)
            } else if (typeof mapRef.current.animateCamera === 'function') {
                const camera = {
                    center: { latitude: coords.latitude, longitude: coords.longitude },
                    zoom: zoomLevel,
                    heading: 0,
                    pitch: 0,
                }
                mapRef.current.animateCamera(camera, { duration: durationMs })
            }
        } catch (err) {
            console.warn('animateToCoordinates error', err)
        }
    }

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={initialRegion}
                onMapReady={handleMapReady}
                showsUserLocation={true}
                showsMyLocationButton={false}
                showsCompass={false}
                zoomEnabled={true}
                scrollEnabled={true}
                pitchEnabled={true}
                rotateEnabled={true}
                zoomControlEnabled={true}
            >
                {petMarkers.map((pet) => (
                    <PetMarker
                        key={pet.id}
                        pet={pet}
                        styles={styles}
                        Ionicons={Ionicons}
                        onPress={(p) => navigation.navigate('AnimalDetail', { pet: p })}
                    />
                ))}

                {/* Native user location dot is shown via `showsUserLocation` */}
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
    },
    petMarkerImage: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    petMarkerShadow: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
        elevation: 6,
        borderRadius: 27,
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
