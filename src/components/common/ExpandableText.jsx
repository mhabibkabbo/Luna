import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Accessible ExpandableText component.
 * Displays compact truncated text with an accessible "Read more" / "Show less" toggle.
 */
export default function ExpandableText({
  text = '',
  maxLines = 3,
  charThreshold = 140,
  className = 'text-xs text-[#8E95A5] leading-relaxed',
  buttonClassName = 'mt-1.5 text-[11px] font-mono text-[#CBD5E1] hover:text-white inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50 rounded transition-colors self-start',
  id,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text) return null;

  const needsTruncation = text.length > charThreshold;

  return (
    <div className="flex flex-col">
      <p
        id={id}
        className={className}
        style={
          !isExpanded && needsTruncation
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
          aria-controls={id}
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

