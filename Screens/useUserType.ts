// Create a new file useUserType.ts
import { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app, auth } from '../firebase';

export const useUserType = () => {
  const [userType, setUserType] = useState<'doctor' | 'patient' | null>(null);
  const db = getFirestore(app);

  useEffect(() => {
    const fetchUserType = async () => {
      const user = auth.currentUser;
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const userData = docSnap.data();
          setUserType(userData.userType);
        }
      }
    };

    fetchUserType();
  }, []);

  return userType;
};
