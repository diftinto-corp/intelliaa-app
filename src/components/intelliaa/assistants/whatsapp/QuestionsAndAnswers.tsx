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

export default function QuestionsAndAnswers({
  qaList,
  handleDeleteQa,
  assistant,
  setOpen,
  loading,
}: QuestionsAndAnswersProps) {
  return (
    <TabsContent value='questions_&_answares'>
      {qaList.length === 0 ? (
        <div className='flex flex-col justify-center w-full gap-2 min-h-[68vh] max-h-[68vh] 2xl:min-h-[73vh] 2xl:max-h-[73vh]'>
          <div className='flex w-[40%] flex-col self-center justify-center items-center text-muted-foreground'>
            <p>Todavía no has creado una Pregunta y Respuesta.</p>
            <p>Haz clic en el botón de abajo para agregar un nuevo QA.</p>
            <ModalAddQa assistant={assistant} />
          </div>
        </div>
      ) : (
        <div className='flex flex-col justify-start w-full gap-2 min-h-[68vh] max-h-[68vh] 2xl:min-h-[73vh] 2xl-max-h-[73vh]'>
          <div className='flex w-full justify-end gap-2'>
            <ModalAddQa assistant={assistant} />
          </div>
          <div className='flex flex-wrap w-full justify-start gap-4 overflow-y-auto max-h-[60vh] mt-2 ml-4'>
            {qaList.map((qa) => (
              <Card key={qa.id} className='w-[48%]'>
                <CardHeader>
                  <CardTitle>{qa.question}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{qa.answer}</CardDescription>
                </CardContent>
                <CardFooter className=' flex justify-between w-full '>
                  <Button
                    variant='outline'
                    size='icon'
                    type='submit'
                    onClick={() =>
                      handleDeleteQa(qa.id, qa.id_document, qa.namespace)
                    }>
                    {loading ? (
                      <Loader2 className=' animate-spin h-4 w-4 text-red-500' />
                    ) : (
                      <Trash2 className='h-4 w-4 text-red-500' />
                    )}
                  </Button>
                  <ModalEditQa
                    qa={qa}
                    setOpenModal={setOpen}
                    assistant={assistant}
                  />
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}
    </TabsContent>
  );
}
