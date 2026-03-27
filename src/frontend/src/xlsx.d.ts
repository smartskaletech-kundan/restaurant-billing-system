declare module "xlsx" {
  export const utils: {
    book_new(): any;
    aoa_to_sheet(data: any[][]): any;
    sheet_add_aoa(sheet: any, data: any[][], opts?: any): void;
    book_append_sheet(wb: any, ws: any, name: string): void;
    sheet_to_json<T = any>(sheet: any, opts?: any): T[];
  };
  export function writeFile(wb: any, filename: string): void;
  export function read(data: any, opts?: any): any;
  const XLSX: typeof import("xlsx");
  export default XLSX;
}
