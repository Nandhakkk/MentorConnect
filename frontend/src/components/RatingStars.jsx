export default function RatingStars({ rating, setRating, readOnly = false }) {
  return (
    <div style={{ display: 'flex', gap: '0.25rem', fontSize: '1.5rem', cursor: readOnly ? 'default' : 'pointer' }}>
      {[1, 2, 3, 4, 5].map(star => (
        <span 
          key={star} 
          onClick={() => !readOnly && setRating && setRating(star)}
          style={{ 
            color: star <= rating ? '#eab308' : 'var(--border-subtle)',
            transition: 'color 0.2s ease'
          }}
          title={`${star} Star${star > 1 ? 's' : ''}`}
        >
          ★
        </span>
      ))}
    </div>
  );
}
