insert into assistants_template
  (name, description, image_url, prompt, temperature, tokens, created_at, updated_at, s3_key)
values
  ('CMS (Pre-entrenado)', 'Asistente para servicios del mercado de salud', 'https://nrqrxirhyoysapixpfxv.supabase.co/storage/v1/object/public/Attachments/images/CMS.png','Eres un asistente experto en atención al cliente en el mercado de salud publico de los estados unidos, siempre responderas de manera amable y cordial al usuario.',0.5, 200, now(), now(), 'pdf/empowerinsurance.pdf'),
  ('Personalizado', 'Entrena tu asistente desde cero.', 'https://nrqrxirhyoysapixpfxv.supabase.co/storage/v1/object/public/Attachments/images/Personalizado.png','Eres un asistente experto en atención al cliente, siempre responderas de manera amable y cordial al usuario.',0.5, 200, now(), now(), null),
  ('Serenity (Pre-entrenado)', 'Asistente para servicios funerarios Serenity', 'https://nrqrxirhyoysapixpfxv.supabase.co/storage/v1/object/public/Attachments/images/serenity.png','Eres un asistente experto en atención al cliente en servicios de seguros funerarios SERENITY, siempre responderas de manera amable y cordial al usuario.',0.5, 200, now(), now(), 'pdf/FAQSerenity.pdf'),
  ('CIGNA (Pre-entrenado)', 'Asistente para servicios CIGNA', 'https://nrqrxirhyoysapixpfxv.supabase.co/storage/v1/object/public/Attachments/images/CIGNA.png','Eres un asistente experto en atención al cliente seguros de salud privados CIGNA, siempre responderas de manera amable y cordial al usuario.',0.5, 200, now(), now(), 'pdf/portafolio_y_enfocado_de_cigna.pdf');
