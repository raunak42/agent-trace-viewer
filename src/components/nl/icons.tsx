/**
 * Icon paths traced verbatim from app.neatlogs.com's rendered SVGs — same
 * 24×24 viewBox, same 1.5 stroke, same round caps. Only the error glyph is
 * ours: their sample data had no failed traces to copy one from, so it reuses
 * their circle with a cross drawn in the same weight.
 */
type P = { className?: string };
const base = (className = "size-4") =>
    ({ xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24",
       fill: "none", stroke: "currentColor", strokeWidth: 1.5, className, "aria-hidden": true }) as const;

export const StatusSuccessIcon = ({ className }: P) => (
    <svg {...base(className)}>
        <path d="M22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12Z" />
        <path d="M8 12.75C8 12.75 9.6 13.6625 10.4 15C10.4 15 12.8 9.75 16 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export const StatusErrorIcon = ({ className }: P) => (
    <svg {...base(className)}>
        <path d="M22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12Z" />
        <path d="M14.9 9.1L9.1 14.9M14.9 14.9L9.1 9.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export const ReplayIcon = ({ className }: P) => (
    <svg {...base(className)}>
        <path d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C15.0413 2 17.7655 3.35767 19.5996 5.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 2.5V6H16.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15.9453 12.3577C15.7686 12.9844 14.9333 13.4273 13.2629 14.3131C11.648 15.1693 10.8406 15.5975 10.1899 15.4254C9.9209 15.3542 9.6758 15.2191 9.47812 15.0329C9 14.5827 9 13.7094 9 11.9629C9 10.2163 9 9.34307 9.47812 8.89284C9.6758 8.7067 9.9209 8.57157 10.1899 8.50042C10.8406 8.32833 11.648 8.75646 13.2629 9.61272C14.9333 10.4985 15.7686 10.9414 15.9453 11.5681C16.0182 11.8268 16.0182 12.099 15.9453 12.3577Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export const ChevronDownIcon = ({ className }: P) => (
    <svg {...base(className)}><path d="M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const ChevronUpIcon = ({ className }: P) => (
    <svg {...base(className)}><path d="M17.9998 15C17.9998 15 13.5809 9.00001 11.9998 9C10.4187 8.99999 5.99985 15 5.99985 15" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const ChevronRightIcon = ({ className }: P) => (
    <svg {...base(className)}><path d="M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const ChevronLeftIcon = ({ className }: P) => (
    <svg {...base(className)}><path d="M15 6C15 6 9 10.4189 9 12C9 13.5812 15 18 15 18" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

