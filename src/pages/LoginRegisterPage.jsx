import React, { useEffect, useState, useMemo } from "react";
import { View, Text, TextInput, StyleSheet, ImageBackground, Pressable, ScrollView, Modal, Platform } from "react-native";
import { getColor } from "../css/theme";
import { useNavigation } from "@react-navigation/native";
import { signIn, signUp, createUserProfile, signOut as firebaseSignOut } from '../firebase/helpers';
import { Alert } from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from '@react-native-community/datetimepicker';

const CITY_URL = 'https://raw.githubusercontent.com/metinyildirimnet/turkiye-adresler-json/master/sehirler.json';

export default function AuthScreen() {

    const [isLogin, setIsLogin] = useState(true);
    const [formValues, setFormValues] = useState({
        fullName: "",
        username: "",
        email: "",
        birthDate: "",
        city: "",
        password: "",
        confirmPassword: "",
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [flashVisible, setFlashVisible] = useState(false);
    const [flashText, setFlashText] = useState('');
    const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
    const [selectedBirthDate, setSelectedBirthDate] = useState(new Date(2000, 0, 1));
    const [showYearPicker, setShowYearPicker] = useState(false);
    const [showCityModal, setShowCityModal] = useState(false);
    const [cities, setCities] = useState([]);
    const [isLoadingCities, setIsLoadingCities] = useState(false);
    const navigation = useNavigation();

    const isFormComplete = useMemo(() => {
        if (isLogin) {
            return formValues.email.trim() !== '' && formValues.password.trim() !== '';
        }
        return (
            formValues.fullName.trim() !== '' &&
            formValues.username.trim() !== '' &&
            formValues.email.trim() !== '' &&
            formValues.birthDate.trim() !== '' &&
            formValues.city.trim() !== '' &&
            formValues.password.trim() !== '' &&
            formValues.confirmPassword.trim() !== ''
        );
    }, [formValues, isLogin]);

    useEffect(() => {
        const loadCities = async () => {
            try {
                setIsLoadingCities(true);
                const response = await fetch(CITY_URL);
                const data = await response.json();
                setCities(Array.isArray(data) ? data : []);
            } catch (error) {
                setCities([]);
            } finally {
                setIsLoadingCities(false);
            }
        };

        loadCities();
    }, []);

    const handleBirthDateChange = (text) => {
        const digitsOnly = text.replace(/\D/g, "").slice(0, 8);

        let formattedDate = digitsOnly;

        if (digitsOnly.length > 2) {
            formattedDate = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2)}`;
        }

        if (digitsOnly.length > 4) {
            formattedDate = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4)}`;
        }

        setFormValues((prev) => ({ ...prev, birthDate: formattedDate }));
        setErrors((prev) => ({ ...prev, birthDate: "" }));
    };

    const applyBirthDate = (selectedDate) => {
        if (!selectedDate) return;

        setSelectedBirthDate(selectedDate);
        const day = String(selectedDate.getDate()).padStart(2, '0');
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const year = selectedDate.getFullYear();
        handleInputChange('birthDate', `${day}/${month}/${year}`);
        setShowBirthDatePicker(false);
    };

    const changeMonth = (delta) => {
        setSelectedBirthDate((curr) => {
            const year = curr.getFullYear();
            const month = curr.getMonth();
            const day = curr.getDate();
            const newYear = year + Math.floor((month + delta) / 12);
            const newMonth = (month + delta + 12) % 12;
            const daysInNewMonth = new Date(newYear, newMonth + 1, 0).getDate();
            const newDay = Math.min(day, daysInNewMonth);
            return new Date(newYear, newMonth, newDay);
        });
    };

    const handleInputChange = (field, value) => {
        setFormValues((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => ({ ...prev, [field]: "" }));
    };

    const getBirthDateError = (birthDateText) => {
        const dateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(birthDateText);

        if (!dateMatch) {
            return "Doğum tarihi GG/AA/YYYY formatında olmalı";
        }

        const day = Number(dateMatch[1]);
        const month = Number(dateMatch[2]);
        const year = Number(dateMatch[3]);

        if (month < 1 || month > 12) {
            return "Geçerli bir ay girin";
        }

        const maxDaysInMonth = new Date(year, month, 0).getDate();
        if (day < 1 || day > maxDaysInMonth) {
            return "Geçerli bir gün girin";
        }

        const birthDate = new Date(year, month - 1, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (birthDate > today) {
            return "Gelecek tarih girilemez";
        }

        return "";
    };

    const validateForm = () => {
        const nextErrors = {};

        if (!formValues.email.trim()) {
            nextErrors.email = "E-posta zorunlu";
        } else if (!formValues.email.includes("@")) {
            nextErrors.email = "Lütfen geçerli bir e-posta adresi girin";
        }

        if (!formValues.password.trim()) {
            nextErrors.password = "Şifre zorunlu";
        }

        if (!isLogin) {
            if (!formValues.fullName.trim()) nextErrors.fullName = "Ad Soyad zorunlu";
            if (!formValues.username.trim()) nextErrors.username = "Kullanıcı adı zorunlu";
            if (!formValues.birthDate.trim()) {
                nextErrors.birthDate = "Doğum tarihi zorunlu";
            } else {
                const birthDateError = getBirthDateError(formValues.birthDate.trim());
                if (birthDateError) {
                    nextErrors.birthDate = birthDateError;
                }
            }
            if (!formValues.city.trim()) nextErrors.city = "Şehir zorunlu";
            if (!formValues.confirmPassword.trim()) {
                nextErrors.confirmPassword = "Şifre tekrarı zorunlu";
            } else if (formValues.confirmPassword !== formValues.password) {
                nextErrors.confirmPassword = "Şifreler eşleşmiyor";
            }
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleSubmit = () => {
        console.log('handleSubmit', { isLogin, formValues });
        // ensure any previous success flash is cleared when attempting new submit
        setFlashVisible(false);
        const isValid = validateForm();
        if (!isValid) {
            Alert.alert('Form Hatası', 'Lütfen eksik veya hatalı alanları kontrol edin.');
            return;
        }
        if (isLogin) {
            // Sign in
            signIn(formValues.email.trim(), formValues.password)
                .then(() => {
                    // navigate immediately and show flash on HomePage
                    navigation.navigate('Ana Sayfa', { authFlash: 'Giriş başarılı' });
                })
                .catch((err) => {
                    // ensure no success flash is visible on error
                    setFlashVisible(false);
                    console.error('signin error', err);
                    const code = (err && err.code) || '';
                    const lower = String(code).toLowerCase();

                    if (lower === 'auth/user-not-found') {
                        Alert.alert('Giriş Hatası', 'Bu e-posta ile kayıtlı kullanıcı bulunamadı.');
                    } else if (lower === 'auth/wrong-password') {
                        Alert.alert('Giriş Hatası', 'E-posta veya şifre hatalı. Lütfen kontrol edin.');
                    } else if (lower === 'auth/invalid-email') {
                        Alert.alert('Giriş Hatası', 'Geçersiz e-posta adresi.');
                    } else if (lower === 'auth/too-many-requests') {
                        Alert.alert('Giriş Hatası', 'Çok fazla başarısız giriş denemesi. Bir süre sonra tekrar deneyin.');
                    } else if (lower === 'auth/user-disabled') {
                        Alert.alert('Giriş Hatası', 'Hesabınız devre dışı bırakılmış.');
                    } else if (lower.includes('invalid-credential') || lower.includes('invalidcredential')) {
                        Alert.alert('Giriş Hatası', 'Giriş bilgileri geçersiz. Lütfen bilgilerinizi kontrol edin.');
                    } else {
                        Alert.alert('Giriş Hatası', err.message || 'Giriş yapılamadı');
                    }
                });
        } else {
            // Register
            setLoading(true);
            signUp(formValues.email.trim(), formValues.password)
                .then(async (userCredential) => {
                    try {
                        const uid = userCredential.user.uid;
                        // save additional profile info
                        await createUserProfile(uid, {
                            fullName: formValues.fullName.trim(),
                            username: formValues.username.trim(),
                            email: formValues.email.trim(),
                            birthDate: formValues.birthDate.trim(),
                            city: formValues.city.trim(),
                            createdAt: new Date().toISOString(),
                        });
                        // After successful registration, sign out so user can log in manually
                        try {
                            await firebaseSignOut();
                        } catch (e) {
                            console.warn('Could not sign out after signup', e);
                        }
                        // switch to login form and clear password fields
                        setIsLogin(true);
                        setFormValues((prev) => ({ ...prev, password: '', confirmPassword: '' }));
                        Alert.alert('Başarılı', 'Kayıt başarılı. Lütfen giriş yapın.');
                    } catch (err) {
                        console.error('profile save error', err);
                        Alert.alert('Kayıp Hatası', err.message || 'Profil kaydedilemedi');
                    }
                })
                .catch((err) => {
                    console.error('signup error', err);
                    // show friendlier, localized messages for common auth errors
                    if (err && err.code === 'auth/email-already-in-use') {
                        Alert.alert('Kayıt Hatası', 'Bu e-posta zaten kayıtlı. Lütfen giriş yapın.');
                    } else if (err && err.code === 'auth/weak-password') {
                        Alert.alert('Kayıt Hatası', 'Şifre çok zayıf. Lütfen en az 6 karakterli bir şifre girin.');
                    } else if (err && err.code === 'auth/invalid-email') {
                        Alert.alert('Kayıt Hatası', 'Geçersiz e-posta adresi. Lütfen kontrol edin.');
                    } else {
                        Alert.alert('Kayıt Hatası', err.message || 'Kayıt yapılamadı');
                    }
                })
                .finally(() => setLoading(false));
        }
    };

    const formContent = (
        <>
            {!isLogin && (
                <View style={styles.fieldContainer}>
                    <Text style={styles.label}>Ad Soyad</Text>
                    <View style={[styles.inputWithIcon, errors.fullName && styles.inputError]}>
                        <Ionicons name="person-outline" size={18} color="#6b6b6b" />
                        <TextInput
                            style={styles.iconInput}
                            placeholder="Ad soyad girin"
                            placeholderTextColor="#6b6b6b"
                            value={formValues.fullName}
                            onChangeText={(text) => handleInputChange("fullName", text)}
                        />
                    </View>
                    {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}
                </View>
            )}

            {!isLogin && (
                <View style={styles.fieldContainer}>
                    <Text style={styles.label}>Kullanıcı Adı</Text>
                    <View style={[styles.inputWithIcon, errors.username && styles.inputError]}>
                        <Ionicons name="at-outline" size={18} color="#6b6b6b" />
                        <TextInput
                            style={styles.iconInput}
                            placeholder="Kullanıcı adınızı girin"
                            placeholderTextColor="#6b6b6b"
                            value={formValues.username}
                            onChangeText={(text) => handleInputChange("username", text)}
                        />
                    </View>
                    {errors.username ? <Text style={styles.errorText}>{errors.username}</Text> : null}
                </View>
            )}

            <View style={styles.fieldContainer}>
                <Text style={styles.label}>E-posta</Text>
                <View style={[styles.inputWithIcon, errors.email && styles.inputError]}>
                    <Ionicons name="mail-outline" size={18} color="#6b6b6b" />
                    <TextInput
                        style={styles.iconInput}
                        placeholder="E-postanızı girin"
                        placeholderTextColor="#6b6b6b"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={formValues.email}
                        onChangeText={(text) => handleInputChange("email", text)}
                    />
                </View>
                {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
            </View>

            {!isLogin && (
                <View style={styles.fieldContainer}>
                    <Text style={styles.label}>Doğum Tarihi</Text>
                    <Pressable style={[styles.inputWithIcon, errors.birthDate && styles.inputError]} onPress={() => setShowBirthDatePicker(true)}>
                        <Ionicons name="calendar-outline" size={18} color="#6b6b6b" />
                        <Text
                            style={styles.iconInput}
                        >
                            {formValues.birthDate || 'Takvimden seçin'}
                        </Text>
                    </Pressable>
                    {errors.birthDate ? <Text style={styles.errorText}>{errors.birthDate}</Text> : null}
                </View>
            )}

            {!isLogin && (
                <View style={styles.fieldContainer}>
                    <Text style={styles.label}>Yaşadığınız Şehir</Text>
                    <Pressable style={[styles.inputWithIcon, errors.city && styles.inputError]} onPress={() => setShowCityModal(true)}>
                        <Ionicons name="location-outline" size={18} color="#6b6b6b" />
                        <Text
                            style={styles.iconInput}
                        >
                            {formValues.city || 'Şehir seçin'}
                        </Text>
                    </Pressable>
                    {errors.city ? <Text style={styles.errorText}>{errors.city}</Text> : null}
                </View>
            )}

            <View style={styles.fieldContainer}>
                <Text style={styles.label}>Şifre</Text>
                <View style={[styles.passwordInputWrap, errors.password && styles.inputError]}>
                    <Ionicons name="lock-closed-outline" size={18} color="#6b6b6b" />
                    <TextInput
                        style={styles.iconInput}
                        placeholder="Şifrenizi girin"
                        placeholderTextColor="#6b6b6b"
                        secureTextEntry={!showPassword}
                        value={formValues.password}
                        onChangeText={(text) => handleInputChange("password", text)}
                    />
                    <Pressable onPress={() => setShowPassword((prev) => !prev)}>
                        <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#6b6b6b" />
                    </Pressable>
                </View>
                {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
            </View>

            {!isLogin && (
                <View style={styles.fieldContainer}>
                    <Text style={styles.label}>Şifre Tekrar</Text>
                    <View style={[styles.passwordInputWrap, errors.confirmPassword && styles.inputError]}>
                        <Ionicons name="lock-closed-outline" size={18} color="#6b6b6b" />
                        <TextInput
                            style={styles.iconInput}
                            placeholder="Şifrenizi tekrar girin"
                            placeholderTextColor="#6b6b6b"
                            secureTextEntry={!showConfirmPassword}
                            value={formValues.confirmPassword}
                            onChangeText={(text) => handleInputChange("confirmPassword", text)}
                        />
                        <Pressable onPress={() => setShowConfirmPassword((prev) => !prev)}>
                            <Ionicons name={showConfirmPassword ? "eye-off" : "eye"} size={20} color="#6b6b6b" />
                        </Pressable>
                    </View>
                    {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
                </View>
            )}

            <View style={styles.actionContainer}>
                <Pressable style={[styles.submitButton, isFormComplete && styles.submitButtonReady]} onPress={handleSubmit}>
                    <Text style={styles.submitButtonText}>{isLogin ? 'Giriş Yap' : 'Kayıt Ol'}</Text>
                </Pressable>
            </View>

            {!isLogin ? (
                <Modal
                    visible={showBirthDatePicker}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowBirthDatePicker(false)}
                >
                    <View style={styles.birthDateModalOverlay}>
                        <View style={styles.birthDateModalCard}>
                            <View style={styles.birthDateModalHeader}>
                                <Text style={styles.birthDateModalTitle}>Doğum Tarihi Seç</Text>
                                <Pressable onPress={() => setShowBirthDatePicker(false)}>
                                    <Ionicons name="close" size={24} color="#111" />
                                </Pressable>
                            </View>
                            {Platform.OS === 'android' ? (
                                <View>
                                    <View style={styles.calendarHeaderRow}>
                                        <Pressable onPress={() => changeMonth(-1)}>
                                            <Text style={styles.calendarNav}>&lt;</Text>
                                        </Pressable>
                                        <Pressable onPress={() => setShowYearPicker((s) => !s)}>
                                            <Text style={styles.calendarMonthTitle}>{selectedBirthDate.toLocaleString('tr-TR', { month: 'long', year: 'numeric' })}</Text>
                                        </Pressable>
                                        <Pressable onPress={() => changeMonth(1)}>
                                            <Text style={styles.calendarNav}>&gt;</Text>
                                        </Pressable>
                                    </View>
                                    <View style={styles.calendarWeekRow}>
                                        {['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'].map((h) => (
                                            <Text key={h} style={styles.calendarWeekDay}>{h}</Text>
                                        ))}
                                    </View>
                                    {showYearPicker ? (
                                        <ScrollView style={styles.yearListContainer} contentContainerStyle={styles.yearListContent}>
                                            {(() => {
                                                const years = [];
                                                const currentYear = new Date().getFullYear();
                                                for (let y = currentYear; y >= 1900; y--) years.push(y);
                                                return years.map((y) => {
                                                    const isSelected = selectedBirthDate.getFullYear() === y;
                                                    return (
                                                        <Pressable
                                                            key={y}
                                                            style={[styles.yearItem, isSelected && styles.yearItemSelected]}
                                                            onPress={() => {
                                                                const month = selectedBirthDate.getMonth();
                                                                const day = selectedBirthDate.getDate();
                                                                const daysInNewMonth = new Date(y, month + 1, 0).getDate();
                                                                const newDay = Math.min(day, daysInNewMonth);
                                                                const newDate = new Date(y, month, newDay);
                                                                setSelectedBirthDate(newDate);
                                                                setShowYearPicker(false);
                                                            }}
                                                        >
                                                            <Text style={[styles.yearItemText, isSelected && styles.yearItemTextSelected]}>{y}</Text>
                                                        </Pressable>
                                                    );
                                                });
                                            })()}
                                        </ScrollView>
                                    ) : (
                                        <View style={styles.calendarGrid}>
                                            {(() => {
                                                const year = selectedBirthDate.getFullYear();
                                                const month = selectedBirthDate.getMonth();
                                                const firstDay = new Date(year, month, 1).getDay();
                                                const offset = (firstDay + 6) % 7;
                                                const daysInMonth = new Date(year, month + 1, 0).getDate();
                                                const cells = [];
                                                for (let i = 0; i < offset; i++) cells.push(null);
                                                for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
                                                while (cells.length % 7 !== 0) cells.push(null);

                                                return cells.map((cell, idx) => {
                                                    const isSelected = cell && selectedBirthDate && (() => {
                                                        return cell.getDate() === selectedBirthDate.getDate() && cell.getMonth() === selectedBirthDate.getMonth() && cell.getFullYear() === selectedBirthDate.getFullYear();
                                                    })();
                                                    return (
                                                        <Pressable
                                                            key={idx}
                                                            style={[styles.calendarCell, isSelected && styles.calendarCellSelected]}
                                                            onPress={() => {
                                                                if (!cell) return;
                                                                setSelectedBirthDate(cell);
                                                            }}
                                                        >
                                                            <Text style={[styles.calendarCellText, isSelected && styles.calendarCellTextSelected]}>{cell ? cell.getDate() : ''}</Text>
                                                        </Pressable>
                                                    );
                                                });
                                            })()}
                                        </View>
                                    )}
                                </View>
                            ) : (
                                <DateTimePicker
                                    value={selectedBirthDate}
                                    mode="date"
                                    display="spinner"
                                    maximumDate={new Date()}
                                    onChange={(_event, date) => {
                                        if (date) setSelectedBirthDate(date);
                                    }}
                                    style={styles.birthDatePicker}
                                />
                            )}
                            <View style={styles.birthDateActions}>
                                <Pressable style={styles.birthDateActionButtonSecondary} onPress={() => setShowBirthDatePicker(false)}>
                                    <Text style={styles.birthDateActionTextSecondary}>Vazgeç</Text>
                                </Pressable>
                                <Pressable style={styles.birthDateActionButtonPrimary} onPress={() => applyBirthDate(selectedBirthDate)}>
                                    <Text style={styles.birthDateActionTextPrimary}>Tamam</Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </Modal>
            ) : null}

            <Modal visible={showCityModal} transparent animationType="slide" onRequestClose={() => setShowCityModal(false)}>
                <View style={styles.cityModalOverlay}>
                    <View style={styles.cityModalCard}>
                        <View style={styles.cityModalHeader}>
                            <Text style={styles.cityModalTitle}>Şehir Seç</Text>
                            <Pressable onPress={() => setShowCityModal(false)}>
                                <Ionicons name="close" size={24} color="#111" />
                            </Pressable>
                        </View>
                        {isLoadingCities ? (
                            <Text style={styles.cityModalLoading}>Yükleniyor...</Text>
                        ) : (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {cities.map((city) => (
                                    <Pressable
                                        key={city.sehir_id}
                                        style={styles.cityOption}
                                        onPress={() => {
                                            handleInputChange('city', city.sehir_adi);
                                            setShowCityModal(false);
                                        }}
                                    >
                                        <Text style={styles.cityOptionText}>{city.sehir_adi}</Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

        </>
    );

    return (
        <ImageBackground
            source={require('../images/login-register-image.png')}
            style={styles.backgroundImage}
            resizeMode='cover'
        >
            <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
                <Ionicons name="chevron-back" size={24} color="white" />
            </Pressable>

            {
                flashVisible ? (
                    <View style={styles.flashBox} pointerEvents="none">
                        <Text style={styles.flashText}>{flashText}</Text>
                    </View>
                ) : null
            }

            <View style={styles.welcomeContainer}>
                <Text style={styles.welcomeTitle}>Hoş Geldin</Text>
                <Text style={styles.welcomeSubtitle}>Pawtopia ile patili dostlara kolayca destek ol.</Text>
            </View>

            <View style={styles.switchContainer}>
                <Pressable style={[styles.switchButton, isLogin ? styles.switchButtonActive : styles.switchButtonInactive]} onPress={() => { setIsLogin(true); setErrors({}); }}>
                    <Text style={[styles.title, isLogin ? styles.titleActive : styles.titleInactive]}>Giriş Yap</Text>
                </Pressable>
                <Pressable style={[styles.switchButton, !isLogin ? styles.switchButtonActive : styles.switchButtonInactive]} onPress={() => { setIsLogin(false); setErrors({}); }}>
                    <Text style={[styles.title, !isLogin ? styles.titleActive : styles.titleInactive]}>Kayıt Ol</Text>
                </Pressable>
            </View>
            {
                isLogin ? (
                    <View style={styles.formWrapper}>{formContent}</View>
                ) : (
                    <ScrollView
                        style={styles.registerScrollView}
                        contentContainerStyle={styles.registerScrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps='handled'
                    >
                        <View style={styles.formWrapper}>{formContent}</View>
                    </ScrollView>
                )
            }


        </ImageBackground >
    );
}

const styles = StyleSheet.create({
    backgroundImage: {
        flex: 1,
        paddingTop: 150,
    },
    backButton: {
        position: 'absolute',
        top: 70,
        left: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.35)',
        zIndex: 20,
        elevation: 8,
    },
    backIcon: {
        color: 'white',
        fontSize: 24,
        fontWeight: '700',
        lineHeight: 24,
    },
    welcomeContainer: {
        width: '86%',
        alignSelf: 'center',
        marginBottom: 14,
        marginTop: -30,
    },
    welcomeTitle: {
        fontSize: 34,
        fontWeight: '800',
        color: '#000000',
        alignSelf: 'center',
    },
    welcomeSubtitle: {
        marginTop: 4,
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(0, 0, 0, 0.92)',
        alignSelf: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    titleActive: {
        color: 'white',
    },
    titleInactive: {
        color: '#4a4a4a',
    },
    switchContainer: {
        backgroundColor: getColor('--light-three'),
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        overflow: 'hidden',
        width: '86%',
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
    },
    switchButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
    },
    switchButtonActive: {
        backgroundColor: getColor('--light-five'),
    },
    switchButtonInactive: {
        backgroundColor: getColor('--light-two'),
    },
    formWrapper: {
        marginTop: 8,
        width: '86%',
        alignSelf: 'center',
        backgroundColor: 'rgba(255,255,255,0.6)',
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 12,
        alignItems: 'center',
    },
    registerScrollView: {
        width: '100%',
        marginTop: 8,
        marginBottom: 40,
    },
    registerScrollContent: {
        paddingBottom: 24,
    },
    fieldContainer: {
        marginBottom: 10,
        width: '92%',
        alignSelf: 'center',
    },
    label: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#222',
    },
    inputWithIcon: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 10,
        marginTop: 4,
        borderWidth: 1,
        borderColor: '#cfcfcf',
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.88)',
        paddingHorizontal: 10,
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 3,
        elevation: 3,
    },
    passwordInputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 10,
        marginTop: 4,
        borderWidth: 1,
        borderColor: '#cfcfcf',
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.88)',
        paddingHorizontal: 10,
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 3,
        elevation: 3,
    },
    iconInput: {
        flex: 1,
        paddingVertical: 8,
        color: '#222',
    },
    cityModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
    },
    cityModalCard: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        padding: 16,
        maxHeight: '70%',
    },
    cityModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    cityModalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111',
    },
    cityModalLoading: {
        textAlign: 'center',
        paddingVertical: 24,
        color: '#555',
    },
    cityOption: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    cityOptionText: {
        fontSize: 16,
        color: '#111',
        fontWeight: '600',
    },
    birthDateModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 18,
    },
    birthDateModalCard: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 16,
    },
    birthDateModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    birthDateModalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111',
    },
    birthDatePicker: {
        width: '100%',
        alignSelf: 'center',
    },
    birthDateActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 14,
        gap: 10,
    },
    birthDateActionButtonPrimary: {
        flex: 1,
        backgroundColor: getColor('--light-six'),
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: 'center',
    },
    birthDateActionButtonSecondary: {
        flex: 1,
        backgroundColor: '#e5e7eb',
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: 'center',
    },
    birthDateActionTextPrimary: {
        color: '#fff',
        fontWeight: '700',
    },
    birthDateActionTextSecondary: {
        color: '#111',
        fontWeight: '700',
    },
    calendarHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    calendarNav: {
        fontSize: 20,
        color: '#111',
        paddingHorizontal: 8,
    },
    calendarMonthTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111',
    },
    calendarWeekRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    calendarWeekDay: {
        width: '14.28%',
        textAlign: 'center',
        color: '#6b6b6b',
        fontWeight: '700',
    },
    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    calendarCell: {
        width: '14.28%',
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 6,
        marginVertical: 2,
    },
    calendarCellText: {
        color: '#111',
    },
    calendarCellSelected: {
        backgroundColor: getColor('--light-six'),
    },
    calendarCellTextSelected: {
        color: '#fff',
        fontWeight: '700',
    },
    yearListContainer: {
        maxHeight: 240,
        marginTop: 8,
    },
    yearListContent: {
        paddingBottom: 12,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    yearItem: {
        width: '20%',
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        margin: 4,
        backgroundColor: '#f3f4f6',
    },
    yearItemSelected: {
        backgroundColor: getColor('--light-six'),
    },
    yearItemText: {
        fontSize: 14,
        color: '#111',
    },
    yearItemTextSelected: {
        color: '#fff',
        fontWeight: '700',
    },
    inputError: {
        borderColor: '#dc2626',
    },
    errorText: {
        marginTop: 4,
        color: '#b91c1c',
        fontSize: 12,
        fontWeight: '600',
    },
    actionContainer: {
        width: '100%',
        alignItems: 'center',
        marginTop: 6,
    },
    submitButton: {
        paddingVertical: 9,
        paddingHorizontal: 10,
        borderRadius: 10,
        width: '80%',
        backgroundColor: getColor('--light-six'),
    },
    submitButtonReady: {
        backgroundColor: getColor('--light-six-dark'),
    },
    submitButtonText: {
        color: 'white',
        fontSize: 18,
        textAlign: 'center',
        fontWeight: '700',
    },
    flashBox: {
        position: 'absolute',
        top: 110,
        alignSelf: 'center',
        backgroundColor: 'rgba(34,197,94,0.95)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        zIndex: 50,
        elevation: 10,
    },
    flashText: {
        color: 'white',
        fontWeight: '700',
    },
});
