import { describe, expect, it } from 'vitest';
import { lockModalScroll } from '../src/components/ui/modal-scroll-lock';

// Only the style contract is required; no browser layout is exercised here.
const body = (overflow = '') => ({ style: { overflow } }) as HTMLElement;

describe('nested modal scroll locks', () => {
  it.each([true, false])('restores overflow only after all dialogs close (parent first: %s)', (parentFirst) => {
    const element = body('auto');
    const parent = lockModalScroll(element);
    const child = lockModalScroll(element);
    (parentFirst ? parent : child)();
    expect(element.style.overflow).toBe('hidden');
    (parentFirst ? child : parent)();
    expect(element.style.overflow).toBe('auto');
  });
  it('allows repeated cleanup and a fresh lock after cleanup', () => {
    const element = body();
    const release = lockModalScroll(element);
    release();
    const next = lockModalScroll(element);
    release();
    expect(element.style.overflow).toBe('hidden');
    next();
    expect(element.style.overflow).toBe('');
  });
});
