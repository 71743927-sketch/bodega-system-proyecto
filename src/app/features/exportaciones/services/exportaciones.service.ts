import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ExportacionesService {

  convertirJson(data: unknown): string {
    return JSON.stringify(data, null, 2);
  }

  convertirCsv(rows: Record<string, unknown>[]): string {
    if (rows.length === 0) {
      return 'sin_datos';
    }

    const headers = Array.from(
      rows.reduce((set, row) => {
        Object.keys(row).forEach(key => set.add(key));
        return set;
      }, new Set<string>())
    );

    const escapeValue = (value: unknown): string => {
      if (value === null || value === undefined) {
        return '';
      }

      const text = String(value)
        .replaceAll('"', '""')
        .replaceAll('\n', ' ')
        .replaceAll('\r', ' ');

      return `"${text}"`;
    };

    const lines = [
      headers.join(','),
      ...rows.map(row => headers.map(header => escapeValue(row[header])).join(','))
    ];

    return lines.join('\n');
  }

  descargarArchivo(fileName: string, content: string, mimeType: string) {
    if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') {
      return;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = fileName;
    anchor.click();

    URL.revokeObjectURL(url);
  }
}
