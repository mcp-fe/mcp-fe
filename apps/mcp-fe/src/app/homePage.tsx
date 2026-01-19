import { Link } from 'react-router-dom';

export const HomePage = () => (
  <div>
    This is the generated root route.{' '}
    <input type="text" placeholder="Try typing here..." />
    <br/>
    <Link to="/page-2">Click here for page 2.</Link>
  </div>
);
