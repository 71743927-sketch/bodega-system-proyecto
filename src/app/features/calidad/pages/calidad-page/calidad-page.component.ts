import { CurrencyPipe, JsonPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { AuditoriaService } from '../../../auditoria/services/auditoria.service';
import { CajaService } from '../../../caja/services/caja.service';
import { ComprasService } from '../../../compras/services/compras.service';
import { ConfiguracionService } from '../../../configuracion/services/configuracion.service';
import { InventarioService } from '../../../inventario/services/inventario.service';
import { ProductosService } from '../../../productos/services/productos.service';
import { ProveedoresService } from '../../../proveedores/services/proveedores.service';
import { UsuariosService } from '../../../usuarios/services/usuarios.service';
import { VentasService } from '../../../ventas/services/ventas.service';
import { CalidadService } from '../../services/calidad.service';

@Component({
  selector: 'app-calidad-page',
  standalone: true,
  imports: [CurrencyPipe, JsonPipe],
  templateUrl: './calidad-page.component.html',
  styleUrl: './calidad-page.component.css'
})
export class CalidadPageComponent {

  private readonly calidadService = inject(CalidadService);
  private readonly ventasService = inject(VentasService);
  private readonly comprasService = inject(ComprasService);
  private readonly productosService = inject(ProductosService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly proveedoresService = inject(ProveedoresService);
  private readonly inventarioService = inject(InventarioService);
  private readonly cajaService = inject(CajaService);
  private readonly auditoriaService = inject(AuditoriaService);
  private readonly configuracionService = inject(ConfiguracionService);

  mensaje = signal('');

  ventas = this.ventasService.ventasLectura;
  compras = this.comprasService.comprasLectura;
  productos = this.productosService.productosLectura;
  usuarios = this.usuariosService.usuariosLectura;
  proveedores = this.proveedoresService.proveedoresLectura;
  movimientosInventario = this.inventarioService.movimientosLectura;
  cierresCaja = this.cajaService.cierres;
  cajaActiva = this.cajaService.cajaActiva;
  eventosAuditoria = this.auditoriaService.eventosLectura;
  configuracion = this.configuracionService.configuracionLectura;

  hallazgos = computed(() => this.calidadService.generarHallazgos());

  resumen = computed(() => {
    const hallazgos = this.hallazgos();
    return {
      ok: hallazgos.filter(item => item.nivel === 'OK').length,
      info: hallazgos.filter(item => item.nivel === 'INFO').length,
      warning: hallazgos.filter(item => item.nivel === 'WARNING').length,
      error: hallazgos.filter(item => item.nivel === 'ERROR').length,
      productos: this.productos().length,
      ventas: this.ventas().length,
      compras: this.compras().length,
      utilidadEstimada:
        this.ventas().reduce((sum, item) => sum + item.total, 0) -
        this.compras().reduce((sum, item) => sum + item.total, 0)
    };
  });

  reporteJson = computed(() => JSON.stringify({
    fecha: new Date().toISOString(),
    resumen: this.resumen(),
    hallazgos: this.hallazgos(),
    metricas: {
      productos: this.productos().length,
      ventas: this.ventas().length,
      compras: this.compras().length,
      usuarios: this.usuarios().length,
      proveedores: this.proveedores().length,
      movimientosInventario: this.movimientosInventario().length,
      cierresCaja: this.cierresCaja().length,
      auditoria: this.eventosAuditoria().length,
      cajaActiva: this.cajaActiva() ? true : false,
      configuracion: this.configuracion()
    }
  }, null, 2));

  exportarDiagnostico() {
    const fileName = `bodega_calidad_tecnica_${new Date().toISOString().slice(0, 10)}.json`;
    this.calidadService.exportarDiagnostico(fileName, this.reporteJson());
    this.mensaje.set(`Se exportó el diagnóstico técnico como ${fileName}.`);
  }
}
