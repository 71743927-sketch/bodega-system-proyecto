$ErrorActionPreference = "Stop"

$Root = Get-Location
$Frontend = Join-Path $Root "frontend"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " MIGRAR PRODUCTOS A SIGNAL FORMS" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

if (-not (Test-Path $Frontend)) {
    Write-Host "[ERROR] No existe frontend/. Ejecuta desde la raiz del proyecto." -ForegroundColor Red
    exit 1
}

$TsPath = Join-Path $Frontend "src/app/features/productos/pages/productos-page/productos-page.component.ts"
$HtmlPath = Join-Path $Frontend "src/app/features/productos/pages/productos-page/productos-page.component.html"
$CssPath = Join-Path $Frontend "src/app/features/productos/pages/productos-page/productos-page.component.css"

if (-not (Test-Path $TsPath)) {
    Write-Host "[ERROR] No existe productos-page.component.ts" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $HtmlPath)) {
    Write-Host "[ERROR] No existe productos-page.component.html" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $CssPath)) {
    Write-Host "[ERROR] No existe productos-page.component.css" -ForegroundColor Red
    exit 1
}

function Write-FileSafe {
    param(
        [string]$Path,
        [string]$Content
    )

    Copy-Item $Path "$Path.signal.bak" -Force
    Write-Host "[BACKUP] $Path -> $Path.signal.bak" -ForegroundColor Yellow

    Set-Content -Path $Path -Value $Content -Encoding UTF8
    Write-Host "[OK] Escrito: $Path" -ForegroundColor Green
}

$TsContent = @'
import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';

import { Producto } from '../../models/producto';
import { ProductosService } from '../../services/productos.service';

interface ProductoSignalFormModel {
  codigo: string;
  nombre: string;
  categoria: string;
  precioCompra: number;
  precioVenta: number;
  stockActual: number;
  stockMinimo: number;
  activo: boolean;
  observacion: string;
}

interface ProductosFiltroSignalModel {
  busqueda: string;
  categoria: string;
  soloActivos: boolean;
  soloCriticos: boolean;
}

@Component({
  selector: 'app-productos-page',
  standalone: true,
  imports: [FormField],
  templateUrl: './productos-page.component.html',
  styleUrl: './productos-page.component.css'
})
export class ProductosPageComponent {

  private readonly productosService = inject(ProductosService);

  readonly productos = this.productosService.productosLectura;

  readonly editandoId = signal<number | null>(null);
  readonly enviado = signal(false);
  readonly mensaje = signal('');

  readonly productoModel = signal<ProductoSignalFormModel>(this.obtenerFormularioBase());
  readonly productoForm = form(this.productoModel);

  readonly filtrosModel = signal<ProductosFiltroSignalModel>({
    busqueda: '',
    categoria: '',
    soloActivos: true,
    soloCriticos: false
  });

  readonly filtrosForm = form(this.filtrosModel);

  readonly categorias = computed(() => this.productosService.obtenerCategorias());

  readonly productosFiltrados = computed(() => {
    const filtros = this.filtrosModel();
    const texto = filtros.busqueda.trim().toLowerCase();

    return this.productos().filter((producto: Producto) => {
      const coincideTexto =
        !texto ||
        producto.codigo.toLowerCase().includes(texto) ||
        producto.nombre.toLowerCase().includes(texto) ||
        producto.categoria.toLowerCase().includes(texto);

      const coincideCategoria =
        !filtros.categoria || producto.categoria === filtros.categoria;

      const coincideActivo =
        !filtros.soloActivos || producto.activo;

      const coincideCritico =
        !filtros.soloCriticos || producto.stockActual <= producto.stockMinimo;

      return coincideTexto && coincideCategoria && coincideActivo && coincideCritico;
    });
  });

  readonly resumen = computed(() => {
    const lista = this.productos();

    const activos = lista.filter((item: Producto) => item.activo).length;
    const criticos = lista.filter((item: Producto) => item.stockActual <= item.stockMinimo).length;
    const valorizado = lista.reduce(
      (sum: number, item: Producto) => sum + item.stockActual * item.precioCompra,
      0
    );

    const margenPromedio = lista.length === 0
      ? 0
      : lista.reduce((sum: number, item: Producto) => {
          const margen = item.precioVenta - item.precioCompra;
          return sum + margen;
        }, 0) / lista.length;

    return {
      total: lista.length,
      activos,
      criticos,
      valorizado,
      margenPromedio
    };
  });

  readonly formularioValido = computed(() => {
    const model = this.productoModel();

    return (
      model.codigo.trim().length > 0 &&
      model.nombre.trim().length > 0 &&
      model.categoria.trim().length > 0 &&
      Number(model.precioCompra) >= 0 &&
      Number(model.precioVenta) >= 0 &&
      Number(model.stockActual) >= 0 &&
      Number(model.stockMinimo) >= 0 &&
      Number(model.precioVenta) >= Number(model.precioCompra)
    );
  });

  readonly modoEdicion = computed(() => this.editandoId() !== null);

  guardar(): void {
    this.enviado.set(true);
    this.mensaje.set('');

    if (!this.formularioValido()) {
      this.mensaje.set('Completa correctamente los datos del producto.');
      return;
    }

    const model = this.productoModel();

    const duplicado = this.productos().find((item: Producto) =>
      item.codigo.trim().toLowerCase() === model.codigo.trim().toLowerCase() &&
      item.id !== this.editandoId()
    );

    if (duplicado) {
      this.mensaje.set('Ya existe un producto con ese codigo.');
      return;
    }

    const payload: Producto = {
      id: this.editandoId() ?? this.productosService.obtenerSiguienteId(),
      codigo: model.codigo.trim(),
      nombre: model.nombre.trim(),
      categoria: model.categoria.trim(),
      precioCompra: Number(model.precioCompra),
      precioVenta: Number(model.precioVenta),
      stockActual: Number(model.stockActual),
      stockMinimo: Number(model.stockMinimo),
      activo: Boolean(model.activo),
      observacion: model.observacion.trim()
    };

    if (this.modoEdicion()) {
      this.productosService.actualizarProducto(payload);
      this.mensaje.set('Producto actualizado correctamente.');
    } else {
      this.productosService.agregarProducto(payload);
      this.mensaje.set('Producto agregado correctamente.');
    }

    this.cancelarEdicion();
  }

  editar(producto: Producto): void {
    this.editandoId.set(producto.id);

    this.productoModel.set({
      codigo: producto.codigo,
      nombre: producto.nombre,
      categoria: producto.categoria,
      precioCompra: producto.precioCompra,
      precioVenta: producto.precioVenta,
      stockActual: producto.stockActual,
      stockMinimo: producto.stockMinimo,
      activo: producto.activo,
      observacion: producto.observacion ?? ''
    });

    this.enviado.set(false);
    this.mensaje.set('');
  }

  eliminar(producto: Producto): void {
    const confirmar = confirm(`¿Eliminar producto ${producto.nombre}?`);

    if (!confirmar) {
      return;
    }

    this.productosService.eliminarProducto(producto.id);
    this.mensaje.set('Producto eliminado correctamente.');
  }

  alternarEstado(producto: Producto): void {
    this.productosService.alternarEstado(producto.id);
  }

  cancelarEdicion(): void {
    this.editandoId.set(null);
    this.productoModel.set(this.obtenerFormularioBase());
    this.enviado.set(false);
  }

  restablecerBase(): void {
    this.productosService.restablecerBase();
    this.mensaje.set('Productos recargados desde backend.');
  }

  limpiarFiltros(): void {
    this.filtrosModel.set({
      busqueda: '',
      categoria: '',
      soloActivos: true,
      soloCriticos: false
    });
  }

  private obtenerFormularioBase(): ProductoSignalFormModel {
    return {
      codigo: '',
      nombre: '',
      categoria: 'General',
      precioCompra: 0,
      precioVenta: 0,
      stockActual: 0,
      stockMinimo: 0,
      activo: true,
      observacion: ''
    };
  }
}
'@

$HtmlContent = @'
<section class="productos-page">
  <header class="page-header">
    <div>
      <h1>Productos</h1>
      <p>Gestión de productos usando Signal Forms y backend FastAPI.</p>
    </div>

    <button type="button" class="secondary" (click)="restablecerBase()">
      Recargar desde backend
    </button>
  </header>

  <section class="summary-grid">
    <article>
      <span>Total</span>
      <strong>{{ resumen().total }}</strong>
    </article>

    <article>
      <span>Activos</span>
      <strong>{{ resumen().activos }}</strong>
    </article>

    <article>
      <span>Críticos</span>
      <strong>{{ resumen().criticos }}</strong>
    </article>

    <article>
      <span>Valorizado</span>
      <strong>S/ {{ resumen().valorizado }}</strong>
    </article>
  </section>

  <section class="card">
    <h2>{{ modoEdicion() ? 'Editar producto' : 'Nuevo producto' }}</h2>

    <form class="product-form" (submit)="guardar(); $event.preventDefault()" novalidate>
      <div class="field">
        <label>Código</label>
        <input type="text" [formField]="productoForm.codigo" placeholder="PROD-001" />

        @if (enviado() && !productoModel().codigo.trim()) {
          <small>El código es obligatorio.</small>
        }
      </div>

      <div class="field">
        <label>Nombre</label>
        <input type="text" [formField]="productoForm.nombre" placeholder="Nombre del producto" />

        @if (enviado() && !productoModel().nombre.trim()) {
          <small>El nombre es obligatorio.</small>
        }
      </div>

      <div class="field">
        <label>Categoría</label>
        <input type="text" [formField]="productoForm.categoria" placeholder="General" />

        @if (enviado() && !productoModel().categoria.trim()) {
          <small>La categoría es obligatoria.</small>
        }
      </div>

      <div class="field">
        <label>Precio compra</label>
        <input type="number" min="0" step="0.01" [formField]="productoForm.precioCompra" />
      </div>

      <div class="field">
        <label>Precio venta</label>
        <input type="number" min="0" step="0.01" [formField]="productoForm.precioVenta" />

        @if (enviado() && productoModel().precioVenta < productoModel().precioCompra) {
          <small>El precio de venta no puede ser menor al precio de compra.</small>
        }
      </div>

      <div class="field">
        <label>Stock actual</label>
        <input type="number" min="0" step="1" [formField]="productoForm.stockActual" />
      </div>

      <div class="field">
        <label>Stock mínimo</label>
        <input type="number" min="0" step="1" [formField]="productoForm.stockMinimo" />
      </div>

      <div class="field checkbox">
        <label>
          <input type="checkbox" [formField]="productoForm.activo" />
          Producto activo
        </label>
      </div>

      <div class="field full">
        <label>Observación</label>
        <textarea rows="3" [formField]="productoForm.observacion" placeholder="Notas internas"></textarea>
      </div>

      @if (mensaje()) {
        <p class="message">{{ mensaje() }}</p>
      }

      <div class="actions full">
        <button type="submit">
          {{ modoEdicion() ? 'Actualizar producto' : 'Guardar producto' }}
        </button>

        @if (modoEdicion()) {
          <button type="button" class="secondary" (click)="cancelarEdicion()">
            Cancelar
          </button>
        }
      </div>
    </form>
  </section>

  <section class="card">
    <h2>Filtros</h2>

    <form class="filters" (submit)="$event.preventDefault()">
      <input type="search" [formField]="filtrosForm.busqueda" placeholder="Buscar por código, nombre o categoría" />

      <select [formField]="filtrosForm.categoria">
        <option value="">Todas las categorías</option>

        @for (categoria of categorias(); track categoria) {
          <option [value]="categoria">{{ categoria }}</option>
        }
      </select>

      <label>
        <input type="checkbox" [formField]="filtrosForm.soloActivos" />
        Solo activos
      </label>

      <label>
        <input type="checkbox" [formField]="filtrosForm.soloCriticos" />
        Solo críticos
      </label>

      <button type="button" class="secondary" (click)="limpiarFiltros()">
        Limpiar filtros
      </button>
    </form>
  </section>

  <section class="card">
    <h2>Listado de productos</h2>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Categoría</th>
            <th>Compra</th>
            <th>Venta</th>
            <th>Stock</th>
            <th>Mínimo</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>

        <tbody>
          @for (producto of productosFiltrados(); track producto.id) {
            <tr [class.inactive]="!producto.activo" [class.critical]="producto.stockActual <= producto.stockMinimo">
              <td>{{ producto.codigo }}</td>
              <td>{{ producto.nombre }}</td>
              <td>{{ producto.categoria }}</td>
              <td>S/ {{ producto.precioCompra }}</td>
              <td>S/ {{ producto.precioVenta }}</td>
              <td>{{ producto.stockActual }}</td>
              <td>{{ producto.stockMinimo }}</td>
              <td>{{ producto.activo ? 'Activo' : 'Inactivo' }}</td>
              <td class="row-actions">
                <button type="button" class="small" (click)="editar(producto)">Editar</button>
                <button type="button" class="small secondary" (click)="alternarEstado(producto)">
                  {{ producto.activo ? 'Desactivar' : 'Activar' }}
                </button>
                <button type="button" class="small danger" (click)="eliminar(producto)">Eliminar</button>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="9" class="empty">No hay productos para mostrar.</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  </section>
</section>
'@

$CssContent = @'
.productos-page {
  display: grid;
  gap: 24px;
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.page-header h1 {
  margin: 0;
}

.page-header p {
  margin: 4px 0 0;
  color: #64748b;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.summary-grid article,
.card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

.summary-grid span {
  display: block;
  color: #64748b;
  font-size: 14px;
}

.summary-grid strong {
  display: block;
  margin-top: 6px;
  font-size: 24px;
}

.product-form {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.filters {
  display: grid;
  grid-template-columns: 2fr 1fr auto auto auto;
  gap: 12px;
  align-items: center;
}

.field {
  display: grid;
  gap: 6px;
}

.field.full,
.actions.full {
  grid-column: 1 / -1;
}

.field.checkbox {
  align-content: end;
}

label {
  font-weight: 600;
}

input,
select,
textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  font: inherit;
}

small,
.message {
  color: #dc2626;
  font-weight: 600;
}

.actions {
  display: flex;
  gap: 12px;
}

button {
  border: none;
  background: #2563eb;
  color: #ffffff;
  padding: 10px 14px;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
}

button.secondary {
  background: #64748b;
}

button.danger {
  background: #dc2626;
}

button.small {
  padding: 7px 10px;
  font-size: 13px;
}

.table-wrapper {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  border-bottom: 1px solid #e2e8f0;
  padding: 10px;
  text-align: left;
}

tr.critical {
  background: #fff7ed;
}

tr.inactive {
  opacity: 0.65;
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.empty {
  text-align: center;
  color: #64748b;
}

@media (max-width: 1000px) {
  .summary-grid,
  .product-form,
  .filters {
    grid-template-columns: 1fr;
  }
}
'@

Write-FileSafe $TsPath $TsContent
Write-FileSafe $HtmlPath $HtmlContent
Write-FileSafe $CssPath $CssContent

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host " PRODUCTOS MIGRADO A SIGNAL FORMS" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Ahora ejecuta:"
Write-Host "cd frontend"
Write-Host "ng serve -o"
Write-Host ""
Write-Host "Luego prueba:"
Write-Host "http://localhost:4200/productos"