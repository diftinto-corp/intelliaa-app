"use server";

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { createClient } from "@/lib/supabase/server";

const s3Client = new S3Client({
  region: process.env.NEXT_AWS_S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.NEXT_AWS_S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.NEXT_AWS_S3_SECRET_ACCESS_KEY || "",
  },
});

async function uploadPdf(prevState: any, formData: FormData) {
  try {
    const file = formData.get("file") as File;

    if (file.size === 0) {
      return { status: "error", message: "Empty file" };
    }
    const buffer = Buffer.from(await file.arrayBuffer());

    const filename = file.name;
    const filenameLarge = `${Math.random()
      .toString(36)
      .substring(2, 15)}_${filename}`;
    const key = `pdfs-intelliaa/${filenameLarge}`;
    const urlFile = `${process.env.NEXT_AWS_S3_BUCKET_URL_FILE}${key}`;

    const putObjectCommand = new PutObjectCommand({
      Bucket: process.env.NEXT_AWS_S3_BUCKET_NAME || "",
      Key: key,
      Body: buffer,
      ContentType: "application/pdf",
    });

    const data = {
      filename,
      key,
      urlFile,
    };

    await s3Client.send(putObjectCommand);

    return {
      status: "success",
      message: "Document uploaded successfully",
      data,
    };
  } catch (error) {
    console.error(error);
    return { status: "error", message: "Error uploading document" };
  }
}

async function deletePdfS3(key: string) {
  try {
    const deleteObjectCommand = new DeleteObjectCommand({
      Bucket: process.env.NEXT_AWS_S3_BUCKET_NAME || "",
      Key: key,
    });

    await s3Client.send(deleteObjectCommand);
  } catch (error) {
    console.error(error);
    return { status: "error", message: "Error deleting document" };
  }
}

async function resumenPdf(key: string) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_FLOWISE}prediction/${process.env.NEXT_PUBLIC_FLOWISE_CHATID_RESUMEN_PDF}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_FLOWISE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: "resumen en menos de 2 lineas el documento",
          overrideConfig: {
            keyName: key,
          },
        }),
      }
    );
    const result = await response.json();

    if (!response.ok) {
      throw new Error("Error al resumir el archivo");
    }

    return result.text;
  } catch (error) {
    console.error((error as Error).message);
  }
}

async function getAllPdf_Doc(account_id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pdf_docs")
    .select("*")
    .eq("account_id", account_id);

  if (error) {
    return { message: error.message };
  }

  return data;
}

async function getPdf_Doc(account_id: string, id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pdf_docs")
    .select("*")
    .eq("account_id", account_id)
    .eq("id", id);

  if (error) {
    return { message: error.message };
  }

  return data[0];
}

async function newPdf_Doc({
  account_id,
  filename,
  description,
  key,
  urlFile,
}: {
  account_id: string;
  filename?: string;
  description?: string;
  key?: string;
  urlFile?: string;
}) {
  const supabase = createClient();

  const { data, error } = await supabase.from("pdf_docs").insert([
    {
      account_id,
      name: filename,
      description,
      s3_key: key,
      url: urlFile,
    },
  ]);

  if (error) {
    return { message: error.message };
  }

  return data;
}

async function deletePdf_Doc(account_id: string, id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pdf_docs")
    .delete()
    .eq("account_id", account_id)
    .eq("id", id);

  if (error) {
    return { message: error.message };
  }

  return data;
}

const upsertPDF = async (
  s3_key: string,
  id_document: string,
  namespace: string
) => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_FLOWISE}vector/upsert/${process.env.NEXT_PUBLIC_FLOWISE_CHATID_UPSERTPDF}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          overrideConfig: {
            keyName: s3_key,
            metadata: {
              namespace: namespace,
              id_document: id_document,
            },
          },
        }),
      }
    );
    const result = await response.json();

    if (!response.ok) {
      throw new Error("Error al subir el archivo");
    }
    return result;
  } catch (error) {
    console.error((error as Error).message);
  }
};

const deleteDocuments = async (
  id_document: string,
  namespace: string
): Promise<boolean> => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .delete()
    .eq("metadata->>id_document", id_document)
    .eq("metadata->>namespace", namespace);

  if (error) {
    console.error("Error al eliminar el documento:", error);
    return false;
  }

  return true;
};

const newEmbedPDF = async (
  account_id: string,
  assistant_id: string,
  s3_key: string,
  id_document: string
) => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("embedded_pdfs")
    .insert([
      {
        account_id: account_id,
        assistant_id: assistant_id,
        pdf_doc_key: s3_key,
        id_document: id_document,
      },
    ])
    .select();

  if (error) {
    return { message: error.message };
  }
  return data;
};

const deleteEmbedPDF = async (
  account_id: string,
  assistant_id: string,
  id_document: string
) => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("embedded_pdfs")
    .delete()
    .eq("account_id", account_id)
    .eq("assistant_id", assistant_id)
    .eq("id_document", id_document);

  if (error) {
    return { message: error.message };
  }

  return data;
};

export {
  uploadPdf,
  deletePdfS3,
  resumenPdf,
  upsertPDF,
  getAllPdf_Doc,
  getPdf_Doc,
  newPdf_Doc,
  deletePdf_Doc,
  newEmbedPDF,
  deleteEmbedPDF,
  deleteDocuments,
};
