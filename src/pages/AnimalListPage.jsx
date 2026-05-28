import { ActivityIndicator, ImageBackground, StyleSheet, Text, View, Pressable, Image, TextInput, Modal, ScrollView } from 'react-native'
import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getColor } from '../css/theme';
import AnimalCard from '../components/animalCard';
import { getPets } from '../firebase/helpers';
import { getEstimatedPetAge } from '../utils/petAge';

const CITY_URL = 'https://raw.githubusercontent.com/metinyildirimnet/turkiye-adresler-json/master/sehirler.json';
const DISTRICT_URL = 'https://raw.githubusercontent.com/metinyildirimnet/turkiye-adresler-json/master/ilceler.json';
const NEIGHBORHOOD_URLS = [
    'https://raw.githubusercontent.com/metinyildirimnet/turkiye-adresler-json/master/mahalleler-1.json',
    'https://raw.githubusercontent.com/metinyildirimnet/turkiye-adresler-json/master/mahalleler-2.json',
    'https://raw.githubusercontent.com/metinyildirimnet/turkiye-adresler-json/master/mahalleler-3.json',
    'https://raw.githubusercontent.com/metinyildirimnet/turkiye-adresler-json/master/mahalleler-4.json',
];

const CAT_BREED_OPTIONS = [
    'Abyssinian',
    'Aegean',
    'American Bobtail',
    'American Curl',
    'American Shorthair',
    'American Wirehair',
    'Ankara Kedisi',
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
    'Dragon Li',
    'Donskoy',
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
    'Sarman',
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
];

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
];
const SPECIES_OPTIONS = [
    { id: 'cat', name: 'Kedi' },
    { id: 'dog', name: 'Köpek' },
];


export default function AnimalListPage() {
    const navigation = useNavigation();
    const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
    const [isLocationDrawerVisible, setIsLocationDrawerVisible] = useState(false);
    const [locationDrawerType, setLocationDrawerType] = useState('city');

    const [cities, setCities] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [neighborhoods, setNeighborhoods] = useState([]);

    const [isLoadingLocations, setIsLoadingLocations] = useState(false);
    const [isLoadingNeighborhoods, setIsLoadingNeighborhoods] = useState(false);
    const [isLoadingPets, setIsLoadingPets] = useState(false);
    const [locationError, setLocationError] = useState('');
    const [pets, setPets] = useState([]);
    const [searchText, setSearchText] = useState('');

    const [selectedCityId, setSelectedCityId] = useState('');
    const [selectedDistrictId, setSelectedDistrictId] = useState('');
    const [selectedCity, setSelectedCity] = useState('');
    const [district, setDistrict] = useState('');
    const [neighborhood, setNeighborhood] = useState('');
    const [selectedSpecies, setSelectedSpecies] = useState('');
    const [selectedBreed, setSelectedBreed] = useState('');
    const [animalAge, setAnimalAge] = useState('');
    const [appliedFilterTags, setAppliedFilterTags] = useState([]);

    useEffect(() => {
        const loadBaseLocations = async () => {
            try {
                setIsLoadingLocations(true);
                setLocationError('');

                const [cityResponse, districtResponse] = await Promise.all([
                    fetch(CITY_URL),
                    fetch(DISTRICT_URL),
                ]);

                const [cityData, districtData] = await Promise.all([
                    cityResponse.json(),
                    districtResponse.json(),
                ]);

                setCities(Array.isArray(cityData) ? cityData : []);
                setDistricts(Array.isArray(districtData) ? districtData : []);
            } catch (error) {
                setLocationError('Konum verileri yüklenemedi');
            } finally {
                setIsLoadingLocations(false);
            }
        };

        loadBaseLocations();
    }, []);

    useFocusEffect(
        useCallback(() => {
            let active = true;

            const loadPets = async () => {
                try {
                    setIsLoadingPets(true);
                    const items = await getPets();
                    if (active) {
                        setPets(items);
                    }
                } catch (error) {
                    console.warn('Hayvanlar yüklenemedi:', error);
                    if (active) {
                        setPets([]);
                    }
                } finally {
                    if (active) {
                        setIsLoadingPets(false);
                    }
                }
            };

            loadPets();

            return () => {
                active = false;
            };
        }, [])
    );

    const loadAllNeighborhoods = async () => {
        if (neighborhoods.length > 0 || isLoadingNeighborhoods) return;

        try {
            setIsLoadingNeighborhoods(true);
            setLocationError('');

            const responses = await Promise.all(NEIGHBORHOOD_URLS.map((url) => fetch(url)));
            const neighborhoodChunks = await Promise.all(responses.map((response) => response.json()));
            const mergedNeighborhoods = neighborhoodChunks.flat().filter(Boolean);

            setNeighborhoods(mergedNeighborhoods);
        } catch (error) {
            setLocationError('Mahalle verileri yüklenemedi');
        } finally {
            setIsLoadingNeighborhoods(false);
        }
    };

    const closeFilterModal = () => {
        setIsFilterModalVisible(false);
        setIsLocationDrawerVisible(false);
    };

    const clearFilters = () => {
        setSelectedCity('');
        setSelectedCityId('');
        setDistrict('');
        setSelectedDistrictId('');
        setNeighborhood('');
        setSelectedSpecies('');
        setSelectedBreed('');
        setAnimalAge('');
        setAppliedFilterTags([]);
        setLocationDrawerType('city');
        setIsLocationDrawerVisible(false);
        setLocationError('');
    };

    const applyFilters = () => {
        const tags = [];

        if (selectedCity) tags.push({ key: 'city', label: `İl: ${selectedCity}` });
        if (district) tags.push({ key: 'district', label: `İlçe: ${district}` });
        if (neighborhood) tags.push({ key: 'neighborhood', label: `Mahalle: ${neighborhood}` });
        if (selectedSpecies) tags.push({ key: 'species', label: `Tür: ${selectedSpecies}` });
        if (selectedBreed) tags.push({ key: 'breed', label: `Cins: ${selectedBreed}` });
        if (animalAge) tags.push({ key: 'age', label: `Tahmini Yaş: ${animalAge}` });

        setAppliedFilterTags(tags);
        closeFilterModal();
    };

    const removeAppliedTag = (tagKey) => {
        if (tagKey === 'city') {
            setSelectedCity('');
            setSelectedCityId('');
            setDistrict('');
            setSelectedDistrictId('');
            setNeighborhood('');
            setAppliedFilterTags([]);
            return;
        }

        if (tagKey === 'district') {
            setDistrict('');
            setSelectedDistrictId('');
            setNeighborhood('');
            setAppliedFilterTags((prev) => prev.filter((item) => item.key !== 'district' && item.key !== 'neighborhood'));
            return;
        }

        if (tagKey === 'neighborhood') {
            setNeighborhood('');
            setAppliedFilterTags((prev) => prev.filter((item) => item.key !== 'neighborhood'));
            return;
        }

        if (tagKey === 'species') {
            setSelectedSpecies('');
            setSelectedBreed('');
            setAppliedFilterTags((prev) => prev.filter((item) => item.key !== 'species' && item.key !== 'breed'));
            return;
        }

        if (tagKey === 'breed') {
            setSelectedBreed('');
            setAppliedFilterTags((prev) => prev.filter((item) => item.key !== 'breed'));
            return;
        }

        if (tagKey === 'age') {
            setAnimalAge('');
            setAppliedFilterTags((prev) => prev.filter((item) => item.key !== 'age'));
        }
    };

    const hasAppliedTags = appliedFilterTags.length > 0;
    const listBottomPadding = hasAppliedTags ? 180 : 120;

    const districtOptions = useMemo(
        () => districts.filter((item) => item.sehir_id === selectedCityId),
        [districts, selectedCityId]
    );

    const neighborhoodOptions = useMemo(
        () => neighborhoods.filter((item) => item.sehir_id === selectedCityId && item.ilce_id === selectedDistrictId),
        [neighborhoods, selectedCityId, selectedDistrictId]
    );

    const breedOptions = useMemo(() => {
        if (selectedSpecies === 'Kedi') return CAT_BREED_OPTIONS;
        if (selectedSpecies === 'Köpek') return DOG_BREED_OPTIONS;
        return [];
    }, [selectedSpecies]);

    const visiblePets = useMemo(() => {
        const normalizedSearch = searchText.trim().toLowerCase();

        return pets.filter((pet) => {
            if (selectedCity && pet.city !== selectedCity) return false;
            if (district && pet.district !== district) return false;
            if (neighborhood && pet.neighborhood !== neighborhood) return false;
            if (selectedSpecies && pet.type !== selectedSpecies) return false;
            if (selectedBreed && pet.breed !== selectedBreed) return false;
            if (animalAge && String(getEstimatedPetAge(pet) ?? '') !== String(animalAge)) return false;

            if (normalizedSearch) {
                const haystack = [pet.name, pet.type, pet.breed, pet.city, pet.district, pet.neighborhood]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                return haystack.includes(normalizedSearch);
            }

            return true;
        });
    }, [pets, selectedCity, district, neighborhood, selectedSpecies, selectedBreed, animalAge, searchText]);

    const locationOptions =
        locationDrawerType === 'city'
            ? cities
            : locationDrawerType === 'district'
                ? districtOptions
                : locationDrawerType === 'neighborhood'
                    ? neighborhoodOptions
                    : locationDrawerType === 'species'
                        ? SPECIES_OPTIONS
                        : breedOptions;

    const drawerTitle =
        locationDrawerType === 'city'
            ? 'İl Seç'
            : locationDrawerType === 'district'
                ? 'İlçe Seç'
                : locationDrawerType === 'neighborhood'
                    ? 'Mahalle Seç'
                    : locationDrawerType === 'species'
                        ? 'Tür Seç'
                        : 'Cins Seç';

    const openLocationDrawer = async (type) => {
        if (type === 'district' && !selectedCity) return;
        if (type === 'neighborhood' && (!selectedCity || !district)) return;
        if (type === 'breed' && !selectedSpecies) return;

        setLocationDrawerType(type);
        setIsLocationDrawerVisible(true);

        if (type === 'neighborhood') {
            loadAllNeighborhoods();
        }
    };

    const selectLocationOption = (value) => {
        if (locationDrawerType === 'city') {
            setSelectedCity(value.sehir_adi);
            setSelectedCityId(value.sehir_id);

            setDistrict('');
            setSelectedDistrictId('');
            setNeighborhood('');
        }

        if (locationDrawerType === 'district') {
            setDistrict(value.ilce_adi);
            setSelectedDistrictId(value.ilce_id);

            setNeighborhood('');
        }

        if (locationDrawerType === 'neighborhood') {
            setNeighborhood(value.mahalle_adi);
        }

        if (locationDrawerType === 'species') {
            setSelectedSpecies(value.name);
            setSelectedBreed('');
        }

        if (locationDrawerType === 'breed') {
            setSelectedBreed(value);
        }

        setIsLocationDrawerVisible(false);
    };

    return (
        <View >
            <ImageBackground
                source={require('../images/allAnimalsPage-Background.png')}
                style={[styles.headerBackground, hasAppliedTags && styles.headerBackgroundExpanded]}
                resizeMode="cover"
            >
                <View style={{ justifyContent: 'center', alignItems: 'center', marginTop: 50 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '90%' }}>
                        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
                            <Ionicons name="chevron-back" size={24} color="black" />
                        </Pressable>
                        <Text style={{ color: 'black', fontSize: 30, fontWeight: '700' }}>Tüm Hayvanlar</Text>
                        <Pressable style={{ backgroundColor: 'white', borderRadius: '50%', shadowColor: 'black', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 }} onPress={() => navigation.navigate('AnimalMap')}>
                            <Image style={{ width: 50, height: 50 }} source={require('../images/compass.png')} />
                        </Pressable>
                    </View>
                    <View style={styles.searchRow}>
                        <TextInput
                            value={searchText}
                            onChangeText={setSearchText}
                            placeholder="Hayvan ara..."
                            style={styles.searchInput}
                        />
                        <Pressable style={styles.filterButton} onPress={() => setIsFilterModalVisible(true)}>
                            <Ionicons name="options-outline" size={24} color="#111827" />
                        </Pressable>
                    </View>

                    {hasAppliedTags && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.appliedTagsWrap}
                            contentContainerStyle={styles.appliedTagsContent}
                        >
                            {appliedFilterTags.map((tag) => (
                                <View key={tag.key} style={styles.appliedTagChip}>
                                    <Text style={styles.appliedTagText}>{tag.label}</Text>
                                    <Pressable style={styles.appliedTagRemoveButton} onPress={() => removeAppliedTag(tag.key)}>
                                        <Text style={styles.appliedTagRemoveText}>x</Text>
                                    </Pressable>
                                </View>
                            ))}
                        </ScrollView>
                    )}

                    <Modal
                        transparent
                        animationType="slide"
                        statusBarTranslucent
                        navigationBarTranslucent
                        visible={isFilterModalVisible}
                        onRequestClose={closeFilterModal}
                    >
                        <View style={styles.modalOverlay}>
                            <View style={styles.modalCard}>
                                <Text style={styles.modalTitle}>Filtreleme</Text>

                                <View style={styles.sectionBlock}>
                                    <Text style={styles.sectionTitle}>Konum</Text>

                                    <Text style={styles.inputLabel}>İl</Text>
                                    <Pressable style={styles.selectInput} onPress={() => openLocationDrawer('city')}>
                                        <Text style={selectedCity ? styles.selectValue : styles.selectPlaceholder}>
                                            {selectedCity || 'İl seç'}
                                        </Text>
                                    </Pressable>

                                    <Text style={styles.inputLabel}>İlçe</Text>
                                    <Pressable
                                        style={[styles.selectInput, !selectedCity && styles.selectInputDisabled]}
                                        onPress={() => openLocationDrawer('district')}
                                    >
                                        <Text style={district ? styles.selectValue : styles.selectPlaceholder}>
                                            {selectedCity ? (district || 'İlçe seç') : 'Önce il seç'}
                                        </Text>
                                    </Pressable>

                                    <Text style={styles.inputLabel}>Mahalle</Text>
                                    <Pressable
                                        style={[styles.selectInput, (!selectedCity || !district) && styles.selectInputDisabled]}
                                        onPress={() => openLocationDrawer('neighborhood')}
                                    >
                                        <Text style={neighborhood ? styles.selectValue : styles.selectPlaceholder}>
                                            {selectedCity && district ? (neighborhood || 'Mahalle seç') : 'Önce il ve ilçe seç'}
                                        </Text>
                                    </Pressable>
                                </View>

                                <View style={styles.sectionBlock}>
                                    <Text style={styles.sectionTitle}>Özellik</Text>

                                    <Text style={styles.inputLabel}>Tür</Text>
                                    <Pressable style={styles.selectInput} onPress={() => openLocationDrawer('species')}>
                                        <Text style={selectedSpecies ? styles.selectValue : styles.selectPlaceholder}>
                                            {selectedSpecies || 'Tür seç'}
                                        </Text>
                                    </Pressable>

                                    <Text style={styles.inputLabel}>Cins</Text>
                                    <Pressable
                                        style={[styles.selectInput, !selectedSpecies && styles.selectInputDisabled]}
                                        onPress={() => openLocationDrawer('breed')}
                                    >
                                        <Text style={selectedBreed ? styles.selectValue : styles.selectPlaceholder}>
                                            {selectedSpecies ? (selectedBreed || 'Cins seç') : 'Önce tür seç'}
                                        </Text>
                                    </Pressable>

                                    <Text style={styles.inputLabel}>Tahmini Yaş</Text>
                                    <TextInput
                                        value={animalAge}
                                        onChangeText={setAnimalAge}
                                        placeholder="Örnek: 2"
                                        keyboardType="numeric"
                                        style={styles.textInput}
                                    />
                                </View>

                                <View style={styles.modalActionRow}>
                                    <Pressable style={styles.modalClearButton} onPress={clearFilters}>
                                        <Text style={styles.modalClearButtonText}>Temizle</Text>
                                    </Pressable>

                                    <Pressable style={styles.modalApplyButton} onPress={applyFilters}>
                                        <Text style={styles.modalApplyButtonText}>Uygula</Text>
                                    </Pressable>

                                    <Pressable style={styles.modalCloseButton} onPress={closeFilterModal}>
                                        <Text style={styles.modalCloseButtonText}>Kapat</Text>
                                    </Pressable>
                                </View>
                            </View>
                        </View>
                    </Modal>

                    <Modal
                        transparent
                        animationType="fade"
                        statusBarTranslucent
                        navigationBarTranslucent
                        visible={isLocationDrawerVisible}
                        onRequestClose={() => setIsLocationDrawerVisible(false)}
                    >
                        <View style={styles.drawerOverlay}>
                            <Pressable style={styles.drawerBackdrop} onPress={() => setIsLocationDrawerVisible(false)} />
                            <View style={styles.drawerCard}>
                                <Text style={styles.drawerTitle}>{drawerTitle}</Text>

                                <ScrollView showsVerticalScrollIndicator={false}>
                                    {(isLoadingLocations || (locationDrawerType === 'neighborhood' && isLoadingNeighborhoods)) && (
                                        <View style={styles.loadingRow}>
                                            <ActivityIndicator size="small" color="#2563EB" />
                                            <Text style={styles.loadingText}>Yükleniyor...</Text>
                                        </View>
                                    )}

                                    {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}

                                    {!isLoadingLocations && !(locationDrawerType === 'neighborhood' && isLoadingNeighborhoods) && locationOptions.length === 0 && (
                                        <Text style={styles.emptyDrawerText}>Seçenek bulunamadı</Text>
                                    )}

                                    {locationOptions.map((option) => (
                                        <Pressable
                                            key={
                                                locationDrawerType === 'city'
                                                    ? option.sehir_id
                                                    : locationDrawerType === 'district'
                                                        ? option.ilce_id
                                                        : locationDrawerType === 'neighborhood'
                                                            ? option.mahalle_id
                                                            : locationDrawerType === 'species'
                                                                ? option.id
                                                                : option
                                            }
                                            style={styles.cityRow}
                                            onPress={() => selectLocationOption(option)}
                                        >
                                            <Text style={styles.cityText}>
                                                {locationDrawerType === 'city'
                                                    ? option.sehir_adi
                                                    : locationDrawerType === 'district'
                                                        ? option.ilce_adi
                                                        : locationDrawerType === 'neighborhood'
                                                            ? option.mahalle_adi
                                                            : locationDrawerType === 'species'
                                                                ? option.name
                                                                : option}
                                            </Text>
                                            {(locationDrawerType === 'city' && selectedCityId === option.sehir_id) && <Text style={styles.cityCheck}>Seçildi</Text>}
                                            {(locationDrawerType === 'district' && selectedDistrictId === option.ilce_id) && <Text style={styles.cityCheck}>Seçildi</Text>}
                                            {(locationDrawerType === 'neighborhood' && neighborhood === option.mahalle_adi) && <Text style={styles.cityCheck}>Seçildi</Text>}
                                            {(locationDrawerType === 'species' && selectedSpecies === option.name) && <Text style={styles.cityCheck}>Seçildi</Text>}
                                            {(locationDrawerType === 'breed' && selectedBreed === option) && <Text style={styles.cityCheck}>Seçildi</Text>}
                                        </Pressable>
                                    ))}
                                </ScrollView>
                            </View>
                        </View>
                    </Modal>

                </View>
            </ImageBackground>
            <ScrollView
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 20, marginBottom: 200 }}
                contentContainerStyle={{ paddingBottom: listBottomPadding }}
            >
                {isLoadingPets ? (
                    <View style={styles.loadingPetsState}>
                        <ActivityIndicator size="small" color="#2563EB" />
                        <Text style={styles.loadingPetsText}>Hayvanlar yükleniyor...</Text>
                    </View>
                ) : visiblePets.length > 0 ? (
                    visiblePets.map((pet) => <AnimalCard key={pet.id} pet={pet} />)
                ) : (
                    <View style={styles.emptyPetsState}>
                        <Ionicons name="paw-outline" size={28} color="#6B7280" />
                        <Text style={styles.emptyPetsText}>Henüz eklenmiş hayvan yok.</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    )
}

const styles = StyleSheet.create({
    headerBackground: {
        width: '100%',
        height: 200,
        opacity: 0.8,
    },
    headerBackgroundExpanded: {
        height: 240,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgb(255, 255, 255)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.35)',
        zIndex: 20,
        elevation: 8,
    },
    backIcon: {
        color: 'black',
        fontSize: 24,
        fontWeight: '700',
        lineHeight: 24,
    },
    searchRow: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 30,
        gap: 10,
    },
    searchInput: {
        backgroundColor: 'white',
        width: '72%',
        padding: 15,
        borderRadius: 20,
    },
    loadingPetsState: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingTop: 30,
    },
    loadingPetsText: {
        color: '#6B7280',
        fontSize: 14,
    },
    emptyPetsState: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingTop: 40,
    },
    emptyPetsText: {
        color: '#6B7280',
        fontSize: 15,
        fontWeight: '600',
    },
    filterButton: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
    },
    filterIcon: {
        width: 24,
        height: 24,
    },
    appliedTagsWrap: {
        marginTop: 12,
        width: '90%',
    },
    appliedTagsContent: {
        paddingRight: 8,
        gap: 8,
    },
    appliedTagChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#E8F0FF',
        borderColor: '#BFDBFE',
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
    },
    appliedTagText: {
        color: '#1E3A8A',
        fontSize: 12,
        fontWeight: '600',
    },
    appliedTagRemoveButton: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#DBEAFE',
        justifyContent: 'center',
        alignItems: 'center',
    },
    appliedTagRemoveText: {
        color: '#1D4ED8',
        fontSize: 11,
        fontWeight: '700',
        lineHeight: 12,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'flex-end',
        paddingBottom: 0,
    },
    modalCard: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        marginBottom: 0,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: 'black',
    },
    sectionBlock: {
        marginTop: 18,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginTop: 8,
        marginBottom: 6,
    },
    selectInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 13,
        backgroundColor: '#F9FAFB',
    },
    selectInputDisabled: {
        opacity: 0.55,
    },
    selectPlaceholder: {
        color: '#9CA3AF',
        fontSize: 14,
    },
    selectValue: {
        color: '#111827',
        fontSize: 14,
        fontWeight: '600',
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 11,
        backgroundColor: '#F9FAFB',
        color: '#111827',
        fontSize: 14,
    },
    modalActionRow: {
        marginTop: 20,
        marginBottom: 34,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
    },
    modalClearButton: {
        backgroundColor: '#c34a4a',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
    },
    modalClearButtonText: {
        color: '#ffffff',
        fontWeight: '600',
    },
    modalApplyButton: {
        backgroundColor: '#5b82d7',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
    },
    modalApplyButtonText: {
        color: 'white',
        fontWeight: '700',
    },
    modalCloseButton: {
        backgroundColor: 'black',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
    },
    modalCloseButtonText: {
        color: 'white',
        fontWeight: '600',
    },
    drawerOverlay: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
    },
    drawerBackdrop: {
        flex: 1,
    },
    drawerCard: {
        width: '78%',
        backgroundColor: 'white',
        paddingTop: 50,
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderTopLeftRadius: 20,
        borderBottomLeftRadius: 20,
    },
    drawerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    cityRow: {
        paddingVertical: 11,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cityText: {
        fontSize: 15,
        color: '#111827',
    },
    cityCheck: {
        color: '#2563EB',
        fontSize: 12,
        fontWeight: '700',
    },
    emptyDrawerText: {
        color: '#6B7280',
        fontSize: 14,
        marginTop: 8,
    },
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
        marginBottom: 8,
    },
    loadingText: {
        fontSize: 13,
        color: '#374151',
    },
    errorText: {
        color: '#B91C1C',
        marginBottom: 8,
        fontSize: 13,
    },
})