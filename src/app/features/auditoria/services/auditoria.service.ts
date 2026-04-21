import { Injectable, signal } from '@angular/core';
import { EventoAuditoria, ModuloAuditoria, NivelAuditoria } from '../models/evento-auditoria';

const STORAGE_KEY = 'bodega-auditoria';
const SESSION_KEY = 'bodega-session';

@Injectable({
  providedIn: 'root'
})
export class AuditoriaService {

  private readonly _eventos = signal<EventoAuditoria[]>(this.cargarDesdeStorage());
  eventosLectura = this._eventos.asReadonly();

  obtenerSiguienteId(): number {
    const lista = this._eventos();
    return lista.length === 0 ? 1 : Math.max(...lista.map(e => e.id)) + 1;
  }

  registrar(
    modulo: ModuloAuditoria,
    accion: string,
    detalle: string,
    nivel: NivelAuditoria = 'INFO',
    metadata: string = '',
    usuario?: string
  ) {
    const evento: EventoAuditoria = {
      id: this.obtenerSiguienteId(),
      fecha: new Date().toISOString(),
      modulo,
      accion,
      detalle,
      usuario: usuario?.trim() || this.obtenerUsuarioSesion() || 'Sistema',
      nivel,
      metadata: metadata.trim()
    };

    this._eventos.update(lista => {
      const nuevaLista = [evento, ...lista].slice(0, 1000);
      this.guardarEnStorage(nuevaLista);
      return nuevaLista;
    });
  }

  limpiarEventos() {
    this._eventos.set([]);
    this.guardarEnStorage([]);
  }

  reemplazarEventos(eventos: EventoAuditoria[]) {
    const saneados = [...eventos]
      .map((evento, index) => ({
        ...evento,
        id: typeof evento.id === 'number' ? evento.id : index + 1,
        fecha: evento.fecha || new Date().toISOString(),
        usuario: evento.usuario || 'Sistema',
        metadata: evento.metadata || ''
      }))
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    this._eventos.set(saneados);
    this.guardarEnStorage(saneados);
  }

  private obtenerUsuarioSesion(): string | null {
    try {
      if (typeof localStorage === 'undefined') {
        return null;
      }

      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as { username?: string };
      return parsed.username?.trim() || null;
    } catch {
      return null;
    }
  }

  private cargarDesdeStorage(): EventoAuditoria[] {
    try {
      if (typeof localStorage === 'undefined') {
        return [];
      }

      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private guardarEnStorage(lista: EventoAuditoria[]) {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
    } catch {
      // Ignorar errores de persistencia local
    }
  }
}
