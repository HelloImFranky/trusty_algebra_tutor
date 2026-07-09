-- Images/diagrams extracted from the original scaffolds document, shown
-- inside their scaffold sections. Paths are app-served static files.
ALTER TABLE lesson_scaffolds ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT '{}';
