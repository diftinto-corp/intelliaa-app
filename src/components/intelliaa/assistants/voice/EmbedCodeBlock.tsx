import { Copy } from "lucide-react";
import React, { useState } from "react";

interface EmbedCodeBlockProps {
  code: string;
}

const EmbedCodeBlock: React.FC<EmbedCodeBlockProps> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className='flex flex-col w-[50%] min-h-[60vh] border rounded-sm p-4 justify-between'>
      <div className='flex flex-col bg-slate-800 p-4 rounded-sm'>
        <div className='flex w-full justify-end'>
          <Copy
            size={17}
            className='cursor-pointer text-primary'
            onClick={handleCopy}
          />
        </div>
        <div className='flex w-full justify-between items-center'>
          <pre className='whitespace-pre-wrap break-words text-primary'>
            <code>{code}</code>
          </pre>
        </div>
      </div>
      <div className='flex w-full justify-between items-center'>
        <pre className='whitespace-pre-wrap break-words text-muted-foreground text-xs'>
          Puedes agregar este código en tu web en cualquier lugar que desees de
          tu código HTML.
          <br />
          Para personalizar el color de fondo del botón, cambia el valor de
          btn-color por cualquier color hexadecimal.
        </pre>
      </div>
    </div>
  );
};

export default EmbedCodeBlock;
