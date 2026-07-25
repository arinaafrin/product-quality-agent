import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FailureTable from './FailureTable.jsx';

describe('FailureTable', () => {
  test('shows an all-clear message when no record has failures', () => {
    render(<FailureTable results={[{ index: 0, sku: 'A', title: 'A', failures: [] }]} />);
    expect(screen.getByText(/every record passed with no warnings/i)).toBeInTheDocument();
  });

  test('renders one row per failure, flattened across flagged records', () => {
    const results = [
      { index: 0, sku: 'A', title: 'A', failures: [] },
      {
        index: 1,
        sku: 'FDS-2',
        title: '',
        failures: [
          { ruleId: 'invalid-category', severity: 'warning', message: 'Category not recognized.' },
          { ruleId: 'invalid-sku-format', severity: 'error', message: 'Bad SKU.' },
        ],
      },
    ];
    render(<FailureTable results={results} />);

    // header row + 2 failure rows for the one flagged record
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText('invalid-category')).toBeInTheDocument();
    expect(screen.getByText('Category not recognized.')).toBeInTheDocument();
    expect(screen.getByText('invalid-sku-format')).toBeInTheDocument();
    expect(screen.getByText('Bad SKU.')).toBeInTheDocument();
  });

  test('shows "untitled" for a record with a blank title', () => {
    render(
      <FailureTable
        results={[
          { index: 0, sku: 'FDS-2', title: '', failures: [{ ruleId: 'missing-title', severity: 'error', message: 'Title is missing.' }] },
        ]}
      />
    );
    expect(screen.getByText('untitled')).toBeInTheDocument();
  });
});
