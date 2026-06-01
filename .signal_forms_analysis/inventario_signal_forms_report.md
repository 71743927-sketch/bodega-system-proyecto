# Análisis Inventario para migración a Signal Forms

- Fecha: `2026-05-31 20:26:56`
- Base: `C:\Users\clint\Downloads\bodega-system-proyecto\frontend\src\app\features\inventario`

## 1. Archivos

- **component_ts**: `frontend/src/app/features/inventario/pages/inventario-page/inventario-page.component.ts`
- **component_html**: `frontend/src/app/features/inventario/pages/inventario-page/inventario-page.component.html`
- **service**: `frontend/src/app/features/inventario/services/inventario.service.ts`
- **model**: `frontend/src/app/features/inventario/models/movimiento-inventario.ts`

## 2. Estado actual del componente

- Usa Signal Forms reales: `False`
- Usa `(input)` manual: `True`
- Usa `[value]` manual: `True`
- Usa `ngModel`: `False`
- Usa Reactive Forms clásico: `False`

### Servicios inyectados
- `productosService` -> `ProductosService`
- `inventarioService` -> `InventarioService`

### Métodos del componente
- `actualizarBusqueda()`
- `actualizarCantidad()`
- `actualizarFiltroStock()`
- `actualizarFiltroTipo()`
- `actualizarProducto()`
- `actualizarTexto()`
- `actualizarTipo()`
- `etiquetaTipo()`
- `limpiarFormulario()`
- `registrarMovimiento()`

### Llamadas a servicios
- `actualizarProducto()`
- `obtenerSiguienteId()`
- `registrarMovimiento()`

## 3. Controles HTML detectados

- Inputs: `4`
- Selects: `4`
- Textareas: `1`

### `input`
- Type: `number`
- Placeholder: ``
- `[value]`: `formulario().cantidad`
- `(input)`: `actualizarCantidad($any($event.target).value)`
- `[formField]`: ``
- Tag: `<input
              id="cantidad"
              type="number"
              min="0"
              [value]="formulario().cantidad"
              (input)="actualizarCantidad($any($event.target).value)" />`

### `input`
- Type: `text`
- Placeholder: `Ej. Administrador`
- `[value]`: `formulario().usuario`
- `(input)`: `actualizarTexto(`
- `[formField]`: ``
- Tag: `<input
              id="usuario"
              type="text"
              [value]="formulario().usuario"
              (input)="actualizarTexto('usuario', $any($event.target).value)"
              placeholder="Ej. Administrador" />`

### `input`
- Type: `text`
- Placeholder: `Buscar producto por nombre, código o categoría`
- `[value]`: `busqueda()`
- `(input)`: `actualizarBusqueda($any($event.target).value)`
- `[formField]`: ``
- Tag: `<input
          type="text"
          [value]="busqueda()"
          (input)="actualizarBusqueda($any($event.target).value)"
          placeholder="Buscar producto por nombre, código o categoría" />`

### `input`
- Type: `text`
- Placeholder: `Buscar por producto, usuario u observación`
- `[value]`: `busqueda()`
- `(input)`: `actualizarBusqueda($any($event.target).value)`
- `[formField]`: ``
- Tag: `<input
        type="text"
        [value]="busqueda()"
        (input)="actualizarBusqueda($any($event.target).value)"
        placeholder="Buscar por producto, usuario u observación" />`

### `select`
- Type: ``
- Placeholder: ``
- `[value]`: `formulario().productoId ?? `
- `(input)`: ``
- `[formField]`: ``
- Tag: `<select id="productoId" [value]="formulario().productoId ?? ''" (change)="actualizarProducto($any($event.target).value)">`

### `select`
- Type: ``
- Placeholder: ``
- `[value]`: `formulario().tipo`
- `(input)`: ``
- `[formField]`: ``
- Tag: `<select id="tipo" [value]="formulario().tipo" (change)="actualizarTipo($any($event.target).value)">`

### `select`
- Type: ``
- Placeholder: ``
- `[value]`: `filtroStock()`
- `(input)`: ``
- `[formField]`: ``
- Tag: `<select [value]="filtroStock()" (change)="actualizarFiltroStock($any($event.target).value)">`

### `select`
- Type: ``
- Placeholder: ``
- `[value]`: `filtroTipo()`
- `(input)`: ``
- `[formField]`: ``
- Tag: `<select [value]="filtroTipo()" (change)="actualizarFiltroTipo($any($event.target).value)">`

### `textarea`
- Type: ``
- Placeholder: `Ej. Reposición de mercadería, merma, corrección de inventario, etc.`
- `[value]`: `formulario().observacion`
- `(input)`: `actualizarTexto(`
- `[formField]`: ``
- Tag: `<textarea
              id="observacion"
              rows="4"
              [value]="formulario().observacion"
              (input)="actualizarTexto('observacion', $any($event.target).value)"
              placeholder="Ej. Reposición de mercadería`

## 4. Servicio de inventario

- Usa Firestore directo: `True`
- Usa ProductosService: `False`

### Métodos del servicio
- `actualizarItem()`
- `actualizarMovimiento()`
- `actualizarStock()`
- `agregarItem()`
- `agregarMovimiento()`
- `asRecord()`
- `borrarItem()`
- `borrarMovimiento()`
- `buscarInterno()`
- `buscarPorCodigo()`
- `buscarPorNombre()`
- `cargarDesdeStorage()`
- `constructor()`
- `crearItem()`
- `crearMovimiento()`
- `deleteDoc()`
- `descontarStock()`
- `editarItem()`
- `editarMovimiento()`
- `eliminarItem()`
- `eliminarMovimiento()`
- `extraerActivo()`
- `extraerCantidad()`
- `extraerCategoria()`
- `extraerCodigo()`
- `extraerId()`
- `extraerNombre()`
- `extraerProductoId()`
- `extraerStockActual()`
- `extraerStockMinimo()`
- `extraerTipoMovimiento()`
- `guardarEnStorage()`
- `incrementarStock()`
- `intentarMigracionInicial()`
- `normalizarMovimiento()`
- `obtenerActivos()`
- `obtenerBajoStock()`
- `obtenerInactivos()`
- `obtenerPorId()`
- `obtenerPorProductoId()`
- `obtenerSiguienteId()`
- `onSnapshot()`
- `ordenarMovimientos()`
- `reemplazarInventario()`
- `reemplazarMovimientos()`
- `registrarEntrada()`
- `registrarItem()`
- `registrarMovimiento()`
- `registrarSalida()`
- `resumenInventario()`
- `sanearMovimiento()`
- `setDoc()`

## 5. Recomendación

- Migrar a Signal Forms reales usando `signal()`, `form()` y `[formField]`.
- Conservar los métodos críticos de stock.
- No cambiar lógica de inventario todavía si el backend no tiene endpoints de inventario.
- Si inventario solo llama a `ProductosService`, se puede migrar únicamente la UI del formulario sin tocar backend.
