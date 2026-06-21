import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const action = formData.get('action') as string;

  if (action === 'create') {
    const prompt = (formData.get('prompt') as string)?.trim();
    const difficulty = normalizeDifficulty(formData.get('difficulty'));
    const questionType = normalizeQuestionType(formData.get('question_type'));
    if (!prompt) return redirect('/admin/fields');
    const { rows } = await db.execute('SELECT MAX(field_order) as max FROM clue_fields');
    const nextOrder = ((rows[0]?.max as number) ?? -1) + 1;
    await db.execute({
      sql: 'INSERT INTO clue_fields (prompt, field_order, difficulty, question_type) VALUES (?, ?, ?, ?)',
      args: [prompt, nextOrder, difficulty, questionType],
    });
  } else if (action === 'update') {
    const id = parseInt(formData.get('id') as string);
    const prompt = (formData.get('prompt') as string)?.trim();
    const fieldOrder = parseInt(formData.get('field_order') as string) || 0;
    const difficulty = normalizeDifficulty(formData.get('difficulty'));
    const questionType = normalizeQuestionType(formData.get('question_type'));
    if (!id || !prompt) return redirect('/admin/fields');
    await db.execute({
      sql: 'UPDATE clue_fields SET prompt = ?, field_order = ?, difficulty = ?, question_type = ? WHERE id = ?',
      args: [prompt, fieldOrder, difficulty, questionType, id],
    });
  } else if (action === 'delete') {
    const id = parseInt(formData.get('id') as string);
    if (!id) return redirect('/admin/fields');
    await db.execute({ sql: 'DELETE FROM user_clues WHERE field_id = ?', args: [id] });
    await db.execute({ sql: 'DELETE FROM clue_fields WHERE id = ?', args: [id] });
  }

  return redirect('/admin/fields');
};

function normalizeDifficulty(value: FormDataEntryValue | null) {
  return ['hard', 'medium', 'easy'].includes(String(value)) ? String(value) : 'medium';
}

function normalizeQuestionType(value: FormDataEntryValue | null) {
  return value === 'yes_no' ? 'yes_no' : 'text';
}
