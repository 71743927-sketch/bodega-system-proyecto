import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { firestoreDb } from './firebase.config';

declare global {
  interface Window {
    firebaseDebugWrite?: () => Promise<void>;
  }
}

if (typeof window !== 'undefined') {
  window.firebaseDebugWrite = async () => {
    console.log('[FirebaseDebug] INIT');
    try {
      await setDoc(
        doc(firestoreDb, '_meta', 'manual-test'),
        {
          ok: true,
          source: 'window.firebaseDebugWrite',
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
      console.log('[FirebaseDebug] OK');
    } catch (error) {
      console.error('[FirebaseDebug] ERROR', error);
    }
  };
}
