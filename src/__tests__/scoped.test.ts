import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startMFEScoped } from '../handlers/mfe';
import { mountMFEs } from '../scoped';

vi.mock('../handlers/mfe', () => ({
  startMFEScoped: vi.fn(),
}));

const mockedStartMFEScoped = vi.mocked(startMFEScoped);

describe('mountMFEs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mounts only mfe: interactions within the root and returns a combined cleanup', async () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div data-interaction="mfe:header" data-mfe-src="/header.js"></div>
      <div data-interaction="poll:comments"></div>
      <div data-interaction="mfe:footer" data-mfe-src="/footer.js"></div>
    `;

    const cleanupHeader = vi.fn();
    const cleanupFooter = vi.fn();
    mockedStartMFEScoped
      .mockResolvedValueOnce(cleanupHeader)
      .mockResolvedValueOnce(cleanupFooter);

    const cleanup = await mountMFEs({ root, context: { appName: 'Toldby' } });

    expect(mockedStartMFEScoped).toHaveBeenCalledTimes(2);
    expect(mockedStartMFEScoped).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      { appName: 'Toldby' },
    );

    cleanup();
    expect(cleanupHeader).toHaveBeenCalledTimes(1);
    expect(cleanupFooter).toHaveBeenCalledTimes(1);
  });

  it('returns a no-op cleanup when there are no mfe interactions', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<div data-interaction="poll:comments"></div>';

    const cleanup = await mountMFEs({ root });

    expect(mockedStartMFEScoped).not.toHaveBeenCalled();
    expect(() => cleanup()).not.toThrow();
  });
});
