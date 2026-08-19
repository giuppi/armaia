import React from 'react';

/**
 * Libreria di Icone SVG Centralizzata
 * -----------------------------------
 * Invece di importare pesanti librerie esterne (es. FontAwesome o Material Icons),
 * il progetto utilizza questo set di icone SVG inline, progettate su misura.
 * 
 * Vantaggi:
 * 1. Zero dipendenze esterne (bundle size ridotto al minimo).
 * 2. Gestione centralizzata dell'accessibilità tramite il wrapper IconBase.
 * 3. Stile coerente (spessori, dimensioni, colori ereditati dal testo 'currentColor').
 */

/**
 * @param {string} label - Etichetta opzionale per screen reader. Se omessa, l'icona è decorativa.
 * @param {boolean} tight - Se true, rimuove il margine destro standard.
 * @param {string} size - Dimensione dell'icona (md, lg, ecc.) mappata via CSS.
 */
const IconBase = ({ children, label, style, className = '', tight = false, size = 'md' }) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden={label ? undefined : 'true'}
        aria-label={label}
        focusable="false"
        className={`ui-icon ui-icon--${size}${tight ? ' ui-icon--tight' : ''}${className ? ` ${className}` : ''}`}
        style={style}
        stroke="currentColor"
        strokeWidth="var(--ui-icon-stroke, 1.9)"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        {children}
    </svg>
);

export const PinIcon = (props) => (
    <IconBase {...props}>
        <path d="M12 21s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11z" />
        <circle cx="12" cy="10" r="2.5" />
    </IconBase>
);

export const RadarIcon = (props) => (
    <IconBase {...props}>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </IconBase>
);

export const BookIcon = (props) => (
    <IconBase {...props}>
        <path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3V4z" />
        <path d="M8 20V4" />
    </IconBase>
);

export const LoanIcon = (props) => (
    <IconBase {...props}>
        <path d="M8 8h8" />
        <path d="M8 12h8" />
        <path d="M8 16h8" />
        <path d="M5 8l-2 2 2 2" />
        <path d="M19 14l2 2-2 2" />
    </IconBase>
);

export const ChartIcon = (props) => (
    <IconBase {...props}>
        <path d="M4 20h16" />
        <path d="M7 20v-8" />
        <path d="M12 20v-12" />
        <path d="M17 20v-5" />
    </IconBase>
);

export const SearchIcon = (props) => (
    <IconBase {...props}>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
    </IconBase>
);

export const CloseIcon = (props) => (
    <IconBase {...props}>
        <path d="M6 6l12 12" />
        <path d="M18 6l-12 12" />
    </IconBase>
);

export const RequestIcon = (props) => (
    <IconBase {...props}>
        <path d="M8 12h8" />
        <path d="M12 8l4 4-4 4" />
        <path d="M4 7h6" />
    </IconBase>
);

export const PendingIcon = (props) => (
    <IconBase {...props}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v5" />
        <path d="M12 12l3 2" />
    </IconBase>
);

export const CheckIcon = (props) => (
    <IconBase {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12l2.7 2.7L16 9.4" />
    </IconBase>
);

export const MessageIcon = (props) => (
    <IconBase {...props}>
        <path d="M5 6h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
    </IconBase>
);

export const InboxIcon = (props) => (
    <IconBase {...props}>
        <path d="M4 14h5l2 3h2l2-3h5" />
        <path d="M5 14V6h14v8" />
        <path d="M4 14v4h16v-4" />
    </IconBase>
);

export const ImageIcon = (props) => (
    <IconBase {...props}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="10" r="1.5" />
        <path d="M21 15l-4.5-4.5L8 19" />
    </IconBase>
);

export const MapIcon = (props) => (
    <IconBase {...props}>
        <path d="M9 5l6-2 6 2v14l-6-2-6 2-6-2V3l6 2z" />
        <path d="M9 5v14" />
        <path d="M15 3v14" />
    </IconBase>
);

export const AlertIcon = (props) => (
    <IconBase {...props}>
        <path d="M12 3l10 18H2L12 3z" />
        <path d="M12 9v5" />
        <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
    </IconBase>
);

export const HomeIcon = (props) => (
    <IconBase {...props}>
        <path d="M3 11l9-7 9 7" />
        <path d="M5 10v10h14V10" />
        <path d="M10 20v-5h4v5" />
    </IconBase>
);
