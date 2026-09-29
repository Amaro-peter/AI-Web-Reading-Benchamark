import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HomePage from '../../src/app/page';

describe('HomePage', () => {
  it('renders the product title', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: 'AI Web Reading Benchmark' })).toBeInTheDocument();
  });

  it('renders the product description', () => {
    render(<HomePage />);
    expect(screen.getByText(/ler e extrair informações de uma página web/i)).toBeInTheDocument();
  });
});
