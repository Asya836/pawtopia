import React, { useEffect, useState, useRef } from 'react';
import { View, Alert } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import AddAnimalPage from '../pages/AddAnimalPage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

export default function AddAnimalGuard() {
    const [user, setUser] = useState(auth.currentUser || null);
    const alertOpenRef = useRef(false);
    const navigation = useNavigation();

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
        });
        return unsub;
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            if (!user && !alertOpenRef.current) {
                alertOpenRef.current = true;
                Alert.alert(
                    'Giriş Gerekiyor',
                    'Bu işlemi gerçekleştirmek için giriş yapmalısınız. Giriş sayfasına gitmek ister misiniz?',
                    [
                        {
                            text: 'Vazgeç',
                            style: 'cancel',
                            onPress: () => {
                                alertOpenRef.current = false;
                                navigation.navigate('Ana Sayfa');
                            },
                        },
                        {
                            text: 'Giriş Yap',
                            onPress: () => {
                                alertOpenRef.current = false;
                                navigation.navigate('Profil');
                            },
                        },
                    ],
                    { cancelable: false }
                );
            }
            return () => {
                // reset alert flag when leaving screen so it can show next time if needed
                alertOpenRef.current = false;
            };
        }, [user, navigation])
    );

    if (user) {
        return <AddAnimalPage />;
    }

    return null;
}
