import React, { useState, useRef, useLayoutEffect, useId } from 'react';
import { ChevronDown } from 'lucide-react';

export default function ExpandableText({
  text = '',
  maxLines = 3,
  charThreshold = 140,
  className = 'text-xs text-[#8E95A5] leading-relaxed',
  buttonClassName = 'mt-1.5 text-[11px] font-mono text-[#CBD5E1] hover:text-white inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50 rounded transition-colors self-start',
  id,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClampedOverflow, setIsClampedOverflow] = useState(false);
  const textRef = useRef(null);
  const generatedId = useId();
  const contentId = id || generatedId;

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || isExpanded) return undefined;

    const checkOverflow = () => {
      setIsClampedOverflow(el.scrollHeight > el.clientHeight + 1);
    };

    checkOverflow();

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(checkOverflow);
      observer.observe(el);
      return () => observer.disconnect();
    }
    return undefined;
  }, [text, maxLines, isExpanded]);

  if (!text) return null;

  const needsTruncation = isExpanded || isClampedOverflow || text.length > charThreshold * 2;

  return (
    <div className="flex flex-col">
      <p
        ref={textRef}
        id={contentId}
        className={className}
        style={
          !isExpanded
            ? {
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: maxLines,
                overflow: 'hidden',
              }
            : undefined
        }
      >
        {text}
      </p>
      {needsTruncation && (
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={contentId}
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded((prev) => !prev);
          }}
          className={buttonClassName}
        >
          <span>{isExpanded ? 'Show less' : 'Read more'}</span>
          <ChevronDown
            className={`w-3 h-3 transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </button>
      )}
    </div>
  );
}

