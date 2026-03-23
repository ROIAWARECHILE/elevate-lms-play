
-- Seed demo IA course
-- This uses a function so it inserts into the first company found
DO $$
DECLARE
  v_company_id uuid;
  v_course_id uuid := gen_random_uuid();
  v_mod1_id uuid := gen_random_uuid();
  v_mod2_id uuid := gen_random_uuid();
  v_mod3_id uuid := gen_random_uuid();
  v_quiz1_id uuid := gen_random_uuid();
  v_quiz2_id uuid := gen_random_uuid();
  v_quiz3_id uuid := gen_random_uuid();
BEGIN
  -- Get first company
  SELECT id INTO v_company_id FROM public.companies LIMIT 1;
  IF v_company_id IS NULL THEN
    RAISE NOTICE 'No company found, skipping seed';
    RETURN;
  END IF;

  -- Course
  INSERT INTO public.courses (id, company_id, title, description, level, status, estimated_duration_minutes, xp_reward, is_mandatory)
  VALUES (v_course_id, v_company_id, 'Introducción a la Inteligencia Artificial', 'Aprende los fundamentos de la IA, cómo se usa en empresas y cómo empezar a aplicarla en tu trabajo diario.', 'beginner', 'published', 45, 150, false);

  -- Module 1
  INSERT INTO public.modules (id, course_id, title, description, sort_order, xp_reward)
  VALUES (v_mod1_id, v_course_id, '¿Qué es la Inteligencia Artificial?', 'Conceptos fundamentales y tipos de IA', 0, 25);

  INSERT INTO public.lessons (module_id, title, content_type, content, sort_order, xp_reward) VALUES
  (v_mod1_id, 'Definición y tipos de IA', 'text', '{"text": "La Inteligencia Artificial (IA) es la simulación de procesos de inteligencia humana por parte de sistemas informáticos.\n\nExisten tres tipos principales:\n\n1. **IA Estrecha (ANI)**: Diseñada para tareas específicas como reconocimiento de voz o recomendaciones. Es la que usamos hoy.\n\n2. **IA General (AGI)**: Tendría capacidades cognitivas humanas completas. Aún no existe.\n\n3. **Superinteligencia (ASI)**: Superaría la inteligencia humana en todos los aspectos. Es teórica.\n\nLa IA que usamos día a día es ANI: asistentes virtuales, filtros de spam, navegación GPS, y mucho más."}', 0, 10),
  (v_mod1_id, 'Historia breve de la IA', 'text', '{"text": "La IA tiene una historia fascinante:\n\n• **1950** - Alan Turing propone el Test de Turing\n• **1956** - Se acuña el término \"Inteligencia Artificial\" en Dartmouth\n• **1997** - Deep Blue de IBM vence al campeón mundial de ajedrez\n• **2011** - IBM Watson gana en Jeopardy!\n• **2016** - AlphaGo derrota al campeón mundial de Go\n• **2022** - ChatGPT revoluciona la IA generativa\n• **2023-2024** - Explosión de herramientas de IA para empresas\n\nLa IA ha pasado de ser ciencia ficción a una herramienta cotidiana en menos de una década."}', 1, 10);

  INSERT INTO public.quizzes (id, module_id, title, passing_score, max_attempts, xp_reward)
  VALUES (v_quiz1_id, v_mod1_id, 'Quiz: Fundamentos de IA', 70, 3, 25);

  INSERT INTO public.questions (quiz_id, question_text, question_type, options, correct_answer, sort_order) VALUES
  (v_quiz1_id, '¿Qué tipo de IA usamos actualmente en la vida cotidiana?', 'multiple_choice', '["IA General (AGI)", "IA Estrecha (ANI)", "Superinteligencia (ASI)", "Ninguna de las anteriores"]', 'IA Estrecha (ANI)', 0),
  (v_quiz1_id, '¿En qué año se acuñó el término Inteligencia Artificial?', 'multiple_choice', '["1943", "1950", "1956", "1997"]', '1956', 1),
  (v_quiz1_id, 'Deep Blue venció al campeón mundial de ajedrez en 1997.', 'true_false', '["Verdadero", "Falso"]', 'Verdadero', 2),
  (v_quiz1_id, 'La IA General (AGI) ya existe y se usa en empresas.', 'true_false', '["Verdadero", "Falso"]', 'Falso', 3);

  -- Module 2
  INSERT INTO public.modules (id, course_id, title, description, sort_order, xp_reward)
  VALUES (v_mod2_id, v_course_id, 'IA en el mundo real', 'Aplicaciones prácticas de IA en empresas', 1, 25);

  INSERT INTO public.lessons (module_id, title, content_type, content, sort_order, xp_reward) VALUES
  (v_mod2_id, 'IA en empresas', 'text', '{"text": "Las empresas están usando IA para:\n\n🔹 **Atención al cliente**: Chatbots que resuelven consultas 24/7\n🔹 **Marketing**: Personalización de contenido y segmentación\n🔹 **Ventas**: Predicción de leads y scoring automático\n🔹 **RRHH**: Filtrado de CVs y análisis de clima laboral\n🔹 **Operaciones**: Optimización de cadena de suministro\n🔹 **Finanzas**: Detección de fraude y análisis predictivo\n\nSegún McKinsey, la IA generativa podría agregar hasta $4.4 trillones anuales a la economía global.\n\nLa clave no es reemplazar personas, sino potenciar su trabajo."}', 0, 10),
  (v_mod2_id, 'ChatGPT y modelos de lenguaje', 'text', '{"text": "Los Modelos de Lenguaje Grande (LLMs) son el corazón de herramientas como ChatGPT.\n\n**¿Cómo funcionan?**\nSon redes neuronales entrenadas con billones de textos que aprenden patrones del lenguaje para generar respuestas coherentes.\n\n**Principales LLMs:**\n• GPT-4 (OpenAI) - El más conocido\n• Claude (Anthropic) - Enfocado en seguridad\n• Gemini (Google) - Integrado con Google\n• Llama (Meta) - Open source\n\n**Casos de uso empresarial:**\n✅ Redacción de documentos\n✅ Análisis de datos\n✅ Generación de código\n✅ Resumen de reuniones\n✅ Traducción\n✅ Brainstorming\n\n⚠️ Importante: Siempre verificar la información generada por IA."}', 1, 10);

  INSERT INTO public.quizzes (id, module_id, title, passing_score, max_attempts, xp_reward)
  VALUES (v_quiz2_id, v_mod2_id, 'Quiz: IA en empresas', 70, 3, 25);

  INSERT INTO public.questions (quiz_id, question_text, question_type, options, correct_answer, sort_order) VALUES
  (v_quiz2_id, '¿Cuál de estos NO es un uso común de IA en empresas?', 'multiple_choice', '["Chatbots de atención", "Detección de fraude", "Teletransportación", "Personalización de marketing"]', 'Teletransportación', 0),
  (v_quiz2_id, '¿Qué significa LLM?', 'multiple_choice', '["Large Language Model", "Low Level Machine", "Logical Learning Method", "Linear Language Module"]', 'Large Language Model', 1),
  (v_quiz2_id, 'ChatGPT es un modelo de lenguaje desarrollado por OpenAI.', 'true_false', '["Verdadero", "Falso"]', 'Verdadero', 2),
  (v_quiz2_id, 'La información generada por IA siempre es 100% precisa.', 'true_false', '["Verdadero", "Falso"]', 'Falso', 3);

  -- Module 3
  INSERT INTO public.modules (id, course_id, title, description, sort_order, xp_reward)
  VALUES (v_mod3_id, v_course_id, 'Primeros pasos con IA', 'Aprende a usar IA en tu trabajo diario', 2, 25);

  INSERT INTO public.lessons (module_id, title, content_type, content, sort_order, xp_reward) VALUES
  (v_mod3_id, 'Cómo escribir buenos prompts', 'text', '{"text": "Un prompt es la instrucción que le das a la IA. La calidad de tu prompt determina la calidad de la respuesta.\n\n**Estructura de un buen prompt:**\n\n1. **Rol**: Define quién es la IA → \"Actúa como un experto en marketing digital\"\n2. **Contexto**: Da información relevante → \"Trabajo en una empresa de SaaS B2B\"\n3. **Tarea**: Sé específico → \"Escribe 5 ideas de contenido para LinkedIn\"\n4. **Formato**: Define el output → \"En formato de lista con emojis\"\n5. **Restricciones**: Limita → \"Máximo 100 palabras cada idea\"\n\n**Ejemplo completo:**\n\"Actúa como un experto en marketing B2B. Mi empresa vende software de RRHH. Necesito 5 ideas de posts para LinkedIn que generen engagement. Formato: título + descripción de 2 líneas. Tono profesional pero cercano.\"\n\n🎯 Tip: Itera. Si la primera respuesta no es perfecta, refina tu prompt."}', 0, 10),
  (v_mod3_id, 'Herramientas de IA para el trabajo', 'text', '{"text": "Herramientas de IA que puedes empezar a usar hoy:\n\n📝 **Escritura y contenido:**\n• ChatGPT / Claude - Redacción, análisis, brainstorming\n• Grammarly - Corrección de textos\n• Jasper - Marketing content\n\n🎨 **Diseño:**\n• Midjourney - Generación de imágenes\n• Canva AI - Diseño con IA\n• Remove.bg - Eliminar fondos\n\n📊 **Productividad:**\n• Notion AI - Notas y documentación\n• Otter.ai - Transcripción de reuniones\n• Gamma - Presentaciones con IA\n\n💻 **Desarrollo:**\n• GitHub Copilot - Asistente de código\n• Cursor - Editor con IA integrada\n• Lovable - Desarrollo de apps con IA\n\n🔑 **Consejo**: Empieza con una herramienta, domínala, y luego expande tu toolkit."}', 1, 10);

  INSERT INTO public.quizzes (id, module_id, title, passing_score, max_attempts, xp_reward)
  VALUES (v_quiz3_id, v_mod3_id, 'Quiz: Usando IA', 70, 3, 25);

  INSERT INTO public.questions (quiz_id, question_text, question_type, options, correct_answer, sort_order) VALUES
  (v_quiz3_id, '¿Cuál es el primer paso para escribir un buen prompt?', 'multiple_choice', '["Escribir mucho texto", "Definir el rol de la IA", "Usar emojis", "Copiar de internet"]', 'Definir el rol de la IA', 0),
  (v_quiz3_id, '¿Qué herramienta se usa para transcribir reuniones?', 'multiple_choice', '["Midjourney", "Otter.ai", "Remove.bg", "Jasper"]', 'Otter.ai', 1),
  (v_quiz3_id, 'Es recomendable iterar y refinar los prompts para obtener mejores resultados.', 'true_false', '["Verdadero", "Falso"]', 'Verdadero', 2),
  (v_quiz3_id, 'GitHub Copilot es una herramienta de diseño gráfico.', 'true_false', '["Verdadero", "Falso"]', 'Falso', 3);

END $$;
