import React, { useEffect } from 'react';
import { AlertIcon, CheckIcon, CloseIcon } from './UiIcons';

const Toast = ({ message, type = 'success', onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const isError = type === 'error';

    return (
        <div
            className={`toast-notification ${type}`}
            role={isError ? 'alert' : 'status'}
            aria-live={isError ? 'assertive' : 'polite'}
        >
            <div className="toast-icon" aria-hidden="true">
                {isError ? <AlertIcon tight /> : <CheckIcon tight />}
            </div>
            <div className="toast-content">
                {message}
            </div>
            <button className="toast-close" onClick={onClose} aria-label="Chiudi notifica">
                <CloseIcon tight />
            </button>
        </div>
    );
};

export default Toast;