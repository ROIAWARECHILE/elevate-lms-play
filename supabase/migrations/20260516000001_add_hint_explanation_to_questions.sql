-- Add hint and explanation columns to questions table
-- hint: a clue that helps without revealing the answer
-- explanation: why the correct answer is correct (shown after answering)
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS hint text,
  ADD COLUMN IF NOT EXISTS explanation text;
