// Uncomment this line to use CSS modules
// import styles from './app.module.scss';
import { HomePage } from './homePage';
import { Routes, Link, Route } from 'react-router-dom';
import { useReactRouterEventTracker } from '@mcp-fe/react-event-tracker';



export function App() {
  useReactRouterEventTracker();

  return (
    <main>
      <aside role="navigation">
        <ul>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/page-2">Page 2</Link>
          </li>
        </ul>
      </aside>
      <Routes>
        <Route
          path="/"
          element={<HomePage />
          }
        />
        <Route
          path="/page-2"
          element={
            <div>
              <Link to="/">Click here to go back to root page.</Link>
            </div>
          }
        />
      </Routes>
      {/* END: routes */}
    </main>
  );
}

export default App;
