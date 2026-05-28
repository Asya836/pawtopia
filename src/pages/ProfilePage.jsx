import { StyleSheet, ScrollView, Image, Dimensions, View, Text, TouchableOpacity, Pressable, Modal, TextInput, Alert, Animated, ActivityIndicator } from 'react-native'
import React, { useRef, useState, useEffect, useCallback } from 'react'
import { getColor } from '../css/theme'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import * as FileSystem from 'expo-file-system'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase/config'
import { getUserProfile, updateUserProfile, createUserProfile, updateAuthEmail, updateAuthPassword, reauthenticateWithPassword, deleteUserAccount, getUserPets, getUserFavoritePets } from '../firebase/helpers'
import { signOut as firebaseSignOut } from '../firebase/helpers'

const { height: screenHeight } = Dimensions.get('window')

const animalsInfoRows = [
    { title: 'Eklediğim Hayvanlar', icon: require('../images/paw.png') },
    { title: 'Favori Hayvanlarım', iconName: 'heart', iconColor: '#e53935' },
    { title: 'Besleme Kayıtlarım', icon: require('../images/dataImages/food.png') },
    { title: 'Tedavi Kayıtlarım', icon: require('../images/dataImages/health.png') },
    { title: 'Konum Kayıtlarım', icon: require('../images/dataImages/map.png') },
]

const profileRecordsBySection = {
    'Eklediğim Hayvanlar': [
        { title: 'Karabaş', subtitle: 'Köpek • Beşiktaş', date: '28.03.2026' },
        { title: 'Pamuk', subtitle: 'Kedi • Kadıköy', date: '24.03.2026' },
    ],
    'Favori Hayvanlarım': [
        { title: 'Tarçın', subtitle: 'Kedi • Üsküdar', date: '27.03.2026' },
        { title: 'Leo', subtitle: 'Köpek • Şişli', date: '22.03.2026' },
    ],
    'Besleme Kayıtlarım': [
        { title: 'Karabaş', subtitle: 'Mama bırakıldı • Kuru mama + su', date: '26.03.2026 09:40' },
        { title: 'Pamuk', subtitle: 'Akşam beslemesi • Yaş mama', date: '25.03.2026 19:20' },
    ],
    'Tedavi Kayıtlarım': [
        { title: 'Karabaş', subtitle: 'Pati pansumanı • Temizlik ve bandaj', date: '21.03.2026' },
    ],
}

const formatRecordDate = (value) => {
    if (!value) return '—'

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return String(value)
    }

    return date.toLocaleDateString('tr-TR')
}

const buildAddedAnimalRecords = (pets = []) => {
    return pets.map((pet) => {
        const locationParts = [pet.city, pet.district, pet.neighborhood].filter(Boolean)
        const secondaryParts = [pet.type, pet.breed].filter(Boolean)

        return {
            title: pet.name || 'Hayvan adı yok',
            subtitle: [...secondaryParts, locationParts.join(' • ')].filter(Boolean).join(' • ') || 'Bilgi yok',
            date: `Eklenme: ${formatRecordDate(pet.createdAt)}`,
            pet,
        }
    })
}

const getRecordsForSection = (sectionTitle, pets = []) => {
    if (sectionTitle === 'Eklediğim Hayvanlar') {
        return buildAddedAnimalRecords(pets)
    }

    return profileRecordsBySection[sectionTitle] || []
}

export default function ProfilePage() {
    const navigation = useNavigation()
    const recordsDrawerTranslateX = useRef(new Animated.Value(420)).current

    const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false)
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false)
    const [isRecordsModalVisible, setIsRecordsModalVisible] = useState(false)
    const [selectedSectionTitle, setSelectedSectionTitle] = useState('')
    const [selectedSectionRecords, setSelectedSectionRecords] = useState([])

    const isFavoriteSection = selectedSectionTitle === 'Favori Hayvanlarım'
    const isAddedAnimalsSection = selectedSectionTitle === 'Eklediğim Hayvanlar'
    const isFeedingSection = selectedSectionTitle === 'Besleme Kayıtlarım'
    const isTreatmentSection = selectedSectionTitle === 'Tedavi Kayıtlarım'
    const isLocationSection = selectedSectionTitle === 'Konum Kayıtlarım'

    const [registrationInfo, setRegistrationInfo] = useState({
        fullName: 'İSİM SOYİSİM',
        username: 'kullaniciadi',
        email: '',
        birthDate: '',
        city: '',
        createdAt: '',
    })

    const [editableRegistrationInfo, setEditableRegistrationInfo] = useState({
        fullName: '',
        username: '',
        email: '',
        birthDate: '',
        city: '',
        password: '',
        confirmPassword: '',
    })

    const [profileImageUri, setProfileImageUri] = useState(null)
    const [addedPets, setAddedPets] = useState([])
    const [favoritePets, setFavoritePets] = useState([])

    const [deletePassword, setDeletePassword] = useState('')
    const [deleteError, setDeleteError] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)

    const openRecordsModal = (sectionTitle) => {
        setSelectedSectionTitle(sectionTitle)
        setSelectedSectionRecords(getRecordsForSection(sectionTitle, addedPets))
        setIsRecordsModalVisible(true)
        recordsDrawerTranslateX.setValue(420)
        Animated.timing(recordsDrawerTranslateX, {
            toValue: 0,
            duration: 260,
            useNativeDriver: true,
        }).start()
    }

    const openSettingsModal = () => setIsSettingsModalVisible(true)
    const closeSettingsModal = () => setIsSettingsModalVisible(false)

    const closeRecordsModal = () => {
        Animated.timing(recordsDrawerTranslateX, {
            toValue: 420,
            duration: 220,
            useNativeDriver: true,
        }).start(({ finished }) => {
            if (finished) {
                setIsRecordsModalVisible(false)
                setSelectedSectionTitle('')
            }
        })
    }

    const handleRegistrationFieldChange = (field, value) => {
        setEditableRegistrationInfo((prev) => ({
            ...prev,
            [field]: value,
        }))
    }

    const handleSaveProfileInfo = () => {
        const sanitizedData = {
            ...editableRegistrationInfo,
            fullName: editableRegistrationInfo.fullName.trim() || 'İSİM SOYİSİM',
            username: editableRegistrationInfo.username.trim() || 'kullaniciadi',
            email: editableRegistrationInfo.email.trim() || 'ornek@email.com',
            birthDate: editableRegistrationInfo.birthDate.trim() || 'GG/AA/YYYY',
            city: editableRegistrationInfo.city.trim() || 'Şehir',
            password: editableRegistrationInfo.password,
            confirmPassword: editableRegistrationInfo.confirmPassword,
        }

        if (
            sanitizedData.password &&
            sanitizedData.confirmPassword &&
            sanitizedData.password !== sanitizedData.confirmPassword
        ) {
            Alert.alert('Hata', 'Şifre ve şifre tekrarı aynı olmalı.')
            return
        }

        // persist to Auth (email/password) and Firestore for the current user
        const user = auth.currentUser
        if (!user) {
            setRegistrationInfo(sanitizedData)
            closeSettingsModal()
            Alert.alert('Uyarı', 'Kullanıcı oturumu bulunamadı. Değişiklikler yalnızca yerelde kaydedildi.')
            return
        }

        (async () => {
            try {
                let emailForProfileSave = sanitizedData.email
                let emailVerificationSent = false

                // 1) update auth email if changed
                if (sanitizedData.email && sanitizedData.email !== registrationInfo.email) {
                    try {
                        const emailUpdateResult = await updateAuthEmail(sanitizedData.email)
                        if (emailUpdateResult?.status === 'verification-required') {
                            emailForProfileSave = registrationInfo.email
                            emailVerificationSent = true
                        }
                    } catch (err) {
                        console.error('updateAuthEmail failed', err)
                        if (err && err.code === 'auth/requires-recent-login') {
                            Alert.alert('Oturum Yenileme Gerekli', 'E-posta güncellemesi için tekrar giriş yapmanız gerekiyor. Lütfen çıkış yapıp tekrar giriş yapın ve tekrar deneyin.')
                            return
                        } else {
                            Alert.alert('E-posta Güncelleme Hatası', err.message || 'E-posta güncellenemedi')
                            return
                        }
                    }
                }

                // 2) update auth password if provided
                if (sanitizedData.password) {
                    try {
                        await updateAuthPassword(sanitizedData.password)
                    } catch (err) {
                        console.error('updateAuthPassword failed', err)
                        if (err && err.code === 'auth/requires-recent-login') {
                            Alert.alert('Oturum Yenileme Gerekli', 'Şifre güncellemesi için tekrar giriş yapmanız gerekiyor. Lütfen çıkış yapıp tekrar giriş yapın ve tekrar deneyin.')
                            return
                        } else {
                            Alert.alert('Şifre Güncelleme Hatası', err.message || 'Şifre güncellenemedi')
                            return
                        }
                    }
                }

                // 3) update Firestore profile (exclude password fields)
                const profileToSave = {
                    fullName: sanitizedData.fullName,
                    username: sanitizedData.username,
                    email: emailForProfileSave,
                    birthDate: sanitizedData.birthDate,
                    city: sanitizedData.city,
                }

                await updateUserProfile(user.uid, profileToSave)

                // fetch fresh doc and update UI
                const fresh = await getUserProfile(user.uid)
                if (fresh) {
                    const mapped = {
                        fullName: fresh.fullName || 'İSİM SOYİSİM',
                        username: fresh.username || 'kullaniciadi',
                        email: fresh.email || 'ornek@email.com',
                        birthDate: fresh.birthDate || 'GG/AA/YYYY',
                        city: fresh.city || 'Şehir',
                        createdAt: fresh.createdAt || registrationInfo.createdAt || '',
                        password: '',
                        confirmPassword: '',
                    }
                    setRegistrationInfo(mapped)
                    setEditableRegistrationInfo((prev) => ({ ...mapped }))
                }

                closeSettingsModal()
                if (emailVerificationSent) {
                    Alert.alert('Doğrulama Gerekli', 'Yeni e-posta adresinize doğrulama bağlantısı gönderildi. Bağlantıyı onayladıktan sonra e-posta adresiniz güncellenecektir.')
                } else {
                    Alert.alert('Başarılı', 'Profil bilgileriniz kaydedildi.')
                }
            } catch (err) {
                console.error('save profile flow error', err)
                Alert.alert('Hata', err.message || 'Profil kaydedilemedi')
            }
        })()
    }

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            console.log('onAuthStateChanged -> user:', u && u.uid)
            if (u) {
                try {
                    let profile = await getUserProfile(u.uid)
                    if (!profile) {
                        // try to create a minimal profile so UI shows signup info if write rules allow it
                        const fallback = {
                            fullName: u.displayName || '',
                            username: (u.email && u.email.split('@')[0]) || 'kullaniciadi',
                            email: u.email || '',
                            birthDate: 'GG/AA/YYYY',
                            city: 'Şehir',
                            createdAt: new Date().toISOString(),
                        }
                        try {
                            await createUserProfile(u.uid, fallback)
                            profile = await getUserProfile(u.uid)
                        } catch (createErr) {
                            console.warn('Could not create fallback profile', createErr)
                            profile = fallback
                        }
                    }

                    if (profile) {
                        if (u.email && profile.email !== u.email) {
                            try {
                                await updateUserProfile(u.uid, { email: u.email })
                                profile = {
                                    ...profile,
                                    email: u.email,
                                }
                            } catch (syncErr) {
                                console.warn('profile email sync failed', syncErr)
                            }
                        }

                        const mapped = {
                            fullName: profile.fullName || 'İSİM SOYİSİM',
                            username: profile.username || 'kullaniciadi',
                            email: u.email || profile.email || 'ornek@email.com',
                            birthDate: profile.birthDate || 'GG/AA/YYYY',
                            city: profile.city || 'Şehir',
                            createdAt: profile.createdAt || (u && u.metadata && u.metadata.creationTime) || '',
                            password: '',
                            confirmPassword: '',
                        }
                        setRegistrationInfo(mapped)
                        // keep editable info separate but include createdAt (read-only)
                        setEditableRegistrationInfo((prev) => ({ ...mapped, password: '', confirmPassword: '' }))
                        setProfileImageUri(profile.photoURL || null)
                        // cache photoURL locally for persistence across sessions
                        try {
                            const cachePath = FileSystem.documentDirectory + `profile_${u.uid}.txt`
                            if (profile.photoURL) {
                                await FileSystem.writeAsStringAsync(cachePath, profile.photoURL)
                            } else {
                                // try to read cache; ignore errors
                                try {
                                    const cached = await FileSystem.readAsStringAsync(cachePath)
                                    if (cached) {
                                        setProfileImageUri(cached.startsWith('data:image') ? cached : `data:image/jpeg;base64,${cached}`)
                                    }
                                } catch (readErr) {
                                    // no cache or cannot read
                                }
                            }
                        } catch (fsErr) {
                            console.warn('photo cache read/write failed', fsErr)
                        }
                    }
                } catch (err) {
                    console.error('fetch profile error', err)
                }
            }
        })
        return unsub
    }, [])

    useFocusEffect(
        useCallback(() => {
            let active = true

            const loadSectionPets = async () => {
                const user = auth.currentUser
                if (!user) {
                    if (active) {
                        setAddedPets([])
                        setFavoritePets([])
                    }
                    return
                }

                try {
                    const [pets, favorites] = await Promise.all([
                        getUserPets(user.uid),
                        getUserFavoritePets(user.uid),
                    ])
                    if (active) {
                        setAddedPets(pets)
                        setFavoritePets(favorites)
                    }
                } catch (error) {
                    if (active) {
                        setAddedPets([])
                        setFavoritePets([])
                    }
                }
            }

            loadSectionPets()

            return () => {
                active = false
            }
        }, [])
    )

    useEffect(() => {
        if (!isRecordsModalVisible || !selectedSectionTitle) return

        setSelectedSectionRecords(getRecordsForSection(selectedSectionTitle, addedPets))
    }, [addedPets, isRecordsModalVisible, selectedSectionTitle])

    const handlePickProfileImage = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync()

        if (!permissionResult.granted) {
            Alert.alert('İzin Gerekli', 'Profil resmi seçmek için galeri izni vermelisin.')
            return
        }

        const imageResult = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.6,
            base64: true,
        })

        if (!imageResult.canceled && imageResult.assets?.length) {
            const originalUri = imageResult.assets[0].uri
            const base64 = imageResult.assets[0].base64
            let uri = originalUri
            try {
                const manipulated = await ImageManipulator.manipulateAsync(
                    originalUri,
                    [{ resize: { width: 1024 } }],
                    {
                        compress: 0.65,
                        format: ImageManipulator.SaveFormat.JPEG,
                    }
                )
                uri = manipulated.uri
                console.log('profile image compressed', {
                    originalUri,
                    compressedUri: uri,
                    width: manipulated.width,
                    height: manipulated.height,
                })
            } catch (manipErr) {
                console.warn('profile image compression failed, using original', manipErr)
            }
            console.log('profile image selected, uid=', auth.currentUser && auth.currentUser.uid, 'uri=', uri)
            // optimistic UI: prefer base64 data URI so it renders immediately and persists locally
            if (base64) {
                setProfileImageUri(`data:image/jpeg;base64,${base64}`)
            } else {
                setProfileImageUri(uri)
            }

            // save a local copy and persist the local URI in Firestore
            const user = auth.currentUser
            if (!user) {
                Alert.alert('Hata', 'Kullanıcı oturumu bulunamadı.')
                return
            }
            try {
                const cacheUri = FileSystem.documentDirectory + `profile_${user.uid}.txt`
                try {
                    if (base64) {
                        await FileSystem.writeAsStringAsync(cacheUri, base64)
                        console.log('profile image base64 cached', cacheUri)
                    } else {
                        await FileSystem.writeAsStringAsync(cacheUri, uri)
                        console.log('profile image uri cached', cacheUri)
                    }
                } catch (copyErr) {
                    console.warn('profile image cache save failed, using picked uri directly', copyErr)
                }

                const persistedUri = base64 ? `data:image/jpeg;base64,${base64}` : uri
                await updateUserProfile(user.uid, { photoURL: persistedUri })
                console.log('updateUserProfile(photoURL) called for uid=', user.uid)

                // verify write succeeded by fetching the profile back
                const after = await getUserProfile(user.uid).catch(() => null)
                console.log('post-update getUserProfile ->', after)
                const finalUri = after && after.photoURL ? after.photoURL : persistedUri
                setProfileImageUri(finalUri)
                Alert.alert('Başarılı', 'Profil resmi kaydedildi.')
            } catch (err) {
                console.error('profile image upload error', err)
                Alert.alert('Hata', 'Profil resmi yüklenemedi. Lütfen tekrar deneyin.')
                // revert optimistic UI if needed
                const fresh = await getUserProfile(user.uid).catch(() => null)
                setProfileImageUri(fresh && fresh.photoURL ? fresh.photoURL : null)
            }
        }
    }

    const handleRemoveProfileImage = () => {
        Alert.alert('Resmi Kaldır', 'Profil resmini kaldırmak istediğine emin misin?', [
            { text: 'Vazgeç', style: 'cancel' },
            {
                text: 'Kaldır',
                style: 'destructive',
                onPress: async () => {
                    const user = auth.currentUser
                    if (!user) return
                    try {
                        await updateUserProfile(user.uid, { photoURL: '' })
                        setProfileImageUri(null)
                        Alert.alert('Başarılı', 'Profil resmi kaldırıldı.')
                    } catch (err) {
                        console.error('remove profile image error', err)
                        Alert.alert('Hata', 'Profil resmi kaldırılamadı')
                    }
                }
            }
        ])
    }

    const handleLogout = () => {
        Alert.alert('Çıkış Yap', 'Çıkış yapmak istediğine emin misin?', [
            { text: 'Vazgeç', style: 'cancel' },
            {
                text: 'Çıkış Yap',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await firebaseSignOut();
                        Alert.alert('Çıkış Yapıldı', 'Başarıyla çıkış yaptınız.');
                    } catch (err) {
                        console.error('sign out error', err);
                        Alert.alert('Hata', err.message || 'Çıkış yapılamadı');
                    }
                },
            },
        ])
    }

    const formatJoinDate = (raw) => {
        if (!raw) return '—'
        try {
            const d = new Date(raw)
            if (isNaN(d.getTime())) return raw
            const day = String(d.getDate()).padStart(2, '0')
            const month = String(d.getMonth() + 1).padStart(2, '0')
            const year = d.getFullYear()
            return `${day}.${month}.${year}`
        } catch (e) {
            return raw
        }
    }

    const handleDeleteAccount = () => {
        setDeleteError('')
        setDeletePassword('')
        setIsDeleteModalVisible(true)
    }

    const closeDeleteModal = () => {
        setIsDeleteModalVisible(false)
        setDeletePassword('')
        setDeleteError('')
    }

    const confirmDeleteAccount = async () => {
        const user = auth.currentUser
        if (!user) {
            Alert.alert('Hata', 'Kullanıcı oturumu bulunamadı.')
            return
        }

        const password = deletePassword.trim()
        if (!password) {
            setDeleteError('Lütfen hesabı silmek için mevcut şifreni gir.')
            return
        }

        setDeleteError('')
        setIsDeleting(true)
        try {
            await reauthenticateWithPassword(user.email || registrationInfo.email, password)
            await deleteUserAccount(user.uid)
            try {
                await firebaseSignOut()
            } catch (_) { }

            closeDeleteModal()
            setDeletePassword('')
            Alert.alert('Hesap Silindi', 'Hesabınız başarıyla silindi.')
            navigation.navigate('Ana Sayfa')
        } catch (err) {
            console.error('confirm delete error', err)
            if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
                setDeleteError('Şifre yanlış. Lütfen tekrar deneyin.')
            } else if (err?.code === 'auth/requires-recent-login') {
                setDeleteError('Bu işlem için oturumun yenilenmesi gerekiyor. Lütfen çıkış yapıp tekrar giriş yapın.')
            } else {
                setDeleteError(err.message || 'Hesap silinemedi')
            }
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <>
            <ScrollView contentContainerStyle={styles.container}>
                <View>
                    <Image
                        source={require('../images/profile-background.png')}
                        style={styles.headerImage}
                    />

                    <View style={styles.profileImageContainer}>
                        {profileImageUri ? (
                            <Image source={{ uri: profileImageUri }} style={styles.profileImage} />
                        ) : (
                            <Ionicons name='person' size={52} color={getColor('--light-one')} />
                        )}
                    </View>
                </View>
                <View style={styles.profileInfoContainer}>
                    <Text style={styles.profileName}>{registrationInfo.fullName}</Text>
                    <Text style={styles.profileUsername}>@{registrationInfo.username}</Text>
                    <Text style={styles.profileJoinDate}>Katılma Tarihi: {formatJoinDate(registrationInfo.createdAt)}</Text>
                </View>
                <View style={styles.animalsInfoContainer}>
                    {animalsInfoRows.map((item, index) => (
                        <View
                            key={item.title}
                            style={[
                                styles.animalsInfoBox,
                                index < animalsInfoRows.length - 1 && styles.animalsInfoDivider,
                            ]}
                        >
                            <View style={styles.animalsInfoLeftSide}>
                                {item.icon ? (
                                    <Image source={item.icon} style={styles.animalsInfoIcon} resizeMode='contain' />
                                ) : (
                                    <Ionicons
                                        name={item.iconName}
                                        size={20}
                                        color={item.iconColor || getColor('--dark-one')}
                                    />
                                )}
                                <Text style={styles.animalsInfoTitle}>{item.title}</Text>
                            </View>
                            <View style={styles.animalsInfoRightSide}>
                                <Text style={styles.animalsInfoCount}>
                                    {item.title === 'Eklediğim Hayvanlar'
                                        ? addedPets.length
                                        : item.title === 'Favori Hayvanlarım'
                                            ? favoritePets.length
                                            : (profileRecordsBySection[item.title] || []).length}
                                </Text>
                                <TouchableOpacity style={styles.rowArrowButton} onPress={() => openRecordsModal(item.title)}>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={20}
                                        color={getColor('--dark-one')}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>
                <View style={styles.settingsContainer}>
                    <Pressable style={styles.settingsButton} onPress={openSettingsModal}>
                        <Ionicons
                            name="settings-outline"
                            size={20}
                            color={getColor('--light-one')}
                        />
                        <Text style={styles.settingsButtonText}>Ayarlar</Text>
                    </Pressable>
                </View>
            </ScrollView>

            <Modal
                visible={isSettingsModalVisible}
                transparent
                animationType='slide'
                presentationStyle='overFullScreen'
                statusBarTranslucent
                onRequestClose={closeSettingsModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Ayarlar</Text>
                            <Pressable onPress={closeSettingsModal} style={styles.modalCloseButton}>
                                <Ionicons name='close' size={22} color={getColor('--dark-one')} />
                            </Pressable>
                        </View>

                        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                            <Text style={styles.modalSectionTitle}>Profil Resmi</Text>
                            <View style={styles.modalProfileImageSection}>
                                <View style={styles.modalProfileImagePreview}>
                                    {profileImageUri ? (
                                        <Image source={{ uri: profileImageUri }} style={styles.modalProfileImage} />
                                    ) : (
                                        <Ionicons name='person' size={34} color={getColor('--light-six')} />
                                    )}
                                </View>
                                <View style={styles.modalProfileImageActions}>
                                    <Pressable style={styles.modalImageActionButton} onPress={handlePickProfileImage}>
                                        <Text style={styles.modalImageActionText}>
                                            {profileImageUri ? 'Profil Resmini Düzenle' : 'Profil Resmi Ekle'}
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        style={[
                                            styles.modalImageActionButton,
                                            styles.modalImageRemoveButton,
                                            !profileImageUri && styles.modalImageRemoveButtonDisabled,
                                        ]}
                                        onPress={handleRemoveProfileImage}
                                        disabled={!profileImageUri}
                                    >
                                        <Text style={styles.modalImageRemoveText}>Resmi Kaldır</Text>
                                    </Pressable>
                                </View>
                            </View>

                            <Text style={styles.modalSectionTitle}>Kayıt Bilgilerini Düzenle</Text>

                            <TextInput
                                style={styles.modalInput}
                                value={editableRegistrationInfo.fullName}
                                onChangeText={(value) => handleRegistrationFieldChange('fullName', value)}
                                placeholder='Ad Soyad'
                                placeholderTextColor={getColor('--light-six')}
                            />
                            <TextInput
                                style={styles.modalInput}
                                value={editableRegistrationInfo.username}
                                onChangeText={(value) => handleRegistrationFieldChange('username', value)}
                                placeholder='Kullanıcı Adı'
                                placeholderTextColor={getColor('--light-six')}
                                autoCapitalize='none'
                            />
                            <TextInput
                                style={styles.modalInput}
                                value={editableRegistrationInfo.email}
                                onChangeText={(value) => handleRegistrationFieldChange('email', value)}
                                placeholder='E-posta'
                                placeholderTextColor={getColor('--light-six')}
                                keyboardType='email-address'
                                autoCapitalize='none'
                            />
                            <TextInput
                                style={styles.modalInput}
                                value={editableRegistrationInfo.birthDate}
                                onChangeText={(value) => handleRegistrationFieldChange('birthDate', value)}
                                placeholder='Doğum Tarihi (GG/AA/YYYY)'
                                placeholderTextColor={getColor('--light-six')}
                            />
                            <TextInput
                                style={styles.modalInput}
                                value={editableRegistrationInfo.city}
                                onChangeText={(value) => handleRegistrationFieldChange('city', value)}
                                placeholder='Şehir'
                                placeholderTextColor={getColor('--light-six')}
                            />
                            <TextInput
                                style={styles.modalInput}
                                value={editableRegistrationInfo.password}
                                onChangeText={(value) => handleRegistrationFieldChange('password', value)}
                                placeholder='Şifre'
                                placeholderTextColor={getColor('--light-six')}
                                secureTextEntry
                            />
                            <TextInput
                                style={styles.modalInput}
                                value={editableRegistrationInfo.confirmPassword}
                                onChangeText={(value) => handleRegistrationFieldChange('confirmPassword', value)}
                                placeholder='Şifre Tekrar'
                                placeholderTextColor={getColor('--light-six')}
                                secureTextEntry
                            />

                            <Pressable style={styles.modalPrimaryButton} onPress={handleSaveProfileInfo}>
                                <Text style={styles.modalPrimaryButtonText}>Bilgileri Kaydet</Text>
                            </Pressable>

                            <Pressable style={styles.modalSecondaryButton} onPress={handleLogout}>
                                <Text style={styles.modalSecondaryButtonText}>Çıkış Yap</Text>
                            </Pressable>

                            <Pressable style={styles.modalDangerButton} onPress={handleDeleteAccount}>
                                <Text style={styles.modalDangerButtonText}>Hesabı Sil</Text>
                            </Pressable>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={isDeleteModalVisible}
                transparent
                animationType='fade'
                statusBarTranslucent
                onRequestClose={closeDeleteModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, styles.deleteModalCard]}>
                        <Text style={styles.deleteModalTitle}>Hesabı Sil</Text>
                        <Text style={styles.deleteModalSubtitle}>Bu işlem geri alınamaz. Devam etmek için mevcut şifreni girmen gerekiyor.</Text>

                        <TextInput
                            style={styles.deleteModalInput}
                            value={deletePassword}
                            onChangeText={(value) => {
                                setDeletePassword(value)
                                if (deleteError) {
                                    setDeleteError('')
                                }
                            }}
                            placeholder='Mevcut şifren'
                            placeholderTextColor={getColor('--light-six')}
                            secureTextEntry
                            autoCapitalize='none'
                        />

                        {!!deleteError && <Text style={styles.deleteErrorText}>{deleteError}</Text>}

                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                            <Pressable
                                style={styles.deleteModalCancelButton}
                                onPress={closeDeleteModal}
                                disabled={isDeleting}
                            >
                                <Text style={styles.deleteModalCancelText}>Vazgeç</Text>
                            </Pressable>

                            <Pressable
                                style={styles.deleteModalDangerButton}
                                onPress={confirmDeleteAccount}
                                disabled={isDeleting || !deletePassword.trim()}
                            >
                                {isDeleting ? <ActivityIndicator color='#fff' /> : <Text style={styles.deleteModalDangerText}>Hesabı Sil</Text>}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={isRecordsModalVisible}
                transparent
                animationType='fade'
                statusBarTranslucent
                onRequestClose={closeRecordsModal}
            >
                <View style={styles.recordsOverlay}>
                    <Pressable style={styles.recordsBackdrop} onPress={closeRecordsModal} />
                    <Animated.View
                        style={[
                            styles.recordsDrawer,
                            { transform: [{ translateX: recordsDrawerTranslateX }] },
                        ]}
                    >
                        <View style={styles.recordsDrawerHeader}>
                            <View>
                                <Text style={styles.recordsDrawerTitle}>{selectedSectionTitle || 'Kayıtlar'}</Text>
                                <Text style={styles.recordsDrawerSubtitle}>{selectedSectionRecords.length} kayıt bulundu</Text>
                            </View>
                            <Pressable style={styles.recordsDrawerCloseButton} onPress={closeRecordsModal}>
                                <Ionicons name='close' size={20} color={getColor('--dark-one')} />
                            </Pressable>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.recordsListContent}>
                            {selectedSectionRecords.length > 0 ? (
                                selectedSectionRecords.map((record, index) => (
                                    <View key={`${selectedSectionTitle}-${index}`} style={styles.recordCard}>
                                        {isLocationSection ? (
                                            <>
                                                <Pressable
                                                    onPress={() => {
                                                        closeRecordsModal()
                                                        navigation.navigate('AnimalDetail')
                                                    }}
                                                >
                                                    <Text style={[styles.recordCardTitle, styles.recordCardLink]}>{record.animal}</Text>
                                                </Pressable>
                                                <View style={styles.locationInfoRow}>
                                                    <Ionicons name='location' size={14} color='#2563eb' />
                                                    <Text style={styles.locationInfoText}>{record.location}</Text>
                                                </View>
                                                <Text style={styles.recordCardDate}>Güncellenme: {record.updatedAt}</Text>
                                            </>
                                        ) : (
                                            <>
                                                {(isFavoriteSection || isAddedAnimalsSection || isFeedingSection || isTreatmentSection) ? (
                                                    <Pressable
                                                        onPress={() => {
                                                            closeRecordsModal()
                                                            navigation.navigate('AnimalDetail', record.pet ? { pet: record.pet } : undefined)
                                                        }}
                                                    >
                                                        <Text style={[styles.recordCardTitle, styles.recordCardLink]}>{record.title}</Text>
                                                    </Pressable>
                                                ) : (
                                                    <Text style={styles.recordCardTitle}>{record.title}</Text>
                                                )}
                                                <Text style={styles.recordCardSubtitle}>{record.subtitle}</Text>
                                                <Text style={styles.recordCardDate}>{record.date}</Text>
                                            </>
                                        )}
                                    </View>
                                ))
                            ) : (
                                <View style={styles.recordEmptyBox}>
                                    <Ionicons name='document-text-outline' size={28} color={getColor('--light-six')} />
                                    <Text style={styles.recordEmptyText}>Bu alanda henüz kayıt yok.</Text>
                                </View>
                            )}
                        </ScrollView>
                    </Animated.View>
                </View>
            </Modal>
        </>
    )
}

const styles = StyleSheet.create({
    container: {
        paddingTop: 0,
        backgroundColor: getColor('--light-one'),
    },
    headerImage: {
        width: '100%',
        height: screenHeight * 0.25,
        resizeMode: 'cover',
    },

    profileImageContainer: {
        position: 'absolute',
        top: (screenHeight * 0.25 - 120) / 2,
        left: '50%',
        transform: [{ translateX: -60 }],
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'black',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    profileImage: {
        width: '100%',
        height: '100%',
    },
    profileInfoContainer: {
        marginTop: 19,
        alignItems: 'center',
        gap: 8,
    },
    profileName: {
        fontSize: 25,
        fontWeight: '700',
    },
    profileUsername: {
        fontSize: 16,
        color: 'gray',
    },
    profileJoinDate: {
        fontSize: 16,
        color: 'gray',
    },
    animalsInfoContainer: {
        marginTop: 16,
        flexDirection: 'column',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        width: '90%',
        alignSelf: 'center',
    },
    animalsInfoBox: {
        width: '100%',
        padding: 16,
        borderRadius: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    animalsInfoDivider: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: getColor('--light-six'),
    },
    animalsInfoRightSide: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    animalsInfoLeftSide: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    animalsInfoIcon: {
        width: 22,
        height: 22,
    },
    animalsInfoTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    animalsInfoCount: {
        fontSize: 14,
        color: 'gray',
    },
    rowArrowButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: getColor('--light-four'),
    },
    recordsOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.28)',
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    recordsBackdrop: {
        flex: 1,
    },
    recordsDrawer: {
        width: '84%',
        backgroundColor: '#ffffff',
        paddingTop: 42,
        paddingHorizontal: 16,
        paddingBottom: 20,
        borderTopLeftRadius: 24,
        borderBottomLeftRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: -2, height: 0 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 8,
    },
    recordsDrawerHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    recordsDrawerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1f2937',
    },
    recordsDrawerSubtitle: {
        marginTop: 4,
        fontSize: 13,
        color: '#6b7280',
    },
    recordsDrawerCloseButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6',
    },
    recordsListContent: {
        paddingBottom: 24,
        gap: 10,
    },
    recordCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    recordCardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
    recordCardLink: {
        color: '#2563eb',
        textDecorationLine: 'underline',
    },
    recordCardSubtitle: {
        marginTop: 4,
        fontSize: 13,
        color: '#4b5563',
    },
    recordCardDate: {
        marginTop: 7,
        fontSize: 12,
        color: '#6b7280',
    },
    locationInfoRow: {
        marginTop: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    locationInfoText: {
        flex: 1,
        fontSize: 13,
        color: '#1f2937',
        fontWeight: '500',
    },
    recordEmptyBox: {
        marginTop: 30,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    recordEmptyText: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
    },
    settingsContainer: {
        marginTop: 32,
        alignItems: 'center',
    },
    settingsButton: {
        width: '90%',
        padding: 14,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: getColor('--light-six'),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#787777',
    },
    settingsButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: getColor('--light-one'),
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'center',
    },
    modalCard: {
        flex: 1,
        backgroundColor: getColor('--light-one'),
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        padding: 20,
        paddingTop: 60,
        width: '100%',
        height: '100%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: getColor('--dark-one'),
    },
    modalCloseButton: {
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalSectionTitle: {
        marginTop: 6,
        marginBottom: 8,
        fontSize: 15,
        fontWeight: '600',
        color: getColor('--dark-one'),
    },
    modalContent: {
        marginTop: 8,
    },
    modalProfileImageSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
    },
    modalProfileImagePreview: {
        width: 70,
        height: 70,
        borderRadius: 35,
        borderWidth: 1,
        borderColor: getColor('--light-six'),
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    modalProfileImage: {
        width: '100%',
        height: '100%',
    },
    modalProfileImageActions: {
        flex: 1,
        gap: 8,
    },
    modalImageActionButton: {
        paddingVertical: 9,
        paddingHorizontal: 10,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: getColor('--light-six'),
        backgroundColor: '#fff',
    },
    modalImageActionText: {
        fontSize: 13,
        fontWeight: '600',
        color: getColor('--dark-one'),
        textAlign: 'center',
    },
    modalImageRemoveButton: {
        backgroundColor: getColor('--light-two'),
    },
    modalImageRemoveButtonDisabled: {
        opacity: 0.45,
    },
    modalImageRemoveText: {
        fontSize: 13,
        fontWeight: '600',
        color: getColor('--dark-one'),
        textAlign: 'center',
    },
    modalInput: {
        borderWidth: 1,
        borderColor: getColor('--light-six'),
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 8,
        fontSize: 15,
        color: getColor('--dark-one'),
        backgroundColor: '#fff',
    },
    modalPrimaryButton: {
        marginTop: 4,
        backgroundColor: getColor('--light-five'),
        borderRadius: 10,
        paddingVertical: 12,
        alignItems: 'center',
    },
    modalPrimaryButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: getColor('--light-one'),
    },
    modalSecondaryButton: {
        marginTop: 10,
        borderRadius: 10,
        paddingVertical: 12,
        alignItems: 'center',
        backgroundColor: getColor('--light-four'),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: getColor('--light-six'),
    },
    modalSecondaryButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: getColor('--dark-one'),
    },
    modalDangerButton: {
        marginTop: 10,
        marginBottom: 40,
        borderRadius: 10,
        paddingVertical: 12,
        alignItems: 'center',
        backgroundColor: '#d9534f',
    },
    modalDangerButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#fff',
    },

    /* Delete modal compact styles */
    deleteModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    deleteModalCard: {
        width: '94%',
        maxWidth: 420,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 10,
    },
    deleteModalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
    },
    deleteModalSubtitle: {
        marginTop: 6,
        color: '#374151',
        fontSize: 13,
    },
    deleteModalInput: {
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#fff',
        fontSize: 14,
    },
    deleteErrorText: {
        marginTop: 8,
        color: '#B91C1C',
        fontSize: 13,
    },
    deleteModalCancelButton: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: '#fff',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#D1D5DB',
    },
    deleteModalCancelText: {
        color: '#111827',
        fontWeight: '600',
    },
    deleteModalDangerButton: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: '#d9534f',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteModalDangerText: {
        color: '#fff',
        fontWeight: '700',
    },


})