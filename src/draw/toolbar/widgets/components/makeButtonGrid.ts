import addLongPressOrHoverCssClasses from '../../../util/addLongPressOrHoverCssClasses';
import { type ReactiveValue } from '../../../util/ReactiveValue';
import { type IconElemType } from '../../IconProvider';

interface Button {
  icon: () => IconElemType;
  label: string;
  onClick: () => void;
  onCreated?: (button: HTMLElement) => void;
  enabled?: ReactiveValue<boolean>;
}

/**
 * Creates HTML `button` elements from `buttonSpecs` and displays them in a
 * grid with `columnCount` columns.
 */
function makeButtonGrid (buttonSpecs: Button[], columnCount: number) {
  const container = document.createElement('div');
  container.classList.add('toolbar-button-grid');

  container.style.setProperty('--column-count', `${columnCount}`);

  const makeButton = (buttonSpec: Button) => {
    const buttonElement = document.createElement('button');
    buttonElement.classList.add('button');

    const iconElement = buttonSpec.icon();
    iconElement.classList.add('icon');

    const labelElement = document.createElement('label');
    labelElement.textContent = buttonSpec.label;
    labelElement.classList.add('button-label-text');

    buttonElement.addEventListener('click', buttonSpec.onClick);

    if (buttonSpec.enabled) {
      buttonSpec.enabled.onUpdateAndNow((enabled) => {
        buttonElement.disabled = !enabled;
      });
    }

    buttonElement.replaceChildren(iconElement, labelElement);
    container.appendChild(buttonElement);

    addLongPressOrHoverCssClasses(buttonElement);
    buttonSpec.onCreated?.(buttonElement);
    return buttonElement;
  };
  buttonSpecs.map(makeButton);

  return {
    container,
  };
}

export default makeButtonGrid;
