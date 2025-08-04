import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export function exportToExcel(data, fileName = 'assets.xlsx') {
  const sheet = XLSX.utils.json_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'All Assets');
  const buffer = XLSX.write(book, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buffer]), fileName);
}

export function exportToExcelByGroup(data, fileName = 'grouped_assets.xlsx') {
  const book = XLSX.utils.book_new();
  const groups = [...new Set(data.map(a => a.group).filter(Boolean))];

  // Add grouped sheets
  groups.forEach((group) => {
    const filtered = data.filter(a => a.group === group);
    const sheet = XLSX.utils.json_to_sheet(filtered);
    XLSX.utils.book_append_sheet(book, sheet, group.slice(0, 31)); // Excel sheet name limit
  });

  // Add ungrouped sheet if any
  const ungrouped = data.filter(a => !a.group);
  if (ungrouped.length > 0) {
    const sheet = XLSX.utils.json_to_sheet(ungrouped);
    XLSX.utils.book_append_sheet(book, sheet, "Ungrouped");
  }

  const buffer = XLSX.write(book, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buffer]), fileName);
}


export function exportGroupOnly(data, group, fileName = 'group_assets.xlsx') {
  const filtered = data.filter(a => a.group === group);
  exportToExcel(filtered, fileName);
}
