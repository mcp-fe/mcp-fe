import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import App from './app';
import { SessionProvider } from './contexts/SessionContext';

describe('App', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <BrowserRouter>
        <SessionProvider>
          <App />
        </SessionProvider>
      </BrowserRouter>,
    );
    expect(baseElement).toBeTruthy();
  });

  it('renders the event log panel', () => {
    // The original scaffolded "Welcome @mcp-fe/mcp-fe" placeholder text was
    // removed once the real demo UI was built; assert on content that's
    // actually part of the current shell instead.
    const { getAllByText } = render(
      <BrowserRouter>
        <SessionProvider>
          <App />
        </SessionProvider>
      </BrowserRouter>,
    );
    expect(
      getAllByText(new RegExp('Live Event Log', 'i')).length > 0,
    ).toBeTruthy();
  });
});
