'use client';

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useFirestore, useFunctions, useUser, useFirestoreCollectionData } from 'reactfire';

import type { User, Plant } from '@/types';

// Define the shape of our App's context
interface AppContextType {
  currentUser: User | null;
  users: User[];
  plants: Plant[];
  locations: {name: string}[];
  loading: boolean;
  addUser: (userData: Omit<User, 'id'>) => Promise<void>;
  updateUser: (userData: User) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
}

// Create the context
export const AppContext = createContext<AppContextType | null>(null);

// Custom hook to use the AppContext
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

// AppProvider component to fetch and provide data
export const AppProvider = ({ children }: { children: ReactNode }) => {
  const firestore = useFirestore();
  const functions = useFunctions();
  const { status: userStatus, data: authUser } = useUser();

  const usersCollection = collection(firestore, 'users');
  const { status: usersStatus, data: users } = useFirestoreCollectionData(usersCollection, { idField: 'id' });

  const plantsCollection = collection(firestore, 'plants');
  const { status: plantsStatus, data: plants } = useFirestoreCollectionData(plantsCollection, { idField: 'id' });
  
  const locationsCollection = collection(firestore, 'locations');
  const { status: locationsStatus, data: locations } = useFirestoreCollectionData(locationsCollection, { idField: 'id' });

  const currentUser = useMemo(() => {
    if (authUser && users) {
      return (users as User[]).find(u => u.id === authUser.uid) || null;
    }
    return null;
  }, [authUser, users]);

  const loading = userStatus === 'loading' || usersStatus === 'loading' || plantsStatus === 'loading' || locationsStatus === 'loading';
  
  const addUser = async (userData: Omit<User, 'id'>) => {
    const { password, ...rest } = userData;
    if (!password) throw new Error('Password is required for new user');
    
    const createUser = httpsCallable(functions, 'createUser');
    try {
      await createUser({ 
        email: userData.email, 
        password: password, 
        displayName: userData.fullName, 
        customClaims: { plantIds: userData.plantIds }
      });
      // Firestore document is created via the cloud function
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  };

  const updateUser = async (userData: User) => {
    const { id, password, ...rest } = userData;
    const userDocRef = doc(firestore, 'users', id);
    const batch = writeBatch(firestore);
    batch.update(userDocRef, rest);
    
    const updateUserFn = httpsCallable(functions, 'updateUser');
    try {
        await updateUserFn({ userId: id, claims: { plantIds: userData.plantIds } });
        if(password){
            const updateUserPasswordFn = httpsCallable(functions, 'updateUserPassword');
            await updateUserPasswordFn({ userId: id, password: password });
        }
        await batch.commit();
    } catch(err){
        console.error("Error updating user", err)
    }
  };

  const deleteUser = async (userId: string) => {
    const deleteUserFn = httpsCallable(functions, 'deleteUser');
    try {
        await deleteUserFn({ userId });
    } catch(err){
        console.error("Error deleting user", err)
    }
  };

  const value = {
    currentUser: currentUser as User | null,
    users: (users || []) as User[],
    plants: (plants || []) as Plant[],
    locations: (locations || []) as {name: string}[],
    loading,
    addUser,
    updateUser,
    deleteUser
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};