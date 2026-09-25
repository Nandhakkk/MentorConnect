import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createReview, getSessionReviews } from '../../services/reviewService';
import RatingStars from '../../components/RatingStars';
import BackLink from '../../components/BackLink';

export default function ReviewSession() {
  const { id } = useParams(); // sessionId
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [existingReview, setExistingReview] = useState(null);

  useEffect(() => {
    const checkExisting = async () => {
      try {
        const reviews = await getSessionReviews(id);
        const myReview = reviews.find(r => r.reviewerRole === 'STUDENT');
        if (myReview) setExistingReview(myReview);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    checkExisting();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setError('Please select a valid rating from 1 to 5.');
      return;
    }
    try {
      setError('');
      await createReview({ sessionId: id, rating, comment });
      navigate('/student/sessions');
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="page-content">Loading...</div>;

  return (
    <div className="page-content">
      <BackLink to="/student/sessions" label="Back to Sessions" />
      <div className="glass-card" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
        <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'white' }}>Rate Your Mentor</h2>
        
        {existingReview ? (
          <div>
            <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: '8px', marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#10b981' }}>You have already reviewed this session.</h4>
              <RatingStars rating={existingReview.rating} readOnly={true} />
              <p style={{ marginTop: '1rem', whiteSpace: 'pre-wrap', color: 'white' }}>{existingReview.comment}</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Rating (Required)</label>
              <RatingStars rating={rating} setRating={setRating} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Review (Optional)</label>
              <textarea 
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows="5"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white', resize: 'vertical' }}
                placeholder="How was the session? Was the mentor helpful?"
              ></textarea>
            </div>
            
            {error && <div style={{ color: '#ef4444' }}>{error}</div>}
            
            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
              Submit Review
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
