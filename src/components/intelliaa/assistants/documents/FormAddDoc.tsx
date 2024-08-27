"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  uploadPdf,
  newPdf_Doc,
  resumenPdf,
} from "@/lib/actions/intelliaa/documents";
import { useEffect, useState } from "react";
import { CloudHail, FileText, Loader2 } from "lucide-react";
import { useAccounts } from "@usebasejump/next";
import Loadable from "next/dist/shared/lib/loadable.shared-runtime";
import { usePathname } from "next/navigation";
import { getAccountBySlug } from "@/lib/actions/accounts";

const initialState = { message: null };

export default function FormAddDocComponent({
  setOpenModal,
}: {
  setOpenModal: any;
}) {
  const pathname = usePathname();
  const accountSlug = pathname.split("/")[1];
  const [file, setFile] = useState<File | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [account_id, setAccount_id] = useState<string>("" as string);

  useEffect(() => {
    const getaccountId = async () => {
      const team_account = await getAccountBySlug(null, accountSlug);
      setAccount_id(team_account?.account_id as string);
    };
    getaccountId();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    if (file && file.name.length > 25) {
      setErrorMessage(
        "El nombre del archivo no debe superar los 25 caracteres. Por favor, edite el nombre antes de subir."
      );
      setLoading(false);
      return;
    }

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
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.name.length > 25) {
        setErrorMessage(
          "El nombre del archivo no debe superar los 25 caracteres. Por favor, edite el nombre antes de subir."
        );
        setFile(undefined);
      } else {
        setErrorMessage(null);
        setFile(selectedFile);
      }
    }
  };

  return (
    <form
      className='animate-in flex-1 flex flex-col w-full justify-center gap-y-6 text-foreground'
      onSubmit={handleSubmit}>
      <div className='flex flex-col gap-y-2'>
        <Label htmlFor='file' className='text-muted-foreground'>
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
        {errorMessage && (
          <span className='text-red-500 text-sm'>{errorMessage}</span>
        )}
      </div>

      <Button
        className='cursor-pointer'
        type='submit'
        disabled={!file || loading}>
        {loading ? (
          <>
            <Loader2 className='animate-spin mr-2' />
            Subiendo..
          </>
        ) : (
          <>
            <FileText className='mr-2' />
            Subir
          </>
        )}
      </Button>
      {loading && (
        <div className='flex items-center justify-center gap-x-2 text-muted-foreground'>
          <Loader2 className='animate-spin' />
          <span>
            Subiendo archivo... Esto puede tardar unos segundos dependiendo del
            tamaño del archivo.
          </span>
        </div>
      )}
    </form>
  );
}
