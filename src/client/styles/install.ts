import { STYLE_ATTRIBUTE } from '../constants';
import styles from './jev.css';

export function installStyles(): () => void {
  const head = document.head;
  const existing = head.querySelector<HTMLStyleElement>(
    `style[${STYLE_ATTRIBUTE}]`,
  );
  const element = existing ?? document.createElement('style');
  element.setAttribute(STYLE_ATTRIBUTE, '');
  element.textContent = styles;
  if (existing === null) {
    head.appendChild(element);
  }
  return () => {
    element.remove();
  };
}
