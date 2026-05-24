import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import ProfilePage from '../pages/ProfilePage';
import LoginRegisterPage from '../pages/LoginRegisterPage';

export default function ProfileTab(props) {
    const [user, setUser] = useState(auth.currentUser || null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            console.log('ProfileTab - onAuthStateChanged ->', u && u.uid);
            setUser(u);
        });
        return unsub;
    }, []);

    if (user) {
        return <ProfilePage />;
    }
    return <LoginRegisterPage />;
}
