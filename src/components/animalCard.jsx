import { Pressable, StyleSheet, Text, View, Image } from 'react-native'
import React from 'react'
import { getColor } from '../css/theme';
import { useNavigation } from '@react-navigation/native';

export default function AnimalCard({ pet }) {
    const navigation = useNavigation();

    const animalName = pet?.name || 'Hayvan adı';
    const animalType = pet?.type || 'Türü';
    const locationLabel = pet?.locationLabel || [pet?.city, pet?.district, pet?.neighborhood].filter(Boolean).join(' • ') || 'Konum bilgisi yok';

    return (
        <View>
            <View style={{ width: '90%', minHeight: 130, backgroundColor: 'white', borderRadius: 10, marginBottom: 15, shadowColor: 'black', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5, alignSelf: 'center', flexDirection: 'row', padding: 10 }}>
                <View style={{ width: 110, height: 110, backgroundColor: '#f3f4f6', borderRadius: 10, marginRight: 20, overflow: 'hidden' }}>
                    {pet?.imageUrl ? (
                        <Image source={{ uri: pet.imageUrl }} style={{ width: '100%', height: '100%' }} />
                    ) : null}
                </View>
                <View style={{ flex: 1, justifyContent: 'space-between' }}>
                    <View>
                        <Text style={{ fontSize: 18, fontWeight: '700' }}>{animalName}</Text>
                        <Text style={{ fontSize: 13, color: getColor('--light-six'), marginTop: 4 }}>{locationLabel}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, color: getColor('--light-six') }}>{animalType}</Text>
                        <Pressable style={{ backgroundColor: getColor('--light-four'), paddingVertical: 5, paddingHorizontal: 15, borderRadius: 5, marginRight: 10 }} onPress={() => navigation.navigate('AnimalDetail', { pet })}>
                            <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Detay</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({})