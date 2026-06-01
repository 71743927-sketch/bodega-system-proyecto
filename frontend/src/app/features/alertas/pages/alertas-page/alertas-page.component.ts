import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { AuditoriaService } from '../../../auditoria/services/auditoria.service';
import { CajaService } from '../../../caja/services/caja.service';
import { ComprasService } from '../../../compras/services/compras.service';
import { ProductosService } from '../../../productos/services/productos.service';
import { UsuariosService } from '../../../usuarios/services/usuarios.service';
import { VentasService } from '../../../ventas/services/ventas.service';
import { AlertaSistema, OrigenAlerta, SeveridadAlerta } from '../../models/alerta';
import { AlertasService } from '../../services/alertas.service';

@Component({
  selector: 'app-alertas-page',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './alertas-page.component.html',
  styleUrl: './alertas-page.component.css'
})
export class AlertasPageComponent {

  private productosService = inject(ProductosService);
  private cajaService = inject(CajaService);
  private auditoriaService = inject(AuditoriaService);
  private usuariosService = inject(UsuariosService);
  private ventasService = inject(VentasService);
  private comprasService = inject(ComprasService);
  private alertasService = inject(AlertasService);

  productos = this.productosService.productosLectura;
  cierresCaja = this.cajaService.cierres;
  cajaActiva = this.cajaService.cajaActiva;
  eventosAuditoria = this.auditoriaService.eventosLectura;
  usuarios = this.usuariosService.usuariosLectura;
  ventas = this.ventasService.ventasLectura;
  compras = this.comprasService.comprasLectura;

  busqueda = signal('');
  filtroSeveridad = signal<'TODOS' | SeveridadAlerta>('TODOS');
  filtroOrigen = signal<'TODOS' | OrigenAlerta>('TODOS');
  incluirDescartadas = signal(false);

  severidades: SeveridadAlerta[] = ['INFO', 'MEDIA', 'ALTA', 'CRITICA'];
  origenes: OrigenAlerta[] = ['STOCK', 'CAJA', 'AUDITORIA', 'USUARIOS', 'VENTAS', 'COMPRAS', 'SISTEMA'];

  private generarAlertasBase(): AlertaSistema[] {
    const ahora = new Date();
    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);
    const hace7Dias = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
    const hace15Dias = new Date(ahora.getTime() - 15 * 24 * 60 * 60 * 1000);

    const alertas: AlertaSistema[] = [];

    // STOCK CRÍTICO Y BAJO
    this.productos().forEach(producto => {
      if (producto.stockActual === 0) {
        alertas.push({
          id: `stock-empty-${producto.id}`,
          fecha: new Date().toISOString(),
          origen: 'STOCK',
          severidad: 'CRITICA',
          titulo: `Producto agotado: ${producto.nombre}`,
          descripcion: `El producto ${producto.codigo} no tiene stock disponible.`,
          accionSugerida: 'Registrar compra o reposición inmediata.',
          referencia: producto.codigo,
          descartada: this.alertasService.estaDescartada(`stock-empty-${producto.id}`)
        });
      } else if (producto.stockActual <= producto.stockMinimo) {
        alertas.push({
          id: `stock-low-${producto.id}`,
          fecha: new Date().toISOString(),
          origen: 'STOCK',
          severidad: 'ALTA',
          titulo: `Stock bajo: ${producto.nombre}`,
          descripcion: `Stock actual ${producto.stockActual}; mínimo configurado ${producto.stockMinimo}.`,
          accionSugerida: 'Planificar reposición antes de que el producto se agote.',
          referencia: producto.codigo,
          descartada: this.alertasService.estaDescartada(`stock-low-${producto.id}`)
        });
      }
    });

    // CAJA
    const ultimaCaja = this.cierresCaja()[0];
    if (ultimaCaja && ultimaCaja.diferencia !== 0) {
      alertas.push({
        id: `caja-diferencia-${ultimaCaja.id}`,
        fecha: ultimaCaja.fechaCierre,
        origen: 'CAJA',
        severidad: Math.abs(ultimaCaja.diferencia) >= 10 ? 'CRITICA' : 'ALTA',
        titulo: `Diferencia en cierre de caja #${ultimaCaja.id}`,
        descripcion: `La diferencia registrada fue S/ ${ultimaCaja.diferencia.toFixed(2)}.`,
        accionSugerida: 'Revisar movimientos manuales, ventas y efectivo contado.',
        referencia: `Cierre ${ultimaCaja.id}`,
        descartada: this.alertasService.estaDescartada(`caja-diferencia-${ultimaCaja.id}`)
      });
    }

    if (!this.cajaActiva()) {
      alertas.push({
        id: 'caja-no-activa',
        fecha: new Date().toISOString(),
        origen: 'CAJA',
        severidad: 'INFO',
        titulo: 'No hay caja activa',
        descripcion: 'Actualmente no se ha abierto una caja para el turno.',
        accionSugerida: 'Abrir caja si el negocio está en operación.',
        referencia: 'Caja actual',
        descartada: this.alertasService.estaDescartada('caja-no-activa')
      });
    }

    // AUDITORÍA: eventos críticos y warnings recientes
    const eventosRecientes = this.eventosAuditoria().filter((evento: any) => new Date(evento.fecha) >= hace7Dias);
    const criticos = eventosRecientes.filter((evento: any) => evento.nivel === 'DANGER').length;
    const warnings = eventosRecientes.filter((evento: any) => evento.nivel === 'WARNING').length;

    if (criticos > 0) {
      alertas.push({
        id: 'auditoria-criticos',
        fecha: new Date().toISOString(),
        origen: 'AUDITORIA',
        severidad: 'CRITICA',
        titulo: 'Eventos críticos recientes',
        descripcion: `Se detectaron ${criticos} eventos de nivel crítico en los últimos 7 días.`,
        accionSugerida: 'Revisar el módulo Auditoría para investigar incidencias graves.',
        referencia: 'Bitácora',
        descartada: this.alertasService.estaDescartada('auditoria-criticos')
      });
    }

    if (warnings > 0) {
      alertas.push({
        id: 'auditoria-warnings',
        fecha: new Date().toISOString(),
        origen: 'AUDITORIA',
        severidad: 'MEDIA',
        titulo: 'Warnings recientes en auditoría',
        descripcion: `Se registraron ${warnings} eventos de advertencia en los últimos 7 días.`,
        accionSugerida: 'Monitorear los eventos para evitar que escalen a críticos.',
        referencia: 'Bitácora',
        descartada: this.alertasService.estaDescartada('auditoria-warnings')
      });
    }

    // USUARIOS INACTIVOS
    const inactivos = this.usuarios().filter(usuario => !usuario.activo);
    if (inactivos.length > 0) {
      alertas.push({
        id: 'usuarios-inactivos',
        fecha: new Date().toISOString(),
        origen: 'USUARIOS',
        severidad: 'MEDIA',
        titulo: 'Usuarios inactivos detectados',
        descripcion: `Hay ${inactivos.length} usuarios inactivos en el sistema.`,
        accionSugerida: 'Confirmar si deben mantenerse inactivos o reactivarse.',
        referencia: inactivos.map((item: any) => item.username).join(', '),
        descartada: this.alertasService.estaDescartada('usuarios-inactivos')
      });
    }

    // VENTAS DEL DÍA
    const ventasHoy = this.ventas().filter((item: any) => new Date(item.fecha) >= hoyInicio);
    if (ventasHoy.length === 0) {
      alertas.push({
        id: 'ventas-sin-registros-hoy',
        fecha: new Date().toISOString(),
        origen: 'VENTAS',
        severidad: 'INFO',
        titulo: 'Sin ventas registradas hoy',
        descripcion: 'No se han encontrado ventas en la fecha actual.',
        accionSugerida: 'Verificar si el negocio está operando o si hay un problema de registro.',
        referencia: 'Ventas del día',
        descartada: this.alertasService.estaDescartada('ventas-sin-registros-hoy')
      });
    }

    // COMPRAS ANTIGUAS Y STOCK CRÍTICO
    const ultimaCompra = this.compras()[0];
    if (ultimaCompra) {
      const fechaUltimaCompra = new Date(ultimaCompra.fecha);
      if (fechaUltimaCompra < hace15Dias && this.productos().some(p => p.stockActual <= p.stockMinimo)) {
        alertas.push({
          id: 'compras-atrasadas-stock',
          fecha: new Date().toISOString(),
          origen: 'COMPRAS',
          severidad: 'ALTA',
          titulo: 'Reposición pendiente',
          descripcion: 'Hay productos con stock crítico y no se registran compras recientes.',
          accionSugerida: 'Registrar compras de reposición cuanto antes.',
          referencia: `Última compra: ${ultimaCompra.id}`,
          descartada: this.alertasService.estaDescartada('compras-atrasadas-stock')
        });
      }
    } else if (this.productos().some(p => p.stockActual <= p.stockMinimo)) {
      alertas.push({
        id: 'sin-compras-con-stock-critico',
        fecha: new Date().toISOString(),
        origen: 'COMPRAS',
        severidad: 'CRITICA',
        titulo: 'No hay compras registradas con stock crítico',
        descripcion: 'El sistema no tiene compras registradas y existen productos en estado crítico.',
        accionSugerida: 'Registrar proveedores y compras de abastecimiento.',
        referencia: 'Compras',
        descartada: this.alertasService.estaDescartada('sin-compras-con-stock-critico')
      });
    }

    return alertas.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }

  alertas = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const severidad = this.filtroSeveridad();
    const origen = this.filtroOrigen();
    const incluirDescartadas = this.incluirDescartadas();

    return this.generarAlertasBase().filter(alerta => {
      const coincideTexto =
        texto === '' ||
        alerta.titulo.toLowerCase().includes(texto) ||
        alerta.descripcion.toLowerCase().includes(texto) ||
        alerta.referencia.toLowerCase().includes(texto) ||
        alerta.accionSugerida.toLowerCase().includes(texto);

      const coincideSeveridad = severidad === 'TODOS' || alerta.severidad === severidad;
      const coincideOrigen = origen === 'TODOS' || alerta.origen === origen;
      const coincideDescartada = incluirDescartadas || !alerta.descartada;

      return coincideTexto && coincideSeveridad && coincideOrigen && coincideDescartada;
    });
  });

  totalAlertas = computed(() => this.generarAlertasBase().length);
  criticas = computed(() => this.generarAlertasBase().filter(a => a.severidad === 'CRITICA' && !a.descartada).length);
  altas = computed(() => this.generarAlertasBase().filter(a => a.severidad === 'ALTA' && !a.descartada).length);
  medias = computed(() => this.generarAlertasBase().filter(a => a.severidad === 'MEDIA' && !a.descartada).length);
  infos = computed(() => this.generarAlertasBase().filter(a => a.severidad === 'INFO' && !a.descartada).length);

  actualizarBusqueda(valor: string) {
    this.busqueda.set(valor);
  }

  actualizarSeveridad(valor: 'TODOS' | SeveridadAlerta) {
    this.filtroSeveridad.set(valor);
  }

  actualizarOrigen(valor: 'TODOS' | OrigenAlerta) {
    this.filtroOrigen.set(valor);
  }

  actualizarIncluirDescartadas(valor: boolean) {
    this.incluirDescartadas.set(valor);
  }

  limpiarFiltros() {
    this.busqueda.set('');
    this.filtroSeveridad.set('TODOS');
    this.filtroOrigen.set('TODOS');
    this.incluirDescartadas.set(false);
  }

  descartar(alerta: AlertaSistema) {
    this.alertasService.descartarAlerta(alerta.id);
    this.auditoriaService.registrar('SISTEMA', 'ALERTA_DESCARTADA', `Alerta descartada: ${alerta.titulo}`, 'INFO', alerta.id);
  }

  restaurar(alerta: AlertaSistema) {
    this.alertasService.restaurarAlerta(alerta.id);
    this.auditoriaService.registrar('SISTEMA', 'ALERTA_RESTAURADA', `Alerta restaurada: ${alerta.titulo}`, 'INFO', alerta.id);
  }

  limpiarDescartes() {
    this.alertasService.limpiarDescartes();
    this.auditoriaService.registrar('SISTEMA', 'ALERTAS_LIMPIAR_DESCARTES', 'Se limpiaron los descartes de alertas.', 'INFO');
  }
}

