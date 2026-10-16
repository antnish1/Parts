import { describe, expect, it, vi } from 'vitest';
import { ensureInitialOrderComment } from './initialOrderComment.service';

describe('ensureInitialOrderComment', () => {
  it('allows blank optional comments without posting anything', async () => {
    const save = vi.fn();
    expect(await ensureInitialOrderComment('order-1', ' \n ', null, save)).toEqual({
      commentSaved: null,
      commentWarning: null,
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('does not double-post when the Edge Function already saved the comment', async () => {
    const save = vi.fn();
    expect(await ensureInitialOrderComment('order-1', 'Please dispatch soon', true, save)).toEqual({
      commentSaved: true,
      commentWarning: null,
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('supports frontend-first release with a legacy Edge Function', async () => {
    const save = vi.fn().mockResolvedValue({ id: 'comment-1' });
    expect(await ensureInitialOrderComment('order-2', '  Need urgently  ', null, save)).toEqual({
      commentSaved: true,
      commentWarning: null,
    });
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith('order-2', 'Need urgently');
  });

  it('retries an unsuccessful server comment once without creating another order', async () => {
    const save = vi.fn().mockResolvedValue({ id: 'comment-1' });
    expect(await ensureInitialOrderComment('order-3', 'Please call', false, save)).toEqual({
      commentSaved: true,
      commentWarning: null,
    });
    expect(save).toHaveBeenCalledOnce();
  });

  it('warns clearly while preserving the order when the fallback comment fails', async () => {
    const save = vi.fn().mockRejectedValue(new Error('RLS rejected comment'));
    expect(await ensureInitialOrderComment('order-4', 'Important information', false, save)).toEqual({
      commentSaved: false,
      commentWarning: 'RLS rejected comment',
    });
    expect(save).toHaveBeenCalledOnce();
  });
});
