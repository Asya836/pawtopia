import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomePage from '../pages/HomePage';
import AddAnimalPage from '../pages/AddAnimalPage';
import AddAnimalGuard from './AddAnimalGuard';
import LoginRegisterPage from '../pages/LoginRegisterPage';
import ProfileTab from './ProfileTab';
import AnimalListPage from '../pages/AnimalListPage';
import MapPage from '../pages/MapPage';
import AnimalDetailPage from '../pages/AnimalDetailPage';
import { getColor } from '../css/theme';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
    const [user, setUser] = useState(auth.currentUser || null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u));
        return unsub;
    }, []);
    const tabIcons = {
        'Ana Sayfa': {
            default: require('../images/navigationButtons/homeButton.png'),
        },
        Ekle: {
            default: require('../images/navigationButtons/addAnimalButton.png'),
        },
        Profil: {
            default: require('../images/navigationButtons/profileButton.png'),
        },
    };

    return (
        <NavigationContainer>
            <Tab.Navigator
                initialRouteName="Ana Sayfa"
                screenOptions={({ route }) => ({
                    headerShown: false,
                    tabBarHideOnKeyboard: true,
                    tabBarShowLabel: false,
                    tabBarStyle:
                        route.name === 'Profil' && !user
                            ? { display: 'none' }
                            : {
                                backgroundColor: getColor('--light-three'),
                                borderTopWidth: 0,
                                borderRadius: 30,
                                marginHorizontal: 16,
                                marginBottom: 35,
                                height: 65,
                                position: 'absolute',
                                paddingTop: 0,
                                paddingBottom: 0,
                            },
                    tabBarIcon: () => {
                        const iconSet = tabIcons[route.name];
                        const iconSource = iconSet ? iconSet.default : null;
                        const iconSize =
                            route.name === 'Ekle'
                                ? 90
                                : route.name === 'Profil'
                                    ? 50
                                    : 50;
                        const iconOffsetX =
                            route.name === 'Ana Sayfa'
                                ? 13
                                : route.name === 'Profil'
                                    ? -13
                                    : 0;

                        if (!iconSource) {
                            return null;
                        }

                        return (
                            <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                                <Image
                                    source={iconSource}
                                    style={{
                                        marginTop: 25,
                                        width: iconSize,
                                        height: iconSize,
                                        transform: [{ translateX: iconOffsetX }],
                                    }}
                                    resizeMode="contain"
                                />
                            </View>
                        );
                    },
                })}
            >
                <Tab.Screen name="Ana Sayfa" component={HomePage} />
                <Tab.Screen name="Ekle" component={AddAnimalGuard} />
                <Tab.Screen
                    name="Profil"
                    component={ProfileTab}
                />
                <Tab.Screen
                    name="AnimalList"
                    component={AnimalListPage}
                    options={{
                        tabBarButton: () => null,
                        tabBarItemStyle: { display: 'none' },
                    }}
                />
                <Tab.Screen
                    name="AnimalMap"
                    component={MapPage}
                    options={{
                        tabBarButton: () => null,
                        tabBarItemStyle: { display: 'none' },
                        tabBarStyle: { display: 'none' },
                    }}
                />
                <Tab.Screen
                    name="AnimalDetail"
                    component={AnimalDetailPage}
                    options={{
                        tabBarButton: () => null,
                        tabBarItemStyle: { display: 'none' },
                    }}
                />
            </Tab.Navigator>
        </NavigationContainer>
    );
}
