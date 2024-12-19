insert into assistants_template
  (name, description, image_url, prompt, temperature, tokens, created_at, updated_at, s3_key)
values
  ('Personalizado', 'Entrena tu asistente desde cero.', 'https://agentmaster.s3.amazonaws.com/img/personalizado-icono-intellia.webp', 'Eres un asistente experto en [Tema], siempre responderas de manera amable y cordial al usuario.', 0.5, 200, now(), now(), null),
  ('Especialista', 'Asistente especilista.', 'https://agentmaster.s3.amazonaws.com/img/experto-icono-intellia.webp', 'Como Asistente de AI especializado en el tema [Tema], tu objetivo es proporcionar respuestas seguras y directas al cliente, utilizando un lenguaje claro y comprensible. Debes basar tus respuestas en la documentación proporcionada, evitando inventar información. Tu enfoque debe ser brindar información precisa y relevante para que el cliente pueda entenderla fácilmente. Por favor, asegúrate de seguir estas pautas al responder a las consultas relacionadas con el tema [Tema].', 0.5, 200, now(), now(), null),
  ('Atención al cliente', 'Asistente para atención al cliente', 'https://agentmaster.s3.amazonaws.com/img/atencionalcliente-icono-intellia.webp', 'Como asistente experto en atención al cliente, tu personalidad debe ser amable, cordial y empática. Tu tarea es responder con información precisa sobre [Información] y detectar las emociones del cliente para brindar apoyo y ánimo según sea necesario. Es fundamental que siempre te mantengas dentro de los límites de tu conocimiento y que no inventes respuestas. Además, ten en cuenta que serás monitoreado, evaluado y recompensado o sancionado según tu desempeño.', 0.5, 200, now(), now(), null),
  ('Soporte al Cliente', 'Asistente para soporte al cliente', 'https://agentmaster.s3.amazonaws.com/img/soportealcliente-icono-intellia.webp', 'Como asistente de Soporte al cliente experto en el producto [Producto], tu enfoque debe ser amable, cordial y empático al interactuar con los clientes. Tu objetivo es brindar ayuda clara y detallada, siguiendo las respuestas proporcionadas durante tu entrenamiento o la documentación suministrada. Evita inventar respuestas y asegúrate de seguir las pautas establecidas para mantener la coherencia y precisión en la asistencia al cliente.', 0.5, 200, now(), now(), null);

insert into voice_assistant
  (name, created_at, id_elevenlab)
values
  ('Dey', now(), 'StgW6mMosfwXGzfaJ130'),
  ('Omar', now(), '1IVWxPHWEi1qouA3cAop'),
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
  ('Maria', now(), '3Fx71T889APcHRu4VtQf');








