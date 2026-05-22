-- Blueprints pedagógicos: plantillas de estructura de curso reutilizables
-- company_id = null → blueprint global de Kibbo (disponible para todas las empresas)

CREATE TABLE IF NOT EXISTS public.course_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  category text,
  structure jsonb NOT NULL DEFAULT '{"modules":[],"variables":[],"pedagogy":{}}'::jsonb,
  is_template boolean NOT NULL DEFAULT false,
  version int NOT NULL DEFAULT 1,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (company_id, slug)
);

CREATE TABLE IF NOT EXISTS public.blueprint_uses (
  blueprint_id uuid NOT NULL REFERENCES public.course_blueprints(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  used_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blueprint_id, course_id)
);

ALTER TABLE public.course_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blueprint_uses ENABLE ROW LEVEL SECURITY;

-- Blueprints globales (company_id IS NULL) son visibles para todos los autenticados
CREATE POLICY "Anyone can read global blueprints"
  ON public.course_blueprints
  FOR SELECT
  USING (company_id IS NULL);

-- Admins pueden ver y gestionar blueprints de su empresa
CREATE POLICY "Admins can manage company blueprints"
  ON public.course_blueprints
  FOR ALL
  USING (
    company_id IN (
      SELECT p.company_id FROM public.profiles p
      INNER JOIN public.user_roles ur ON ur.user_id = p.id
      WHERE p.id = auth.uid() AND ur.role = 'admin'
    )
  );

-- blueprint_uses: admins pueden gestionar
CREATE POLICY "Admins can manage blueprint_uses"
  ON public.blueprint_uses
  FOR ALL
  USING (
    course_id IN (
      SELECT c.id FROM public.courses c
      INNER JOIN public.profiles p ON p.company_id = c.company_id
      INNER JOIN public.user_roles ur ON ur.user_id = p.id
      WHERE p.id = auth.uid() AND ur.role = 'admin'
    )
  );

-- ============================================================
-- 5 blueprints semilla globales de Kibbo
-- ============================================================

INSERT INTO public.course_blueprints (slug, name, description, category, is_template, structure) VALUES

('b2b-sales-postsale', 'Ventas y Postventa B2B', 'Metodología completa para equipos de ventas de alto ticket: fundamentos, argumentación, objeciones y postventa.', 'sales', true, '{
  "modules": [
    {
      "title_template": "1 · Fundamentos de {brand}",
      "order_index": 1,
      "lessons": [
        {"lesson_type": "reading", "title_template": "Identidad y propósito de {brand}"},
        {"lesson_type": "concept", "title_template": "Pilares de {brand}"},
        {"lesson_type": "interactive_quiz", "title_template": "Quiz · Fundamentos"}
      ]
    },
    {
      "title_template": "2 · El producto",
      "order_index": 2,
      "lessons": [
        {"lesson_type": "reading", "title_template": "Qué es {product_name} y para quién es"},
        {"lesson_type": "comparison", "title_template": "Comparativa con la competencia"},
        {"lesson_type": "flashcards", "title_template": "Beneficios clave"},
        {"lesson_type": "interactive_quiz", "title_template": "Quiz · Producto"}
      ]
    },
    {
      "title_template": "3 · El proceso de venta",
      "order_index": 3,
      "lessons": [
        {"lesson_type": "steps", "title_template": "Proceso de venta paso a paso"},
        {"lesson_type": "case_study", "title_template": "Caso real: cierre exitoso"},
        {"lesson_type": "concept", "title_template": "Manejo de objeciones frecuentes"},
        {"lesson_type": "interactive_quiz", "title_template": "Quiz · Proceso de venta"}
      ]
    },
    {
      "title_template": "4 · Postventa y fidelización",
      "order_index": 4,
      "lessons": [
        {"lesson_type": "reading", "title_template": "El viaje del cliente después de la compra"},
        {"lesson_type": "steps", "title_template": "Protocolo de seguimiento postventa"},
        {"lesson_type": "case_study", "title_template": "Caso: cliente convertido en embajador"},
        {"lesson_type": "interactive_quiz", "title_template": "Quiz · Postventa"}
      ]
    }
  ],
  "variables": ["brand", "product_name", "audience"],
  "pedagogy": {
    "sequence": "knowledge → application → defense → continuity",
    "min_xp_per_module": 50,
    "include_case_studies": true,
    "include_objections": true,
    "include_postsale": true
  }
}'),

('operational-onboarding', 'Onboarding operativo', 'Incorporación de nuevos colaboradores: cultura, procesos, herramientas y primeros 30 días.', 'onboarding', true, '{
  "modules": [
    {
      "title_template": "1 · Bienvenida a {brand}",
      "order_index": 1,
      "lessons": [
        {"lesson_type": "reading", "title_template": "Nuestra historia, misión y valores"},
        {"lesson_type": "concept", "title_template": "Estructura del equipo"},
        {"lesson_type": "interactive_quiz", "title_template": "Quiz · Cultura"}
      ]
    },
    {
      "title_template": "2 · Procesos y herramientas",
      "order_index": 2,
      "lessons": [
        {"lesson_type": "sop_walkthrough", "title_template": "Herramientas esenciales del día a día"},
        {"lesson_type": "steps", "title_template": "Flujos de trabajo principales"},
        {"lesson_type": "interactive_quiz", "title_template": "Quiz · Procesos"}
      ]
    },
    {
      "title_template": "3 · Tu rol en {department}",
      "order_index": 3,
      "lessons": [
        {"lesson_type": "reading", "title_template": "Responsabilidades y expectativas"},
        {"lesson_type": "case_study", "title_template": "Situación real del primer mes"},
        {"lesson_type": "interactive_quiz", "title_template": "Quiz · Rol"}
      ]
    }
  ],
  "variables": ["brand", "department", "audience"],
  "pedagogy": {
    "sequence": "culture → process → role",
    "min_xp_per_module": 40,
    "include_case_studies": true,
    "include_objections": false,
    "include_postsale": false
  }
}'),

('product-knowledge', 'Conocimiento de producto', 'Dominio profundo del catálogo: características, beneficios, casos de uso y diferenciadores.', 'product', true, '{
  "modules": [
    {
      "title_template": "1 · El producto {product_name}",
      "order_index": 1,
      "lessons": [
        {"lesson_type": "reading", "title_template": "Descripción y propuesta de valor"},
        {"lesson_type": "concept", "title_template": "Especificaciones técnicas clave"},
        {"lesson_type": "flashcards", "title_template": "Características para recordar"}
      ]
    },
    {
      "title_template": "2 · Casos de uso y aplicaciones",
      "order_index": 2,
      "lessons": [
        {"lesson_type": "case_study", "title_template": "¿Quién lo usa y cómo?"},
        {"lesson_type": "comparison", "title_template": "Cuándo elegir {product_name} vs alternativas"},
        {"lesson_type": "interactive_quiz", "title_template": "Quiz · Producto"}
      ]
    }
  ],
  "variables": ["brand", "product_name", "audience"],
  "pedagogy": {
    "sequence": "features → application",
    "min_xp_per_module": 35,
    "include_case_studies": true,
    "include_objections": false,
    "include_postsale": false
  }
}'),

('compliance-safety', 'Cumplimiento y seguridad', 'Normativas, protocolos y procedimientos de seguridad para equipos operativos.', 'compliance', true, '{
  "modules": [
    {
      "title_template": "1 · Marco normativo",
      "order_index": 1,
      "lessons": [
        {"lesson_type": "reading", "title_template": "Regulaciones aplicables a {context}"},
        {"lesson_type": "concept", "title_template": "Obligaciones y responsabilidades"},
        {"lesson_type": "interactive_quiz", "title_template": "Quiz · Normativa"}
      ]
    },
    {
      "title_template": "2 · Protocolos de {context}",
      "order_index": 2,
      "lessons": [
        {"lesson_type": "sop_walkthrough", "title_template": "Procedimiento estándar"},
        {"lesson_type": "steps", "title_template": "Qué hacer ante una incidencia"},
        {"lesson_type": "case_study", "title_template": "Caso real y lecciones aprendidas"},
        {"lesson_type": "interactive_quiz", "title_template": "Quiz · Protocolos"}
      ]
    }
  ],
  "variables": ["brand", "context", "audience"],
  "pedagogy": {
    "sequence": "knowledge → protocol → incident",
    "min_xp_per_module": 45,
    "include_case_studies": true,
    "include_objections": false,
    "include_postsale": false
  }
}'),

('customer-success', 'Customer Success', 'Atención al cliente, retención, NPS y gestión de escalaciones.', 'cx', true, '{
  "modules": [
    {
      "title_template": "1 · Filosofía de {brand} en atención",
      "order_index": 1,
      "lessons": [
        {"lesson_type": "reading", "title_template": "Nuestra promesa al cliente"},
        {"lesson_type": "concept", "title_template": "Métricas que importan: NPS, CSAT, CES"},
        {"lesson_type": "interactive_quiz", "title_template": "Quiz · Filosofía CX"}
      ]
    },
    {
      "title_template": "2 · Gestión de casos",
      "order_index": 2,
      "lessons": [
        {"lesson_type": "steps", "title_template": "Flujo de atención y resolución"},
        {"lesson_type": "case_study", "title_template": "Cliente difícil: escalación y cierre"},
        {"lesson_type": "concept", "title_template": "Técnicas de retención y fidelización"},
        {"lesson_type": "interactive_quiz", "title_template": "Quiz · Gestión de casos"}
      ]
    }
  ],
  "variables": ["brand", "audience"],
  "pedagogy": {
    "sequence": "philosophy → practice → retention",
    "min_xp_per_module": 40,
    "include_case_studies": true,
    "include_objections": true,
    "include_postsale": false
  }
}')

ON CONFLICT DO NOTHING;
