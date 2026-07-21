// pdfmake ships no types for its browser build entrypoints; the report
// renderer types the tiny surface it uses at the call site (reportPdf.ts).
declare module 'pdfmake/build/pdfmake';
declare module 'pdfmake/build/vfs_fonts';
