insert into assistants_template
  (name, description, image_url, prompt, temperature, tokens, created_at, updated_at, s3_key)
values
  ('CMS (Pre-entrenado)', 'Asistente para servicios del mercado de salud', 'https://nrqrxirhyoysapixpfxv.supabase.co/storage/v1/object/public/Attachments/images/CMS.png','Eres un asistente experto en atención al cliente en el mercado de salud publico de los estados unidos, siempre responderas de manera amable y cordial al usuario.',0.5, 200, now(), now(), 'pdf/empowerinsurance.pdf'),
  ('Personalizado', 'Entrena tu asistente desde cero.', 'https://nrqrxirhyoysapixpfxv.supabase.co/storage/v1/object/public/Attachments/images/Personalizado.png','Eres un asistente experto en atención al cliente, siempre responderas de manera amable y cordial al usuario.',0.5, 200, now(), now(), null),
  ('Serenity (Pre-entrenado)', 'Asistente para servicios funerarios Serenity', 'https://nrqrxirhyoysapixpfxv.supabase.co/storage/v1/object/public/Attachments/images/serenity.png','Eres un asistente experto en atención al cliente en servicios de seguros funerarios SERENITY, siempre responderas de manera amable y cordial al usuario.',0.5, 200, now(), now(), 'pdf/FAQSerenity.pdf'),
  ('CIGNA (Pre-entrenado)', 'Asistente para servicios CIGNA', 'https://nrqrxirhyoysapixpfxv.supabase.co/storage/v1/object/public/Attachments/images/CIGNA.png','Eres un asistente experto en atención al cliente seguros de salud privados CIGNA, siempre responderas de manera amable y cordial al usuario.',0.5, 200, now(), now(), 'pdf/portafolio_y_enfocado_de_cigna.pdf');

  insert into voice_assistant
  (name,created_at, id_elevenlab)
values
  ('Dey', now(), 'StgW6mMosfwXGzfaJ130'),
  ('Omar', now(), '1IVWxPHWEi1qouA3cAop');
  ('Sofi', now(), 'vqoh9orw2tmOS3mY7D2p'),
  ('Lucho', now(), 'YX5i6O5LlgNrFlUpGn1d'),
  ('Andrea', now(), 'qHkrJuifPpn95wK3rm2A'),
  ('Ruben', now(), '9rPXcCBrQoFQhLPQ4aqV'),
  ('Valeria', now(), '9oPKasc15pfAbMr7N6Gs'),
  ('Firusho', now(), 'wL6Hwp3E71wGlj2GZKGK'),
  ('Jhenny', now(), 'FXGrCtY3PEyfqczBAlqm'),
  ('Jorge', now(), 'HAsl3FenyWHYwECSP6Hl'),
  ('Samanta', now(), 'qBvury71WUJfVeT1STkG'),
  ('Carmelo', now(), 'IoWn77TsmQnza94sYlfg'),
  ('Maria', now(), '3Fx71T889APcHRu4VtQf'),








