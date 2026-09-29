import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HomePage from '../../src/app/page';

describe('smoke: frontend app shell', () => {
  it('mounts the home page without throwing', () => {
    expect(() => render(<HomePage />)).not.toThrow();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
