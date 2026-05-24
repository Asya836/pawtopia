import { StyleSheet, Text, View, Image, Pressable } from 'react-native'
import React from 'react'
import { useNavigation } from '@react-navigation/native'
import { getColor } from '../css/theme'

export default function NearbyAnimalsCard() {
    const navigation = useNavigation()

    return (
        <View>
            <View style={styles.mainContainer}>
                <View style={{ width: '100%', height: 90, backgroundColor: 'black', borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}>
                    <Image />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 20, marginTop: 15 }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold' }}>İsim</Text>
                    <Text style={{ fontSize: 14 }}>Tür</Text>
                </View>
                <Pressable style={{ backgroundColor: getColor('--light-six'), padding: 5, borderRadius: 20, marginTop: 15, alignSelf: 'center', width: '90%' }} onPress={() => navigation.navigate('AnimalDetail')}>
                    <Text style={{ color: 'white', fontSize: 17, textAlign: 'center' }}>Detay</Text>
                </Pressable>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    mainContainer: {
        width: 200,
        height: 190,
        backgroundColor: 'white',
        borderRadius: 10,
        marginRight: 5,
        marginLeft: 5,
        marginBottom: 20,
        flexDirection: 'column',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 5,
    }
})