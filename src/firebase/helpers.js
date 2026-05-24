import { auth, db, storage } from './config';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    sendPasswordResetEmail,
    updateEmail as fbUpdateEmail,
    updatePassword as fbUpdatePassword,
    deleteUser as fbDeleteUser,
} from 'firebase/auth';
import { collection, addDoc, getDocs, doc, setDoc, getDoc, deleteDoc, updateDoc, query, where } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as FileSystem from 'expo-file-system';

export async function signUp(email, password) {
    try {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        return res;
    } catch (err) {
        console.error('signUp error', err);
        throw err;
    }
}

export async function signIn(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

export async function signOut() {
    return firebaseSignOut(auth);
}

export async function sendPasswordReset(email) {
    return sendPasswordResetEmail(auth, email);
}

export async function addPet(data) {
    return addDoc(collection(db, 'pets'), data);
}

function cleanFirestoreData(data) {
    return Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined)
    );
}

export async function updatePet(petId, data) {
    if (!petId) {
        throw new Error('Pet id is required');
    }

    const petRef = doc(db, 'pets', petId);
    await setDoc(petRef, cleanFirestoreData(data), { merge: true });
    return true;
}

export async function deletePet(petId) {
    if (!petId) {
        throw new Error('Pet id is required');
    }

    const petRef = doc(db, 'pets', petId);
    await deleteDoc(petRef);
    return true;
}

export async function createUserProfile(uid, profileData) {
    try {
        const userRef = doc(db, 'users', uid);
        await setDoc(userRef, profileData);
        return true;
    } catch (err) {
        console.error('createUserProfile error', err);
        throw err;
    }
}

export async function getUserProfile(uid) {
    try {
        const userRef = doc(db, 'users', uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() };
    } catch (err) {
        console.error('getUserProfile error', err);
        throw err;
    }
}

export async function updateUserProfile(uid, data) {
    try {
        const userRef = doc(db, 'users', uid);
        await setDoc(userRef, data, { merge: true });
        return true;
    } catch (err) {
        console.error('updateUserProfile error', err);
        throw err;
    }
}

export async function getUserFavoritePetIds(uid) {
    if (!uid) return [];

    const profile = await getUserProfile(uid);
    return Array.isArray(profile?.favoritePetIds) ? profile.favoritePetIds.filter(Boolean) : [];
}

export async function getUserFavoritePets(uid) {
    if (!uid) return [];

    const [favoritePetIds, pets] = await Promise.all([
        getUserFavoritePetIds(uid),
        getPets(),
    ]);

    if (!favoritePetIds.length) return [];

    return pets.filter((pet) => favoritePetIds.includes(pet.id));
}

export async function togglePetFavorite(uid, petId) {
    if (!uid) {
        throw new Error('User id is required');
    }

    if (!petId) {
        throw new Error('Pet id is required');
    }

    const favoritePetIds = await getUserFavoritePetIds(uid);
    const isAlreadyFavorite = favoritePetIds.includes(petId);
    const nextFavoritePetIds = isAlreadyFavorite
        ? favoritePetIds.filter((id) => id !== petId)
        : [...favoritePetIds, petId];

    await updateDoc(doc(db, 'users', uid), {
        favoritePetIds: nextFavoritePetIds,
    });

    return !isAlreadyFavorite;
}

export async function updateAuthEmail(newEmail) {
    try {
        if (!auth.currentUser) throw new Error('Kullanıcı oturumu yok');
        await fbUpdateEmail(auth.currentUser, newEmail);
        return true;
    } catch (err) {
        console.error('updateAuthEmail error', err);
        throw err;
    }
}

export async function updateAuthPassword(newPassword) {
    try {
        if (!auth.currentUser) throw new Error('Kullanıcı oturumu yok');
        await fbUpdatePassword(auth.currentUser, newPassword);
        return true;
    } catch (err) {
        console.error('updateAuthPassword error', err);
        throw err;
    }
}

export async function deleteUserAccount(uid) {
    try {
        // remove Firestore doc first
        const userRef = doc(db, 'users', uid);
        await deleteDoc(userRef).catch(() => { });

        // then delete auth user if current
        if (auth.currentUser && auth.currentUser.uid === uid) {
            await fbDeleteUser(auth.currentUser);
        }
        return true;
    } catch (err) {
        console.error('deleteUserAccount error', err);
        throw err;
    }
}

export async function getPets() {
    const snap = await getDocs(collection(db, 'pets'));
    return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((left, right) => {
            const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
            const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
            return rightTime - leftTime;
        });
}

export async function getUserPets(uid) {
    if (!uid) return [];

    const snap = await getDocs(query(collection(db, 'pets'), where('createdByUid', '==', uid)));
    return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((left, right) => {
            const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
            const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
            return rightTime - leftTime;
        });
}

export async function getPetById(petId) {
    if (!petId) return null;

    const petRef = doc(db, 'pets', petId);
    const snap = await getDoc(petRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
}

export function uploadImage(file, path = 'images') {
    const storageReference = storageRef(storage, `${path}/${Date.now()}_${file.name || 'file'}`);
    const uploadTask = uploadBytesResumable(storageReference, file);
    return new Promise((resolve, reject) => {
        uploadTask.on(
            'state_changed',
            null,
            (err) => reject(err),
            async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(url);
            }
        );
    });
}

export async function uploadImageFromBase64(base64, path = 'images', contentType = 'image/jpeg') {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('Kullanıcı oturumu yok');
        }

        const filename = `${Date.now()}.jpg`;
        const objectPath = `${path}/${filename}`;
        const storageReference = storageRef(storage, objectPath);

        const blob = await (await fetch(`data:${contentType};base64,${base64}`)).blob();
        const uploadResult = await uploadBytes(storageReference, blob, {
            contentType,
        });
        return await getDownloadURL(uploadResult.ref);
    } catch (err) {
        return `data:${contentType};base64,${base64}`;
    }
}

export async function uploadImageFromUri(fileUri, path = 'images', contentType = 'image/jpeg') {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('Kullanıcı oturumu yok');
        }

        const filename = `${Date.now()}.jpg`;
        const objectPath = `${path}/${filename}`;
        const storageReference = storageRef(storage, objectPath);

        const response = await fetch(fileUri);
        const blob = await response.blob();
        const uploadResult = await uploadBytes(storageReference, blob, {
            contentType,
        });

        return await getDownloadURL(uploadResult.ref);
    } catch (err) {
        const base64 = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.Base64,
        });
        return `data:${contentType};base64,${base64}`;
    }
}
