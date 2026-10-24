import { useNavigate } from 'react-router-dom';

export default function BackLink({ to, children, onClick, label }) {
  const navigate = useNavigate();

  const handleBack = (e) => {
    e.preventDefault();
    if (onClick) {
      onClick(e);
      return;
    }

    // Check if we have React Router history to pop
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      // Fallback if opened in a new tab
      navigate(to, { replace: true });
    }
  };

  return (
    <a href={to} onClick={handleBack} className="back-link">
      ← {label || children}
    </a>
  );
}
