import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

interface AddNewComponentProps {
  textTitle: string;
  textDescription: string;
  form: React.ReactNode;
}

export default function GeneralModalComponent({
  textTitle,
  textDescription,
  form,
}: AddNewComponentProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size='sm' className='mt-4'>
          <Plus className='h-4 w-4 mr-2' />
          {textTitle}
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>{textDescription}</DialogDescription>
        </DialogHeader>
        {form}
        <DialogFooter>
          <Button type='submit'>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
