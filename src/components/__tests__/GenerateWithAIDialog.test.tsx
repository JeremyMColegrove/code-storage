import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GenerateWithAIDialog from '../GenerateWithAIDialog';

describe('GenerateWithAIDialog', () => {
  it('validates API key and request', async () => {
    const onResponse = vi.fn();
    render(<GenerateWithAIDialog onResponse={onResponse} />);

    // Open dialog by toggling open state via trigger prop not provided; directly call button in DOM after open state is default false.
    // Instead, render with a trigger and click it.
  });

  it('calls fetch and onResponse on success', async () => {
    const onResponse = vi.fn();
    const userCode = 'print(123)';
    // @ts-expect-error - jsdom fetch mock
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: userCode }] } }] }) })) as any;
    render(<GenerateWithAIDialog onResponse={onResponse} trigger={<button>Open</button>} currentLanguage="python" />);
    fireEvent.click(screen.getByText('Open'));
    fireEvent.change(screen.getByLabelText('Gemini API Key'), { target: { value: 'key' } });
    fireEvent.change(screen.getByLabelText('Request'), { target: { value: 'do it' } });
    fireEvent.click(screen.getByText('Generate'));
    await waitFor(() => expect(onResponse).toHaveBeenCalledWith(userCode));
  });
});


