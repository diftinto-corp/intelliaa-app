import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import ModalAddQa from "./ModalAddQa";
import ModalEditQa from "./ModalEditQa";
import { Loader2, Trash2 } from "lucide-react";
import { Assistant } from "@/interfaces/intelliaa";
import { TabsContent } from "@/components/ui/tabs";

interface QAItem {
  id: string;
  question: string;
  answer: string;
  id_document: string;
  namespace: string;
}

interface QuestionsAndAnswersProps {
  qaList: QAItem[];
  handleDeleteQa: (
    id: string,
    document_id: string,
    namespace: string
  ) => Promise<void>;
  assistant: Assistant;
  setOpen: (open: boolean) => void;
  loading: boolean;
}

export default function AdvancedComponent() {
  return <TabsContent value='advanced'></TabsContent>;
}
