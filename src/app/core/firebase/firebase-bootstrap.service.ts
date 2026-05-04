import { Injectable } from '@angular/core';
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { firestoreDb } from './firebase.config';

declare global {
  interface Window {
    firebaseDebugWrite?: () => Promise<void>;
  }
}

const DEFAULT_PRODUCTOS = [
  {
    id: 1,
    codigo: 'P-001',
    nombre: 'Arroz Costeño 5kg',
    categoria: 'Abarrotes',
    precioCompra: 18.5,
    precioVenta: 22,
    stockActual: 20,
    stockMinimo: 5,
    activo: true,
    observacion: 'Producto de alta rotación.'
  },
  {
    id: 2,
    codigo: 'P-002',
    nombre: 'Aceite Vegetal 1L',
    categoria: 'Abarrotes',
    precioCompra: 8.2,
    precioVenta: 10.5,
    stockActual: 3,
    stockMinimo: 4,
    activo: true,
    observacion: 'Conviene reponer semanalmente.'
  }
];

@Injectable({
  providedIn: 'root'
})
export class FirebaseBootstrapService {
  constructor() {
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
  }

  async init(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    console.log('[FirebaseBootstrap] INIT');

    try {
      await this.crearMetaBootstrap();
      await this.sembrarProductosSiHaceFalta();
      console.log('[FirebaseBootstrap] OK');
    } catch (error) {
      console.error('[FirebaseBootstrap] ERROR', error);
    }
  }

  private async crearMetaBootstrap(): Promise<void> {
    await setDoc(
      doc(firestoreDb, '_meta', 'bootstrap'),
      {
        ok: true,
        source: 'angular-root',
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  }

  private async sembrarProductosSiHaceFalta(): Promise<void> {
    const productosRef = collection(firestoreDb, 'productos');
    const q = query(productosRef, limit(1));
    const snap = await getDocs(q);

    if (!snap.empty) {
      return;
    }

    for (const item of DEFAULT_PRODUCTOS) {
      await setDoc(doc(firestoreDb, 'productos', String(item.id)), item, { merge: true });
    }
  }
}
