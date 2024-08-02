"use client";

import { Button } from "@/components/ui/button";
import { deletePdfS3, deletePdf_Doc } from "@/lib/actions/intelliaa/documents";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

export default function FormDeleteDocComponent({
  account_id,
  id,
  key,
  setOpenModal,
  id_vapi_doc,
}: {
  account_id: string;
  id: string;
  key: string;
  setOpenModal: any;
  id_vapi_doc: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    await deletePdfS3(key);
    await deletePdf_Doc(account_id, id, id_vapi_doc);
    setLoading(false);
    setOpenModal(false);
  };

  return (
    <div className='flex justify-between'>
      <Button className='cursor-pointer'>Cancelar</Button>
      <Button
        className='cursor-pointer mr-5 bg-red-600 hover:bg-red-500 '
        onClick={handleDelete}>
        {loading ? <Loader2 className='mr-2' /> : <Trash2 className='mr-2' />}
        Delete
      </Button>
    </div>
  );
}
