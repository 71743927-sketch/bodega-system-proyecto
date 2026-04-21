import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'bodega-alertas-descartadas';

@Injectable({
  providedIn: 'root'
})
export class AlertasService {

  private readonly _descartadas = signal<string[]>(this.cargarDescartadas());
  descartadas = this._descartadas.asReadonly();

  estaDescartada(id: string): boolean {
    return this._descartadas().includes(id);
  }

  descartarAlerta(id: string) {
    if (this.estaDescartada(id)) {
      return;
    }

    this._descartadas.update(lista => {
      const nueva = [...lista, id];
      this.guardar(nueva);
      return nueva;
    });
  }

  restaurarAlerta(id: string) {
    this._descartadas.update(lista => {
      const nueva = lista.filter(item => item !== id);
      this.guardar(nueva);
      return nueva;
    });
  }

  limpiarDescartes() {
    this._descartadas.set([]);
    this.guardar([]);
  }

  reemplazarDescartadas(ids: string[]) {
    const saneadas = Array.from(new Set(ids.filter(item => typeof item === 'string')));
    this._descartadas.set(saneadas);
    this.guardar(saneadas);
  }

  private cargarDescartadas(): string[] {
    try {
      if (typeof localStorage === 'undefined') {
        return [];
      }

      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }

  private guardar(lista: string[]) {
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
