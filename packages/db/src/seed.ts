/**
 * Seed the database from the curriculum content package. Content lands as
 * versioned rows (design doc §3: "content must be data, not code").
 * Idempotent: a seeded database only re-syncs the scaffold sections.
 * Generated problems are validated through the math engine before insert.
 */
import url from 'node:url';
import { prisma } from './client.js';
import { migrate } from './migrate.js';
import { curriculum, classroomScaffolds } from '@tutor/core';
import { generateProblem, makeRng } from '@tutor/core';
import type { FixedProblemSeed, Misconception, StepSeed } from '@tutor/core';
import scaffoldImages from '../content/scaffoldImages.json';

interface ScaffoldImageEntry {
  lesson: string;
  title: string;
  images: string[];
}

const imageEntries = scaffoldImages as ScaffoldImageEntry[];

/**
 * Sync the original classroom scaffold sections onto their lessons.
 * Idempotent (delete + insert per lesson) so content edits land on reseed
 * without touching the rest of the curriculum.
 *
 * The scaffolds document is the source of truth: each lesson gets the
 * sections of the image manifest (the document, section by section, in its
 * teaching order), and the transcribed text rides along as a fallback body
 * where a transcription exists. Lessons the manifest doesn't cover fall back
 * to their transcribed sections so a stale/absent manifest degrades to text
 * rather than to nothing.
 */
export async function seedScaffolds(): Promise<void> {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const bodyFor = (lesson: string, title: string) =>
    (classroomScaffolds[lesson] ?? []).find((s) => norm(s.title) === norm(title))?.body ?? '';

  const lessonCodes = new Set([
    ...Object.keys(classroomScaffolds),
    ...imageEntries.map((e) => e.lesson),
  ]);

  for (const code of lessonCodes) {
    const lesson = await prisma.lesson.findUnique({ where: { code }, select: { id: true } });
    if (!lesson) {
      console.warn(`scaffolds: no lesson with code ${code}; skipping`);
      continue;
    }
    await prisma.lessonScaffold.deleteMany({ where: { lessonId: lesson.id } });

    const entries = imageEntries.filter((e) => e.lesson === code);
    const sections = entries.length
      ? entries.map((e) => ({ title: e.title, body: bodyFor(code, e.title), images: e.images }))
      : (classroomScaffolds[code] ?? []).map((s) => ({ ...s, images: [] as string[] }));
    let position = 0;
    for (const s of sections) {
      await prisma.lessonScaffold.create({
        data: {
          lessonId: lesson.id,
          position: ++position,
          title: s.title,
          bodyMd: s.body,
          images: s.images,
        },
      });
    }
  }
  const n = await prisma.lessonScaffold.count();
  const withImages = await prisma.lessonScaffold.count({ where: { NOT: { images: { isEmpty: true } } } });
  console.log(`scaffolds synced: ${n} sections (${withImages} with images)`);
}

/**
 * Backfill misconception data onto an already-seeded curriculum. Generation
 * is deterministic (same per-lesson seeds), so replaying it reproduces the
 * exact problems that were originally inserted; rows are matched by
 * prompt + answer and updated in place. Content edited since the original
 * seed simply matches nothing — a safe no-op.
 */
export async function syncMisconceptions(): Promise<void> {
  let updated = 0;
  for (const unit of curriculum) {
    for (const [li, lesson] of unit.lessons.entries()) {
      let genSeed = unit.number * 1000 + li * 100;
      for (const spec of lesson.generated ?? []) {
        const rng = makeRng(genSeed++ * 7919 + 17);
        const seen = new Set<string>();
        let made = 0;
        for (let i = 0; made < spec.count && i < spec.count * 6; i++) {
          const gp = generateProblem(spec.template, rng);
          const key = gp.promptEn + gp.answerLatex;
          if (seen.has(key)) continue;
          seen.add(key);
          made++;
          if (!gp.misconceptions?.length) continue;
          const res = await prisma.problem.updateMany({
            where: { promptEn: gp.promptEn, answerLatex: gp.answerLatex },
            data: { misconceptionsJson: JSON.parse(JSON.stringify(gp.misconceptions)) },
          });
          updated += res.count;
        }
      }
    }
  }
  console.log(`misconceptions synced onto ${updated} problems`);
}

export async function seed(): Promise<void> {
  await migrate();
  const existing = await prisma.unit.count();
  if (existing > 0) {
    await seedScaffolds(); // scaffolds sync even when the curriculum exists
    await syncMisconceptions();
    console.log('curriculum already seeded; skipping (truncate units to reseed)');
    return;
  }

  for (const unit of curriculum) {
    const unitRow = await prisma.unit.create({
      data: { number: unit.number, titleEn: unit.titleEn, titleEs: unit.titleEs, position: unit.number },
    });

    for (const [li, lesson] of unit.lessons.entries()) {
      const lessonRow = await prisma.lesson.create({
        data: {
          unitId: unitRow.id,
          code: lesson.code,
          titleEn: lesson.titleEn,
          titleEs: lesson.titleEs,
          position: li + 1,
          mnemonicEn: lesson.mnemonicEn ?? null,
          mnemonicEs: lesson.mnemonicEs ?? null,
        },
      });

      for (const [si, step] of lesson.steps.entries()) {
        await prisma.lessonStep.create({
          data: {
            lessonId: lessonRow.id,
            position: si + 1,
            bodyEn: step.bodyEn,
            bodyEs: step.bodyEs,
            workedExampleLatex: step.workedExampleLatex ?? null,
            hintEn: step.hintEn ?? null,
            hintEs: step.hintEs ?? null,
          },
        });
      }

      const skillRow = await prisma.skill.create({
        data: {
          lessonId: lessonRow.id,
          slug: lesson.skill.slug,
          nameEn: lesson.skill.nameEn,
          nameEs: lesson.skill.nameEs,
        },
      });

      const insertProblem = async (
        p: FixedProblemSeed & {
          paramsJson?: unknown;
          sprint?: boolean;
          misconceptions?: Misconception[];
        },
      ): Promise<bigint> => {
        const row = await prisma.problem.create({
          data: {
            skillId: skillRow.id,
            tier: p.tier,
            promptEn: p.promptEn,
            promptEs: p.promptEs,
            answerLatex: p.answerLatex,
            gradingMode: p.gradingMode,
            tolerance: p.tolerance ?? null,
            paramsJson: p.paramsJson ? JSON.parse(JSON.stringify(p.paramsJson)) : undefined,
            misconceptionsJson: p.misconceptions?.length
              ? JSON.parse(JSON.stringify(p.misconceptions))
              : undefined,
            isSprint: p.sprint ?? false,
          },
        });
        for (const [pi, s] of (p.steps ?? ([] as StepSeed[])).entries()) {
          await prisma.problemStep.create({
            data: {
              problemId: row.id,
              position: pi + 1,
              promptEn: s.promptEn,
              promptEs: s.promptEs,
              expectedLatex: s.expectedLatex,
              gradingMode: s.gradingMode,
              hintEn: s.hintEn ?? null,
              hintEs: s.hintEs ?? null,
            },
          });
        }
        return row.id;
      };

      const standardProblemIds: bigint[] = [];

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
            misconceptions: gp.misconceptions,
            sprint: spec.sprint,
          });
          if (spec.tier === 'standard' && !spec.sprint) standardProblemIds.push(id);
        }
      }

      console.log(`seeded lesson ${lesson.code} (${standardProblemIds.length} standard problems)`);
    }
  }
  await seedScaffolds();
  const lessons = await prisma.lesson.count();
  const problems = await prisma.problem.count();
  console.log(`done: ${lessons} lessons, ${problems} problems`);
}

if (process.argv[1] === url.fileURLToPath(import.meta.url)) {
  seed()
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
