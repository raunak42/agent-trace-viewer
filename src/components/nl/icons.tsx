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

export const SearchIcon = ({ className }: P) => (
    <svg {...base(className)}>
        <path d="M17 17L21 21" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z" />
    </svg>
);

export const CalendarIcon = ({ className }: P) => (
    <svg {...base(className)}>
        <path d="M16 2V6M8 2V6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 4H11C7.22876 4 5.34315 4 4.17157 5.17157C3 6.34315 3 8.22876 3 12V14C3 17.7712 3 19.6569 4.17157 20.8284C5.34315 22 7.22876 22 11 22H13C16.7712 22 18.6569 22 19.8284 20.8284C21 19.6569 21 17.7712 21 14V12C21 8.22876 21 6.34315 19.8284 5.17157C18.6569 4 16.7712 4 13 4Z" />
        <path d="M3 10H21" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export const FunnelIcon = ({ className }: P) => (
    <svg {...base(className)}>
        <path d="M8.85746 12.5061C6.36901 10.6456 4.59564 8.59915 3.62734 7.44867C3.3276 7.09253 3.22938 6.8319 3.17033 6.3728C2.96811 4.8008 2.86701 4.0148 3.32795 3.5074C3.7889 3 4.60404 3 6.23433 3H17.7657C19.396 3 20.2111 3 20.672 3.5074C21.133 4.0148 21.0319 4.8008 20.8297 6.37281C20.7706 6.83191 20.6724 7.09254 20.3726 7.44867C19.403 8.59927 17.6261 10.6493 15.1326 12.5135C14.907 12.6822 14.7583 12.9535 14.7307 13.2562C14.4837 15.9615 14.2559 17.4284 14.1141 18.1955C13.8853 19.4341 12.1348 20.5177 11.2454 21.1465C10.7166 21.5204 10.0699 21.0966 10.0012 20.5111C9.86122 19.3175 9.61103 16.9202 9.26903 13.2562C9.24076 12.9535 9.09215 12.6749 8.85746 12.5061Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export const PlusIcon = ({ className }: P) => (
    <svg {...base(className)}><path d="M12 4V20M20 12H4" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export const SlidersIcon = ({ className }: P) => (
    <svg {...base(className)}>
        <path d="M13 4L3 4M11 19H3M21 19L17 19M21 11.5L11 11.5M21 4L19 4M5 11.5L3 11.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14.5 2H15C15.9428 2 16 2.5 16 3.5V4.5C16 5.5 15.9428 6 15 6H14.5C13.5572 6 13 5.5 13 4.5V3.5C13 2.5 13.5572 2 14.5 2Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 9.5H8.5C9.44281 9.5 10 10 10 11V12C10 13 9.44281 13.5 8.5 13.5H8C7.05719 13.5 6.5 13 6.5 12V11C6.5 10 7.05719 9.5 8 9.5Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.5 17H14C14.9428 17 15.5 17.5 15.5 18.5V19.5C15.5 20.5 14.9428 21 14 21H13.5C12.5572 21 12 20.5 12 19.5V18.5C12 17.5 12.5572 17 13.5 17Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export const TracesIcon = ({ className }: P) => (
    <svg {...base(className)}>
        <path d="M3 4V14C3 16.8284 3 18.2426 3.87868 19.1213C4.75736 20 6.17157 20 9 20H21" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 16L16 16M7 12L20 12M7 8L13 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export const CloseIcon = ({ className }: P) => (
    <svg {...base(className)}><path d="M18 6L6.00081 17.9992M17.9992 18L6 6.00085" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
