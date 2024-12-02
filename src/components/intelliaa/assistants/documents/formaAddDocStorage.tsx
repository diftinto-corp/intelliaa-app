"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { createDocumentStorage } from "@/lib/actions/intelliaa/documents";
import { usePathname } from "next/navigation";
import { getAccountBySlug } from "@/lib/actions/accounts";
import { Loader2 } from "lucide-react";

// Definimos la interfaz para los datos del formulario
interface FormInputs {
  name: string;
  description: string;
  pdfFile: FileList;
}

export default function FormaAddDocStorage({
  setOpenModal,
}: {
  setOpenModal: any;
}) {
  const pathname = usePathname();
  const accountSlug = pathname.split("/")[1];
  console.log(accountSlug);
  // Agregamos validación al useForm
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInputs>();
  const [account_id, setAccount_id] = useState<string>("" as string);
  const [loading, setLoading] = useState(false);
  console.log(account_id);

  useEffect(() => {
    const getaccountId = async () => {
      const team_account = await getAccountBySlug(null, accountSlug);
      setAccount_id(team_account?.account_id as string);
    };
    getaccountId();
  }, [accountSlug]);

  const createDocumentStorageForm = async (data: FormInputs) => {
    try {
      setLoading(true);
      // Aquí deberías manejar el archivo PDF antes de enviarlo
      const formData = {
        name: data.name,
        description: data.description,
        file: data.pdfFile[0], // Primer archivo seleccionado
      };
      // Crear un objeto FormData para enviar el archivo
      const formDataToSend = new FormData();
      formDataToSend.append("name", formData.name);
      formDataToSend.append("description", formData.description);
      formDataToSend.append("file", formData.file);

      await createDocumentStorage(account_id, formDataToSend);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setOpenModal(false);
    }
  };

  return (
    <form
      className='animate-in flex-1 flex flex-col w-full justify-center gap-y-6 text-muted-foreground'
      onSubmit={handleSubmit(createDocumentStorageForm)}>
      <div className='flex flex-col gap-y-2'>
        <Label htmlFor='name'>Nombre del Document Storage</Label>
        <Input
          type='text'
          id='name'
          {...register("name", {
            required: "El nombre es requerido",
            minLength: {
              value: 3,
              message: "El nombre debe tener al menos 3 caracteres",
            },
          })}
        />
        {errors.name && (
          <span className='text-sm text-red-500'>{errors.name.message}</span>
        )}
      </div>
      <div className='flex flex-col gap-y-2'>
        <Label htmlFor='description'>Descripción del DocumentStorage</Label>
        <Input
          type='text'
          id='description'
          {...register("description", {
            required: "La descripción es requerida",
            minLength: {
              value: 10,
              message: "La descripción debe tener al menos 10 caracteres",
            },
          })}
        />
        {errors.description && (
          <span className='text-sm text-red-500'>
            {errors.description.message}
          </span>
        )}
      </div>

      <div className='flex flex-col gap-y-2'>
        <Label htmlFor='pdfFile'>Archivo PDF</Label>
        <Input
          type='file'
          id='pdfFile'
          accept='.pdf'
          {...register("pdfFile", {
            required: "El archivo PDF es requerido",
          })}
        />
        {errors.pdfFile && (
          <span className='text-sm text-red-500'>{errors.pdfFile.message}</span>
        )}
      </div>

      <Button type='submit' disabled={loading}>
        {loading ? (
          <>
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            Creando...
          </>
        ) : (
          "Crear Document Storage"
        )}
      </Button>
    </form>
  );
}
