/**
 * Seed the database from the curriculum content package. Content lands as
 * versioned rows (design doc §3: "content must be data, not code").
 * Re-running bumps content_version on changed lessons; generated problems are
 * validated through the math engine before insert.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { pool } from './pool.js';
import { migrate } from './migrate.js';
import { curriculum } from '../content/index.js';
import { classroomScaffolds } from '../content/classroomScaffolds.js';
import { generateProblem, makeRng } from '../math/generators.js';
import type { FixedProblemSeed, StepSeed } from '../content/types.js';

interface ScaffoldImageEntry {
  lesson: string;
  title: string;
  images: string[];
}

/**
 * Images extracted from the original scaffolds document by
 * scripts/ingest_scaffold_images.py. Optional: absent until the document
 * export has been ingested.
 */
function loadScaffoldImages(): ScaffoldImageEntry[] {
  const file = path.join(
    path.dirname(url.fileURLToPath(import.meta.url)),
    '../content/scaffoldImages.json',
  );
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as ScaffoldImageEntry[];
  } catch (err) {
    console.warn('scaffoldImages.json unreadable; skipping images', err);
    return [];
  }
}

/**
 * Sync the original classroom scaffold sections onto their lessons.
 * Idempotent (delete + insert per lesson) so content edits land on reseed
 * without touching the rest of the curriculum. Sections that exist only as
 * images in the source document (no extractable text) are appended from the
 * image manifest with an empty body.
 */
export async function seedScaffolds(): Promise<void> {
  const imageEntries = loadScaffoldImages();
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const imagesFor = (lesson: string, title: string) =>
    imageEntries.find((e) => e.lesson === lesson && norm(e.title) === norm(title))?.images ?? [];

  const lessonCodes = new Set([
    ...Object.keys(classroomScaffolds),
    ...imageEntries.map((e) => e.lesson),
  ]);

  for (const code of lessonCodes) {
    const lesson = await pool.query<{ id: number }>('SELECT id FROM lessons WHERE code=$1', [code]);
    if (!lesson.rowCount) {
      console.warn(`scaffolds: no lesson with code ${code}; skipping`);
      continue;
    }
    const lessonId = lesson.rows[0].id;
    await pool.query('DELETE FROM lesson_scaffolds WHERE lesson_id=$1', [lessonId]);

    const textSections = classroomScaffolds[code] ?? [];
    let position = 0;
    const seen = new Set<string>();
    for (const s of textSections) {
      seen.add(norm(s.title));
      await pool.query(
        'INSERT INTO lesson_scaffolds(lesson_id, position, title, body_md, images) VALUES ($1,$2,$3,$4,$5)',
        [lessonId, ++position, s.title, s.body, imagesFor(code, s.title)],
      );
    }
    // image-only sections from the source document
    for (const e of imageEntries.filter((e) => e.lesson === code && !seen.has(norm(e.title)))) {
      await pool.query(
        'INSERT INTO lesson_scaffolds(lesson_id, position, title, body_md, images) VALUES ($1,$2,$3,$4,$5)',
        [lessonId, ++position, e.title, '', e.images],
      );
    }
  }
  const n = await pool.query(
    `SELECT count(*)::int AS n, count(*) FILTER (WHERE cardinality(images) > 0)::int AS with_images
     FROM lesson_scaffolds`,
  );
  console.log(
    `scaffolds synced: ${n.rows[0].n} sections (${n.rows[0].with_images} with images)`,
  );
}

export async function seed(): Promise<void> {
  await migrate();
  const existing = await pool.query('SELECT count(*)::int AS n FROM units');
  if (existing.rows[0].n > 0) {
    await seedScaffolds(); // scaffolds sync even when the curriculum exists
    console.log('curriculum already seeded; skipping (truncate units to reseed)');
    return;
  }

  for (const unit of curriculum) {
    const unitRow = await pool.query(
      'INSERT INTO units(number, title_en, title_es, position) VALUES ($1,$2,$3,$1) RETURNING id',
      [unit.number, unit.titleEn, unit.titleEs],
    );
    const unitId = unitRow.rows[0].id;

    for (const [li, lesson] of unit.lessons.entries()) {
      const lessonRow = await pool.query(
        `INSERT INTO lessons(unit_id, code, title_en, title_es, position, mnemonic_en, mnemonic_es)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [unitId, lesson.code, lesson.titleEn, lesson.titleEs, li + 1, lesson.mnemonicEn ?? null, lesson.mnemonicEs ?? null],
      );
      const lessonId = lessonRow.rows[0].id;

      for (const [si, step] of lesson.steps.entries()) {
        await pool.query(
          `INSERT INTO lesson_steps(lesson_id, position, body_en, body_es, worked_example_latex, hint_en, hint_es)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [lessonId, si + 1, step.bodyEn, step.bodyEs, step.workedExampleLatex ?? null, step.hintEn ?? null, step.hintEs ?? null],
        );
      }

      const skillRow = await pool.query(
        'INSERT INTO skills(lesson_id, slug, name_en, name_es) VALUES ($1,$2,$3,$4) RETURNING id',
        [lessonId, lesson.skill.slug, lesson.skill.nameEn, lesson.skill.nameEs],
      );
      const skillId = skillRow.rows[0].id;

      const insertProblem = async (
        p: FixedProblemSeed & { paramsJson?: unknown; sprint?: boolean },
      ): Promise<number> => {
        const row = await pool.query(
          `INSERT INTO problems(skill_id, tier, prompt_en, prompt_es, answer_latex, grading_mode, tolerance, params_json, is_sprint)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [
            skillId,
            p.tier,
            p.promptEn,
            p.promptEs,
            p.answerLatex,
            p.gradingMode,
            p.tolerance ?? null,
            p.paramsJson ? JSON.stringify(p.paramsJson) : null,
            p.sprint ?? false,
          ],
        );
        const problemId = row.rows[0].id;
        for (const [pi, s] of (p.steps ?? ([] as StepSeed[])).entries()) {
          await pool.query(
            `INSERT INTO problem_steps(problem_id, position, prompt_en, prompt_es, expected_latex, grading_mode, hint_en, hint_es)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [problemId, pi + 1, s.promptEn, s.promptEs, s.expectedLatex, s.gradingMode, s.hintEn ?? null, s.hintEs ?? null],
          );
        }
        return problemId;
      };

      const standardProblemIds: number[] = [];

      for (const p of lesson.fixedProblems ?? []) {
        const id = await insertProblem(p);
        if (p.tier === 'standard') standardProblemIds.push(id);
      }

      // Deterministic per-lesson seed keeps reseeds reproducible.
      let genSeed = unit.number * 1000 + li * 100;
      for (const spec of lesson.generated ?? []) {
        const rng = makeRng(genSeed++ * 7919 + 17);
        const seen = new Set<string>();
        let made = 0;
        for (let i = 0; made < spec.count && i < spec.count * 6; i++) {
          const gp = generateProblem(spec.template, rng);
          const key = gp.promptEn + gp.answerLatex;
          if (seen.has(key)) continue; // skip duplicate variants
          seen.add(key);
          made++;
          const id = await insertProblem({
            tier: spec.tier,
            promptEn: gp.promptEn,
            promptEs: gp.promptEs,
            answerLatex: gp.answerLatex,
            gradingMode: gp.gradingMode,
            tolerance: gp.tolerance,
            steps: gp.steps?.map((s) => ({
              promptEn: s.promptEn,
              promptEs: s.promptEs,
              expectedLatex: s.expectedLatex,
              gradingMode: s.gradingMode,
              hintEn: s.hintEn,
              hintEs: s.hintEs,
            })),
            paramsJson: gp.params,
            sprint: spec.sprint,
          });
          if (spec.tier === 'standard' && !spec.sprint) standardProblemIds.push(id);
        }
      }

      const etIds = standardProblemIds.slice(0, Math.max(4, Math.min(8, lesson.exitTicketSize)));
      if (etIds.length) {
        await pool.query('INSERT INTO exit_tickets(lesson_id, problem_ids) VALUES ($1,$2)', [
          lessonId,
          etIds,
        ]);
      }
      console.log(`seeded lesson ${lesson.code} (${standardProblemIds.length} standard problems)`);
    }
  }
  await seedScaffolds();
  const totals = await pool.query(
    `SELECT (SELECT count(*) FROM lessons) AS lessons, (SELECT count(*) FROM problems) AS problems`,
  );
  console.log(`done: ${totals.rows[0].lessons} lessons, ${totals.rows[0].problems} problems`);
}

if (process.argv[1] === url.fileURLToPath(import.meta.url)) {
  seed()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
