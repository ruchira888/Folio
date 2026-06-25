import React from 'react';

interface ToolCardStyles {
  bg: string;
  border: string;
  iconBg: string;
  iconColor: string;
  tagBg: string;
  tagColor: string;
}

interface ToolCardProps {
  category: string;
  title: string;
  description: string;
  tag?: string;
  tagIcon?: React.ComponentType<{ className?: string }>;
  icon: React.ComponentType<{ className?: string }>;
  styles: ToolCardStyles;
  avatars?: string[];
  avatarCount?: string;
  onClick?: () => void;
}

export default function ToolCard({
  category,
  title,
  description,
  tag,
  tagIcon: TagIcon,
  icon: Icon,
  styles,
  avatars,
  avatarCount,
  onClick,
}: ToolCardProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick();
        }
      }}
      className={`group flex flex-col justify-between rounded-2xl border p-5 md:p-6 transition-all duration-300 ${styles.border} ${styles.bg} ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-100/60' : ''}`}
    >
      <div>
        {/* Icon + Category label */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`rounded-xl p-2.5 ${styles.iconBg} ${styles.iconColor} shadow-sm transition-transform group-hover:scale-105`}>
            <Icon className="h-5 w-5" />
          </div>
          <span className="font-sans text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400">
            {category}
          </span>
        </div>

        {/* Title */}
        <h4 className="mb-1.5 font-serif text-lg font-bold text-[#0F172A] group-hover:text-slate-900">
          {title}
        </h4>

        {/* Description */}
        <p className="font-sans text-[13px] font-medium leading-relaxed text-slate-400">
          {description}
        </p>
      </div>

      {/* Footer: tag + avatars */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100/60">
        {tag && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${styles.tagBg} ${styles.tagColor}`}>
            {TagIcon ? (
              <TagIcon className="h-3.5 w-3.5 flex-shrink-0" />
            ) : (
              <span className="opacity-70">✦</span>
            )}
            {tag}
          </span>
        )}

        {avatars && (
          <div className="ml-auto flex items-center gap-1.5">
            <div className="flex -space-x-2">
              {avatars.map((url, index) => (
                <img
                  key={index}
                  src={url}
                  alt="User avatar"
                  className="h-5 w-5 rounded-full border-[1.5px] border-white object-cover shadow-sm"
                />
              ))}
            </div>
            {avatarCount && (
              <span className="text-[10px] font-bold text-slate-400">{avatarCount}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
