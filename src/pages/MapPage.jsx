import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as Location from 'expo-location'
import { useNavigation } from '@react-navigation/native'
import { WebView } from 'react-native-webview'
import { Ionicons } from '@expo/vector-icons'

export default function MapPage() {
    const navigation = useNavigation();
    const locationSubscriptionRef = useRef(null);

    const [currentLocation, setCurrentLocation] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [locationError, setLocationError] = useState('');

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
        } catch (error) {
            setLocationError('Konum alınırken bir hata oluştu.');
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

    const defaultRegion = {
        latitude: 41.0082,
        longitude: 28.9784,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
    };

    const activeRegion = currentLocation
        ? {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            latitudeDelta: 0.012,
            longitudeDelta: 0.012,
        }
        : defaultRegion;

    const mapUrl = useMemo(() => {
        const lat = activeRegion.latitude;
        const lon = activeRegion.longitude;
        const delta = 0.01;
        const left = lon - delta;
        const right = lon + delta;
        const top = lat + delta;
        const bottom = lat - delta;

        return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lon}`;
    }, [activeRegion.latitude, activeRegion.longitude]);

    return (
        <View style={styles.container}>
            <WebView
                key={`${activeRegion.latitude}-${activeRegion.longitude}`}
                style={styles.map}
                source={{ uri: mapUrl }}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
            />

            <Pressable style={styles.backButton} onPress={() => navigation.navigate('AnimalList')}>
                <Ionicons name="chevron-back" size={22} color="#1f2937" />
            </Pressable>

            <View style={styles.topInfoCard}>
                <Text style={styles.topInfoTitle}>Canlı Konum</Text>
                <Text style={styles.topInfoSubtitle}>Son bilinen konum haritada gösteriliyor</Text>
            </View>

            {isLoading && (
                <View style={styles.overlayBox}>
                    <ActivityIndicator size="small" color="#2563EB" />
                    <Text style={styles.overlayText}>Konum alınıyor...</Text>
                </View>
            )}

            {!isLoading && !currentLocation && !locationError && (
                <View style={styles.overlayBox}>
                    <Text style={styles.overlayText}>Konum bulunamadı</Text>
                </View>
            )}

            <Pressable style={styles.recenterButton} onPress={loadCurrentLocation}>
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