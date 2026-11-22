import { STYLE_ATTRIBUTE } from '../constants';
import styles from './jev.css';

export function installStyles(): () => void {
  const head = document.head;
  const existing = head.querySelector(`style[${STYLE_ATTRIBUTE}]`);
  if (existing !== null) {
    return () => undefined;
  }
  const element = document.createElement('style');
  element.setAttribute(STYLE_ATTRIBUTE, '');
  element.textContent = styles;
  head.appendChild(element);
  return () => {
    element.remove();
  };
}
