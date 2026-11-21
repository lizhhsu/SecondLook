import React, { useRef, useState } from 'react';

export default function EquationSelection({ videoRef, region, onChange, disabled }) {
  const origin = useRef(null);
  const [outline, setOutline] = useState(null);

  function coordinates(event) {
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
    const video = videoRef.current;
    const scale = Math.min(width / video.videoWidth, height / video.videoHeight);
    const videoWidth = scale * video.videoWidth;
    const videoHeight = scale * video.videoHeight;
    const offsetX = (width - videoWidth) / 2;
    const offsetY = (height - videoHeight) / 2;
    const x = Math.max(0, Math.min(1, (event.clientX - left - offsetX) / videoWidth));
    const y = Math.max(0, Math.min(1, (event.clientY - top - offsetY) / videoHeight));
    return { x, y, offsetX, offsetY, videoWidth, videoHeight };
  }

  function selection(event) {
    const point = coordinates(event);
    const x = Math.min(origin.current.x, point.x);
    const y = Math.min(origin.current.y, point.y);
    const width = Math.abs(point.x - origin.current.x);
    const height = Math.abs(point.y - origin.current.y);
    const { offsetX, offsetY, videoWidth, videoHeight } = point;
    setOutline({
      left: offsetX + x * videoWidth,
      top: offsetY + y * videoHeight,
      width: width * videoWidth,
      height: height * videoHeight,
    });
    return width * videoWidth >= 20 && height * videoHeight >= 12 ? { x, y, width, height } : null;
  }

  return <div
    className="workspace-selection"
    aria-hidden="true"
    onPointerDown={event => {
      if (disabled || event.button !== 0 || origin.current) return;
      origin.current = coordinates(event);
      event.currentTarget.setPointerCapture(event.pointerId);
      onChange(null);
      setOutline(null);
    }}
    onPointerMove={event => {
      if (origin.current && event.currentTarget.hasPointerCapture(event.pointerId)) selection(event);
    }}
    onPointerUp={event => {
      if (!origin.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
      const next = selection(event);
      origin.current = null;
      onChange(next);
      if (!next) setOutline(null);
    }}
    onPointerCancel={() => {
      origin.current = null;
      setOutline(null);
    }}
  >
    {outline && (region || origin.current) && <div className="workspace-selection-outline" style={outline} />}
  </div>;
}
