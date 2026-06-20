import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { getAssignment, getTargetClues, getReleasedFieldIds, startAssignment } from '../../../lib/hunt';

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const action = formData.get('action') as string;

  if (action === 'assign') {
    const hunter_id = (formData.get('hunter_id') as string)?.trim();
    const target_id = (formData.get('target_id') as string)?.trim();
    if (!hunter_id || !target_id || hunter_id === target_id) return redirect('/admin/assignments');

    // (Re)assign this hunter a target. Reassigning resets the hunt and clears
    // any clues already handed out.
    const existing = await db.execute({
      sql: 'SELECT id FROM assignments WHERE hunter_id = ?',
      args: [hunter_id],
    });
    if (existing.rows[0]) {
      const id = existing.rows[0].id as number;
      await db.execute({ sql: 'DELETE FROM clue_releases WHERE assignment_id = ?', args: [id] });
      await db.execute({
        sql: `UPDATE assignments SET target_id = ?, status = 'assigned', started_at = NULL WHERE id = ?`,
        args: [target_id, id],
      });
    } else {
      await db.execute({
        sql: 'INSERT INTO assignments (hunter_id, target_id) VALUES (?, ?)',
        args: [hunter_id, target_id],
      });
    }
    return redirect('/admin/assignments');
  }

  // Everything below operates on a single assignment.
  const id = parseInt(formData.get('id') as string);
  if (!id) return redirect('/admin/assignments');
  const assignment = await getAssignment(id);
  if (!assignment) return redirect('/admin/assignments');
  const detail = `/admin/assignment/${id}`;

  if (action === 'unassign') {
    await db.execute({ sql: 'DELETE FROM clue_releases WHERE assignment_id = ?', args: [id] });
    await db.execute({ sql: 'DELETE FROM assignments WHERE id = ?', args: [id] });
    return redirect('/admin/assignments');
  }

  if (action === 'start') {
    await startAssignment(id);
    return redirect(detail);
  }

  if (action === 'release_clue') {
    const field_id = parseInt(formData.get('field_id') as string);
    if (field_id) {
      await db.execute({
        sql: `INSERT INTO clue_releases (assignment_id, field_id) VALUES (?, ?)
              ON CONFLICT (assignment_id, field_id) DO NOTHING`,
        args: [id, field_id],
      });
      // TODO(slack): notify the hunter that a new clue is available.
    }
    return redirect(detail);
  }

  if (action === 'revoke_clue') {
    const field_id = parseInt(formData.get('field_id') as string);
    if (field_id) {
      await db.execute({
        sql: 'DELETE FROM clue_releases WHERE assignment_id = ? AND field_id = ?',
        args: [id, field_id],
      });
    }
    return redirect(detail);
  }

  if (action === 'reveal_all') {
    const clues = await getTargetClues(assignment.target_id);
    for (const clue of clues) {
      await db.execute({
        sql: `INSERT INTO clue_releases (assignment_id, field_id) VALUES (?, ?)
              ON CONFLICT (assignment_id, field_id) DO NOTHING`,
        args: [id, clue.id],
      });
    }
    // TODO(slack): notify the hunter that new clues are available.
    return redirect(detail);
  }

  if (action === 'reveal_next') {
    const clues = await getTargetClues(assignment.target_id);
    const released = await getReleasedFieldIds(id);
    const next = clues.find(c => !released.has(c.id));
    if (next) {
      await db.execute({
        sql: 'INSERT INTO clue_releases (assignment_id, field_id) VALUES (?, ?)',
        args: [id, next.id],
      });
      // TODO(slack): notify the hunter that a new clue is available.
    }
    return redirect(detail);
  }

  if (action === 'reset_clues') {
    await db.execute({ sql: 'DELETE FROM clue_releases WHERE assignment_id = ?', args: [id] });
    return redirect(detail);
  }

  return redirect(detail);
};
