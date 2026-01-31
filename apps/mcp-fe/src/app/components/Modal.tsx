import { ReactNode } from 'react';
import styles from './Modal.module.scss';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
  showFooter?: boolean;
  footerContent?: ReactNode;
}

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = '500px',
  showFooter = true,
  footerContent,
}: ModalProps) => {
  if (!isOpen) return null;

  return (
    <div className={styles['modal-overlay']} onClick={onClose}>
      <div
        className={styles['modal-content']}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth }}
      >
        <div className={styles['modal-header']}>
          <h2>{title}</h2>
          <button className={styles['modal-close']} onClick={onClose}>
            ✕
          </button>
        </div>
        <div className={styles['modal-body']}>{children}</div>
        {showFooter && (
          <div className={styles['modal-footer']}>
            {footerContent || (
              <button className="btn btn-primary" onClick={onClose}>
                Close
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
