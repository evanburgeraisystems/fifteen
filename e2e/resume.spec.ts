/**
 * Uploads each of the four real resume files and checks that "Check what we read" shows what the file says.
 * The expected values come from the persona source text the files were generated from.
 */
import { join } from 'node:path';
import { RESUME_DIR } from './helpers/data.ts';
import { expect, test } from './helpers/fixtures.ts';
import { PERSONAS } from './fixtures/resumes/personas.ts';

const CLASS_LABEL = { freshman: 'Freshman', sophomore: 'Sophomore', junior: 'Junior', senior: 'Senior' } as const;

test.describe('resume upload', () => {
  for (const persona of PERSONAS) {
    test(`${persona.file} is read correctly`, async ({ page, shots }) => {
      const e = persona.expected;
      await page.goto('/welcome?dataset=demo');
      await page.getByTestId('resume-input').setInputFiles(join(RESUME_DIR, persona.file));
      await expect(page.getByRole('heading', { name: 'Check what we read' })).toBeVisible();
      await expect(page.getByText(persona.file)).toBeVisible();

      await expect(page.locator('#pf-school')).toHaveValue(e.school);
      await expect(page.locator('#pf-grad')).toHaveValue(String(e.gradYear));
      await expect(page.locator('#pf-gpa')).toHaveValue(String(e.gpa));
      // Class year is worked out from the graduation year and preselected.
      await expect(page.getByRole('radio', { name: CLASS_LABEL[e.classYear], exact: true })).toHaveAttribute('aria-checked', 'true');

      for (const id of [...e.majors, ...e.skills]) await expect(page.getByTestId(`signal-${id}`), `found ${id}`).toBeVisible();
      for (const id of e.notSkills) await expect(page.getByTestId(`signal-${id}`), `did not invent ${id}`).toHaveCount(0);
      await shots('resume')(persona.slug);
    });
  }

  test('fixing what we read changes the chips', async ({ page }) => {
    await page.goto('/welcome?dataset=demo');
    await page.getByTestId('resume-input').setInputFiles(join(RESUME_DIR, 'sophomore-jordan.docx'));
    await expect(page.getByRole('heading', { name: 'Check what we read' })).toBeVisible();
    await expect(page.getByTestId('signal-copywriting')).toBeVisible();
    await page.getByRole('button', { name: 'Remove Copywriting' }).click();
    await expect(page.getByTestId('signal-copywriting')).toHaveCount(0);
    await page.getByLabel('Add a skill').selectOption({ label: 'SQL' });
    await expect(page.getByTestId('signal-sql')).toBeVisible();
  });
});
