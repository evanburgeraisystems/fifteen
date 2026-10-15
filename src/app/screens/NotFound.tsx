import { Link } from 'react-router';
import { Icon } from '../components/Icon.tsx';

export function NotFound() {
  return (
    <div className="page">
      <div className="state">
        <span className="state-icon">
          <Icon name="search" />
        </span>
        <h1 className="page-title">Nothing at this address</h1>
        <p>The page may have moved. Your roles are on Home.</p>
        <Link to="/" className="btn btn-primary">
          Go to Home
        </Link>
      </div>
    </div>
  );
}
