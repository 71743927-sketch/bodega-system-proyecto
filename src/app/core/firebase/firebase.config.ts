import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: 'AIzaSyDMFqRxstIbNTgHCTsd-2jh6dvFPT29M50',
  authDomain: 'bodega-system.firebaseapp.com',
  projectId: 'bodega-system',
  storageBucket: 'bodega-system.firebasestorage.app',
  messagingSenderId: '7084002857',
  appId: '1:7084002857:web:ba5933908ce6da0bd35638'
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firestoreDb = getFirestore(firebaseApp);



