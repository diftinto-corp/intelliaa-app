"use client";

import { useEffect, SetStateAction, useState, Dispatch } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDocumentssByDocumentStorageId } from "@/lib/actions/intelliaa/documents";
import { getAccountBySlug } from "@/lib/actions/accounts";
import { usePathname } from "next/navigation";

type DocumentStorage = {
  document_storage_id: string;
  document_storage_name: string;
  document_ids: string[]; // IDs combinados de documentos (PDF y TXT)
};

export default function SelectorDsVoice({
  setSelectedDocuments,
  setIsChangeOptions,
  documentStorageId,
  setDocumentStorageId,
}: {
  setSelectedDocuments: (documents: any) => void;
  setIsChangeOptions: (isChangeOptions: boolean) => void;
  documentStorageId: string;
  setDocumentStorageId: Dispatch<SetStateAction<string>>;
}) {
  const pathname = usePathname();
  const accountSlug = pathname.split("/")[1];

  const [storages, setStorages] = useState<DocumentStorage[]>([]);

  useEffect(() => {
    const fetchStorages = async () => {
      try {
        const teamAccount = await getAccountBySlug(null, accountSlug);
        const accountId = teamAccount.account_id;
        const fetchedStorages = await getDocumentssByDocumentStorageId(
          accountId
        );
        if (fetchedStorages) {
          setStorages(fetchedStorages);
          // Set the initial selected document storage based on documentStorageId
          const initialStorage = fetchedStorages.find(
            (s) => s.document_storage_id === documentStorageId
          );
          if (initialStorage) {
            setSelectedDocuments(initialStorage.document_ids);
          }
        }
      } catch (error) {
        console.error("Error fetching storages:", error);
      }
    };
    fetchStorages();
  }, [accountSlug, documentStorageId]);

  const handleChange = (value: string) => {
    setDocumentStorageId(value);
    const storage = storages.find((s) => s.document_storage_id === value);
    setSelectedDocuments(storage?.document_ids || []);
    setIsChangeOptions(true);
  };

  return (
    <Select onValueChange={handleChange} value={documentStorageId}>
      <SelectTrigger className='w-[180px]'>
        <SelectValue placeholder='Select a document storage' />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Document storage</SelectLabel>
          {storages.map((storage) => (
            <SelectItem
              key={storage.document_storage_id}
              value={storage.document_storage_id}>
              {storage.document_storage_name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
