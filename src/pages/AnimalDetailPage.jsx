import { StyleSheet, Text, View, ScrollView, Pressable, Image, Modal, TextInput, Alert, ActivityIndicator, Animated } from 'react-native'
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { getColor } from '../css/theme'
import * as Location from 'expo-location'
import * as ImagePicker from 'expo-image-picker'
import { auth, db } from '../firebase/config'
import { deletePet, getUserFavoritePetIds, getUserProfile, togglePetFavorite, updatePet, uploadImageFromUri, addFeedRecord, addTreatmentRecord, addLocationRecord } from '../firebase/helpers'
import { collection as fsCollection, query as fsQuery, orderBy as fsOrderBy, onSnapshot } from 'firebase/firestore'
import { formatEstimatedPetAge } from '../utils/petAge'

const CITY_URL = 'https://raw.githubusercontent.com/metinyildirimnet/turkiye-adresler-json/master/sehirler.json'
const DISTRICT_URL = 'https://raw.githubusercontent.com/metinyildirimnet/turkiye-adresler-json/master/ilceler.json'
const NEIGHBORHOOD_URLS = [
    'https://raw.githubusercontent.com/metinyildirimnet/turkiye-adresler-json/master/mahalleler-1.json',
    'https://raw.githubusercontent.com/metinyildirimnet/turkiye-adresler-json/master/mahalleler-2.json',
    'https://raw.githubusercontent.com/metinyildirimnet/turkiye-adresler-json/master/mahalleler-3.json',
    'https://raw.githubusercontent.com/metinyildirimnet/turkiye-adresler-json/master/mahalleler-4.json',
]

const parseDateDMY = (value) => {
    if (!value || typeof value !== 'string') return NaN

    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!match) return NaN

    const day = Number(match[1])
    const month = Number(match[2])
    const year = Number(match[3])

    return new Date(year, month - 1, day).getTime()
}

const parseTimeHM = (value) => {
    if (!value || typeof value !== 'string') return NaN

    const match = value.match(/^(\d{2}):(\d{2})$/)
    if (!match) return NaN

    const hour = Number(match[1])
    const minute = Number(match[2])

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return NaN

    return hour * 60 + minute
}

const isFutureDateTime = (dateValue, timeValue) => {
    const dateTs = parseDateDMY(dateValue)
    const timeMinutes = parseTimeHM(timeValue)

    if (Number.isNaN(dateTs) || Number.isNaN(timeMinutes)) return false

    const dateMatch = dateValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    const timeMatch = timeValue.match(/^(\d{2}):(\d{2})$/)
    if (!dateMatch || !timeMatch) return false

    const scheduled = new Date(
        Number(dateMatch[3]),
        Number(dateMatch[2]) - 1,
        Number(dateMatch[1]),
        Number(timeMatch[1]),
        Number(timeMatch[2]),
        0,
        0,
    )

    return scheduled.getTime() > Date.now()
}

const getHistoryItemKey = (type, item) => {
    if (!item) return `${type}:empty`

    if (item.id) return `${type}:id:${item.id}`

    if (type === 'feed') {
        return [
            type,
            item.food || '',
            item.date || '',
            item.time || '',
            item.city || '',
            item.district || '',
            item.neighborhood || '',
            item.note || '',
            item.addedByUid || '',
        ].join('|')
    }

    if (type === 'treatment') {
        return [
            type,
            item.treatmentType || '',
            item.date || '',
            item.time || '',
            item.vetName || '',
            item.note || '',
            item.addedByUid || '',
        ].join('|')
    }

    return [
        type,
        item.date || '',
        item.time || '',
        item.city || '',
        item.district || '',
        item.neighborhood || '',
        item.currentLocation || '',
        item.latitude ?? '',
        item.longitude ?? '',
        item.addedByUid || '',
    ].join('|')
}

const normalizeHistoryItems = (type, items) => {
    const uniqueItems = []
    const seen = new Set()

    for (const item of items || []) {
        const key = getHistoryItemKey(type, item)
        if (seen.has(key)) continue
        seen.add(key)
        uniqueItems.push(item)
    }

    return uniqueItems
}

const createAnimalState = (pet) => ({
    id: pet?.id || null,
    imageUri: pet?.imageUrl || pet?.imageUri || null,
    imageBase64: '',
    name: pet?.name || 'Hayvanın İsmi',
    type: pet?.type || 'Köpek',
    breed: pet?.breed || 'Golden Retriever',
    gender: pet?.gender || 'Dişi',
    age: formatEstimatedPetAge(pet, '3'),
    color: pet?.color || 'Sarı',
    note: pet?.note ?? '',
    city: pet?.city || '',
    district: pet?.district || '',
    neighborhood: pet?.neighborhood || '',
    lastSeenAtRaw: pet?.lastSeenAt || pet?.createdAt || null,
    createdAtRaw: pet?.createdAt || null,
    lastSeen: pet?.lastSeenAt ? new Date(pet.lastSeenAt).toLocaleString('tr-TR') : (pet?.createdAt ? new Date(pet.createdAt).toLocaleString('tr-TR') : '—'),
    addedBy: pet?.createdByUsername || pet?.createdByName || pet?.addedByUsername || pet?.addedBy || pet?.username || '',
    addedByUsername: pet?.createdByUsername || pet?.createdByName || pet?.addedByUsername || pet?.addedBy || pet?.username || '',
    createdByUsername: pet?.createdByUsername || pet?.createdByName || pet?.addedByUsername || pet?.addedBy || pet?.username || '',
    addedAt: pet?.createdAt ? new Date(pet.createdAt).toLocaleString('tr-TR') : '—',
    ownerUid: pet?.createdByUid || null,
    ownerId: pet?.ownerId || pet?.createdByUid || null,
})


export default function AnimalDetailPage() {
    const navigation = useNavigation()
    const route = useRoute()
    const hasPetData = Boolean(route.params?.pet)
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
        vetName: '',
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

    const [historyRecords, setHistoryRecords] = useState({ feed: [], treatment: [], location: [] })
    const [cities, setCities] = useState([])
    const [districts, setDistricts] = useState([])
    const [neighborhoods, setNeighborhoods] = useState([])
    const [feedCityId, setFeedCityId] = useState('')
    const [feedDistrictId, setFeedDistrictId] = useState('')
    const [locationCityId, setLocationCityId] = useState('')
    const [locationDistrictId, setLocationDistrictId] = useState('')
    const [locationPickerVisible, setLocationPickerVisible] = useState(false)
    const [locationPickerTarget, setLocationPickerTarget] = useState('feed')
    const [locationPickerType, setLocationPickerType] = useState('city')

    const historyDrawerTitle =
        historyDrawerType === 'feed'
            ? 'Besleme Geçmişi'
            : historyDrawerType === 'treatment'
                ? 'Tedavi Geçmişi'
                : 'Konum Geçmişi'

    const selectedHistoryRecords = useMemo(
        () => historyRecords[historyDrawerType] || [],
        [historyDrawerType, historyRecords]
    )

    useEffect(() => {
        const loadBaseLocations = async () => {
            try {
                const [cityResponse, districtResponse] = await Promise.all([
                    fetch(CITY_URL),
                    fetch(DISTRICT_URL),
                ])

                const [cityData, districtData] = await Promise.all([
                    cityResponse.json(),
                    districtResponse.json(),
                ])

                setCities(Array.isArray(cityData) ? cityData : [])
                setDistricts(Array.isArray(districtData) ? districtData : [])
            } catch (error) {
                setCities([])
                setDistricts([])
            }
        }

        loadBaseLocations()
    }, [])

    const feedDistrictOptions = useMemo(
        () => districts.filter((item) => item.sehir_id === feedCityId),
        [districts, feedCityId]
    )

    const feedNeighborhoodOptions = useMemo(
        () => neighborhoods.filter((item) => item.sehir_id === feedCityId && item.ilce_id === feedDistrictId),
        [neighborhoods, feedCityId, feedDistrictId]
    )

    const locationDistrictOptions = useMemo(
        () => districts.filter((item) => item.sehir_id === locationCityId),
        [districts, locationCityId]
    )

    const locationNeighborhoodOptions = useMemo(
        () => neighborhoods.filter((item) => item.sehir_id === locationCityId && item.ilce_id === locationDistrictId),
        [neighborhoods, locationCityId, locationDistrictId]
    )

    const activeLocationCityId = locationPickerTarget === 'feed' ? feedCityId : locationCityId
    const activeLocationDistrictId = locationPickerTarget === 'feed' ? feedDistrictId : locationDistrictId
    const activeLocationDistrictOptions = locationPickerTarget === 'feed' ? feedDistrictOptions : locationDistrictOptions
    const activeLocationNeighborhoodOptions = locationPickerTarget === 'feed' ? feedNeighborhoodOptions : locationNeighborhoodOptions

    const openLocationPicker = async (target, type) => {
        const cityValue = target === 'feed' ? feedForm.city : locationForm.city
        const districtValue = target === 'feed' ? feedForm.district : locationForm.district

        if (type === 'district' && !cityValue) return
        if (type === 'neighborhood' && (!cityValue || !districtValue)) return

        if (type === 'neighborhood') {
            if (neighborhoods.length === 0) {
                try {
                    const responses = await Promise.all(NEIGHBORHOOD_URLS.map((url) => fetch(url)))
                    const chunks = await Promise.all(responses.map((response) => response.json()))
                    const mergedNeighborhoods = chunks.flat().filter(Boolean)
                    setNeighborhoods(mergedNeighborhoods)
                } catch (error) {
                    setNeighborhoods([])
                }
            }
        }

        setLocationPickerTarget(target)
        setLocationPickerType(type)
        setLocationPickerVisible(true)
    }

    const closeLocationPicker = () => {
        setLocationPickerVisible(false)
    }

    const applyLocationSelection = (value) => {
        if (locationPickerTarget === 'feed') {
            if (locationPickerType === 'city') {
                setFeedForm((prev) => ({ ...prev, city: value.sehir_adi, district: '', neighborhood: '' }))
                setFeedCityId(value.sehir_id)
                setFeedDistrictId('')
            }

            if (locationPickerType === 'district') {
                setFeedForm((prev) => ({ ...prev, district: value.ilce_adi, neighborhood: '' }))
                setFeedDistrictId(value.ilce_id)
            }

            if (locationPickerType === 'neighborhood') {
                setFeedForm((prev) => ({ ...prev, neighborhood: value.mahalle_adi }))
            }
        } else {
            if (locationPickerType === 'city') {
                setLocationForm((prev) => ({ ...prev, city: value.sehir_adi, district: '', neighborhood: '' }))
                setLocationCityId(value.sehir_id)
                setLocationDistrictId('')
            }

            if (locationPickerType === 'district') {
                setLocationForm((prev) => ({ ...prev, district: value.ilce_adi, neighborhood: '' }))
                setLocationDistrictId(value.ilce_id)
            }

            if (locationPickerType === 'neighborhood') {
                setLocationForm((prev) => ({ ...prev, neighborhood: value.mahalle_adi }))
            }
        }

        closeLocationPicker()
    }

    useEffect(() => {
        if (!animalData?.id) return

        const enrich = async (arr) => {
            if (!Array.isArray(arr) || !arr.length) return []
            return await Promise.all(arr.map(async (item) => {
                try {
                    const uid = item.addedByUid || (item.addedBy && item.addedBy.length >= 20 ? item.addedBy : null)
                    if (uid) {
                        const profile = await getUserProfile(uid).catch(() => null)
                        if (profile?.username) {
                            return { ...item, addedBy: profile.username }
                        }
                    }
                } catch (err) {
                    // ignore
                }
                return item
            }))
        }

        const feedsQuery = fsCollection(db, 'pets', animalData.id, 'feeds')
        const treatmentsQuery = fsCollection(db, 'pets', animalData.id, 'treatments')
        const locationsQuery = fsCollection(db, 'pets', animalData.id, 'locations')

        const parseDateDMY = (s) => {
            if (!s || typeof s !== 'string') return NaN;
            const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (!m) return NaN;
            const day = Number(m[1]);
            const month = Number(m[2]);
            const year = Number(m[3]);
            return new Date(year, month - 1, day).getTime();
        }

        const getTs = (item) => {
            const d1 = parseDateDMY(item.date)
            if (!Number.isNaN(d1)) return d1
            if (item.createdAt) {
                const t = Date.parse(item.createdAt)
                if (!Number.isNaN(t)) return t
            }
            return 0
        }

        const sortItems = (items) => items.sort((a, b) => getTs(b) - getTs(a))

        const unsubFeeds = onSnapshot(feedsQuery, async (snap) => {
            const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
            const enriched = await enrich(items)
            setHistoryRecords((prev) => ({ ...prev, feed: normalizeHistoryItems('feed', sortItems(enriched)) }))
        }, (err) => console.warn('feeds snapshot error', err))

        const unsubTreatments = onSnapshot(treatmentsQuery, async (snap) => {
            const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
            const enriched = await enrich(items)
            setHistoryRecords((prev) => ({ ...prev, treatment: normalizeHistoryItems('treatment', sortItems(enriched)) }))
        }, (err) => console.warn('treatments snapshot error', err))

        const unsubLocations = onSnapshot(locationsQuery, async (snap) => {
            const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
            const enriched = await enrich(items)
            setHistoryRecords((prev) => ({ ...prev, location: normalizeHistoryItems('location', sortItems(enriched)) }))
        }, (err) => console.warn('locations snapshot error', err))

        return () => {
            try { unsubFeeds && unsubFeeds() } catch (e) { }
            try { unsubTreatments && unsubTreatments() } catch (e) { }
            try { unsubLocations && unsubLocations() } catch (e) { }
        }
    }, [animalData?.id])

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

    // clear history records when viewing a different pet to avoid showing previous pet's data
    useEffect(() => {
        setHistoryRecords({ feed: [], treatment: [], location: [] })
    }, [animalData.id])

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
                // ignore
            }
        }

        loadCreatorUsername()

        return () => {
            active = false
        }
    }, [animalData.ownerUid, animalData.ownerId, animalData.addedBy, animalData.addedByUsername])

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
        if (!editForm.age.trim()) return 'Tahmini yaş alanı zorunludur.'

        const ageNumber = Number(editForm.age)
        if (Number.isNaN(ageNumber) || ageNumber < 0 || ageNumber > 30) return 'Tahmini yaş 0 ile 30 arasında olmalıdır.'

        if (!editForm.color.trim()) return 'Renk alanı zorunludur.'
        return ''
    }

    const validateFeedForm = () => {
        if (!feedForm.food.trim()) return 'Verilen yiyecek alanı zorunludur.'
        if (!isValidDate(feedForm.date)) return 'Besleme tarihi DD/MM/YYYY formatında ve geçerli olmalıdır.'
        if (!isValidTime(feedForm.time)) return 'Besleme saati SS:DD formatında ve geçerli olmalıdır.'
        if (isFutureDateTime(feedForm.date, feedForm.time)) return 'Besleme tarihi ve saati ileri bir zaman olamaz.'
        return ''
    }

    const validateTreatmentForm = () => {
        if (!treatmentForm.treatmentType.trim()) return 'Tedavi türü alanı zorunludur.'
        if (!isValidDate(treatmentForm.date)) return 'Tedavi tarihi DD/MM/YYYY formatında ve geçerli olmalıdır.'
        if (!isValidTime(treatmentForm.time)) return 'Tedavi saati SS:DD formatında ve geçerli olmalıdır.'
        if (isFutureDateTime(treatmentForm.date, treatmentForm.time)) return 'Tedavi tarihi ve saati ileri bir zaman olamaz.'
        if (!treatmentForm.vetName || !treatmentForm.vetName.trim()) return 'Veteriner adı zorunludur.'
        return ''
    }

    const validateLocationForm = () => {
        const locationValidation = validateLocationCore(locationForm)
        if (locationValidation) return locationValidation
        if (!isValidDate(locationForm.date)) return 'Konum tarihi DD/MM/YYYY formatında ve geçerli olmalıdır.'
        if (!isValidTime(locationForm.time)) return 'Konum saati SS:DD formatında ve geçerli olmalıdır.'
        if (isFutureDateTime(locationForm.date, locationForm.time)) return 'Konum tarihi ve saati ileri bir zaman olamaz.'
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

    const getInitialFeedForm = () => ({
        food: '',
        date: '',
        time: '',
        city: '',
        district: '',
        neighborhood: '',
        currentLocation: '',
        note: '',
    })

    const getInitialTreatmentForm = () => ({
        treatmentType: '',
        date: '',
        time: '',
        vetName: '',
        note: '',
    })

    const getInitialLocationForm = () => ({
        city: '',
        district: '',
        neighborhood: '',
        date: '',
        time: '',
        currentLocation: '',
    })

    const openFeedModal = () => {
        setFeedForm(getInitialFeedForm())
        setFeedCityId('')
        setFeedDistrictId('')
        setIsFeedModalVisible(true)
    }

    const openTreatmentModal = () => {
        setTreatmentForm(getInitialTreatmentForm())
        setIsTreatmentModalVisible(true)
    }

    const openLocationModal = () => {
        setLocationForm(getInitialLocationForm())
        setLocationCityId('')
        setLocationDistrictId('')
        setIsLocationModalVisible(true)
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
        const user = auth.currentUser
        if (!user) {
            Alert.alert('Giriş Gerekli', 'Besleme kaydı ekleyebilmek için giriş yapmalısınız.')
            return
        }

        const validationError = validateFeedForm()
        if (validationError) {
            Alert.alert('Geçersiz Bilgi', validationError)
            return
        }

        ; (async () => {
            try {
                const profile = await getUserProfile(user.uid).catch(() => null)
                const addedByName = profile?.username || user.displayName || user.email?.split('@')[0] || 'Bilinmiyor'

                const record = {
                    food: feedForm.food.trim(),
                    date: feedForm.date,
                    time: feedForm.time,
                    city: feedForm.city.trim(),
                    district: feedForm.district.trim(),
                    neighborhood: feedForm.neighborhood.trim(),
                    note: feedForm.note.trim(),
                    addedBy: addedByName,
                    addedByUid: user.uid,
                    createdAt: new Date().toISOString(),
                }

                const savedRecord = await addFeedRecord(animalData.id, record)
                const feedRecord = { ...record, id: savedRecord?.id || record.id }
                setHistoryRecords((prev) => ({
                    ...prev,
                    feed: normalizeHistoryItems('feed', [feedRecord, ...(prev.feed || [])]),
                }))
                setFeedForm(getInitialFeedForm())
                closeFeedModal()
                Alert.alert('Başarılı', 'Besleme kaydı eklendi.')
            } catch (err) {
                console.error('saveFeedRecord error', err)
                Alert.alert('Hata', err.message || 'Besleme kaydı eklenemedi.')
            }
        })()
    }

    const saveTreatmentRecord = () => {
        const user = auth.currentUser
        if (!user) {
            Alert.alert('Giriş Gerekli', 'Tedavi kaydı ekleyebilmek için giriş yapmalısınız.')
            return
        }

        const validationError = validateTreatmentForm()
        if (validationError) {
            Alert.alert('Geçersiz Bilgi', validationError)
            return
        }

        ; (async () => {
            try {
                const profile = await getUserProfile(user.uid).catch(() => null)
                const addedByName = profile?.username || user.displayName || user.email?.split('@')[0] || 'Bilinmiyor'

                const record = {
                    treatmentType: treatmentForm.treatmentType.trim(),
                    date: treatmentForm.date,
                    time: treatmentForm.time,
                    vetName: treatmentForm.vetName.trim(),
                    note: treatmentForm.note.trim(),
                    addedBy: addedByName,
                    addedByUid: user.uid,
                    createdAt: new Date().toISOString(),
                }

                const savedRecord = await addTreatmentRecord(animalData.id, record)
                const treatmentRecord = { ...record, id: savedRecord?.id || record.id }
                setHistoryRecords((prev) => ({
                    ...prev,
                    treatment: normalizeHistoryItems('treatment', [treatmentRecord, ...(prev.treatment || [])]),
                }))
                setTreatmentForm(getInitialTreatmentForm())
                closeTreatmentModal()
                Alert.alert('Başarılı', 'Tedavi kaydı eklendi.')
            } catch (err) {
                console.error('saveTreatmentRecord error', err)
                Alert.alert('Hata', err.message || 'Tedavi kaydı eklenemedi.')
            }
        })()
    }

    const saveLocationRecord = () => {
        const user = auth.currentUser
        if (!user) {
            Alert.alert('Giriş Gerekli', 'Konum kaydı ekleyebilmek için giriş yapmalısınız.')
            return
        }

        const validationError = validateLocationForm()
        if (validationError) {
            Alert.alert('Geçersiz Bilgi', validationError)
            return
        }

        ; (async () => {
            try {
                // try to parse currentLocation string like 'lat, lon'
                let latitude = undefined
                let longitude = undefined
                if (locationForm.currentLocation) {
                    const parts = locationForm.currentLocation.split(',').map((s) => s.trim())
                    const lat = Number(parts[0])
                    const lon = Number(parts[1])
                    if (Number.isFinite(lat) && Number.isFinite(lon)) {
                        latitude = lat
                        longitude = lon
                    }
                }

                const profile = await getUserProfile(user.uid).catch(() => null)
                const addedByName = profile?.username || user.displayName || user.email?.split('@')[0] || 'Bilinmiyor'

                const record = {
                    date: locationForm.date,
                    time: locationForm.time,
                    city: locationForm.city.trim(),
                    district: locationForm.district.trim(),
                    neighborhood: locationForm.neighborhood.trim(),
                    currentLocation: locationForm.currentLocation || '',
                    latitude,
                    longitude,
                    detail: locationForm.currentLocation ? `Konum: ${locationForm.currentLocation}` : '',
                    addedBy: addedByName,
                    addedByUid: user.uid,
                    createdAt: new Date().toISOString(),
                }

                const savedRecord = await addLocationRecord(animalData.id, record)
                const locationRecord = { ...record, id: savedRecord?.id || record.id }

                if (latitude !== undefined && longitude !== undefined) {
                    setAnimalData((prev) => ({ ...prev, latitude, longitude, city: record.city, district: record.district, neighborhood: record.neighborhood, lastSeenAtRaw: record.date }))
                }

                setHistoryRecords((prev) => ({
                    ...prev,
                    location: normalizeHistoryItems('location', [locationRecord, ...(prev.location || [])]),
                }))
                setLocationForm(getInitialLocationForm())
                closeLocationModal()
                Alert.alert('Başarılı', 'Konum kaydı eklendi.')
            } catch (err) {
                console.error('saveLocationRecord error', err)
                Alert.alert('Hata', err.message || 'Konum kaydı eklenemedi.')
            }
        })()
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

    const handleOpenMapAtLastLocation = () => {
        const lat = animalData.latitude || null
        const lon = animalData.longitude || null

        // always pass focusPetId so MapPage can focus when latest location becomes available
        const params = { focusPetId: animalData.id }
        if (lat && lon) params.focusCoords = { latitude: lat, longitude: lon }

        navigation.navigate('AnimalMap', params)
    }

    if (!hasPetData) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#fff' }}>
                <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>Hayvan bilgisi yüklenemedi</Text>
                <Text style={{ fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 20 }}>
                    Bu sayfa bir hayvan kartı üzerinden açılmalı.
                </Text>
                <Pressable onPress={() => navigation.goBack()} style={{ backgroundColor: '#2563eb', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10 }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Geri Dön</Text>
                </Pressable>
            </View>
        )
    }

    const scrollRef = useRef(null)

    useFocusEffect(
        useCallback(() => {
            // scroll to top whenever the screen receives focus
            try { scrollRef.current && scrollRef.current.scrollTo({ y: 0, animated: false }) } catch (e) { }
        }, [])
    )

    return (
        <ScrollView ref={scrollRef} style={styles.screen} contentContainerStyle={styles.screenContent}>
            <View style={styles.headerShell}>
                <View style={styles.headerAccent} />
                <View style={styles.header}>
                    <Pressable style={styles.backButton} onPress={() => navigation.navigate('AnimalList')}>
                        <Ionicons name="chevron-back" size={24} color="#111827" />
                    </Pressable>

                    <Text style={styles.headerText} numberOfLines={1} ellipsizeMode="tail">
                        {animalData.name}
                    </Text>

                    <View style={styles.headerActions}>
                        <Pressable style={styles.actionButton} onPress={handleToggleFavorite}>
                            <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={22} color="#e53935" />
                        </Pressable>
                        <Pressable style={styles.actionButton} onPress={openEditModal}>
                            <Ionicons name="create-outline" size={22} color="#111827" />
                        </Pressable>
                    </View>
                </View>
            </View>

            <View style={styles.heroCard}>
                <View style={styles.heroImageWrap}>
                    {animalData.imageUri ? (
                        <Image source={{ uri: animalData.imageUri }} style={styles.animalImage} />
                    ) : (
                        <View style={styles.heroEmptyState}>
                            <Ionicons name='image-outline' size={46} color='#8a94a6' />
                            <Text style={styles.heroEmptyText}>Fotoğraf yok</Text>
                        </View>
                    )}
                </View>

                <View style={styles.heroDetails}>
                    <View style={styles.heroPillRow}>
                        <View style={styles.heroPill}>
                            <Text style={styles.heroPillText}>{animalData.type}</Text>
                        </View>
                        <View style={styles.heroPillSoft}>
                            <Text style={styles.heroPillSoftText}>{animalData.gender}</Text>
                        </View>
                    </View>

                    <View style={styles.heroInfoGrid}>
                        <View style={styles.heroInfoChip}>
                            <Text style={styles.heroInfoLabel}>Cins</Text>
                            <Text style={styles.heroInfoValue}>{animalData.breed}</Text>
                        </View>
                        <View style={styles.heroInfoChip}>
                            <Text style={styles.heroInfoLabel}>Tahmini Yaş</Text>
                            <Text style={styles.heroInfoValue}>{animalData.age}</Text>
                        </View>
                        <View style={styles.heroInfoChip}>
                            <Text style={styles.heroInfoLabel}>Renk</Text>
                            <Text style={styles.heroInfoValue}>{animalData.color}</Text>
                        </View>
                    </View>

                    {!!animalData.note?.trim() && (
                        <View style={styles.heroNoteCard}>
                            <Text style={styles.heroNoteTitle}>Diğer Bilgiler</Text>
                            <Text style={styles.heroNoteText}>{animalData.note}</Text>
                        </View>
                    )}
                </View>
            </View>

            <View style={styles.metaCard}>
                <View style={styles.animalDetailRow}>
                    <View style={styles.metaIconWrap}>
                        <Ionicons name="person-outline" size={16} color="#5b21b6" />
                    </View>
                    <View style={styles.metaTextBlock}>
                        <Text style={styles.metaLabel}>Ekleyen Kullanıcı</Text>
                        <Text style={styles.metaValue}>{animalData.addedByUsername || animalData.createdByUsername || animalData.addedBy || 'Bilinmiyor'}</Text>
                    </View>
                </View>
                <View style={styles.metaDivider} />
                <View style={styles.animalDetailRow}>
                    <View style={styles.metaIconWrap}>
                        <Ionicons name="calendar-clear-outline" size={16} color="#0f766e" />
                    </View>
                    <View style={styles.metaTextBlock}>
                        <Text style={styles.metaLabel}>Eklenme Tarihi</Text>
                        <Text style={styles.metaValue}>{animalData.addedAt}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.actionSection}>
                <Text style={styles.sectionTitle}>Yeni Kayıt Ekle</Text>
                <View style={styles.newRecordContainer}>
                    <Pressable style={[styles.newRecordButton, styles.newRecordFeedButton]} onPress={openFeedModal}>
                        <Ionicons name="restaurant-outline" size={20} color="#fff" />
                        <Text style={styles.newRecordButtonText}>Besleme</Text>
                    </Pressable>
                    <Pressable style={[styles.newRecordButton, styles.newRecordTreatmentButton]} onPress={openTreatmentModal}>
                        <Ionicons name="medkit-outline" size={20} color="#fff" />
                        <Text style={styles.newRecordButtonText}>Tedavi</Text>
                    </Pressable>
                    <Pressable style={[styles.newRecordButton, styles.newRecordLocationButton]} onPress={openLocationModal}>
                        <Ionicons name="location-outline" size={20} color="#fff" />
                        <Text style={styles.newRecordButtonText}>Konum</Text>
                    </Pressable>
                </View>
            </View>

            <View style={styles.secondaryActionCard}>
                <Pressable style={styles.lastLocationButton} onPress={handleOpenMapAtLastLocation}>
                    <View style={styles.lastLocationLeftSide}>
                        <View style={styles.lastLocationIconWrap}>
                            <Image source={require('../images/dataImages/map.png')} style={styles.mapImage} />
                        </View>
                        <View>
                            <Text style={styles.lastLocationText}>Son Konumu Haritada Gör</Text>
                            <Text style={styles.lastLocationSubText}>Güncel rota ve detayları aç</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#fff" />
                </Pressable>
            </View>

            <View style={styles.historySection}>
                <Text style={styles.sectionTitle}>Geçmiş Kayıtlar</Text>
                <Pressable style={styles.pastContainer} onPress={() => openHistoryDrawer('feed')}>
                    <View style={styles.pastLeftSide}>
                        <View style={styles.pastIconWrap}>
                            <Image source={require('../images/dataImages/food.png')} style={styles.pastIcon} />
                        </View>
                        <Text style={styles.pastText}>Besleme Geçmişi</Text>
                    </View>
                    <View style={styles.pastButton}>
                        <Ionicons name="chevron-forward" size={22} color="#111827" />
                    </View>
                </Pressable>
                <Pressable style={styles.pastContainer} onPress={() => openHistoryDrawer('treatment')}>
                    <View style={styles.pastLeftSide}>
                        <View style={styles.pastIconWrap}>
                            <Image source={require('../images/dataImages/health.png')} style={styles.pastIcon} />
                        </View>
                        <Text style={styles.pastText}>Tedavi Geçmişi</Text>
                    </View>
                    <View style={styles.pastButton}>
                        <Ionicons name="chevron-forward" size={22} color="#111827" />
                    </View>
                </Pressable>
                <Pressable style={styles.pastContainer} onPress={() => openHistoryDrawer('location')}>
                    <View style={styles.pastLeftSide}>
                        <View style={styles.pastIconWrap}>
                            <Image source={require('../images/dataImages/map.png')} style={styles.pastIcon} />
                        </View>
                        <Text style={styles.pastText}>Konum Geçmişi</Text>
                    </View>
                    <View style={styles.pastButton}>
                        <Ionicons name="chevron-forward" size={22} color="#111827" />
                    </View>
                </Pressable>
            </View>

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
                            <TextInput style={styles.modalInput} value={editForm.age} onChangeText={(value) => updateEditField('age', value)} placeholder='Tahmini Yaş' keyboardType='number-pad' />
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
                            {selectedHistoryRecords.map((item, index) => {
                                const detailText = item.detail || item.food || item.treatmentType || item.note || ''
                                const locationLabel = [item.city, item.district, item.neighborhood].filter(Boolean).join(', ')
                                const coords = item.currentLocation || (item.latitude && item.longitude ? `${item.latitude}, ${item.longitude}` : '')
                                const displayDate = item.date || (item.createdAt ? new Date(item.createdAt).toLocaleDateString('tr-TR') : '')
                                const displayTime = item.time || (item.createdAt ? new Date(item.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '')

                                return (
                                    <View key={`${historyDrawerType}-${index}`} style={styles.historyCard}>
                                        {historyDrawerType === 'feed' ? (
                                            <>
                                                <Text style={styles.historyDetailText}>{item.food || detailText}</Text>
                                                {item.note ? <Text style={styles.historyNoteText}>{item.note}</Text> : null}
                                            </>
                                        ) : historyDrawerType === 'treatment' ? (
                                            <>
                                                <Text style={styles.historyDetailText}>{item.treatmentType || detailText}</Text>
                                                {item.vetName ? <Text style={styles.historyVetText}>Veteriner: {item.vetName}</Text> : null}
                                                {item.note ? <Text style={styles.historyNoteText}>{item.note}</Text> : null}
                                            </>
                                        ) : (
                                            <Text style={styles.historyDetailText}>{detailText}</Text>
                                        )}
                                        <View style={styles.historyInfoRow}>
                                            <Ionicons name='person-outline' size={15} color='#7c3aed' />
                                            <Text style={styles.historyInfoText}>Ekleyen: {item.addedBy || 'Bilinmiyor'}</Text>
                                        </View>
                                        {locationLabel ? (
                                            <View style={styles.historyInfoRow}>
                                                <Ionicons name='location-outline' size={15} color='#2563eb' />
                                                <Text style={styles.historyInfoText}>{locationLabel}</Text>
                                            </View>
                                        ) : null}
                                        {coords ? (
                                            <View style={styles.historyInfoRow}>
                                                <Ionicons name='navigate-outline' size={15} color='#0f766e' />
                                                <Text style={styles.historyInfoText}>{coords}</Text>
                                            </View>
                                        ) : null}
                                        <Text style={styles.historyDateTime}>{displayDate}{displayTime ? ` • ${displayTime}` : ''}</Text>
                                    </View>
                                )
                            })}
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
                            <Pressable style={styles.locationPickerButton} onPress={() => openLocationPicker('feed', 'city')}>
                                <Text style={feedForm.city ? styles.locationPickerValue : styles.locationPickerPlaceholder}>
                                    {feedForm.city || 'Şehir seçin'}
                                </Text>
                                <Ionicons name='chevron-down' size={18} color='#6b7280' />
                            </Pressable>
                            <Pressable
                                style={[styles.locationPickerButton, !feedForm.city && styles.locationPickerDisabled]}
                                onPress={() => openLocationPicker('feed', 'district')}
                            >
                                <Text style={feedForm.district ? styles.locationPickerValue : styles.locationPickerPlaceholder}>
                                    {feedForm.city ? (feedForm.district || 'İlçe seçin') : 'Önce şehir seçin'}
                                </Text>
                                <Ionicons name='chevron-down' size={18} color='#6b7280' />
                            </Pressable>
                            <Pressable
                                style={[styles.locationPickerButton, (!feedForm.city || !feedForm.district) && styles.locationPickerDisabled]}
                                onPress={() => openLocationPicker('feed', 'neighborhood')}
                            >
                                <Text style={feedForm.neighborhood ? styles.locationPickerValue : styles.locationPickerPlaceholder}>
                                    {feedForm.city && feedForm.district ? (feedForm.neighborhood || 'Mahalle seçin') : 'Önce şehir ve ilçe seçin'}
                                </Text>
                                <Ionicons name='chevron-down' size={18} color='#6b7280' />
                            </Pressable>
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
                                placeholder='Veteriner Adı'
                                value={treatmentForm.vetName}
                                onChangeText={(value) => setTreatmentForm((prev) => ({ ...prev, vetName: sanitizeGeneralText(value, 80) }))}
                            />
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
                            <Pressable style={styles.locationPickerButton} onPress={() => openLocationPicker('location', 'city')}>
                                <Text style={locationForm.city ? styles.locationPickerValue : styles.locationPickerPlaceholder}>
                                    {locationForm.city || 'Şehir seçin'}
                                </Text>
                                <Ionicons name='chevron-down' size={18} color='#6b7280' />
                            </Pressable>
                            <Pressable
                                style={[styles.locationPickerButton, !locationForm.city && styles.locationPickerDisabled]}
                                onPress={() => openLocationPicker('location', 'district')}
                            >
                                <Text style={locationForm.district ? styles.locationPickerValue : styles.locationPickerPlaceholder}>
                                    {locationForm.city ? (locationForm.district || 'İlçe seçin') : 'Önce şehir seçin'}
                                </Text>
                                <Ionicons name='chevron-down' size={18} color='#6b7280' />
                            </Pressable>
                            <Pressable
                                style={[styles.locationPickerButton, (!locationForm.city || !locationForm.district) && styles.locationPickerDisabled]}
                                onPress={() => openLocationPicker('location', 'neighborhood')}
                            >
                                <Text style={locationForm.neighborhood ? styles.locationPickerValue : styles.locationPickerPlaceholder}>
                                    {locationForm.city && locationForm.district ? (locationForm.neighborhood || 'Mahalle seçin') : 'Önce şehir ve ilçe seçin'}
                                </Text>
                                <Ionicons name='chevron-down' size={18} color='#6b7280' />
                            </Pressable>
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

            <Modal
                visible={locationPickerVisible}
                transparent
                animationType='fade'
                statusBarTranslucent
                onRequestClose={closeLocationPicker}
            >
                <View style={styles.locationPickerOverlay}>
                    <Pressable style={styles.locationPickerBackdrop} onPress={closeLocationPicker} />
                    <View style={styles.locationPickerCard}>
                        <View style={styles.locationPickerHeader}>
                            <Text style={styles.locationPickerTitle}>
                                {locationPickerType === 'city'
                                    ? 'Şehir Seç'
                                    : locationPickerType === 'district'
                                        ? 'İlçe Seç'
                                        : 'Mahalle Seç'}
                            </Text>
                            <Pressable onPress={closeLocationPicker} style={styles.locationPickerCloseButton}>
                                <Ionicons name='close' size={22} color='#1f2937' />
                            </Pressable>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.locationPickerList}>
                            {locationPickerType === 'city' ? (
                                cities.map((city) => (
                                    <Pressable key={city.sehir_id} style={styles.locationPickerOption} onPress={() => applyLocationSelection(city)}>
                                        <Text style={styles.locationPickerOptionText}>{city.sehir_adi}</Text>
                                    </Pressable>
                                ))
                            ) : locationPickerType === 'district' ? (
                                activeLocationDistrictOptions.map((district) => (
                                    <Pressable key={district.ilce_id} style={styles.locationPickerOption} onPress={() => applyLocationSelection(district)}>
                                        <Text style={styles.locationPickerOptionText}>{district.ilce_adi}</Text>
                                    </Pressable>
                                ))
                            ) : activeLocationNeighborhoodOptions.length === 0 ? (
                                <View style={styles.locationPickerEmptyState}>
                                    <Text style={styles.locationPickerEmptyText}>Yükleniyor veya seçenek bulunamadı.</Text>
                                </View>
                            ) : (
                                activeLocationNeighborhoodOptions.map((neighborhood) => (
                                    <Pressable key={neighborhood.mahalle_id} style={styles.locationPickerOption} onPress={() => applyLocationSelection(neighborhood)}>
                                        <Text style={styles.locationPickerOptionText}>{neighborhood.mahalle_adi}</Text>
                                    </Pressable>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    screen: {
        backgroundColor: '#f3f6fb',
    },
    screenContent: {
        paddingBottom: 28,
    },
    headerShell: {
        marginTop: 54,
        marginHorizontal: 16,
        borderRadius: 28,
        overflow: 'hidden',
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 6,
    },
    headerAccent: {
        height: 6,
        backgroundColor: getColor('--light-six'),
    },
    header: {
        backgroundColor: '#ffffff',
        paddingVertical: 14,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: {
        flex: 1,
        fontSize: 26,
        lineHeight: 30,
        fontWeight: '800',
        color: '#111827',
        textAlign: 'center',
        paddingHorizontal: 12,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    actionButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroCard: {
        marginTop: 16,
        marginHorizontal: 16,
        backgroundColor: '#ffffff',
        borderRadius: 28,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.09,
        shadowRadius: 24,
        elevation: 6,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    heroImageWrap: {
        width: '100%',
        height: 250,
        borderRadius: 22,
        overflow: 'hidden',
        backgroundColor: '#e9eef7',
    },
    heroEmptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    heroEmptyText: {
        fontSize: 14,
        color: '#6b7280',
        fontWeight: '600',
    },
    heroDetails: {
        marginTop: 14,
        gap: 12,
    },
    heroPillRow: {
        flexDirection: 'row',
        gap: 10,
        flexWrap: 'wrap',
    },
    heroPill: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: getColor('--light-six'),
    },
    heroPillSoft: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: '#eef2ff',
    },
    heroPillText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '800',
    },
    heroPillSoftText: {
        color: '#3730a3',
        fontSize: 12,
        fontWeight: '800',
    },
    heroInfoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    heroInfoChip: {
        flexBasis: '31%',
        minWidth: 96,
        flexGrow: 1,
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    heroInfoLabel: {
        fontSize: 11,
        color: '#6b7280',
        fontWeight: '700',
        marginBottom: 4,
    },
    heroInfoValue: {
        fontSize: 14,
        color: '#111827',
        fontWeight: '800',
    },
    heroNoteCard: {
        backgroundColor: '#fff7ed',
        borderRadius: 18,
        padding: 12,
        borderWidth: 1,
        borderColor: '#fed7aa',
    },
    heroNoteTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#9a3412',
        marginBottom: 6,
    },
    heroNoteText: {
        fontSize: 14,
        lineHeight: 20,
        color: '#7c2d12',
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
        color: '#111827',
        paddingVertical: 5,
        flex: 1,
    },
    animalDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    metaCard: {
        marginTop: 14,
        marginHorizontal: 16,
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 3,
    },
    metaIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6',
    },
    metaTextBlock: {
        flex: 1,
    },
    metaLabel: {
        fontSize: 11,
        color: '#6b7280',
        fontWeight: '700',
        marginBottom: 2,
    },
    metaValue: {
        fontSize: 14,
        color: '#111827',
        fontWeight: '700',
    },
    metaDivider: {
        height: 1,
        backgroundColor: '#e5e7eb',
        marginVertical: 12,
    },
    actionSection: {
        marginTop: 18,
    },
    sectionTitle: {
        paddingHorizontal: 16,
        marginBottom: 10,
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
    },
    newRecordContainer: {
        paddingHorizontal: 16,
        flexDirection: 'row',
        gap: 10,
        alignItems: 'stretch',
    },
    newRecordButton: {
        flex: 1,
        borderRadius: 20,
        minHeight: 102,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        paddingVertical: 12,
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 18,
        elevation: 4,
    },
    newRecordFeedButton: {
        backgroundColor: '#f0c41b',
    },
    newRecordTreatmentButton: {
        backgroundColor: '#59b35a',
    },
    newRecordLocationButton: {
        backgroundColor: '#4c9cf0',
    },
    newRecordButtonText: {
        color: 'white',
        fontSize: 13,
        fontWeight: '800',
        textAlign: 'center',
    },
    secondaryActionCard: {
        marginTop: 16,
        paddingHorizontal: 16,
    },
    lastLocationContainer: {
        marginTop: 0,
        marginBottom: 0,
    },
    lastLocationButton: {
        backgroundColor: '#111827',
        borderRadius: 24,
        paddingVertical: 14,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
        elevation: 5,
    },
    lastLocationLeftSide: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    lastLocationIconWrap: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    lastLocationText: {
        color: 'white',
        fontSize: 15,
        fontWeight: '800',
    },
    lastLocationSubText: {
        marginTop: 2,
        color: 'rgba(255,255,255,0.76)',
        fontSize: 12,
        fontWeight: '500',
    },
    mapImage: {
        width: 22,
        height: 22,
    },
    historySection: {
        marginTop: 18,
    },
    pastContainer: {
        marginTop: 10,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
        width: '92%',
        alignSelf: 'center',
        borderRadius: 18,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 2,
    },
    pastLeftSide: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 10,
    },
    pastIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pastIcon: {
        width: 20,
        height: 20,
    },
    pastText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111827',
    },
    pastButton: {
        borderRadius: 12,
        paddingVertical: 8,
        paddingHorizontal: 10,
        backgroundColor: '#f3f4f6',
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
    historyNoteText: {
        fontSize: 13,
        color: '#4b5563',
        marginBottom: 8,
    },
    historyVetText: {
        fontSize: 13,
        color: '#111827',
        fontWeight: '700',
        marginBottom: 6,
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
    locationPickerButton: {
        borderWidth: 1,
        borderColor: getColor('--light-six'),
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 12,
        marginBottom: 8,
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    locationPickerDisabled: {
        opacity: 0.65,
    },
    locationPickerValue: {
        fontSize: 14,
        color: '#111827',
        fontWeight: '500',
        flex: 1,
        marginRight: 10,
    },
    locationPickerPlaceholder: {
        fontSize: 14,
        color: '#6b7280',
        flex: 1,
        marginRight: 10,
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
    locationPickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    locationPickerBackdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    locationPickerCard: {
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 16,
        maxHeight: '78%',
    },
    locationPickerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    locationPickerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    locationPickerCloseButton: {
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
    },
    locationPickerList: {
        paddingBottom: 6,
    },
    locationPickerOption: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginBottom: 8,
        backgroundColor: '#f8fafc',
    },
    locationPickerOptionText: {
        fontSize: 14,
        color: '#111827',
        fontWeight: '500',
    },
    locationPickerEmptyState: {
        paddingVertical: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    locationPickerEmptyText: {
        color: '#6b7280',
        fontSize: 14,
        textAlign: 'center',
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
        marginTop: 20,
    },
    animalDeleteButton: {
        backgroundColor: '#e53935',
        borderRadius: 16,
        alignItems: 'center',
        paddingVertical: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 3,
    },
    animalDeleteButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
    },
})