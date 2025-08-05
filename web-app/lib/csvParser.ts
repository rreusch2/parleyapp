
import Papa from 'papaparse';

export const parseCsv = (csvText: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data);
      },
      error: (error: any) => {
        reject(error);
      },
    });
  });
};
