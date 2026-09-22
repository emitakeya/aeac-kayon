'use client';
// Small toggle-chip group used across /b2b forms.

export function Chips({
  options, selected, onToggle, labelledBy, size = 'md',
}: {
  options: [string, string][];
  selected: string[];
  onToggle: (key: string) => void;
  labelledBy: string;
  size?: 'md' | 'lg';
}) {
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {options.map(([k, l]) => {
        const on = selected.includes(k);
        return (
          <button
            key={k}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(k)}
            className={
              (size === 'lg' ? 'min-h-12 px-4 text-sm ' : 'min-h-10 px-3.5 text-[13px] ') +
              'rounded-full font-semibold transition border ' +
              (on
                ? 'bg-aeac-amber-100 text-amber-900 border-aeac-amber-600 border-2'
                : 'bg-white text-neutral-800 border-neutral-300 hover:border-neutral-500')
            }
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
