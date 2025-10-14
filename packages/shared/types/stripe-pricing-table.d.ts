import type { DetailedHTMLProps, HTMLAttributes } from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'stripe-pricing-table': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        'pricing-table-id'?: string;
        'publishable-key'?: string;
        [key: string]: unknown;
      };
    }
  }
}

export {};
