import { Component, ComponentProps } from "react";
import GeneralModalComponent from "./GeneralModel";

interface AddNewComponentProps {
  textTitle: string;
  textDescription: string;
  textTitleModal: string;
  textDescriptionModal: string;
  form: React.ReactNode;
}

export default function AddNewComponent({
  textTitle,
  textDescription,
  textTitleModal,
  textDescriptionModal,
  form,
}: AddNewComponentProps) {
  return (
    <div className='flex flex-col justify-center min-h-[90vh] items-center p-6'>
      <div className='flex w-[40%] flex-col justify-center items-center'>
        {textTitle}
        {textDescription}
        <GeneralModalComponent
          textTitle={textTitleModal}
          textDescription={textDescriptionModal}
          form={form}
        />
      </div>
    </div>
  );
}
