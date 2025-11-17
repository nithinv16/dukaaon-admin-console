// Export utility functions for CSV and PDF generation

export function exportToCSV(data: any[], filename: string, headers?: string[]) {
  // Convert data to CSV format
  const csvHeaders = headers || Object.keys(data[0] || {});
  const csvRows = [
    csvHeaders.join(','),
    ...data.map((row) =>
      csvHeaders
        .map((header) => {
          const value = row[header];
          // Handle nested objects and arrays
          if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value).replace(/"/g, '""');
          }
          // Escape quotes and wrap in quotes if contains comma
          const stringValue = String(value || '');
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(',')
    ),
  ];

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToJSON(data: any[], filename: string) {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.json`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportToPDF(
  title: string,
  data: any[],
  columns: Array<{ field: string; headerName: string; width?: number }>,
  filename: string
) {
  // For PDF export, we'll use a server-side API route
  // This is a placeholder - actual implementation would call an API
  try {
    const response = await fetch('/api/admin/export/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        data,
        columns,
        filename,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate PDF');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.pdf`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    throw error;
  }
}

export function prepareDataForExport(
  data: any[],
  columns: Array<{ field: string; headerName: string }>
): any[] {
  return data.map((row) => {
    const exportRow: any = {};
    columns.forEach((col) => {
      const value = row[col.field];
      // Format the value for export
      if (value === null || value === undefined) {
        exportRow[col.headerName] = '';
      } else if (typeof value === 'object') {
        exportRow[col.headerName] = JSON.stringify(value);
      } else {
        exportRow[col.headerName] = value;
      }
    });
    return exportRow;
  });
}

