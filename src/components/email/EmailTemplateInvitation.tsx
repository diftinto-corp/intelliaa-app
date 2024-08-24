import {
  Body,
  Button,
  Container,
  Column,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
  Tailwind,
} from "@react-email/components";
import * as React from "react";

interface VercelInviteUserEmailProps {
  invitedByEmail: string;
  organitationName: string;
  urlInvitation: string;
}

export const EmailTemplateInvitation = ({
  invitedByEmail,
  organitationName,
  urlInvitation,
}: VercelInviteUserEmailProps) => {
  const previewText = `Únete ${organitationName} en Intelliaa`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className='bg-white my-auto mx-auto font-sans px-2'>
          <Container className=' bg-[#1C1917] border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]'>
            <Section className='mt-[32px]'>
              <Img
                src={`https://intelliaa.s3.amazonaws.com/img/Logo-Intelliaa-Dark.png`}
                width='150'
                height='50'
                alt='Intelliaa'
                className='my-0 mx-auto'
              />
            </Section>
            <Heading className='text-[#D6D6D7] text-[24px] font-normal text-center p-0 my-[30px] mx-0'>
              Únete <strong className='text-[#D6D6D7]'>{organitationName}</strong>{" "}
              en <strong className='text-[#D6D6D7]'>Intelliaa</strong>
            </Heading>
            <Text className='text-[#D6D6D7] text-[14px] leading-[24px]'>
              Hola {invitedByEmail},
            </Text>
            <Text className='text-[#D6D6D7] text-[14px] leading-[24px]'>
              Te han invitado a la organización{" "}
              <strong>{organitationName}</strong> de <strong>Intelliaa</strong>.
            </Text>

            <Section className='text-center mt-[32px] mb-[32px]'>
              <Button
                className='bg-[#14B8A6] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3'
                href={urlInvitation}>
                Únete a la organización
              </Button>
            </Section>
            <Text className='text-[#D6D6D7] text-[14px] leading-[24px]'>
              o copie y pegue esta URL en su navegador:{" "}
              <Link
                href={urlInvitation}
                className='text-[#14B8A6] no-underline'>
                {urlInvitation}
              </Link>
            </Text>
            <Hr className='border border-solid border-[#eaeaea] my-[26px] mx-0 w-full' />
            <Text className='text-[#D6D6D7] text-[12px] leading-[24px]'>
              Esta invitación fue destinada para{" "}
              <span className='text-[#14B8A6]'>{invitedByEmail}</span>. Si no
              esperabas esta invitación, puedes ignorar este correo electrónico.
              Si estás preocupado por la seguridad de tu cuenta, por favor
              responde a este correo electrónico para ponerte en contacto con
              nosotros.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default EmailTemplateInvitation;
