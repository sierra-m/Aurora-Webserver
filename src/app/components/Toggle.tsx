import React from "react";
import classNames from "classnames";
import "../style/toggle.css";


const getStyle = (el: Element, prop: string) => (
  parseInt(getComputedStyle(el).getPropertyValue(prop), 10)
);

const getTextNodeBoundingClientRect = (node: ChildNode | ChildNode[]) => {
  const newNode: ChildNode = Array.isArray(node) ? node[node.length - 1] : node;
  if (typeof document.createRange === 'function') {
    const range = document.createRange();
    if (range.getBoundingClientRect) {
      range.selectNodeContents(newNode);
      return range.getBoundingClientRect();
    }
  }
  return 0;
};

const compareWithMarginOfError = (num1: number, num2: number) => (
  Math.abs(num1 - num2) < 1.01
);


const getDimension = (el: Element) => {
  const margin = {width: 0, height: 0};

  const padding = {
    right: getStyle(el, 'padding-right'),
    left: getStyle(el, 'padding-left'),
    top: getStyle(el, 'padding-top'),
    bottom: getStyle(el, 'padding-bottom'),
  };

  if (el.childElementCount) {
    const child = el.children[0];
    margin.height = getStyle(child, 'margin-bottom') + getStyle(child, 'margin-top');
    margin.width = getStyle(child, 'margin-left') + getStyle(child, 'margin-right');

    return {
      width:  (child.scrollWidth || ('offsetWidth' in child && typeof child.offsetWidth === 'number' && child.offsetWidth) || 0) +
        margin.width + padding.left + padding.right,
      height: (child.scrollHeight || ('offsetHeight' in child && typeof child.offsetHeight === 'number' && child.offsetHeight) || 0) +
        margin.height + padding.top + padding.bottom,
    };
  }

  // @ts-ignore
  const range = getTextNodeBoundingClientRect(el.childNodes);

  return {
    width: (typeof range === 'number' ? 0 : range.width) + padding.right + padding.left,
    height: (typeof range === 'number' ? 0 : range.height) + padding.bottom + padding.top,
  };
};

type ToggleOnClickFunc = (toggled: boolean, event: React.MouseEvent<HTMLDivElement>) => void;

interface ToggleProps {
  style: React.CSSProperties;
  // Bootstrap variant name for "on" side
  onVariant: string;
  // Additional class name for "on" side
  onClassName: string;
  // Bootstrap variant name for "off" side
  offVariant: string;
  // Additional class name for "off" side
  offClassName: string;
  // Bootstrap variant name for toggle handle
  handleVariant: string;
  // Additional class name for toggle handle
  handleClassName: string;
  // Width to force toggle size to
  overrideWidth: string | number;
  // Height to force toggle size to
  overrideHeight: string | number;
  // Title for "on" side (defaults to "On")
  onElement: React.ReactElement<any, any>;
  // Title for "off" side (defaults to "Off")
  offElement: React.ReactElement<any, any>;
  // The initial state of the toggle
  active?: boolean;
  // Sets the toggle to be disabled
  disabled: boolean;
  // Controls the size of the toggle
  size: 'xs' | 'sm' | 'lg';
  // Returns toggled state and mouse click event
  onClick?: ToggleOnClickFunc;
  // Additional class names for component
  className: string;
  // Indicates whether the toggle should recalculate its dimensions when visibility or dimensions change
  recalculateOnResize: boolean;
  extraProps: {[key: string]: any};
}

const defaultToggleProps: ToggleProps = {
  style: {},
  onVariant: "primary",
  onClassName: '',
  offVariant: 'light',
  offClassName: '',
  handleVariant: 'light',
  handleClassName: '',
  overrideWidth: '',
  overrideHeight: '',
  onElement: <h2>On</h2>,
  offElement: <h2>Off</h2>,
  active: true,
  disabled: false,
  className: '',
  size: 'sm',
  recalculateOnResize: false,
  extraProps: {}
}

const Toggle = (props: Partial<ToggleProps> = defaultToggleProps) => {
  props = {...defaultToggleProps, ...props};

  const [width, setWidth] = React.useState<string | number>(0);

  const [height, setHeight] = React.useState<string | number>(0);

  const onElementRef = React.useRef<HTMLButtonElement | null>();

  const offElementRef = React.useRef<HTMLButtonElement | null>();

  const toggleElement = React.useRef<HTMLDivElement | null>();

  const setDimensions = () => {
    if (onElementRef.current && offElementRef.current) {
      const onDim = getDimension(onElementRef.current);
      const offDim = getDimension(offElementRef.current);
      const maxWidth = Math.max(onDim.width, offDim.width);
      const maxHeight = Math.max(onDim.height, offDim.height);

      if (typeof width === 'number' && typeof height === 'number') {
        const areAlmostTheSame = (
          compareWithMarginOfError(width, maxWidth) &&
          compareWithMarginOfError(height, maxHeight)
        );
        if ((props.overrideWidth && props.overrideHeight) || areAlmostTheSame) {
          return;
        }
      }

      setWidth(props.overrideWidth || maxWidth);
      setHeight(props.overrideHeight || maxHeight)
    }
  }

  const setOnElementRef = React.useCallback((el: HTMLButtonElement | null) => {
    onElementRef.current = el;
  }, [])

  const setOffElementRef = React.useCallback((el: HTMLButtonElement | null) => {
    offElementRef.current = el;
  }, [])

  const setToggleElementRef = React.useCallback((el: HTMLDivElement | null) => {
    toggleElement.current = el;
  }, [])

  const resizeObserver = React.useRef<ResizeObserver>(new ResizeObserver((entries:ResizeObserverEntry[]) => {
    setDimensions();
  }));

  const resizedContainerRef = React.useCallback((container: HTMLDivElement) => {
    if (container !== null && props.recalculateOnResize) {
      resizeObserver.current.observe(container);
    } else {
      if (resizeObserver.current)
        resizeObserver.current.disconnect();
    }
  }, [props.recalculateOnResize]);

  React.useEffect(() => {
    if (props.overrideWidth && props.overrideHeight) {
      return;
    }
    setDimensions();
  }, []);

  const onClick = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (props.disabled) return;
    if (typeof props.onClick === 'function') {
      props.onClick(!props.active, event);
    }
  }, [props.disabled, props.onClick, props.active]);

  const sizeClass = `btn-${props.size}`;

  const size = {
    width: width || props.overrideWidth,
    height: height || props.overrideHeight
  };

  return (
    <div ref={resizedContainerRef}>
      <div
        role="button"
        //disabled={props.disabled}
        className={classNames('btn', 'toggle', props.className, sizeClass, {
          [`off btn-${props.offVariant}`]: !props.active,
          [`btn-${props.onVariant}`]: props.active,
        })}
        onClick={onClick}
        style={Object.assign({}, size, props.style)}
        {...props.extraProps}
        ref={setToggleElementRef}
      >
        <div className="toggle-group">
          <button
            ref={setOnElementRef}
            className={classNames(
              'btn toggle-on',
              sizeClass,
              props.onClassName, {
                [`btn-${props.onVariant}`]: props.onVariant,
              })}
            disabled={props.disabled}
          >
            {props.onElement}
          </button>
          <button
            ref={setOffElementRef}
            className={classNames(
              'btn toggle-off',
              sizeClass,
              props.offClassName, {
                [`btn-${props.offVariant}`]: props.offVariant,
              })}
            disabled={props.disabled}
          >
            {props.offElement}
          </button>
          <button
            disabled={props.disabled}
            className={classNames(
              'toggle-handle btn',
              sizeClass,
              props.handleClassName, {
                [`btn-${props.handleVariant}`]: props.handleVariant,
              })}
          />
        </div>
      </div>
    </div>
  )
}

export default React.memo(Toggle);