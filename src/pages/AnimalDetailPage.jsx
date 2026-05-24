import { StyleSheet, Text, View, ScrollView, Pressable, Image, Modal, TextInput, Alert, ActivityIndicator, Animated } from 'react-native'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import { useRoute } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { getColor } from '../css/theme'
import * as Location from 'expo-location'
import * as ImagePicker from 'expo-image-picker'
import { auth } from '../firebase/config'
import { deletePet, getUserFavoritePetIds, getUserProfile, togglePetFavorite, updatePet, uploadImageFromUri } from '../firebase/helpers'

const createAnimalState = (pet) => ({
    id: pet?.id || null,
    imageUri: pet?.imageUrl || pet?.imageUri || null,
    imageBase64: '',
    name: pet?.name || 'Hayvanın İsmi',
    type: pet?.type || 'Köpek',
    breed: pet?.breed || 'Golden Retriever',
    gender: pet?.gender || 'Dişi',
    age: pet?.age !== undefined && pet?.age !== null ? String(pet.age) : '3',
    color: pet?.color || 'Sarı',
    note: pet?.note ?? '',
    city: pet?.city || '',
    district: pet?.district || '',
    neighborhood: pet?.neighborhood || '',
    lastSeenAtRaw: pet?.lastSeenAt || pet?.createdAt || null,
    createdAtRaw: pet?.createdAt || null,
    lastSeen: pet?.lastSeenAt ? new Date(pet.lastSeenAt).toLocaleString('tr-TR') : (pet?.createdAt ? new Date(pet.createdAt).toLocaleString('tr-TR') : '—'),
    addedBy: pet?.createdByName || '',
    addedByUsername: pet?.createdByUsername || '',
    addedAt: pet?.createdAt ? new Date(pet.createdAt).toLocaleString('tr-TR') : '—',
    ownerUid: pet?.createdByUid || null,
    ownerId: pet?.ownerId || pet?.createdByUid || null,
})


export default function AnimalDetailPage() {
    const navigation = useNavigation()
    const route = useRoute()
    const [isFavorite, setIsFavorite] = useState(false)
    const [isEditModalVisible, setIsEditModalVisible] = useState(false)
    const [isFeedModalVisible, setIsFeedModalVisible] = useState(false)
    const [isTreatmentModalVisible, setIsTreatmentModalVisible] = useState(false)
    const [isLocationModalVisible, setIsLocationModalVisible] = useState(false)
    const [isHistoryDrawerVisible, setIsHistoryDrawerVisible] = useState(false)
    const [historyDrawerType, setHistoryDrawerType] = useState('feed')
    const [isLocatingNow, setIsLocatingNow] = useState(false)
    const historyDrawerTranslateX = useRef(new Animated.Value(420)).current
    const [animalData, setAnimalData] = useState(() => createAnimalState(route.params?.pet))
    const [editForm, setEditForm] = useState(animalData)
    const [feedForm, setFeedForm] = useState({
        food: '',
        date: '',
        time: '',
        city: '',
        district: '',
        neighborhood: '',
        currentLocation: '',
        note: '',
    })
    const [treatmentForm, setTreatmentForm] = useState({
        treatmentType: '',
        date: '',
        time: '',
        city: '',
        district: '',
        neighborhood: '',
        currentLocation: '',
        note: '',
    })
    const [locationForm, setLocationForm] = useState({
        city: '',
        district: '',
        neighborhood: '',
        date: '',
        time: '',
        currentLocation: '',
    })

    const historyRecords = {
        feed: [
            {
                date: '28/03/2026',
                time: '09:30',
                city: 'İstanbul',
                district: 'Beşiktaş',
                neighborhood: 'Cihannuma',
                currentLocation: '41.04317, 29.00477',
                detail: 'Kuru mama ve temiz su bırakıldı.',
                addedBy: 'asya.yildiz',
            },
            {
                date: '27/03/2026',
                time: '18:10',
                city: 'İstanbul',
                district: 'Kadıköy',
                neighborhood: 'Moda',
                currentLocation: '40.98521, 29.02634',
                detail: 'Yaş mama verildi.',
                addedBy: 'mert.kaya',
            },
        ],
        treatment: [
            {
                date: '25/03/2026',
                time: '15:20',
                city: 'İstanbul',
                district: 'Şişli',
                neighborhood: 'Mecidiyeköy',
                currentLocation: '41.06701, 28.99221',
                detail: 'Pati pansumanı yapıldı, antiseptik uygulandı.',
                addedBy: 'derya.oz',
            },
            {
                date: '22/03/2026',
                time: '11:45',
                city: 'İstanbul',
                district: 'Üsküdar',
                neighborhood: 'Altunizade',
                currentLocation: '41.02248, 29.04830',
                detail: 'Parazit damlası uygulandı.',
                addedBy: 'can.arslan',
            },
        ],
        location: [
            {
                date: '28/03/2026',
                time: '13:40',
                city: 'İstanbul',
                district: 'Beşiktaş',
                neighborhood: 'Levazım',
                currentLocation: '41.07721, 29.01421',
                detail: 'Park girişine yakın noktada görüldü.',
                addedBy: 'selin.demir',
            },
            {
                date: '27/03/2026',
                time: '20:05',
                city: 'İstanbul',
                district: 'Kadıköy',
                neighborhood: 'Yeldeğirmeni',
                currentLocation: '40.99634, 29.03352',
                detail: 'Sokak lambası yanında dinlenirken gözlemlendi.',
                addedBy: 'oguz.kurt',
            },
        ],
    }

    const historyDrawerTitle =
        historyDrawerType === 'feed'
            ? 'Besleme Geçmişi'
            : historyDrawerType === 'treatment'
                ? 'Tedavi Geçmişi'
                : 'Konum Geçmişi'

    const selectedHistoryRecords = useMemo(
        () => historyRecords[historyDrawerType] || [],
        [historyDrawerType]
    )

    const isOwnPet = !animalData.ownerUid || auth.currentUser?.uid === animalData.ownerUid
        || !animalData.ownerId || auth.currentUser?.uid === animalData.ownerId

    useEffect(() => {
        const loadFavoriteState = async () => {
            const user = auth.currentUser
            if (!user || !animalData.id) {
                setIsFavorite(false)
                return
            }

            try {
                const favoritePetIds = await getUserFavoritePetIds(user.uid)
                setIsFavorite(favoritePetIds.includes(animalData.id))
            } catch (error) {
                setIsFavorite(false)
            }
        }

        loadFavoriteState()
    }, [animalData.id])

    useEffect(() => {
        const nextAnimal = createAnimalState(route.params?.pet)
        setAnimalData(nextAnimal)
        setEditForm(nextAnimal)
    }, [route.params?.pet])

    useEffect(() => {
        let active = true

        const loadCreatorUsername = async () => {
            const creatorUid = animalData.ownerUid || animalData.ownerId
            if (!creatorUid) return

            try {
                const profile = await getUserProfile(creatorUid)
                const username = profile?.username || ''
                if (active && username) {
                    setAnimalData((prev) => ({ ...prev, addedByUsername: username }))
                }
            } catch (error) {
            }
        }

        loadCreatorUsername()

        return () => {
            active = false
        }
    }, [animalData.ownerUid, animalData.ownerId, animalData.addedBy])

    const sanitizeAlphaText = (value, maxLength = 60) =>
        value
            .replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ\s\-']/g, '')
            .replace(/\s{2,}/g, ' ')
            .slice(0, maxLength)

    const sanitizeGeneralText = (value, maxLength = 180) =>
        value
            .replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ\s.,:;!?\-'/()]/g, '')
            .replace(/\s{2,}/g, ' ')
            .slice(0, maxLength)

    const formatDateInput = (value) => {
        const digits = value.replace(/\D/g, '').slice(0, 8)
        if (digits.length <= 2) return digits
        if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
        return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
    }

    const formatTimeInput = (value) => {
        const digits = value.replace(/\D/g, '').slice(0, 4)
        if (digits.length <= 2) return digits
        return `${digits.slice(0, 2)}:${digits.slice(2)}`
    }

    const isValidDate = (value) => {
        const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
        if (!match) return false

        const day = Number(match[1])
        const month = Number(match[2])
        const year = Number(match[3])
        if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) return false

        const date = new Date(year, month - 1, day)
        return (
            date.getFullYear() === year &&
            date.getMonth() === month - 1 &&
            date.getDate() === day
        )
    }

    const isValidTime = (value) => {
        const match = value.match(/^(\d{2}):(\d{2})$/)
        if (!match) return false

        const hour = Number(match[1])
        const minute = Number(match[2])
        return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
    }

    const validateLocationCore = ({ city, district, neighborhood, currentLocation }) => {
        if (!city.trim()) return 'Şehir alanı zorunludur.'
        if (!district.trim()) return 'İlçe alanı zorunludur.'
        if (!neighborhood.trim()) return 'Mahalle alanı zorunludur.'
        if (!currentLocation.trim()) return 'Güncel konum alınmalı.'
        return ''
    }

    const validateAnimalForm = () => {
        if (!editForm.name.trim()) return 'Hayvan ismi zorunludur.'
        if (editForm.name.trim().length < 2) return 'Hayvan ismi en az 2 karakter olmalı.'
        if (!editForm.type.trim()) return 'Tür alanı zorunludur.'
        if (!editForm.breed.trim()) return 'Cins alanı zorunludur.'
        if (!editForm.gender.trim()) return 'Cinsiyet alanı zorunludur.'
        if (!editForm.age.trim()) return 'Yaş alanı zorunludur.'

        const ageNumber = Number(editForm.age)
        if (Number.isNaN(ageNumber) || ageNumber < 0 || ageNumber > 30) return 'Yaş 0 ile 30 arasında olmalıdır.'

        if (!editForm.color.trim()) return 'Renk alanı zorunludur.'
        return ''
    }

    const validateFeedForm = () => {
        if (!feedForm.food.trim()) return 'Verilen yiyecek alanı zorunludur.'
        if (!isValidDate(feedForm.date)) return 'Besleme tarihi DD/MM/YYYY formatında ve geçerli olmalıdır.'
        if (!isValidTime(feedForm.time)) return 'Besleme saati SS:DD formatında ve geçerli olmalıdır.'

        const locationValidation = validateLocationCore(feedForm)
        if (locationValidation) return locationValidation
        return ''
    }

    const validateTreatmentForm = () => {
        if (!treatmentForm.treatmentType.trim()) return 'Tedavi türü alanı zorunludur.'
        if (!isValidDate(treatmentForm.date)) return 'Tedavi tarihi DD/MM/YYYY formatında ve geçerli olmalıdır.'
        if (!isValidTime(treatmentForm.time)) return 'Tedavi saati SS:DD formatında ve geçerli olmalıdır.'

        const locationValidation = validateLocationCore(treatmentForm)
        if (locationValidation) return locationValidation
        return ''
    }

    const validateLocationForm = () => {
        const locationValidation = validateLocationCore(locationForm)
        if (locationValidation) return locationValidation
        if (!isValidDate(locationForm.date)) return 'Konum tarihi DD/MM/YYYY formatında ve geçerli olmalıdır.'
        if (!isValidTime(locationForm.time)) return 'Konum saati SS:DD formatında ve geçerli olmalıdır.'
        return ''
    }

    const openEditModal = () => {
        if (!isOwnPet) {
            Alert.alert('Bilgi', 'Düzenleme yalnızca kendi eklediğin hayvanlarda kullanılabilir.')
            return
        }
        setEditForm(animalData)
        setIsEditModalVisible(true)
    }

    const closeEditModal = () => {
        setIsEditModalVisible(false)
    }

    const updateEditField = (field, value) => {
        let nextValue = value

        if (['name', 'type', 'breed', 'gender', 'color'].includes(field)) {
            nextValue = sanitizeAlphaText(value)
        }

        if (field === 'age') {
            nextValue = value.replace(/\D/g, '').slice(0, 2)
        }

        if (field === 'note') {
            nextValue = sanitizeGeneralText(value, 300)
        }

        setEditForm((prev) => ({ ...prev, [field]: nextValue }))
    }

    const saveAnimalChanges = () => {
        const validationError = validateAnimalForm()
        if (validationError) {
            Alert.alert('Geçersiz Bilgi', validationError)
            return
        }

        if (!isOwnPet || !animalData.id) {
            setAnimalData((prev) => ({
                ...prev,
                imageUri: editForm.imageUri || null,
                name: editForm.name.trim() || 'Hayvanın İsmi',
                type: editForm.type.trim() || '-',
                breed: editForm.breed.trim() || '-',
                gender: editForm.gender.trim() || '-',
                age: editForm.age.trim() || '-',
                color: editForm.color.trim() || '-',
                note: editForm.note.trim(),
            }))
            closeEditModal()
            return
        }

        (async () => {
            try {
                let nextImageUrl = editForm.imageUri || animalData.imageUri || null
                let nextImageSource = animalData.imageSource || 'local'
                if (editForm.imageUri && editForm.imageUri !== animalData.imageUri) {
                    try {
                        nextImageUrl = await uploadImageFromUri(editForm.imageUri, 'pets')
                        nextImageSource = nextImageUrl?.startsWith('http') ? 'storage' : nextImageUrl?.startsWith('data:image') ? 'base64' : 'local'
                    } catch (uploadError) {
                        console.warn('Detail image upload failed, using local uri', uploadError)
                        nextImageUrl = editForm.imageBase64 ? `data:image/jpeg;base64,${editForm.imageBase64}` : editForm.imageUri
                        nextImageSource = editForm.imageBase64 ? 'base64' : 'local'
                    }
                }

                const updatedPet = {
                    name: editForm.name.trim(),
                    type: editForm.type.trim(),
                    breed: editForm.breed.trim(),
                    gender: editForm.gender.trim(),
                    age: Number(editForm.age),
                    color: editForm.color.trim(),
                    note: editForm.note.trim(),
                    imageUrl: nextImageUrl,
                    imageSource: nextImageSource,
                    ownerId: animalData.ownerId || animalData.ownerUid || auth.currentUser?.uid || null,
                    createdByUid: animalData.ownerUid || animalData.ownerId || auth.currentUser?.uid || null,
                    createdByUsername: animalData.addedByUsername || animalData.addedBy || '',
                    city: animalData.city,
                    district: animalData.district,
                    neighborhood: animalData.neighborhood,
                    lastSeenAt: animalData.lastSeenAtRaw || animalData.createdAtRaw || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                }

                await updatePet(animalData.id, updatedPet)
                setAnimalData((prev) => ({
                    ...prev,
                    ...updatedPet,
                    imageUri: nextImageUrl,
                    age: String(updatedPet.age),
                    lastSeen: updatedPet.lastSeenAt ? new Date(updatedPet.lastSeenAt).toLocaleString('tr-TR') : prev.lastSeen,
                }))
                closeEditModal()
            } catch (error) {
                console.error('update pet error', error)
                Alert.alert('Hata', error.message || 'Hayvan güncellenemedi.')
            }
        })()
    }

    const handlePickAnimalImage = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync()

        if (!permissionResult.granted) {
            Alert.alert('İzin Gerekli', 'Resim seçmek için galeri izni vermelisin.')
            return
        }

        const imageResult = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            base64: true,
        })

        if (!imageResult.canceled && imageResult.assets?.length) {
            setEditForm((prev) => ({ ...prev, imageUri: imageResult.assets[0].uri, imageBase64: imageResult.assets[0].base64 || '' }))
        }
    }

    const handleRemoveAnimalImage = () => {
        setEditForm((prev) => ({ ...prev, imageUri: null, imageBase64: '' }))
    }

    const closeFeedModal = () => setIsFeedModalVisible(false)
    const closeTreatmentModal = () => setIsTreatmentModalVisible(false)
    const closeLocationModal = () => setIsLocationModalVisible(false)

    const openHistoryDrawer = (type) => {
        setHistoryDrawerType(type)
        setIsHistoryDrawerVisible(true)
        historyDrawerTranslateX.setValue(420)

        Animated.timing(historyDrawerTranslateX, {
            toValue: 0,
            duration: 240,
            useNativeDriver: true,
        }).start()
    }

    const closeHistoryDrawer = () => {
        Animated.timing(historyDrawerTranslateX, {
            toValue: 420,
            duration: 200,
            useNativeDriver: true,
        }).start(({ finished }) => {
            if (finished) {
                setIsHistoryDrawerVisible(false)
            }
        })
    }

    const saveFeedRecord = () => {
        const validationError = validateFeedForm()
        if (validationError) {
            Alert.alert('Geçersiz Bilgi', validationError)
            return
        }

        closeFeedModal()
        Alert.alert('Başarılı', 'Besleme kaydı eklendi.')
    }

    const saveTreatmentRecord = () => {
        const validationError = validateTreatmentForm()
        if (validationError) {
            Alert.alert('Geçersiz Bilgi', validationError)
            return
        }

        closeTreatmentModal()
        Alert.alert('Başarılı', 'Tedavi kaydı eklendi.')
    }

    const saveLocationRecord = () => {
        const validationError = validateLocationForm()
        if (validationError) {
            Alert.alert('Geçersiz Bilgi', validationError)
            return
        }

        closeLocationModal()
        Alert.alert('Başarılı', 'Konum kaydı eklendi.')
    }

    const handleDeleteAnimal = () => {
        if (!isOwnPet || !animalData.id) {
            Alert.alert('Bilgi', 'Sadece kendi eklediğin hayvanları silebilirsin.')
            return
        }

        Alert.alert('Hayvanı Sil', 'Bu hayvan kaydını silmek istiyor musun?', [
            { text: 'Vazgeç', style: 'cancel' },
            {
                text: 'Sil',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deletePet(animalData.id)
                        Alert.alert('Başarılı', 'Hayvan kaydı silindi.')
                        navigation.goBack()
                    } catch (error) {
                        Alert.alert('Hata', error.message || 'Hayvan silinemedi.')
                    }
                },
            },
        ])
    }

    const handleToggleFavorite = async () => {
        const user = auth.currentUser
        if (!user) {
            Alert.alert('Giriş Gerekli', 'Favorilere eklemek için giriş yapmalısın.')
            return
        }

        if (!animalData.id) {
            return
        }

        try {
            const nextFavoriteState = await togglePetFavorite(user.uid, animalData.id)
            setIsFavorite(nextFavoriteState)
        } catch (error) {
            Alert.alert('Hata', error.message || 'Favori durumu güncellenemedi.')
        }
    }

    const handleGetCurrentLocation = async (targetForm) => {
        try {
            setIsLocatingNow(true)
            const { status } = await Location.requestForegroundPermissionsAsync()

            if (status !== 'granted') {
                Alert.alert('İzin Gerekli', 'Güncel konumu alabilmek için konum izni vermelisin.')
                return
            }

            const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
            const coords = `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`

            if (targetForm === 'feed') {
                setFeedForm((prev) => ({ ...prev, currentLocation: coords }))
                return
            }

            if (targetForm === 'treatment') {
                setTreatmentForm((prev) => ({ ...prev, currentLocation: coords }))
                return
            }

            setLocationForm((prev) => ({ ...prev, currentLocation: coords }))
        } catch (error) {
            Alert.alert('Hata', 'Güncel konum alınamadı.')
        } finally {
            setIsLocatingNow(false)
        }
    }

    return (
        <ScrollView>
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={() => navigation.navigate('AnimalList')}>
                    <Ionicons name="chevron-back" size={24} color="black" />
                </Pressable>
                <Text style={styles.headerText}>{animalData.name}</Text>
                <Pressable style={styles.favoriteButton} onPress={handleToggleFavorite}>
                    <Ionicons
                        name={isFavorite ? 'heart' : 'heart-outline'}
                        size={28}
                        color="#e53935"
                    />
                </Pressable>
                <Pressable style={styles.editButton} onPress={openEditModal}>
                    <Ionicons name="create-outline" size={30} color="black" />
                </Pressable>
            </View>
            <View style={styles.animalInfoContainer}>
                <View style={styles.animalPictureContainer}>
                    {animalData.imageUri ? (
                        <Image source={{ uri: animalData.imageUri }} style={styles.animalImage} />
                    ) : (
                        <Ionicons name='image-outline' size={44} color='#7b7b7b' />
                    )}
                </View>
                <View style={styles.animalDetails}>
                    <Text style={styles.animalInfo}>Tür: {animalData.type}</Text>
                    <Text style={styles.animalInfo}>Cins: {animalData.breed}</Text>
                    <Text style={styles.animalInfo}>Cinsiyet: {animalData.gender}</Text>
                    <Text style={styles.animalInfo}>Yaş: {animalData.age}</Text>
                    <Text style={styles.animalInfo}>Renk: {animalData.color}</Text>
                </View>
            </View>
            <View style={styles.animalOtherInfoContainer}>
                <Text style={styles.animalOtherInfo}>Diğer Bilgiler: </Text>
                <Text style={styles.animalOtherInfoText}>{animalData.note}</Text>
            </View>
            <View style={styles.animalDetailContainer}>
                <View style={styles.animalDetailRow}>
                    <Ionicons name="calendar-outline" size={16} color="#333" />
                    <Text style={styles.animalDetail}>Son Görülme: {animalData.lastSeen}</Text>
                </View>
                <View style={styles.animalDetailRow}>
                    <Ionicons name="person-outline" size={16} color="#333" />
                    <Text style={styles.animalDetail}>Ekleyen Kullanıcı: {animalData.addedByUsername || animalData.addedBy || '—'}</Text>
                </View>
                <View style={styles.animalDetailRow}>
                    <Ionicons name="calendar-clear-outline" size={16} color="#333" />
                    <Text style={styles.animalDetail}>Eklenme Tarihi: {animalData.addedAt}</Text>
                </View>
            </View>
            <View style={styles.newRecordContainer}>
                <Pressable style={[styles.newRecordButton, styles.newRecordFeedButton]} onPress={() => setIsFeedModalVisible(true)}>
                    <Text style={styles.newRecordButtonText}>Yeni Besleme Ekle</Text>
                </Pressable>
                <Pressable style={[styles.newRecordButton, styles.newRecordTreatmentButton]} onPress={() => setIsTreatmentModalVisible(true)}>
                    <Text style={styles.newRecordButtonText}>Yeni Tedavi Ekle</Text>
                </Pressable>
                <Pressable style={[styles.newRecordButton, styles.newRecordLocationButton]} onPress={() => setIsLocationModalVisible(true)}>
                    <Text style={styles.newRecordButtonText}>Yeni Konum Ekle</Text>
                </Pressable>
            </View>
            <View style={styles.lastLocationContainer}>
                <Pressable style={styles.lastLocationButton}>
                    <View style={styles.lastLocationLeftSide}>
                        <Image source={require('../images/dataImages/map.png')} style={styles.mapImage} />
                        <Text style={styles.lastLocationText}>Son Konumu Haritada Gör</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="white" />
                </Pressable>
            </View>
            <Pressable style={styles.pastContainer} onPress={() => openHistoryDrawer('feed')}>
                <View style={styles.pastLeftSide}>
                    <Image source={require('../images/dataImages/food.png')} style={styles.pastIcon} />
                    <Text style={styles.pastText}>Besleme Geçmişi</Text>
                </View>
                <View style={styles.pastButton}>
                    <Ionicons name="chevron-forward" size={25} color="#333" />
                </View>
            </Pressable>
            <Pressable style={styles.pastContainer} onPress={() => openHistoryDrawer('treatment')}>
                <View style={styles.pastLeftSide}>
                    <Image source={require('../images/dataImages/health.png')} style={styles.pastIcon} />
                    <Text style={styles.pastText}>Tedavi Geçmişi</Text>
                </View>
                <View style={styles.pastButton}>
                    <Ionicons name="chevron-forward" size={25} color="#333" />
                </View>
            </Pressable>
            <Pressable style={styles.pastContainer} onPress={() => openHistoryDrawer('location')}>
                <View style={styles.pastLeftSide}>
                    <Image source={require('../images/dataImages/map.png')} style={styles.pastIcon} />
                    <Text style={styles.pastText}>Konum Geçmişi</Text>
                </View>
                <View style={styles.pastButton}>
                    <Ionicons name="chevron-forward" size={25} color="#333" />
                </View>
            </Pressable>
            <View style={styles.animalDeleteContainer}>
                <Pressable style={styles.animalDeleteButton} onPress={handleDeleteAnimal}>
                    <Text style={styles.animalDeleteButtonText}>Hayvanı Sil</Text>
                </Pressable>
            </View>

            <Modal
                visible={isEditModalVisible}
                transparent
                animationType='slide'
                statusBarTranslucent
                navigationBarTranslucent
                onRequestClose={closeEditModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Hayvan Bilgilerini Düzenle</Text>
                            <Pressable onPress={closeEditModal} style={styles.modalCloseButton}>
                                <Ionicons name='close' size={22} color={getColor('--dark-one')} />
                            </Pressable>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.modalScrollContent}
                        >
                            <Text style={styles.modalSectionTitle}>Resim</Text>
                            <View style={styles.modalImageSection}>
                                <View style={styles.modalImagePreview}>
                                    {editForm.imageUri ? (
                                        <Image source={{ uri: editForm.imageUri }} style={styles.modalImage} />
                                    ) : (
                                        <Ionicons name='image-outline' size={32} color={getColor('--light-six')} />
                                    )}
                                </View>
                                <View style={styles.modalImageActions}>
                                    <Pressable style={styles.modalImageActionButton} onPress={handlePickAnimalImage}>
                                        <Text style={styles.modalImageActionText}>{editForm.imageUri ? 'Resmi Değiştir' : 'Resim Ekle'}</Text>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.modalImageActionButton, styles.modalImageRemoveButton, !editForm.imageUri && styles.modalImageRemoveButtonDisabled]}
                                        onPress={handleRemoveAnimalImage}
                                        disabled={!editForm.imageUri}
                                    >
                                        <Text style={styles.modalImageRemoveText}>Resmi Kaldır</Text>
                                    </Pressable>
                                </View>
                            </View>

                            <TextInput style={styles.modalInput} value={editForm.name} onChangeText={(value) => updateEditField('name', value)} placeholder='Hayvanın İsmi' />
                            <TextInput style={styles.modalInput} value={editForm.type} onChangeText={(value) => updateEditField('type', value)} placeholder='Tür' />
                            <TextInput style={styles.modalInput} value={editForm.breed} onChangeText={(value) => updateEditField('breed', value)} placeholder='Cins' />
                            <TextInput style={styles.modalInput} value={editForm.gender} onChangeText={(value) => updateEditField('gender', value)} placeholder='Cinsiyet' />
                            <TextInput style={styles.modalInput} value={editForm.age} onChangeText={(value) => updateEditField('age', value)} placeholder='Yaş' keyboardType='number-pad' />
                            <TextInput style={styles.modalInput} value={editForm.color} onChangeText={(value) => updateEditField('color', value)} placeholder='Renk' />
                            <TextInput
                                style={styles.modalInputMultiline}
                                value={editForm.note}
                                onChangeText={(value) => updateEditField('note', value)}
                                placeholder='Diğer Bilgiler'
                                multiline
                                textAlignVertical='top'
                            />
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <Pressable style={styles.modalCancelButton} onPress={closeEditModal}>
                                <Text style={styles.modalCancelButtonText}>Vazgeç</Text>
                            </Pressable>
                            <Pressable style={styles.modalSaveButton} onPress={saveAnimalChanges}>
                                <Text style={styles.modalSaveButtonText}>Kaydet</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={isHistoryDrawerVisible}
                transparent
                animationType='fade'
                statusBarTranslucent
                onRequestClose={closeHistoryDrawer}
            >
                <View style={styles.historyOverlay}>
                    <Pressable style={styles.historyBackdrop} onPress={closeHistoryDrawer} />
                    <Animated.View
                        style={[
                            styles.historyDrawer,
                            { transform: [{ translateX: historyDrawerTranslateX }] },
                        ]}
                    >
                        <View style={styles.historyHeader}>
                            <View>
                                <Text style={styles.historyTitle}>{historyDrawerTitle}</Text>
                                <Text style={styles.historySubtitle}>{selectedHistoryRecords.length} kayıt</Text>
                            </View>
                            <Pressable style={styles.historyCloseButton} onPress={closeHistoryDrawer}>
                                <Ionicons name='close' size={20} color='#1f2937' />
                            </Pressable>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.historyListContent}>
                            {selectedHistoryRecords.map((item, index) => (
                                <View key={`${historyDrawerType}-${index}`} style={styles.historyCard}>
                                    <Text style={styles.historyDetailText}>{item.detail}</Text>
                                    <View style={styles.historyInfoRow}>
                                        <Ionicons name='person-outline' size={15} color='#7c3aed' />
                                        <Text style={styles.historyInfoText}>Ekleyen: {item.addedBy || 'Bilinmiyor'}</Text>
                                    </View>
                                    <View style={styles.historyInfoRow}>
                                        <Ionicons name='location-outline' size={15} color='#2563eb' />
                                        <Text style={styles.historyInfoText}>{item.city}, {item.district}, {item.neighborhood}</Text>
                                    </View>
                                    <View style={styles.historyInfoRow}>
                                        <Ionicons name='navigate-outline' size={15} color='#0f766e' />
                                        <Text style={styles.historyInfoText}>{item.currentLocation}</Text>
                                    </View>
                                    <Text style={styles.historyDateTime}>{item.date} • {item.time}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </Animated.View>
                </View>
            </Modal>

            <Modal
                visible={isFeedModalVisible}
                transparent
                animationType='slide'
                statusBarTranslucent
                navigationBarTranslucent
                onRequestClose={closeFeedModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Besleme Kaydı Ekle</Text>
                            <Pressable onPress={closeFeedModal} style={styles.modalCloseButton}>
                                <Ionicons name='close' size={22} color={getColor('--dark-one')} />
                            </Pressable>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
                            <TextInput
                                style={styles.modalInput}
                                placeholder='Verilen yiyecek'
                                value={feedForm.food}
                                onChangeText={(value) => setFeedForm((prev) => ({ ...prev, food: sanitizeGeneralText(value, 80) }))}
                            />
                            <TextInput
                                style={styles.modalInput}
                                placeholder='Tarih (GG/AA/YYYY)'
                                value={feedForm.date}
                                onChangeText={(value) => setFeedForm((prev) => ({ ...prev, date: formatDateInput(value) }))}
                                keyboardType='number-pad'
                                maxLength={10}
                            />
                            <TextInput
                                style={styles.modalInput}
                                placeholder='Saat (SS:DD)'
                                value={feedForm.time}
                                onChangeText={(value) => setFeedForm((prev) => ({ ...prev, time: formatTimeInput(value) }))}
                                keyboardType='number-pad'
                                maxLength={5}
                            />
                            <TextInput
                                style={styles.modalInput}
                                placeholder='Şehir'
                                value={feedForm.city}
                                onChangeText={(value) => setFeedForm((prev) => ({ ...prev, city: sanitizeAlphaText(value, 50) }))}
                            />
                            <TextInput
                                style={styles.modalInput}
                                placeholder='İlçe'
                                value={feedForm.district}
                                onChangeText={(value) => setFeedForm((prev) => ({ ...prev, district: sanitizeAlphaText(value, 50) }))}
                            />
                            <TextInput
                                style={styles.modalInput}
                                placeholder='Mahalle'
                                value={feedForm.neighborhood}
                                onChangeText={(value) => setFeedForm((prev) => ({ ...prev, neighborhood: sanitizeAlphaText(value, 60) }))}
                            />
                            <Pressable style={styles.currentLocationButton} onPress={() => handleGetCurrentLocation('feed')} disabled={isLocatingNow}>
                                <Ionicons name='locate' size={18} color='#fff' />
                                <Text style={styles.currentLocationButtonText}>
                                    {isLocatingNow ? 'Konum alınıyor...' : 'Güncel Konum'}
                                </Text>
                                {isLocatingNow && <ActivityIndicator size='small' color='#fff' />}
                            </Pressable>
                            {!!feedForm.currentLocation && <Text style={styles.currentLocationInfoText}>{feedForm.currentLocation}</Text>}
                            <TextInput
                                style={styles.modalInputMultiline}
                                placeholder='Açıklama'
                                value={feedForm.note}
                                onChangeText={(value) => setFeedForm((prev) => ({ ...prev, note: sanitizeGeneralText(value, 300) }))}
                                multiline
                                textAlignVertical='top'
                                maxLength={300}
                            />
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <Pressable style={styles.modalCancelButton} onPress={closeFeedModal}>
                                <Text style={styles.modalCancelButtonText}>Vazgeç</Text>
                            </Pressable>
                            <Pressable style={styles.modalSaveButton} onPress={saveFeedRecord}>
                                <Text style={styles.modalSaveButtonText}>Kaydet</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={isTreatmentModalVisible}
                transparent
                animationType='slide'
                statusBarTranslucent
                navigationBarTranslucent
                onRequestClose={closeTreatmentModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Tedavi Kaydı Ekle</Text>
                            <Pressable onPress={closeTreatmentModal} style={styles.modalCloseButton}>
                                <Ionicons name='close' size={22} color={getColor('--dark-one')} />
                            </Pressable>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
                            <TextInput
                                style={styles.modalInput}
                                placeholder='Tedavi türü (Örn: Aşı, Kırık Tedavisi vb.)'
                                value={treatmentForm.treatmentType}
                                onChangeText={(value) => setTreatmentForm((prev) => ({ ...prev, treatmentType: sanitizeGeneralText(value, 80) }))}
                            />
                            <TextInput
                                style={styles.modalInput}
                                placeholder='Tarih (GG/AA/YYYY)'
                                value={treatmentForm.date}
                                onChangeText={(value) => setTreatmentForm((prev) => ({ ...prev, date: formatDateInput(value) }))}
                                keyboardType='number-pad'
                                maxLength={10}
                            />
                            <TextInput
                                style={styles.modalInput}
                                placeholder='Saat (SS:DD)'
                                value={treatmentForm.time}
                                onChangeText={(value) => setTreatmentForm((prev) => ({ ...prev, time: formatTimeInput(value) }))}
                                keyboardType='number-pad'
                                maxLength={5}
                            />
                            <TextInput
                                style={styles.modalInput}
                                placeholder='Şehir'
                                value={treatmentForm.city}
                                onChangeText={(value) => setTreatmentForm((prev) => ({ ...prev, city: sanitizeAlphaText(value, 50) }))}
                            />
                            <TextInput
                                style={styles.modalInput}
                                placeholder='İlçe'
                                value={treatmentForm.district}
                                onChangeText={(value) => setTreatmentForm((prev) => ({ ...prev, district: sanitizeAlphaText(value, 50) }))}
                            />
                            <TextInput
                                style={styles.modalInput}
                                placeholder='Mahalle'
                                value={treatmentForm.neighborhood}
                                onChangeText={(value) => setTreatmentForm((prev) => ({ ...prev, neighborhood: sanitizeAlphaText(value, 60) }))}
                            />
                            <Pressable style={styles.currentLocationButton} onPress={() => handleGetCurrentLocation('treatment')} disabled={isLocatingNow}>
                                <Ionicons name='locate' size={18} color='#fff' />
                                <Text style={styles.currentLocationButtonText}>
                                    {isLocatingNow ? 'Konum alınıyor...' : 'Güncel Konum'}
                                </Text>
                                {isLocatingNow && <ActivityIndicator size='small' color='#fff' />}
                            </Pressable>
                            {!!treatmentForm.currentLocation && <Text style={styles.currentLocationInfoText}>{treatmentForm.currentLocation}</Text>}
                            <TextInput
                                style={styles.modalInputMultiline}
                                placeholder='Açıklama'
                                value={treatmentForm.note}
                                onChangeText={(value) => setTreatmentForm((prev) => ({ ...prev, note: sanitizeGeneralText(value, 300) }))}
                                multiline
                                textAlignVertical='top'
                                maxLength={300}
                            />
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <Pressable style={styles.modalCancelButton} onPress={closeTreatmentModal}>
                                <Text style={styles.modalCancelButtonText}>Vazgeç</Text>
                            </Pressable>
                            <Pressable style={styles.modalSaveButton} onPress={saveTreatmentRecord}>
                                <Text style={styles.modalSaveButtonText}>Kaydet</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={isLocationModalVisible}
                transparent
                animationType='slide'
                statusBarTranslucent
                navigationBarTranslucent
                onRequestClose={closeLocationModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Konum Kaydı Ekle</Text>
                            <Pressable onPress={closeLocationModal} style={styles.modalCloseButton}>
                                <Ionicons name='close' size={22} color={getColor('--dark-one')} />
                            </Pressable>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
                            <TextInput
                                style={styles.modalInput}
                                placeholder='Şehir'
                                value={locationForm.city}
                                onChangeText={(value) => setLocationForm((prev) => ({ ...prev, city: sanitizeAlphaText(value, 50) }))}
                            />
                            <TextInput
                                style={styles.modalInput}
                                placeholder='İlçe'
                                value={locationForm.district}
                                onChangeText={(value) => setLocationForm((prev) => ({ ...prev, district: sanitizeAlphaText(value, 50) }))}
                            />
                            <TextInput
                                style={styles.modalInput}
                                placeholder='Mahalle'
                                value={locationForm.neighborhood}
                                onChangeText={(value) => setLocationForm((prev) => ({ ...prev, neighborhood: sanitizeAlphaText(value, 60) }))}
                            />
                            <TextInput
                                style={styles.modalInput}
                                placeholder='Tarih (GG/AA/YYYY)'
                                value={locationForm.date}
                                onChangeText={(value) => setLocationForm((prev) => ({ ...prev, date: formatDateInput(value) }))}
                                keyboardType='number-pad'
                                maxLength={10}
                            />
                            <TextInput
                                style={styles.modalInput}
                                placeholder='Saat (SS:DD)'
                                value={locationForm.time}
                                onChangeText={(value) => setLocationForm((prev) => ({ ...prev, time: formatTimeInput(value) }))}
                                keyboardType='number-pad'
                                maxLength={5}
                            />

                            <Pressable style={styles.currentLocationButton} onPress={() => handleGetCurrentLocation('location')} disabled={isLocatingNow}>
                                <Ionicons name='locate' size={18} color='#fff' />
                                <Text style={styles.currentLocationButtonText}>
                                    {isLocatingNow ? 'Konum alınıyor...' : 'Güncel Konum'}
                                </Text>
                                {isLocatingNow && <ActivityIndicator size='small' color='#fff' />}
                            </Pressable>
                            {!!locationForm.currentLocation && <Text style={styles.currentLocationInfoText}>{locationForm.currentLocation}</Text>}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <Pressable style={styles.modalCancelButton} onPress={closeLocationModal}>
                                <Text style={styles.modalCancelButtonText}>Vazgeç</Text>
                            </Pressable>
                            <Pressable style={styles.modalSaveButton} onPress={saveLocationRecord}>
                                <Text style={styles.modalSaveButtonText}>Kaydet</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    header: {
        backgroundColor: 'transparent',
        marginTop: 60,
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        minHeight: 40,
    },
    backButton: {
        position: 'absolute',
        left: 16,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
    },
    headerText: {
        fontSize: 25,
        fontWeight: 'bold',
        color: 'black',
        textAlign: 'center',
    },
    editButton: {
        position: 'absolute',
        right: 16,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    favoriteButton: {
        position: 'absolute',
        right: 56,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    animalInfoContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
        gap: 12,
    },
    animalPictureContainer: {
        width: 180,
        height: 210,
        borderRadius: 12,
        backgroundColor: '#d9d9d9',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    animalImage: {
        width: '100%',
        height: '100%',
    },
    animalDetails: {
        flex: 1,
        gap: 4,
    },
    animalInfo: {
        fontSize: 17,
        color: '#333',
        backgroundColor: getColor('--light-two'),
        borderRadius: 8,
        padding: 8,
        textAlign: 'center',
    },
    animalDetail: {
        fontSize: 14,
        color: '#333',
        paddingVertical: 5,
    },
    animalDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    animalDetailContainer: {
        marginTop: 20,
        paddingHorizontal: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: getColor('--light-six'),
        paddingTop: 10,
    },
    lastLocationContainer: {
        marginTop: 20,
        paddingHorizontal: 16,
        marginBottom: 20,
    },
    lastLocationButton: {
        backgroundColor: getColor('--light-six'),
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    lastLocationLeftSide: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    lastLocationText: {
        color: 'white',
        fontSize: 15,
        fontWeight: 'bold',
    },
    mapImage: {
        width: 24,
        height: 24,
        marginRight: 8,
    },
    pastContainer: {
        marginTop: 10,
        paddingHorizontal: 13,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
        width: '90%',
        alignSelf: 'center',
        borderRadius: 12,
        paddingVertical: 8,
    },
    pastLeftSide: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pastIcon: {
        width: 24,
        height: 24,
        marginRight: 8,
    },
    pastText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    pastButton: {
        borderRadius: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    historyOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    historyBackdrop: {
        flex: 1,
    },
    historyDrawer: {
        width: '86%',
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderBottomLeftRadius: 24,
        paddingTop: 42,
        paddingHorizontal: 16,
        paddingBottom: 18,
        shadowColor: '#000',
        shadowOffset: { width: -2, height: 0 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 8,
    },
    historyHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    historyTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#111827',
    },
    historySubtitle: {
        marginTop: 4,
        fontSize: 13,
        color: '#6b7280',
    },
    historyCloseButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6',
    },
    historyListContent: {
        paddingBottom: 24,
        gap: 10,
    },
    historyCard: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 14,
        backgroundColor: '#f8fafc',
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    historyDateTime: {
        marginTop: 8,
        textAlign: 'right',
        fontSize: 12,
        color: '#6b7280',
    },
    historyDetailText: {
        fontSize: 13,
        color: '#374151',
        marginBottom: 8,
    },
    historyInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    historyInfoText: {
        flex: 1,
        fontSize: 12,
        color: '#1f2937',
    },
    animalOtherInfoContainer: {
        marginTop: 20,
        paddingHorizontal: 16,
    },
    animalOtherInfo: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    animalOtherInfoText: {
        fontSize: 15,
        color: '#333',
        marginTop: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'flex-end',
        paddingBottom: 0,
    },
    modalCard: {
        backgroundColor: getColor('--light-one'),
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 16,
        paddingHorizontal: 16,
        paddingBottom: 15,
        marginBottom: 0,
        maxHeight: '88%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#222',
    },
    modalCloseButton: {
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalInput: {
        borderWidth: 1,
        borderColor: getColor('--light-six'),
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 8,
        backgroundColor: '#fff',
    },
    modalInputMultiline: {
        borderWidth: 1,
        borderColor: getColor('--light-six'),
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        minHeight: 90,
        marginBottom: 10,
        backgroundColor: '#fff',
    },
    modalSectionTitle: {
        marginBottom: 8,
        fontSize: 15,
        fontWeight: '700',
        color: '#222',
    },
    modalImageSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 10,
    },
    modalImagePreview: {
        width: 82,
        height: 82,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: getColor('--light-six'),
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    modalImage: {
        width: '100%',
        height: '100%',
    },
    modalImageActions: {
        flex: 1,
        gap: 8,
    },
    modalImageActionButton: {
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: getColor('--light-six'),
        backgroundColor: '#fff',
        paddingVertical: 9,
        paddingHorizontal: 10,
    },
    modalImageActionText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333',
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
        color: '#333',
        textAlign: 'center',
    },
    currentLocationButton: {
        marginBottom: 8,
        borderRadius: 10,
        backgroundColor: '#5dabf9',
        paddingVertical: 12,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    currentLocationButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    currentLocationInfoText: {
        marginBottom: 8,
        borderWidth: 1,
        borderColor: getColor('--light-six'),
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#fff',
        color: '#333',
        fontSize: 14,
    },
    modalScrollContent: {
        paddingBottom: 8,
    },
    modalFooter: {
        marginTop: 0,
        paddingTop: 6,
        paddingBottom: 44,
        flexDirection: 'row',
        gap: 10,
    },
    modalCancelButton: {
        flex: 1,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: getColor('--light-six'),
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        backgroundColor: '#fff',
    },
    modalCancelButtonText: {
        color: '#333',
        fontSize: 16,
        fontWeight: '700',
    },
    modalSaveButton: {
        flex: 1,
        borderRadius: 10,
        backgroundColor: getColor('--light-six'),
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    modalSaveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    animalDeleteContainer: {
        paddingHorizontal: 16,
        marginBottom: 130,
        marginTop: 30
    },
    animalDeleteButton: {
        backgroundColor: '#e53935',
        borderRadius: 10,
        alignItems: 'center',
        paddingVertical: 12,
    },
    animalDeleteButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    newRecordContainer: {
        marginTop: 20,
        paddingHorizontal: 30,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    newRecordButton: {
        borderRadius: 45,
        width: 90,
        height: 90,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        paddingVertical: 12,
    },
    newRecordFeedButton: {
        backgroundColor: '#dfd32a',
    },
    newRecordTreatmentButton: {
        backgroundColor: '#69c53e',
    },
    newRecordLocationButton: {
        backgroundColor: '#5dabf9',
    },
    newRecordButtonText: {
        color: 'white',
        fontSize: 13,
        fontWeight: 'bold',
        textAlign: 'center',
    },
})