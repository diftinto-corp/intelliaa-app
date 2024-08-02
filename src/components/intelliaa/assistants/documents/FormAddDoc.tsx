"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  uploadPdf,
  newPdf_Doc,
  resumenPdf,
} from "@/lib/actions/intelliaa/documents";
import { useState } from "react";
import { CloudHail, FileText, Loader2 } from "lucide-react";
import { useAccounts } from "@usebasejump/next";
import Loadable from "next/dist/shared/lib/loadable.shared-runtime";

const initialState = { message: null };

export default function FormAddDocComponent({
  setOpenModal,
}: {
  setOpenModal: any;
}) {
  const [file, setFile] = useState<File | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const { data } = useAccounts();
  const account_id = data?.[1]?.account_id ?? "";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.target as HTMLFormElement);
    const dataUploadFile = await uploadPdf(initialState, formData);
    const { data } = dataUploadFile;

    const description = await resumenPdf(data?.s3?.key || "");
    await newPdf_Doc({
      account_id,
      filename: data?.s3?.filename,
      description,
      key: data?.s3?.key,
      urlFile: data?.s3?.urlFile,
      id_vapi_doc: data?.vapi?.id,
    });
    setLoading(false);
    setOpenModal(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0]);
  };

  return (
    <form
      className='animate-in flex-1 flex flex-col w-full justify-center gap-y-6 text-foreground'
      onSubmit={handleSubmit}>
      <div className='flex flex-col gap-y-2'>
        <Label htmlFor='question' className='text-muted-foreground'>
          Subir un documento
        </Label>
        <Input
          className='cursor-pointer text-muted-foreground'
          type='file'
          id='file'
          name='file'
          placeholder='Subir un documento'
          accept='application/pdf'
          onChange={handleChange}
        />
      </div>

      <Button
        className='cursor-pointer'
        type='submit'
        disabled={!file || loading}>
        {loading ? (
          <Loader2 className='animate-spin mr-2' />
        ) : (
          <FileText className='mr-2' />
        )}
        Subir
      </Button>
    </form>
  );
}
