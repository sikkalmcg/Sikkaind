'use client';

import React, { createContext, useEffect, useState, ReactNode } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import type { SubUser, Plant } from '@/types';

interface AppContextType {
  users: SubUser[];
  plants: Plant[];
  currentUser: SubUser | null;
  addUser: (data: any) => Promise<void>;
  updateUser: (data: any) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [users, setUsers] = useState<SubUser[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<SubUser | null>(null);

  useEffect(() => {
    if (!firestore) return;

    const unsubUsers = onSnapshot(collection(firestore, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as SubUser)));
    });

    const unsubPlants = onSnapshot(collection(firestore, 'logistics_plants'), (snap) => {
      setPlants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Plant)));
    });

    return () => {
      unsubUsers();
      unsubPlants();
    };
  }, [firestore]);

  useEffect(() => {
    if (!firestore || !user) {
      setCurrentUserProfile(null);
      return;
    }
    const unsub = onSnapshot(doc(firestore, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        setCurrentUserProfile({ id: snap.id, ...snap.data() } as SubUser);
      }
    });
    return () => unsub();
  }, [firestore, user]);

  const addUser = async (data: any) => {
    if (!firestore) return;
    const email = data.email || `${data.username}@sikka.com`;
    await setDoc(doc(firestore, 'users', email), {
      ...data,
      email,
      createdAt: serverTimestamp(),
    });
  };

  const updateUser = async (data: any) => {
    if (!firestore || !data.id) return;
    const { id, ...rest } = data;
    await updateDoc(doc(firestore, 'users', id), {
      ...rest,
      lastUpdated: serverTimestamp(),
    });
  };

  const deleteUser = async (id: string) => {
    if (!firestore) return;
    await deleteDoc(doc(firestore, 'users', id));
  };

  return (
    <AppContext.Provider value={{ 
      users, 
      plants, 
      currentUser: currentUserProfile,
      addUser,
      updateUser,
      deleteUser
    }}>
      {children}
    </AppContext.Provider>
  );
}