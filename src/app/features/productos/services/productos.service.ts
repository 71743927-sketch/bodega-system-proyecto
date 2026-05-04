import { Injectable, signal } from '@angular/core';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { firestoreDb } from '../../../core/firebase/firebase.config';
import { AuditoriaService } from '../../auditoria/services/auditoria.service';
import { Producto } from '../models/producto';

const STORAGE_KEY = 'bodega-productos';

const DEFAULT_PRODUCTOS: Producto[] = [
  {
    id: 1,
    codigo: 'P-001',
    nombre: 'Arroz Costeño 5kg',
    categoria: 'Abarrotes',
    precioCompra: 18.50,
    precioVenta: 22.00,
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
    precioCompra: 8.20,
    precioVenta: 10.50,
    stockActual: 3,
    stockMinimo: 4,
    activo: true,
    observacion: 'Conviene reponer semanalmente.'
  },
  {
    id: 3,
    codigo: 'P-003',
    nombre: 'Leche Gloria 400g',
    categoria: 'Lácteos',
    precioCompra: 3.20,
    precioVenta: 4.00,
    stockActual: 12,
    stockMinimo: 6,
    activo: true,
    observacion: 'Producto sensible a quiebres de stock.'
  },
  {
    id: 4,
    codigo: 'P-004',
    nombre: 'Galleta Soda Field',
    categoria: 'Snacks',
    precioCompra: 1.10,
    precioVenta: 1.60,
    stockActual: 18,
    stockMinimo: 8,
    activo: true,
    observacion: 'Venta unitaria constante.'
  }
];

@Injectable({
  providedIn: 'root'
})
export class ProductosService {
  private readonly auditoriaService = new AuditoriaService();
  private readonly productosRef = collection(firestoreDb, 'productos');

  private readonly _productos = signal<Producto[]>([]);
  productosLectura = this._productos.asReadonly();

  private migrationTried = false;

  constructor() {
    const productosQuery = query(this.productosRef, orderBy('nombre'));

    onSnapshot(productosQuery, {
      next: snapshot => {
        const items = snapshot.docs.map(docSnap => ({
          ...(docSnap.data() as Producto),
          observacion: (docSnap.data() as Producto).observacion ?? ''
        }));
        this._productos.set(items);
        this.intentarMigracionInicial(items);
      },
      error: () => {
        const local = this.cargarDesdeStorage();
        this._productos.set(local);
      }
    });
  }

  obtenerSiguienteId(): number {
    const lista = this._productos();
    return lista.length === 0 ? 1 : Math.max(...lista.map(item => item.id)) + 1;
  }

  obtenerCategorias(): string[] {
    return Array.from(new Set(this._productos().map(item => item.categoria.trim()).filter(item => item !== '')))
      .sort((a, b) => a.localeCompare(b));
  }

  agregarProducto(producto: Producto) {
    const payload: Producto = {
      ...producto,
      observacion: producto.observacion ?? ''
    };

    setDoc(doc(firestoreDb, 'productos', String(payload.id)), payload)
      .then(() => {
        this.auditoriaService.registrar(
          'PRODUCTOS',
          'CREAR',
          `Producto creado: ${payload.nombre}`,
          'SUCCESS',
          `Código: ${payload.codigo}`
        );
      })
      .catch(() => {
        const nueva = [...this._productos(), payload].sort((a, b) => a.nombre.localeCompare(b.nombre));
        this._productos.set(nueva);
        this.guardarEnStorage(nueva);
      });
  }

  actualizarProducto(productoActualizado: Producto) {
    const payload: Producto = {
      ...productoActualizado,
      observacion: productoActualizado.observacion ?? ''
    };

    const anterior = this._productos().find(item => item.id === payload.id);

    updateDoc(doc(firestoreDb, 'productos', String(payload.id)), { ...payload } as never)
      .then(() => {
        this.auditoriaService.registrar(
          'PRODUCTOS',
          'ACTUALIZAR',
          `Producto actualizado: ${payload.nombre}`,
          'INFO',
          anterior ? `Stock ${anterior.stockActual} -> ${payload.stockActual}` : payload.codigo
        );
      })
      .catch(() => {
        const nueva = this._productos()
          .map(item => item.id === payload.id ? payload : item)
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
        this._productos.set(nueva);
        this.guardarEnStorage(nueva);
      });
  }

  eliminarProducto(id: number) {
    const producto = this._productos().find(item => item.id === id);

    deleteDoc(doc(firestoreDb, 'productos', String(id)))
      .then(() => {
        if (producto) {
          this.auditoriaService.registrar(
            'PRODUCTOS',
            'ELIMINAR',
            `Producto eliminado: ${producto.nombre}`,
            'DANGER',
            `Código: ${producto.codigo}`
          );
        }
      })
      .catch(() => {
        const nueva = this._productos().filter(item => item.id !== id);
        this._productos.set(nueva);
        this.guardarEnStorage(nueva);
      });
  }

  alternarEstado(id: number) {
    const actual = this._productos().find(item => item.id === id);
    if (!actual) {
      return;
    }

    this.actualizarProducto({
      ...actual,
      activo: !actual.activo
    });
  }

  actualizarProductoStock(productoId: number, cantidadVendida: number) {
    const actual = this._productos().find(item => item.id === productoId);
    if (!actual) {
      return;
    }

    this.actualizarProducto({
      ...actual,
      stockActual: actual.stockActual - cantidadVendida
    });
  }

  actualizarStockPorReposicion(productoId: number, cantidad: number) {
    const actual = this._productos().find(item => item.id === productoId);
    if (!actual) {
      return;
    }

    this.actualizarProducto({
      ...actual,
      stockActual: actual.stockActual + cantidad
    });
  }

  reemplazarProductos(items: Producto[]) {
    const saneados = items.map(item => ({
      ...item,
      observacion: item.observacion ?? ''
    }));

    saneados.forEach(item => {
      setDoc(doc(firestoreDb, 'productos', String(item.id)), item).catch(() => {});
    });

    this._productos.set(saneados);
    this.guardarEnStorage(saneados);
  }

  restablecerBase() {
    const defaults = DEFAULT_PRODUCTOS.map(item => ({ ...item }));
    this.reemplazarProductos(defaults);

    this.auditoriaService.registrar(
      'PRODUCTOS',
      'RESTABLECER',
      'Se restableció el catálogo base de productos.',
      'WARNING'
    );
  }

  private async intentarMigracionInicial(actual: Producto[]) {
    if (this.migrationTried) {
      return;
    }
    this.migrationTried = true;

    if (actual.length > 0) {
      return;
    }

    const local = this.cargarDesdeStorage();
    if (local.length > 0) {
      this.reemplazarProductos(local);
      return;
    }

    this.reemplazarProductos(DEFAULT_PRODUCTOS);
  }

  private cargarDesdeStorage(): Producto[] {
    try {
      if (typeof localStorage === 'undefined') {
        return DEFAULT_PRODUCTOS.map(item => ({ ...item }));
      }

      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return DEFAULT_PRODUCTOS.map(item => ({ ...item }));
      }

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.map(item => ({ ...item, observacion: item.observacion ?? '' }))
        : DEFAULT_PRODUCTOS.map(item => ({ ...item }));
    } catch {
      return DEFAULT_PRODUCTOS.map(item => ({ ...item }));
    }
  }

  private guardarEnStorage(lista: Producto[]) {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
    } catch {
      // ignorar
    }
  }
}
