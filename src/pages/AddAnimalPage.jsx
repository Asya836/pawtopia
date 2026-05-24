import { StyleSheet, Text, View, ScrollView, Image, Dimensions, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native'
import React, { useEffect, useMemo, useState } from 'react'
import { getColor } from '../css/theme'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import { auth } from '../firebase/config'
import { addPet, getUserProfile, uploadImageFromUri } from '../firebase/helpers'

const { height: screenHeight } = Dimensions.get('window')
const CITY_URL = 'https://raw.githubusercontent.com/metinyildirimnet/turkiye-adresler-json/master/sehirler.json'
const DISTRICT_URL = 'https://raw.githubusercontent.com/metinyildirimnet/turkiye-adresler-json/master/ilceler.json'
const NEIGHBORHOOD_URLS = [
    'https://raw.githubusercontent.com/metinyildirimnet/turkiye-adresler-json/master/mahalleler-1.json',
    'https://raw.githubusercontent.com/metinyildirimnet/turkiye-adresler-json/master/mahalleler-2.json',
    'https://raw.githubusercontent.com/metinyildirimnet/turkiye-adresler-json/master/mahalleler-3.json',
    'https://raw.githubusercontent.com/metinyildirimnet/turkiye-adresler-json/master/mahalleler-4.json',
]

const ANIMAL_TYPE_OPTIONS = ['Kedi', 'Köpek']

const CAT_BREED_OPTIONS = [
    'Abyssinian',
    'Aegean',
    'American Bobtail',
    'American Curl',
    'American Shorthair',
    'American Wirehair',
    'Arabian Mau',
    'Australian Mist',
    'Balinese',
    'Bambino',
    'Bengal',
    'Birman',
    'Bombay',
    'British Longhair',
    'British Shorthair',
    'Burmese',
    'Burmilla',
    'California Spangled',
    'Chantilly-Tiffany',
    'Chartreux',
    'Chausie',
    'Cheetoh',
    'Colorpoint Shorthair',
    'Cornish Rex',
    'Cyprus',
    'Cymric',
    'Devon Rex',
    'Diğer',
    'Donskoy',
    'Dragon Li',
    'Egyptian Mau',
    'European Burmese',
    'Exotic Shorthair',
    'Havana Brown',
    'Himalayan',
    'Japanese Bobtail',
    'Javanese',
    'Khao Manee',
    'Korat',
    'Kurilian',
    'LaPerm',
    'Maine Coon',
    'Malayan',
    'Manx',
    'Munchkin',
    'Nebelung',
    'Norwegian Forest Cat',
    'Ocicat',
    'Oriental',
    'Persian',
    'Pixie-bob',
    'Ragamuffin',
    'Ragdoll',
    'Russian Blue',
    'Savannah',
    'Scottish Fold',
    'Selkirk Rex',
    'Siamese',
    'Siberian',
    'Singapura',
    'Snowshoe',
    'Somali',
    'Sphynx',
    'Tekir',
    'Tonkinese',
    'Toyger',
    'Turkish Angora',
    'Turkish Van',
    'Van Kedisi',
    'York Chocolate',
    'Ankara Kedisi',
    'Sarman',
]

const DOG_BREED_OPTIONS = [
    'Affenpinscher',
    'Afghan Hound',
    'Akita',
    'Alaskan Malamute',
    'American Bulldog',
    'American Cocker Spaniel',
    'American Eskimo Dog',
    'American Pit Bull Terrier',
    'American Staffordshire Terrier',
    'Anatolian Shepherd Dog',
    'Australian Cattle Dog',
    'Australian Shepherd',
    'Basenji',
    'Basset Hound',
    'Beagle',
    'Belgian Malinois',
    'Bernese Mountain Dog',
    'Bichon Frise',
    'Bloodhound',
    'Border Collie',
    'Border Terrier',
    'Boston Terrier',
    'Boxer',
    'Bull Terrier',
    'Bullmastiff',
    'Cane Corso',
    'Cavalier King Charles Spaniel',
    'Chihuahua',
    'Chow Chow',
    'Cocker Spaniel',
    'Dachshund',
    'Dalmatian',
    'Doberman Pinscher',
    'English Bulldog',
    'English Cocker Spaniel',
    'English Setter',
    'French Bulldog',
    'German Shepherd',
    'German Shorthaired Pointer',
    'Golden Retriever',
    'Great Dane',
    'Greyhound',
    'Husky',
    'Irish Setter',
    'Jack Russell Terrier',
    'Kangal',
    'Labrador Retriever',
    'Maltese',
    'Miniature Schnauzer',
    'Newfoundland',
    'Pomeranian',
    'Poodle',
    'Pug',
    'Rottweiler',
    'Samoyed',
    'Shiba Inu',
    'Shih Tzu',
    'Siberian Husky',
    'Staffordshire Bull Terrier',
    'Terrier',
    'Tibetan Mastiff',
    'Weimaraner',
    'West Highland White Terrier',
    'Yorkshire Terrier',
    'Melez',
    'Diğer',
]

export default function AddAnimalPage() {
    const navigation = useNavigation()
    const [selectedImageUri, setSelectedImageUri] = useState(null)
    const [selectedImageBase64, setSelectedImageBase64] = useState('')
    const [animalName, setAnimalName] = useState('')
    const [animalType, setAnimalType] = useState('')
    const [animalBreed, setAnimalBreed] = useState('')
    const [animalColor, setAnimalColor] = useState('')
    const [animalAge, setAnimalAge] = useState('')
    const [animalDescription, setAnimalDescription] = useState('')
    const [selectedGender, setSelectedGender] = useState('')
    const [isGenderOpen, setIsGenderOpen] = useState(false)
    const [isTypeOpen, setIsTypeOpen] = useState(false)
    const [isBreedOpen, setIsBreedOpen] = useState(false)
    const [cities, setCities] = useState([])
    const [districts, setDistricts] = useState([])
    const [neighborhoods, setNeighborhoods] = useState([])
    const [selectedCityId, setSelectedCityId] = useState('')
    const [selectedDistrictId, setSelectedDistrictId] = useState('')
    const [selectedCity, setSelectedCity] = useState('')
    const [selectedDistrict, setSelectedDistrict] = useState('')
    const [selectedNeighborhood, setSelectedNeighborhood] = useState('')
    const [creatorUsername, setCreatorUsername] = useState('')
    const [isCityOpen, setIsCityOpen] = useState(false)
    const [isDistrictOpen, setIsDistrictOpen] = useState(false)
    const [isNeighborhoodOpen, setIsNeighborhoodOpen] = useState(false)
    const [isLoadingNeighborhoods, setIsLoadingNeighborhoods] = useState(false)
    const [latitude, setLatitude] = useState(null)
    const [longitude, setLongitude] = useState(null)
    const [isLoadingLocation, setIsLoadingLocation] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [errors, setErrors] = useState({})

    const clearFieldError = (field) => {
        setErrors((prev) => {
            if (!prev[field]) return prev
            const next = { ...prev }
            delete next[field]
            return next
        })
    }

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
            }
        }

        loadBaseLocations()
    }, [])

    useEffect(() => {
        const loadCreatorUsername = async () => {
            const user = auth.currentUser
            if (!user) return

            try {
                const profile = await getUserProfile(user.uid)
                setCreatorUsername(profile?.username || user.displayName || user.email?.split('@')[0] || 'Bilinmiyor')
            } catch (error) {
                setCreatorUsername(user.displayName || user.email?.split('@')[0] || 'Bilinmiyor')
            }
        }

        loadCreatorUsername()
    }, [])

    const districtOptions = useMemo(
        () => districts.filter((item) => item.sehir_id === selectedCityId),
        [districts, selectedCityId]
    )

    const neighborhoodOptions = useMemo(
        () => neighborhoods.filter((item) => item.sehir_id === selectedCityId && item.ilce_id === selectedDistrictId),
        [neighborhoods, selectedCityId, selectedDistrictId]
    )

    const breedOptions = useMemo(
        () => {
            if (animalType === 'Kedi') return CAT_BREED_OPTIONS
            if (animalType === 'Köpek') return DOG_BREED_OPTIONS
            return []
        },
        [animalType]
    )

    const loadAllNeighborhoods = async () => {
        if (neighborhoods.length > 0 || isLoadingNeighborhoods) return

        try {
            setIsLoadingNeighborhoods(true)
            const responses = await Promise.all(NEIGHBORHOOD_URLS.map((url) => fetch(url)))
            const chunks = await Promise.all(responses.map((response) => response.json()))
            const mergedNeighborhoods = chunks.flat().filter(Boolean)
            setNeighborhoods(mergedNeighborhoods)
        } catch (error) {
        } finally {
            setIsLoadingNeighborhoods(false)
        }
    }

    const toggleCityDropdown = () => {
        setIsCityOpen((prev) => !prev)
        setIsDistrictOpen(false)
        setIsNeighborhoodOpen(false)
        setIsGenderOpen(false)
        setIsTypeOpen(false)
        setIsBreedOpen(false)
    }

    const toggleDistrictDropdown = () => {
        if (!selectedCity) return
        setIsDistrictOpen((prev) => !prev)
        setIsCityOpen(false)
        setIsNeighborhoodOpen(false)
        setIsGenderOpen(false)
        setIsTypeOpen(false)
        setIsBreedOpen(false)
    }

    const toggleNeighborhoodDropdown = async () => {
        if (!selectedCity || !selectedDistrict) return
        await loadAllNeighborhoods()
        setIsNeighborhoodOpen((prev) => !prev)
        setIsCityOpen(false)
        setIsDistrictOpen(false)
        setIsGenderOpen(false)
        setIsTypeOpen(false)
        setIsBreedOpen(false)
    }

    const toggleTypeDropdown = () => {
        setIsTypeOpen((prev) => !prev)
        setIsGenderOpen(false)
        setIsCityOpen(false)
        setIsDistrictOpen(false)
        setIsNeighborhoodOpen(false)
        setIsBreedOpen(false)
    }

    const toggleBreedDropdown = () => {
        if (!animalType) return
        setIsBreedOpen((prev) => !prev)
        setIsGenderOpen(false)
        setIsCityOpen(false)
        setIsDistrictOpen(false)
        setIsNeighborhoodOpen(false)
        setIsTypeOpen(false)
    }

    const selectAnimalType = (type) => {
        setAnimalType(type)
        setAnimalBreed('')
        clearFieldError('animalType')
        clearFieldError('animalBreed')
        setIsTypeOpen(false)
        setIsBreedOpen(false)
    }

    const selectAnimalBreed = (breed) => {
        setAnimalBreed(breed)
        clearFieldError('animalBreed')
        setIsBreedOpen(false)
    }

    const selectCity = (city) => {
        setSelectedCity(city.sehir_adi)
        setSelectedCityId(city.sehir_id)
        setSelectedDistrict('')
        setSelectedDistrictId('')
        setSelectedNeighborhood('')
        setIsCityOpen(false)
    }

    const selectDistrict = (district) => {
        setSelectedDistrict(district.ilce_adi)
        setSelectedDistrictId(district.ilce_id)
        setSelectedNeighborhood('')
        setIsDistrictOpen(false)
    }

    const selectNeighborhood = (neighborhood) => {
        setSelectedNeighborhood(neighborhood.mahalle_adi)
        setIsNeighborhoodOpen(false)
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
            aspect: [4, 3],
            quality: 0.85,
            base64: true,
        })

        if (!imageResult.canceled && imageResult.assets?.length) {
            setSelectedImageUri(imageResult.assets[0].uri)
            setSelectedImageBase64(imageResult.assets[0].base64 || '')
            clearFieldError('image')
        }
    }

    const handleGetCurrentLocation = async () => {
        try {
            setIsLoadingLocation(true)
            const { status } = await Location.requestForegroundPermissionsAsync()

            if (status !== 'granted') {
                Alert.alert('İzin Gerekli', 'Konum erişimi için izni vermelisin.')
                return
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            })

            setLatitude(location.coords.latitude)
            setLongitude(location.coords.longitude)
            clearFieldError('location')
            Alert.alert('Başarılı', `Konum kaydedildi.\nEnlem: ${location.coords.latitude.toFixed(4)}\nBoylam: ${location.coords.longitude.toFixed(4)}`)
        } catch (error) {
            Alert.alert('Hata', 'Konum alınamadı: ' + error.message)
        } finally {
            setIsLoadingLocation(false)
        }
    }

    const validateForm = () => {
        const nextErrors = {}

        if (!selectedImageUri) nextErrors.image = 'Lütfen bir hayvan resmi ekleyin.'
        if (!animalName.trim()) nextErrors.animalName = 'Hayvan adı zorunludur.'
        if (!animalType.trim()) nextErrors.animalType = 'Hayvan türü zorunludur.'
        if (!animalBreed.trim()) nextErrors.animalBreed = 'Hayvanın cinsi zorunludur.'
        if (!animalColor.trim()) nextErrors.animalColor = 'Hayvanın rengi zorunludur.'

        if (!animalAge.trim()) {
            nextErrors.animalAge = 'Hayvan yaşı zorunludur.'
        } else {
            const numericAge = Number(animalAge)
            if (!Number.isInteger(numericAge) || numericAge <= 0 || numericAge > 40) {
                nextErrors.animalAge = 'Yaş 1 ile 40 arasında bir sayı olmalıdır.'
            }
        }

        if (!selectedGender) nextErrors.gender = 'Cinsiyet seçimi zorunludur.'
        if (!selectedCity) nextErrors.city = 'İl seçimi zorunludur.'
        if (!selectedDistrict) nextErrors.district = 'İlçe seçimi zorunludur.'
        if (!selectedNeighborhood) nextErrors.neighborhood = 'Mahalle seçimi zorunludur.'
        if (latitude === null || longitude === null) nextErrors.location = 'Lütfen güncel konumu ekleyin.'

        setErrors(nextErrors)
        return Object.keys(nextErrors).length === 0
    }

    const resetForm = () => {
        setSelectedImageUri(null)
        setSelectedImageBase64('')
        setAnimalName('')
        setAnimalType('')
        setAnimalBreed('')
        setAnimalColor('')
        setAnimalAge('')
        setAnimalDescription('')
        setSelectedGender('')
        setIsGenderOpen(false)
        setIsTypeOpen(false)
        setIsBreedOpen(false)
        setSelectedCityId('')
        setSelectedDistrictId('')
        setSelectedCity('')
        setSelectedDistrict('')
        setSelectedNeighborhood('')
        setLatitude(null)
        setLongitude(null)
        setErrors({})
    }

    const handleSave = async () => {
        if (!validateForm()) {
            Alert.alert('Eksik Bilgi', 'Lütfen zorunlu alanları doğru şekilde doldurun.')
            return
        }

        const user = auth.currentUser
        if (!user) {
            Alert.alert('Hata', 'Hayvan eklemek için giriş yapmış olmalısın.')
            return
        }

        try {
            setIsSaving(true)

            let imageUrl = selectedImageUri
            let imageSource = 'local'
            try {
                imageUrl = await uploadImageFromUri(selectedImageUri, 'pets')
                imageSource = imageUrl?.startsWith('http') ? 'storage' : imageUrl?.startsWith('data:image') ? 'base64' : 'local'
            } catch (uploadError) {
                imageUrl = selectedImageBase64 ? `data:image/jpeg;base64,${selectedImageBase64}` : selectedImageUri
                imageSource = selectedImageBase64 ? 'base64' : 'local'
            }
            const now = new Date().toISOString()
            const petPayload = {
                name: animalName.trim(),
                type: animalType.trim(),
                breed: animalBreed.trim(),
                color: animalColor.trim(),
                age: Number(animalAge),
                gender: selectedGender,
                city: selectedCity,
                district: selectedDistrict,
                neighborhood: selectedNeighborhood,
                latitude,
                longitude,
                note: animalDescription.trim(),
                imageUrl,
                imageSource,
                createdAt: now,
                lastSeenAt: now,
                createdByUid: user.uid,
                ownerId: user.uid,
                createdByUsername: creatorUsername || user.displayName || user.email?.split('@')[0] || 'Bilinmiyor',
                createdByName: user.displayName || user.email?.split('@')[0] || 'Bilinmiyor',
                locationLabel: `${selectedCity} / ${selectedDistrict} / ${selectedNeighborhood}`,
            }

            const savedPet = await addPet(petPayload)
            resetForm()
            Alert.alert('Başarılı', 'Hayvan kaydedildi.')
            navigation.navigate('AnimalList', { savedPetId: savedPet.id })
        } catch (error) {
            Alert.alert('Hata', error.message || 'Hayvan kaydedilemedi.')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <ScrollView>
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="chevron-back" size={24} color="black" />
                </Pressable>
                <Text style={styles.headerText}>Hayvan Ekle</Text>
            </View>
            <View style={styles.container}>
                <Image style={styles.headerImage} source={require('../images/addAnimalPage-background.png')} />
            </View>
            <View style={styles.animalInfoContainer}>
                <Pressable style={[styles.imageUploadArea, errors.image && styles.inputErrorBorder]} onPress={handlePickAnimalImage}>
                    {selectedImageUri ? (
                        <Image source={{ uri: selectedImageUri }} style={styles.uploadedAnimalImage} />
                    ) : (
                        <>
                            <Ionicons name="image-outline" size={28} color={getColor('--light-five')} />
                            <Text style={styles.imageUploadText}>Resim Ekle</Text>
                        </>
                    )}
                </Pressable>
                {!!errors.image && <Text style={styles.errorText}>{errors.image}</Text>}
                <Text style={styles.inputLabel}>Hayvan Adı</Text>
                <TextInput
                    style={[styles.textInput, errors.animalName && styles.inputErrorBorder]}
                    placeholder="Örn: Minnoş"
                    value={animalName}
                    onChangeText={(text) => {
                        setAnimalName(text)
                        clearFieldError('animalName')
                    }}
                />
                {!!errors.animalName && <Text style={styles.errorText}>{errors.animalName}</Text>}

                <Text style={styles.inputLabel}>Hayvan Türü</Text>
                <Pressable
                    style={[styles.dropdownInput, errors.animalType && styles.inputErrorBorder]}
                    onPress={toggleTypeDropdown}
                >
                    <Text style={animalType ? styles.dropdownText : styles.dropdownPlaceholder}>
                        {animalType || 'Tür seçin'}
                    </Text>
                    <Ionicons
                        name={isTypeOpen ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={getColor('--light-six')}
                    />
                </Pressable>
                {isTypeOpen && (
                    <View style={styles.dropdownOptions}>
                        {ANIMAL_TYPE_OPTIONS.map((type) => (
                            <Pressable
                                key={type}
                                style={styles.dropdownOption}
                                onPress={() => selectAnimalType(type)}
                            >
                                <Text style={styles.dropdownOptionText}>{type}</Text>
                            </Pressable>
                        ))}
                    </View>
                )}
                {!!errors.animalType && <Text style={styles.errorText}>{errors.animalType}</Text>}

                <Text style={styles.inputLabel}>Hayvanın Cinsi</Text>
                <Pressable
                    style={[styles.dropdownInput, !animalType && styles.dropdownInputDisabled, errors.animalBreed && styles.inputErrorBorder]}
                    onPress={toggleBreedDropdown}
                >
                    <Text style={animalBreed ? styles.dropdownText : styles.dropdownPlaceholder}>
                        {animalType ? (animalBreed || 'Cins seçin') : 'Önce tür seçin'}
                    </Text>
                    <Ionicons
                        name={isBreedOpen ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={getColor('--light-six')}
                    />
                </Pressable>
                {isBreedOpen && animalType && (
                    <ScrollView style={styles.dropdownOptions} nestedScrollEnabled>
                        {breedOptions.map((breed) => (
                            <Pressable
                                key={breed}
                                style={styles.dropdownOption}
                                onPress={() => selectAnimalBreed(breed)}
                            >
                                <Text style={styles.dropdownOptionText}>{breed}</Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                )}
                {!!errors.animalBreed && <Text style={styles.errorText}>{errors.animalBreed}</Text>}

                <Text style={styles.inputLabel}>Hayvanın Rengi</Text>
                <TextInput
                    style={[styles.textInput, errors.animalColor && styles.inputErrorBorder]}
                    placeholder="Örn: Turuncu"
                    value={animalColor}
                    onChangeText={(text) => {
                        setAnimalColor(text)
                        clearFieldError('animalColor')
                    }}
                />
                {!!errors.animalColor && <Text style={styles.errorText}>{errors.animalColor}</Text>}

                <Text style={styles.inputLabel}>Hayvan Yaşı</Text>
                <TextInput
                    style={[styles.textInput, errors.animalAge && styles.inputErrorBorder]}
                    placeholder="Örn: 2"
                    value={animalAge}
                    onChangeText={(text) => {
                        setAnimalAge(text.replace(/\D/g, ''))
                        clearFieldError('animalAge')
                    }}
                    keyboardType='number-pad'
                />
                {!!errors.animalAge && <Text style={styles.errorText}>{errors.animalAge}</Text>}

                <Text style={styles.inputLabel}>Hayvanın Cinsiyeti</Text>
                <Pressable
                    style={[styles.dropdownInput, errors.gender && styles.inputErrorBorder]}
                    onPress={() => {
                        setIsGenderOpen((prev) => !prev)
                        setIsCityOpen(false)
                        setIsDistrictOpen(false)
                        setIsNeighborhoodOpen(false)
                    }}
                >
                    <Text style={selectedGender ? styles.dropdownText : styles.dropdownPlaceholder}>
                        {selectedGender || 'Cinsiyet seçin'}
                    </Text>
                    <Ionicons
                        name={isGenderOpen ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={getColor('--light-six')}
                    />
                </Pressable>

                {isGenderOpen && (
                    <View style={styles.dropdownOptions}>
                        <Pressable
                            style={styles.dropdownOption}
                            onPress={() => {
                                setSelectedGender('Dişi')
                                clearFieldError('gender')
                                setIsGenderOpen(false)
                            }}
                        >
                            <Text style={styles.dropdownOptionText}>Dişi</Text>
                        </Pressable>
                        <Pressable
                            style={styles.dropdownOption}
                            onPress={() => {
                                setSelectedGender('Erkek')
                                clearFieldError('gender')
                                setIsGenderOpen(false)
                            }}
                        >
                            <Text style={styles.dropdownOptionText}>Erkek</Text>
                        </Pressable>
                    </View>
                )}
                {!!errors.gender && <Text style={styles.errorText}>{errors.gender}</Text>}

                <Text style={styles.inputLabel}>İl</Text>
                <Pressable style={[styles.dropdownInput, errors.city && styles.inputErrorBorder]} onPress={toggleCityDropdown}>
                    <Text style={selectedCity ? styles.dropdownText : styles.dropdownPlaceholder}>
                        {selectedCity || 'İl seç'}
                    </Text>
                    <Ionicons
                        name={isCityOpen ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={getColor('--light-six')}
                    />
                </Pressable>
                {isCityOpen && (
                    <ScrollView style={styles.dropdownOptions} nestedScrollEnabled>
                        {cities.map((city) => (
                            <Pressable
                                key={city.sehir_id}
                                style={styles.dropdownOption}
                                onPress={() => {
                                    selectCity(city)
                                    clearFieldError('city')
                                    clearFieldError('district')
                                    clearFieldError('neighborhood')
                                }}
                            >
                                <Text style={styles.dropdownOptionText}>{city.sehir_adi}</Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                )}
                {!!errors.city && <Text style={styles.errorText}>{errors.city}</Text>}

                <Text style={styles.inputLabel}>İlçe</Text>
                <Pressable
                    style={[styles.dropdownInput, !selectedCity && styles.dropdownInputDisabled, errors.district && styles.inputErrorBorder]}
                    onPress={toggleDistrictDropdown}
                >
                    <Text style={selectedDistrict ? styles.dropdownText : styles.dropdownPlaceholder}>
                        {selectedCity ? (selectedDistrict || 'İlçe seç') : 'Önce il seç'}
                    </Text>
                    <Ionicons
                        name={isDistrictOpen ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={getColor('--light-six')}
                    />
                </Pressable>
                {isDistrictOpen && (
                    <ScrollView style={styles.dropdownOptions} nestedScrollEnabled>
                        {districtOptions.map((district) => (
                            <Pressable
                                key={district.ilce_id}
                                style={styles.dropdownOption}
                                onPress={() => {
                                    selectDistrict(district)
                                    clearFieldError('district')
                                    clearFieldError('neighborhood')
                                }}
                            >
                                <Text style={styles.dropdownOptionText}>{district.ilce_adi}</Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                )}
                {!!errors.district && <Text style={styles.errorText}>{errors.district}</Text>}

                <Text style={styles.inputLabel}>Mahalle</Text>
                <Pressable
                    style={[styles.dropdownInput, (!selectedCity || !selectedDistrict) && styles.dropdownInputDisabled, errors.neighborhood && styles.inputErrorBorder]}
                    onPress={toggleNeighborhoodDropdown}
                >
                    <Text style={selectedNeighborhood ? styles.dropdownText : styles.dropdownPlaceholder}>
                        {selectedCity && selectedDistrict ? (selectedNeighborhood || 'Mahalle seç') : 'Önce il ve ilçe seç'}
                    </Text>
                    <Ionicons
                        name={isNeighborhoodOpen ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={getColor('--light-six')}
                    />
                </Pressable>
                {isNeighborhoodOpen && (
                    <ScrollView style={styles.dropdownOptions} nestedScrollEnabled>
                        {isLoadingNeighborhoods ? (
                            <View style={styles.dropdownLoadingState}>
                                <Text style={styles.dropdownPlaceholder}>Yükleniyor...</Text>
                            </View>
                        ) : (
                            neighborhoodOptions.map((neighborhood) => (
                                <Pressable
                                    key={neighborhood.mahalle_id}
                                    style={styles.dropdownOption}
                                    onPress={() => {
                                        selectNeighborhood(neighborhood)
                                        clearFieldError('neighborhood')
                                    }}
                                >
                                    <Text style={styles.dropdownOptionText}>{neighborhood.mahalle_adi}</Text>
                                </Pressable>
                            ))
                        )}
                    </ScrollView>
                )}
                {!!errors.neighborhood && <Text style={styles.errorText}>{errors.neighborhood}</Text>}

                <Text style={styles.inputLabel}>Güncel Konum</Text>
                <Pressable style={[styles.locationButton, errors.location && styles.inputErrorBorder]} onPress={handleGetCurrentLocation} disabled={isLoadingLocation}>
                    <Ionicons name="location" size={18} color="#fff" />
                    <Text style={styles.locationButtonText}>
                        {isLoadingLocation ? 'Konum alınıyor...' : 'Güncel Konumu Ekle'}
                    </Text>
                    {isLoadingLocation && <ActivityIndicator size="small" color="#fff" style={{ marginLeft: 8 }} />}
                </Pressable>
                {!!errors.location && <Text style={styles.errorText}>{errors.location}</Text>}
                {latitude && longitude && (
                    <View style={styles.locationDisplay}>
                        <Text style={styles.locationDisplayText}>📍 Enlem: {latitude.toFixed(4)}</Text>
                        <Text style={styles.locationDisplayText}>📍 Boylam: {longitude.toFixed(4)}</Text>
                    </View>
                )}

                <Text style={styles.inputLabel}>Açıklama</Text>
                <TextInput
                    style={styles.descriptionInput}
                    placeholder="Başka özellikleri yazabilirsiniz..."
                    multiline
                    textAlignVertical='top'
                    value={animalDescription}
                    onChangeText={setAnimalDescription}
                />

                <Pressable style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} onPress={handleSave} disabled={isSaving}>
                    <Text style={styles.saveButtonText}>{isSaving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
                </Pressable>
            </View>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    header: {
        backgroundColor: 'transparent',
        marginTop: 40,
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
        minHeight: 50,
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
    container: {
        paddingTop: 0,
        backgroundColor: 'transparent',
    },
    headerImage: {
        width: '100%',
        height: screenHeight * 0.22,
        resizeMode: 'cover',
    },
    animalInfoContainer: {
        padding: 20,
    },
    imageUploadArea: {
        width: '100%',
        height: 130,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: getColor('--light-five'),
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.45)',
        gap: 8,
        overflow: 'hidden',
    },
    uploadedAnimalImage: {
        width: '100%',
        height: '100%',
    },
    imageUploadText: {
        fontSize: 16,
        fontWeight: '600',
        color: getColor('--light-five'),
    },
    inputLabel: {
        marginTop: 16,
        marginBottom: 8,
        fontSize: 16,
        fontWeight: '600',
        color: '#222',
    },
    textInput: {
        width: '100%',
        borderWidth: 1,
        borderColor: getColor('--light-six'),
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: '#fff',
    },
    descriptionInput: {
        width: '100%',
        minHeight: 120,
        borderWidth: 1,
        borderColor: getColor('--light-six'),
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: '#fff',
    },
    dropdownInput: {
        width: '100%',
        borderWidth: 1,
        borderColor: getColor('--light-six'),
        borderRadius: 10,
        paddingVertical: 11,
        paddingHorizontal: 12,
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dropdownPlaceholder: {
        color: getColor('--light-six'),
        fontSize: 15,
    },
    dropdownText: {
        color: '#222',
        fontSize: 15,
    },
    dropdownOptions: {
        marginTop: 6,
        maxHeight: 180,
        borderWidth: 1,
        borderColor: getColor('--light-six'),
        borderRadius: 10,
        backgroundColor: '#fff',
        overflow: 'hidden',
    },
    dropdownOption: {
        paddingVertical: 11,
        paddingHorizontal: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: getColor('--light-six'),
    },
    dropdownOptionText: {
        fontSize: 15,
        color: '#222',
    },
    dropdownInputDisabled: {
        opacity: 0.55,
    },
    dropdownLoadingState: {
        paddingVertical: 12,
        paddingHorizontal: 12,
    },
    saveButton: {
        marginTop: 30,
        backgroundColor: getColor('--light-six'),
        paddingVertical: 14,
        borderRadius: 50,
        alignItems: 'center',
        marginBottom: 100,
    },
    saveButtonDisabled: {
        opacity: 0.7,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    locationButton: {
        width: '100%',
        backgroundColor: getColor('--light-four'),
        paddingVertical: 12,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    locationButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    locationDisplay: {
        marginTop: 10,
        backgroundColor: '#f0f8ff',
        padding: 10,
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: getColor('--light-four'),
    },
    locationDisplayText: {
        fontSize: 14,
        color: '#333',
        marginVertical: 3,
    },
    inputErrorBorder: {
        borderColor: '#D84A4A',
        borderWidth: 1.5,
    },
    errorText: {
        marginTop: 6,
        fontSize: 13,
        color: '#D84A4A',
    },
})