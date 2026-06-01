import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc
} from 'firebase/firestore';
import { firestoreDb } from './firebase.config';

declare global {
  interface Window {
    auditoriaDebugInsert?: () => Promise<void>;
    auditoriaDebugInsertDanger?: () => Promise<void>;
    auditoriaDebugList?: () => Promise<void>;
    auditoriaDebugClearDebug?: () => Promise<void>;
  }
}

async function insertarEvento(
  nivel: 'INFO' | 'WARNING' | 'DANGER',
  accion: string,
  descripcion: string
): Promise<void> {
  const id = Date.now();

  const payload = {
    id,
    modulo: 'DEBUG',
    accion,
    descripcion,
    nivel,
    detalle: 'Insertado desde auditoria-debug.ts',
    usuario: 'debug',
    fecha: new Date().toISOString()
  };

  await setDoc(doc(firestoreDb, 'auditoria', String(id)), payload, { merge: true });
  console.log('[AuditoriaDebug] INSERT OK', payload);
}

if (typeof window !== 'undefined') {
  window.auditoriaDebugInsert = async () => {
    console.log('[AuditoriaDebug] INSERT INFO');
    await insertarEvento(
      'INFO',
      'PRUEBA_MANUAL',
      'Evento de prueba manual de auditoría'
    );
  };

  window.auditoriaDebugInsertDanger = async () => {
    console.log('[AuditoriaDebug] INSERT DANGER');
    await insertarEvento(
      'DANGER',
      'PRUEBA_CRITICA',
      'Evento crítico de prueba manual'
    );
  };

  window.auditoriaDebugList = async () => {
    const snap = await getDocs(collection(firestoreDb, 'auditoria'));
    const rows = snap.docs
      .map(item => item.data() as Record<string, unknown>)
      .sort(
        (a, b) =>
          new Date(String(b['fecha'] ?? '')).getTime() -
          new Date(String(a['fecha'] ?? '')).getTime()
      );

    console.log(`[AuditoriaDebug] TOTAL = ${rows.length}`);
    console.table(rows.slice(0, 20));
  };

  window.auditoriaDebugClearDebug = async () => {
    const snap = await getDocs(collection(firestoreDb, 'auditoria'));
    let deleted = 0;

    for (const item of snap.docs) {
      const data = item.data() as Record<string, unknown>;
      const modulo = String(data['modulo'] ?? '').toUpperCase();
      const usuario = String(data['usuario'] ?? '').toLowerCase();

      if (modulo === 'DEBUG' || usuario === 'debug') {
        await deleteDoc(item.ref);
        deleted++;
      }
    }

    console.log(`[AuditoriaDebug] CLEAR OK. Eliminados: ${deleted}`);
  };
}
