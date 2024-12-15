export function PDFViewer({ pdfUrl }: { pdfUrl: string }) {
  console.log(pdfUrl);
  return (
    <div className='flex flex-col gap-2 w-[100%] h-[80vh] rounded  overflow-hidden'>
      {/* <span className='text-muted-foreground'>Visor PDF</span> */}
      <iframe
        className='rounded w-full h-full'
        src={pdfUrl}
        allow='fullscreen'
        allowFullScreen></iframe>
    </div>
  );
}
