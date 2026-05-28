import { StyleSheet, Text, View, Image, Pressable } from 'react-native'
import React from 'react'
import { useNavigation } from '@react-navigation/native'
import { getColor } from '../css/theme'

export default function NearbyAnimalsCard({ pet }) {
    const navigation = useNavigation()

    const animalName = pet?.name || 'Hayvan'
    const animalType = pet?.type || 'Tür'
    const imageUri = pet?.imageUrl || pet?.imageUri || null

    const handleOpenDetail = () => {
        if (!pet) return
        navigation.navigate('AnimalDetail', { pet })
    }

    return (
        <View>
            <View style={styles.mainContainer}>
                <View style={styles.imageWrap}>
                    {imageUri ? (
                        <Image source={{ uri: imageUri }} style={styles.image} />
                    ) : (
                        <View style={styles.imageFallback}>
                            <Text style={styles.imageFallbackText}>🐾</Text>
                        </View>
                    )}
                </View>
                <View style={styles.textBlock}>
                    <Text style={styles.nameText} numberOfLines={1}>{animalName}</Text>
                    <Text style={styles.typeText} numberOfLines={1}>{animalType}</Text>
                </View>
                <Pressable
                    style={({ pressed }) => [
                        styles.detailButton,
                        pressed && styles.detailButtonPressed,
                        !pet && styles.detailButtonDisabled,
                    ]}
                    onPress={handleOpenDetail}
                    disabled={!pet}
                >
                    <Text style={styles.detailButtonText}>{pet ? 'Detay' : 'Detay yok'}</Text>
                </Pressable>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    mainContainer: {
        width: 210,
        minHeight: 240,
        backgroundColor: 'white',
        borderRadius: 16,
        marginRight: 10,
        marginLeft: 2,
        marginBottom: 20,
        flexDirection: 'column',
        padding: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    }
    ,
    imageWrap: {
        width: '100%',
        height: 110,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: getColor('--light-three'),
        marginBottom: 10,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    imageFallback: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: getColor('--light-three'),
    },
    imageFallbackText: {
        fontSize: 28,
    },
    textBlock: {
        flex: 1,
        paddingHorizontal: 2,
        justifyContent: 'flex-start',
        marginBottom: 4,
    },
    nameText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    typeText: {
        fontSize: 14,
        color: getColor('--light-six'),
        marginTop: 3,
    },
    detailButton: {
        marginTop: 10,
        backgroundColor: getColor('--light-four'),
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10,
        alignSelf: 'stretch',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 2.5,
        elevation: 3,
    },
    detailButtonPressed: {
        transform: [{ scale: 0.98 }],
        opacity: 0.95,
    },
    detailButtonDisabled: {
        backgroundColor: '#cbd5e1',
        shadowOpacity: 0,
        elevation: 0,
    },
    detailButtonText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 15,
        textAlign: 'center',
    },
})