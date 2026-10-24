import { useState, useRef, useEffect } from 'react';

export default function ImageCropper({ imageSrc, onCrop, onCancel }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const imageRef = useRef(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      resetCrop();
    };
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    drawCanvas();
  }, [zoom, offset]);

  const resetCrop = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    drawCanvas();
  };

  const drawCanvas = () => {
    if (!canvasRef.current || !imageRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const size = Math.min(img.width, img.height);
    const scale = (canvas.width / size) * zoom;

    const w = img.width * scale;
    const h = img.height * scale;

    const x = (canvas.width - w) / 2 + offset.x;
    const y = (canvas.height - h) / 2 + offset.y;

    ctx.drawImage(img, x, y, w, h);

    // Draw circular mask
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // Draw outer overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleConfirm = () => {
    if (!canvasRef.current || !imageRef.current) return;

    // Create an offscreen canvas specifically for the cropped result
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = 300; // Profile image size
    resultCanvas.height = 300;
    const ctx = resultCanvas.getContext('2d');

    const img = imageRef.current;
    const size = Math.min(img.width, img.height);
    const scale = (resultCanvas.width / size) * zoom;

    const w = img.width * scale;
    const h = img.height * scale;

    const x = (resultCanvas.width - w) / 2 + (offset.x * (resultCanvas.width / canvasRef.current.width));
    const y = (resultCanvas.height - h) / 2 + (offset.y * (resultCanvas.height / canvasRef.current.height));

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, resultCanvas.width, resultCanvas.height);
    ctx.drawImage(img, x, y, w, h);

    resultCanvas.toBlob((blob) => {
      onCrop(blob);
    }, 'image/jpeg', 0.9);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '2rem', borderRadius: 'var(--radius-lg)', maxWidth: '90vw', width: '400px', textAlign: 'center' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Adjust Profile Photo</h3>

        <div
          ref={containerRef}
          style={{ width: '300px', height: '300px', margin: '0 auto 1.5rem auto', cursor: isDragging ? 'grabbing' : 'grab', position: 'relative', overflow: 'hidden' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <canvas
            ref={canvasRef}
            width={300}
            height={300}
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>-</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>+</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={resetCrop}>Reset</button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={handleConfirm}>Use Photo</button>
          </div>
        </div>
      </div>
    </div>
  );
}
